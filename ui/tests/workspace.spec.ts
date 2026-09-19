import { test, expect, type Page } from "@playwright/test";

async function mockSession(
  page: Page,
  {
    resumable = true,
    failPhotos = false,
    failPreview = false,
    unsupported = 0,
  } = {},
) {
  let imageVersion = "source-v1";
  let photos = Array.from({ length: 24 }, (_, i) => ({
    id: `photo-${i}`,
    filename: `FRC_${String(i + 1).padStart(4, "0")}.jpg`,
    path: `/photos/card-a/FRC_${i}.jpg`,
    quality_score: 94 - i,
    destination: i < 12 ? "keep" : i < 18 ? "maybe" : "blurry",
    tier: "good",
    sharpness: 88,
    exposure: 79,
    contrast: 85,
    exif_score: 80,
    iso: 800,
    shutter_speed: 0.001,
    aperture: 2.8,
    file_size: 6400000,
    group_id: null,
    group_size: null,
    is_group_best: false,
    folder: "/photos/card-a",
  }));
  let previous = photos;
  let canUndo = false;

  const decisions: { photo_id: string; destination: string }[] = [];
  const summary = () => ({
    keep: photos.filter((p) => p.destination === "keep").length,
    maybe: photos.filter((p) => p.destination === "maybe").length,
    reject: photos.filter((p) => !["keep", "maybe"].includes(p.destination))
      .length,
    total: photos.length,
  });
  await page.route("http://127.0.0.1:9470/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data: unknown) => route.fulfill({ json: data });
    if (path === "/api/session")
      return json({
        resumable,
        input_folders: ["/photos/card-a"],
        summary: summary(),
        output_dir: "/photos/export",
        merge_mode: true,
      });
    if (path === "/api/summary") return json(summary());
    if (path === "/api/history")
      return json({ can_undo: canUndo, can_redo: false });
    if (path === "/api/folders")
      return json({
        folders: [
          { path: "/photos/card-a", name: "Card A", count: 24 },
          { path: "/photos/card-b", name: "Card B", count: 0 },
        ],
      });
    if (path === "/api/check_folders")
      return json({ jpg_count: 24, other_count: unsupported });
    if (path === "/api/analyze") {
      resumable = true;
      return json({ status: "started" });
    }
    if (path === "/api/progress")
      return route.fulfill({
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ stage: "complete", current: 24, total: 24, pct: 100, stages: {} })}\n\n`,
      });
    if (path === "/api/photos") {
      if (failPhotos)
        return route.fulfill({ status: 500, body: "unavailable" });
      let result = photos.filter(
        (p) =>
          !url.searchParams.has("category") ||
          (url.searchParams.get("category") === "reject"
            ? !["keep", "maybe"].includes(p.destination)
            : p.destination === url.searchParams.get("category")),
      );
      if (url.searchParams.has("min_score"))
        result = result.filter(
          (p) => p.quality_score >= Number(url.searchParams.get("min_score")),
        );
      if (url.searchParams.get("folder") === "/photos/card-b") result = [];
      return json({
        photos: result.map((photo) => ({
          ...photo,
          image_version: imageVersion,
        })),
        total: result.length,
        page: 1,
        limit: 200,
      });
    }
    if (path === "/api/override") {
      const body = route.request().postDataJSON();
      decisions.push(body);
      previous = photos;
      canUndo = true;
      photos = photos.map((p) =>
        p.id === body.photo_id ? { ...p, destination: body.destination } : p,
      );
      return json({ status: "ok" });
    }
    if (path === "/api/undo") {
      photos = previous;
      canUndo = false;
      return json({ status: "ok", can_undo: false, can_redo: true });
    }
    if (path === "/api/export/preview") {
      if (failPreview)
        return route.fulfill({ status: 500, body: "unavailable" });
      return json({ keep: 12, maybe: 6, blurry: 4, duplicate: 2 });
    }
    if (path === "/api/export")
      return route.fulfill({
        contentType: "text/event-stream",
        body: 'data: {"stage":"complete","pct":100,"output_dir":"/photos/export"}\n\n',
      });
    if (/\/api\/photos\/.+\/(thumbnail|preview|full)/.test(path)) {
      const i = Number(path.match(/photo-(\d+)/)?.[1] ?? 0);
      return route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="hsl(${205 + i * 9} 18% 31%)"/><path d="M0 400L180 150L290 290L450 100L640 400V480H0" fill="hsl(${205 + i * 9} 16% 19%)"/><circle cx="110" cy="95" r="34" fill="#e9b85b"/><text x="28" y="444" fill="white" font-family="sans-serif" font-size="18">Test frame ${i + 1}</text></svg>`,
      });
    }
    return json({ status: "ok" });
  });
  return {
    decisions,
    replaceImageVersion: (version: string) => {
      imageVersion = version;
    },
    recoverPhotos: () => {
      failPhotos = false;
    },
    recoverPreview: () => {
      failPreview = false;
    },
  };
}

async function resume(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your contact sheet" }),
  ).toBeVisible();
}

