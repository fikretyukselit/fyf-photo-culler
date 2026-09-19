/** Record the real UI with calculated scores and isolated, in-memory decisions.
 * Usage: node scripts/capture-demo.mjs /tmp/fyf-demo/dataset.json
 * Requires the Vite dev server and a prior read-only dataset audit.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dataFile = path.resolve(process.argv[2] ?? "/tmp/fyf-demo/dataset.json");
const data = JSON.parse(await fs.readFile(dataFile, "utf8"));
const cache = path.join(path.dirname(dataFile), "cache");
const framesDir = path.join(path.dirname(dataFile), "frames");
const docsDir = path.join(repo, "docs/demo");
await fs.mkdir(framesDir, { recursive: true });
await fs.mkdir(docsDir, { recursive: true });
const groups = data.groups;
const byPath = new Map();
let photos = Object.entries(data.analyses).map(([original, a], i) => {
  const group = groups.find((g) => g.members.includes(original));
  const id = `demo-${i}`;
  byPath.set(original, id);
  return {
    id,
    original,
    filename: path.basename(original),
    path: `/FRC event/Camera A/${path.basename(original)}`,
    folder: "/FRC event/Camera A",
    destination: data.destinations[original],
    tier: a.tier,
    quality_score: a.quality_score,
    sharpness: Math.max(0, Math.min(100, a.sharpness_raw / 5)),
    focus_uncertain: a.focus_uncertain ?? false,
    exposure: a.exposure,
    contrast: a.contrast,
    exif_score: a.exif_score,
    iso: a.iso,
    shutter_speed: a.shutter_speed,
    aperture: a.aperture,
    file_size: a.file_size,
    group_id: group?.id ?? null,
    group_size: group?.members.length ?? null,
    is_group_best: group?.best === original,
  };
});
let resumable = false;
let history = [];
const category = (p) =>
  ["keep", "maybe"].includes(p.destination) ? p.destination : "reject";
const summary = () =>
  photos.reduce(
    (s, p) => {
      s[category(p)]++;
      s.total++;
      return s;
    },
    { keep: 0, maybe: 0, reject: 0, total: 0 },
  );
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  localStorage.setItem("fyf-theme", "dark");
  localStorage.setItem("fyf-locale", "en");
  localStorage.setItem("fyf-density", "m");
});
await page.route("http://127.0.0.1:9470/**", async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    endpoint = url.pathname;
  const json = (value) => route.fulfill({ json: value });
  if (endpoint === "/api/session")
    return json({
      resumable,
      input_folders: ["/FRC event/Camera A"],
      output_dir: "/FRC event/Selected",
      merge_mode: true,
      summary: summary(),
    });
  if (endpoint === "/api/check_folders")
    return json({ jpg_count: photos.length, other_count: 0 });
  if (endpoint === "/api/analyze") {
    resumable = true;
    return json({ status: "started" });
  }
  if (endpoint === "/api/progress") {
    await new Promise((r) => setTimeout(r, 700));
    return route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({ stage: "complete", current: photos.length, total: photos.length, pct: 100, stages: {} })}\n\n`,
    });
  }
  if (endpoint === "/api/summary") return json(summary());
  if (endpoint === "/api/history")
    return json({ can_undo: history.length > 0, can_redo: false });
  if (endpoint === "/api/folders")
    return json({
      folders: [
        { name: "Camera A", path: "/FRC event/Camera A", count: photos.length },
      ],
    });
  if (endpoint === "/api/photos") {
    let result = photos.filter(
      (p) =>
        !url.searchParams.has("category") ||
        category(p) === url.searchParams.get("category"),
    );
    result = result.toSorted((a, b) =>
      url.searchParams.get("sort") === "filename"
        ? a.filename.localeCompare(b.filename)
        : b.quality_score - a.quality_score ||
          a.filename.localeCompare(b.filename),
    );
    const n = Number(url.searchParams.get("page") ?? 1),
      limit = Number(url.searchParams.get("limit") ?? 200);
    return json({
      photos: result.slice((n - 1) * limit, n * limit),
      total: result.length,
      page: n,
      limit,
    });
  }
  if (endpoint === "/api/override" || endpoint === "/api/override/batch") {
    const body = req.postDataJSON(),
      ids = body.photo_ids ?? [body.photo_id];
    history.push(structuredClone(photos));
    photos = photos.map((p) =>
      ids.includes(p.id) ? { ...p, destination: body.destination } : p,
    );
    return json({ status: "ok" });
  }
  if (endpoint === "/api/undo") {
    photos = history.pop() ?? photos;
    return json({
      status: "ok",
      can_undo: history.length > 0,
      can_redo: false,
    });
  }
  if (endpoint.startsWith("/api/groups/")) {
    const g = groups.find((g) => g.id === endpoint.split("/").pop());
    return json({
      ...g,
      best: byPath.get(g.best),
      members: g.members.map((original) =>
        photos.find((p) => p.original === original),
      ),
    });
  }
  if (endpoint === "/api/export/preview")
    return json(
      photos.reduce((s, p) => {
        s[p.destination] = (s[p.destination] ?? 0) + 1;
        return s;
      }, {}),
    );
  if (endpoint === "/api/export")
    return route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"stage":"complete","pct":100,"output_dir":"/FRC event/Selected"}\n\n',
    });
  const match = endpoint.match(
    /^\/api\/photos\/([^/]+)\/(thumbnail|preview|full)$/,
  );
  if (match) {
    const p = photos.find((p) => p.id === match[1]);
    const hash = createHash("md5").update(p.original).digest("hex");
    const derivative =
      data.derivatives?.[p.original]?.[
        match[2] === "thumbnail" ? "thumbnail" : "preview"
      ];
    return route.fulfill({
      contentType: "image/jpeg",
      body: await fs.readFile(
        path.join(
          cache,
          derivative ??
            `${hash}${match[2] === "thumbnail" ? "" : ".preview"}.jpg`,
        ),
      ),
    });
  }
  return json({ status: "ok" });
});
const frames = [],
  chapters = [];
await page.goto("http://127.0.0.1:1420");
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({
  content: `
 #root>div{height:calc(100vh - 88px)!important}
 [role=dialog]{bottom:88px!important}
 #demo-caption{position:fixed;bottom:0;left:0;right:0;height:88px;z-index:1000;background:#202327;border-top:1px solid #3a3f47;display:flex;align-items:center;gap:18px;padding:0 30px;color:#eef0f2;font-family:'Inter Variable',sans-serif;pointer-events:none}
 #demo-step{height:34px;width:34px;border-radius:50%;background:#e9b85b;color:#29200f;display:grid;place-items:center;font-size:14px;font-weight:650}
 #demo-caption strong{display:block;font-size:16px;font-weight:600;letter-spacing:-.02em}
 #demo-caption p{margin:6px 0 0;color:#a5abb4;font-size:12px}
 #demo-keys{margin-left:auto;font-size:12px;color:#e9b85b;padding:8px 12px;border:1px solid #4c4538;border-radius:7px}
 #demo-cursor{position:fixed;z-index:1001;pointer-events:none;width:24px;height:24px;border:2px solid #e9b85b;border-radius:50%;box-shadow:0 0 0 5px #e9b85b20;transform:translate(-50%,-50%);display:none}
`,
});
await page.evaluate(() => {
  const el = document.createElement("div");
  el.id = "demo-caption";
  el.innerHTML =
    '<span id="demo-step"></span><div><strong id="demo-title"></strong><p id="demo-description"></p></div><span id="demo-keys"></span>';
  document.body.append(el);
  const cursor = document.createElement("div");
  cursor.id = "demo-cursor";
  document.body.append(cursor);
});
async function capture({
  step,
  title,
  description,
  keys = "",
  duration = 2,
  chapter = null,
}) {
  await page.evaluate(
    ({ step, title, description, keys }) => {
      document.querySelector("#demo-step").textContent = step;
      document.querySelector("#demo-title").textContent = title;
      document.querySelector("#demo-description").textContent = description;
      document.querySelector("#demo-keys").textContent = keys;
      document.querySelector("#demo-keys").style.display = keys
        ? "block"
        : "none";
    },
    { step, title, description, keys },
  );
  await page.waitForTimeout(240);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images]
        .filter((i) => i.getBoundingClientRect().top < innerHeight)
        .map((i) => i.decode().catch(() => {})),
    );
  });
  const filename = `frame-${String(frames.length).padStart(3, "0")}.png`;
  await page.screenshot({ path: path.join(framesDir, filename) });
  frames.push({ filename, duration });
  if (chapter) {
    const jpg = `${chapter}.jpg`;
    await page.screenshot({
      path: path.join(docsDir, jpg),
      type: "jpeg",
      quality: 86,
    });
    chapters.push({ id: chapter, step, title, description, keys, image: jpg });
  }
}
async function point(locator) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  await page.evaluate(
    ({ x, y }) => {
      const el = document.querySelector("#demo-cursor");
      el.style.display = "block";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
}
async function unpoint() {
  await page.evaluate(
    () => (document.querySelector("#demo-cursor").style.display = "none"),
  );
}
try {
  await capture({
    step: 1,
    title: "Bring your competition day together",
    description: "Add camera cards. Your originals stay in place.",
    duration: 2.5,
    chapter: "01-import",
  });
  await page.getByRole("button", { name: "Add folders", exact: true }).click();
  await page.getByLabel("Full folder path").fill("/FRC event/Camera A");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await point(page.getByRole("button", { name: "Start Culling" }));
  await capture({
    step: 1,
    title: "Start with your photo folders",
    description: `${data.total} real competition photos. Analysis checks quality and similar frames.`,
    duration: 2.2,
  });
  await page.getByRole("button", { name: "Start Culling" }).click();
  await unpoint();
  await page.getByRole("heading", { name: "Your contact sheet" }).waitFor();
  await page.locator(".photo-card").first().waitFor();
  await capture({
    step: 2,
    title: "See the whole selection",
    description:
      "Review suggested categories, scores and groups. The final decision is yours.",
    duration: 3,
    chapter: "02-review",
  });
  // Keep a clean, full-size screenshot without editorial tutorial captions.
  await page.evaluate(() => {
    document.querySelector("#demo-caption").style.display = "none";
    document
      .querySelector("#root>div")
      .style.setProperty("height", "100vh", "important");
  });
  await page.waitForTimeout(350);
  await page.screenshot({
    path: path.join(repo, "docs/screenshot-review.png"),
  });
  await page.evaluate(() => {
    document.querySelector("#demo-caption").style.display = "flex";
    document.querySelector("#root>div").style.removeProperty("height");
  });
  await page.locator(".photo-card").first().click();
  await capture({
    step: 2,
    title: "Inspect the details",
    description:
      "Read focus, exposure and camera settings. Keep, Maybe and Reject stay within reach.",
    keys: "K  Keep    M  Maybe    R  Reject",
    duration: 2.5,
    chapter: "03-inspect",
  });
  await page.keyboard.press("Enter");
  await capture({
    step: 2,
    title: "Give each frame room",
    description:
      "Open the large view to inspect framing, then move between photos with the arrow keys.",
    keys: "Enter  Enlarge    ← →  Navigate",
    duration: 2.5,
    chapter: "04-loupe",
  });
  await page.keyboard.press("m");
  await capture({
    step: 2,
    title: "One key. Next frame.",
    description:
      "M marks the current frame as Maybe and advances to the next photograph.",
    keys: "M  Maybe",
    duration: 2,
  });
  await page.keyboard.press("Escape");
  await page
    .locator(".photo-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  // Use a real multi-member group, when available, for the comparison.
  const groupBadge = page.locator(".photo-card button[title]").first();
  if (await groupBadge.count()) {
    await groupBadge.click();
    await page.getByRole("dialog", { name: "Photo Group" }).waitFor();
    await page
      .getByRole("dialog", { name: "Photo Group" })
      .getByRole("button", { name: "Compare", exact: true })
      .click();
  } else {
    await page
      .getByRole("button", { name: /^Select .*\.JPG$/ })
      .nth(0)
      .click({ force: true });
    await page
      .getByRole("button", { name: /^Select .*\.JPG$/ })
      .nth(1)
      .click({ force: true });
    await page.getByRole("button", { name: "Compare", exact: true }).click();
  }
  await capture({
    step: 3,
    title: "Compare before you decide",
    description:
      "Put similar frames side by side. Look at the subject, not just the score.",
    keys: "C  Compare    Esc  Return",
    duration: 3.5,
    chapter: "05-compare",
  });
  await page.keyboard.press("Escape");
  if (await page.getByRole("dialog", { name: "Photo Group" }).count())
    await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByText(/photos to copy/).waitFor();
  await capture({
    step: 4,
    title: "Check the destination and totals",
    description:
      "All categories are copied into organized folders. Originals are never moved or deleted.",
    duration: 3,
    chapter: "06-export",
  });
  await point(page.getByRole("button", { name: "Export Photos", exact: true }));
  await page
    .getByRole("button", { name: "Export Photos", exact: true })
    .click();
  await unpoint();
  await page.getByRole("heading", { name: "Export Complete" }).waitFor();
  await capture({
    step: 4,
    title: "Your selection, ready for the next step",
    description: "Open the organized folder or return to your saved review.",
    duration: 3,
    chapter: "07-complete",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  await fs.writeFile(
    path.join(framesDir, "frames.txt"),
    frames
      .map((f) => `file '${f.filename}'\nduration ${f.duration}\n`)
      .join("") + `file '${frames.at(-1).filename}'\n`,
  );
  await fs.writeFile(
    path.join(docsDir, "chapters.json"),
    JSON.stringify(chapters, null, 2),
  );
  console.log(
    JSON.stringify({
      frames: frames.length,
      chapters: chapters.length,
      duration: frames.reduce((s, f) => s + f.duration, 0),
      output: docsDir,
    }),
  );
} finally {
  await browser.close();
}
