import { noticeVersion, appVersion } from "./helpers/notice";
import { test, expect, type Page } from "@playwright/test";

async function start(page: Page, record?: unknown) {
  let backendRequests = 0;
  await page.addInitScript(
    ({ record }) => {
      localStorage.setItem("fyf-locale", "en");
      if (record !== undefined)
        localStorage.setItem("fyf-use-notice", JSON.stringify(record));
    },
    { record },
  );
  await page.route("http://127.0.0.1:9470/**", (route) => {
    backendRequests++;
    return route.fulfill({ json: { resumable: false } });
  });
  await page.goto("/");
  return () => backendRequests;
}

async function accept(page: Page) {
  await page.getByRole("checkbox", { name: /I have read/ }).check();
  await page
    .getByRole("button", { name: "Accept and continue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add folders", exact: true }),
  ).toBeVisible();
}

test("first launch requires an explicit acknowledgment before any workspace requests", async ({
  page,
}) => {
  const requests = await start(page);
  const dialog = page.getByRole("dialog", {
    name: "Before your first selection",
  });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /I have read/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Accept and continue", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(requests()).toBe(0);
  await expect(
    page.getByRole("button", { name: "Add folders", exact: true }),
  ).toHaveCount(0);
  await accept(page);
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fyf-use-notice")!),
  );
  expect(record).toMatchObject({
    version: noticeVersion,
    locale: "en",
    appVersion,
  });
  expect(Number.isNaN(Date.parse(record.acceptedAt))).toBe(false);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a previous notice version asks again and switching language resets the checkbox", async ({
  page,
}) => {
  await start(page, {
    version: "2026-01-01.1",
    acceptedAt: new Date().toISOString(),
    locale: "en",
    appVersion: "0.2.2",
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("checkbox", { name: /I have read/ }).check();
  await page.getByRole("button", { name: "Türkçe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "İlk seçiminizden önce" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Okudum/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Kabul et ve devam et" }),
  ).toBeDisabled();
});

test("the full notice remains available after acceptance without changing the receipt", async ({
  page,
}) => {
  await start(page);
  await accept(page);
  const before = await page.evaluate(() =>
    localStorage.getItem("fyf-use-notice"),
  );
  await page
    .getByRole("button", { name: "Privacy & terms", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Updates and external connections",
  );
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Privacy & terms", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => localStorage.getItem("fyf-use-notice")),
  ).toBe(before);
});

test("storage failure never silently accepts and offers a retry", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "fyf-use-notice") throw new Error("Storage unavailable");
      return original.call(this, key, value);
    };
  });
  await start(page);
  await page.getByRole("checkbox", { name: /I have read/ }).check();
  await page
    .getByRole("button", { name: "Accept and continue", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not save");
  await expect(
    page.getByRole("button", { name: "Add folders", exact: true }),
  ).toHaveCount(0);
});

test("declining in the browser keeps the workspace closed and can return to the notice", async ({
  page,
}) => {
  const requests = await start(page);
  await page
    .getByRole("button", { name: "Decline and close", exact: true })
    .click();
  await expect(
    page.getByText("You can close this tab.", { exact: true }),
  ).toBeVisible();
  expect(requests()).toBe(0);
  expect(
    await page.evaluate(() => localStorage.getItem("fyf-use-notice")),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Read the notice", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: /I have read/ }),
  ).not.toBeChecked();
});

test("Mac close errors keep the gate closed and native update checks wait for acceptance", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__nativeCalls = [];
    (window as any).isTauri = true;
    (window as any).__TAURI_INTERNALS__ = {
      metadata: {
        currentWindow: { label: "main" },
        currentWebview: { label: "main" },
      },
      invoke: async (command: string) => {
        (window as any).__nativeCalls.push(command);
        if (command === "get_backend_port") return 9470;
        if (command === "plugin:window|close") throw new Error("Close failed");
        return null;
      },
    };
  });
  await start(page);
  expect(
    await page.evaluate(() =>
      (window as any).__nativeCalls.includes("plugin:updater|check"),
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Decline and close", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("could not close");
  await expect(
    page.getByRole("button", { name: "Add folders", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Read the notice", exact: true })
    .click();
  await accept(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__nativeCalls.includes("plugin:updater|check"),
      ),
    )
    .toBe(true);
});

test("malformed current-version receipts do not unlock the workspace", async ({
  page,
}) => {
  await start(page, {
    version: noticeVersion,
    acceptedAt: "invalid",
    locale: "en",
    appVersion,
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add folders", exact: true }),
  ).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  test(`notice is readable at the minimum desktop size and narrow widths in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("fyf-theme", theme),
      theme,
    );
    await page.setViewportSize({ width: 1000, height: 760 });
    await start(page);
    await page.getByRole("button", { name: "Türkçe", exact: true }).click();
    await page.screenshot({ path: `/private/tmp/fyf-notice-${theme}-tr.png` });
    for (const size of [
      { width: 900, height: 600 },
      { width: 390, height: 720 },
    ]) {
      await page.setViewportSize(size);
      const acceptButton = page.getByRole("button", {
        name: "Kabul et ve devam et",
        exact: true,
      });
      await expect(acceptButton).toBeInViewport();
      const region = page.getByRole("region", {
        name: "Çalışma biçimi ve kullanım koşulları",
      });
      await region.focus();
      await page.keyboard.press("End");
      await expect
        .poll(() => region.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (!(await page.locator("details").evaluate((el) => el.open))) {
        await page.getByText("MIT Lisansını oku", { exact: true }).click();
      }
      await expect(
        page.getByText("MIT License", { exact: false }).last(),
      ).toBeVisible();
      await page.keyboard.press("Tab");
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
  });
}