test("first launch is usable; folder import explains skipped files and reaches review", async ({
  page,
}) => {
  await mockSession(page, { resumable: false, unsupported: 2 });
  await page.goto("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start Culling" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Add folders", exact: true }).click();
  await page.getByLabel("Full folder path").fill("/photos/card-a");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Start Culling" }).click();
  await expect(
    page.getByText("2 unsupported files will be skipped.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analyze JPEG photos" }).click();
  await expect(
    page.getByRole("heading", { name: "Your contact sheet" }),
  ).toBeVisible();
});

test("resume, keyboard culling, auto-advance, undo and full-frame loupe", async ({
  page,
}) => {
  const { decisions } = await mockSession(page);
  await resume(page);
  await expect(page.locator(".photo-card").first()).toBeVisible();
  await page.locator(".photo-card").first().click();
  await page.keyboard.press("r");
  await expect.poll(() => decisions.length).toBe(1);
  expect(decisions[0]).toEqual({ photo_id: "photo-0", destination: "reject" });
  await page.keyboard.press("Enter");
  const loupe = page.getByRole("dialog");
  await expect(loupe).toBeVisible();
  await expect(
    loupe.getByText("FRC_0002.jpg", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(loupe).toHaveCount(0);
  await page.getByTitle("Undo (Ctrl/Cmd+Z)").click();
  await expect(
    page.getByRole("button", { name: "Keep 12", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".photo-card img").first()).toHaveCSS(
    "object-fit",
    "contain",
  );
});

test("photo loading failures and empty filters offer working recovery", async ({
  page,
}) => {
  const { recoverPhotos } = await mockSession(page, { failPhotos: true });
  await resume(page);
  await expect(page.getByText("Photos could not be loaded.")).toBeVisible();
  recoverPhotos();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".photo-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Card B 0" }).click();
  await expect(
    page.getByText("No photos match the current filters"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".photo-card").first()).toBeVisible();
});

test("refreshed source versions reach grid, inspector and loupe image URLs", async ({
  page,
}) => {
  const session = await mockSession(page);
  await resume(page);
  await expect(page.locator(".photo-card img").first()).toHaveAttribute(
    "src",
    /thumbnail\?v=source-v1$/,
  );
  session.replaceImageVersion("source-v2");
  await page.getByRole("button", { name: "Maybe 6", exact: true }).click();
  await page
    .getByRole("button", { name: "All photos 24", exact: true })
    .click();
  await expect(page.locator(".photo-card img").first()).toHaveAttribute(
    "src",
    /thumbnail\?v=source-v2$/,
  );
  await page.locator(".photo-card").first().click();
  await expect(page.locator(".photo-inspector img")).toHaveAttribute(
    "src",
    /preview\?v=source-v2$/,
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog").locator('img[src*="/preview?"]').first(),
  ).toHaveAttribute("src", /preview\?v=source-v2$/);
  await page.keyboard.press("z");
  await expect(
    page.getByRole("dialog").locator('img[src*="/full?"]'),
  ).toHaveAttribute("src", /full\?v=source-v2$/);
});

test("export groups rejection reasons, uses session destination and can retry a failed preview", async ({
  page,
}) => {
  const { recoverPreview } = await mockSession(page, { failPreview: true });
  await resume(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByText("Could not load the export summary.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Photos", exact: true }),
  ).toBeDisabled();
  recoverPreview();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("24 photos to copy")).toBeVisible();
  await expect(
    page.locator(".export-category").filter({ hasText: "Reject" }),
  ).toContainText("6");
  await expect(page.locator(".export-path")).toContainText("/photos/export");
  await page
    .getByRole("button", { name: "Export Photos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Export Complete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New session", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
});

test("shortcuts dialog traps focus and returns it to the trigger", async ({
  page,
}) => {
  await mockSession(page);
  await resume(page);
  await page.getByRole("button", { name: "Shortcuts", exact: false }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Shortcuts", exact: false }),
  ).toBeFocused();
});

for (const theme of ["dark", "light"]) {
  test(`${theme} theme supports Turkish and narrow viewports without horizontal overflow`, async ({
    page,
  }) => {
    await mockSession(page, { resumable: false });
    await page.addInitScript((theme) => {
      localStorage.setItem("fyf-theme", theme);
      localStorage.setItem("fyf-locale", "tr");
    }, theme);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Fotoğraf kaynakları" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await page.screenshot({ path: `test-results/import-${theme}-tr.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", { name: "Klasör ekle", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/import-${theme}-mobile.png` });
  });
}

test("review and export visual checkpoints in light and dark themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mockSession(page);
  await resume(page);
  await expect(page.locator(".photo-card").first()).toBeVisible();
  await expect(page.locator(".photo-card img").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: "test-results/review-dark.png" });
  await page.getByLabel("Switch color theme").click();
  await page.locator(".photo-card").first().click();
  await page.screenshot({ path: "test-results/review-light-inspector.png" });
  await page.setViewportSize({ width: 900, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .locator(".inspector-actions")
      .getByRole("button", { name: "Keep", exact: true }),
  ).toBeInViewport();
  await expect(
    page
      .locator(".inspector-actions")
      .getByRole("button", { name: "Reject", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/review-900.png" });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByText("24 photos to copy")).toBeVisible();
  await page.screenshot({ path: "test-results/export-light.png" });
  expect(errors).toEqual([]);
});

test("selected photos compare in a focused dialog without losing the selection", async ({
  page,
}) => {
  await mockSession(page);
  await resume(page);
  await page
    .getByRole("button", { name: "Select FRC_0001.jpg", exact: true })
    .click({ force: true });
  await page
    .getByRole("button", { name: "Select FRC_0002.jpg", exact: true })
    .click({ force: true });
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Compare", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").locator("img").first()).toHaveAttribute(
    "src",
    /full\?v=source-v1$/,
  );
  await page.keyboard.press("Tab");
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Select FRC_0001.jpg", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
