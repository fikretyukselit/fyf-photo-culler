import { test, expect, type Page } from "@playwright/test";

async function updaterSession(
  page: Page,
  failure: "download" | "restart" | "none",
) {
  await page.addInitScript(
    ({ failure }) => {
      localStorage.setItem("fyf-locale", "en");
      const calls = { downloads: 0, restarts: 0, checks: 0 };
      (window as any).__updateCalls = calls;
      (window as any).isTauri = true;
      (window as any).__TAURI_INTERNALS__ = {
        metadata: {
          currentWindow: { label: "main" },
          currentWebview: { label: "main" },
        },
        transformCallback: () => 1,
        unregisterCallback: () => {},
        invoke: async (command: string, args: any) => {
          if (command === "get_backend_port") return 9470;
          if (command === "plugin:updater|check") {
            calls.checks++;
            return {
              rid: calls.checks,
              currentVersion: "0.2.1",
              version: "0.2.2",
              body: "Fix updates",
              rawJson: {},
            };
          }
          if (command === "plugin:updater|download_and_install") {
            calls.downloads++;
            args.onEvent.onmessage({ event: "Started", data: {} });
            if (failure === "download" && calls.downloads === 1)
              throw new Error("Download failed: HTTP 404");
            args.onEvent.onmessage({
              event: "Progress",
              data: { chunkLength: 100 },
            });
            args.onEvent.onmessage({ event: "Finished" });
            return;
          }
          if (command === "plugin:process|restart") {
            calls.restarts++;
            if (failure === "restart" && calls.restarts === 1)
              throw new Error("Restart permission denied");
            return;
          }
          return null;
        },
      };
    },
    { failure },
  );
  await page.route("http://127.0.0.1:9470/**", (route) =>
    route.fulfill({ json: { resumable: false } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Update Now", exact: true }),
  ).toBeVisible();
}

test("failed update shows the error and retries without silently returning to the offer", async ({
  page,
}) => {
  await updaterSession(page, "download");
  await page.getByRole("button", { name: "Update Now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("HTTP 404");
  await expect(
    page.getByRole("button", { name: "Retry update", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry update", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__updateCalls.restarts))
    .toBe(1);
  await expect(
    page.getByRole("button", { name: "Update Now", exact: true }),
  ).toHaveCount(0);
});

test("restart failure keeps the installed state and never downloads the same update again", async ({
  page,
}) => {
  await updaterSession(page, "restart");
  await page.getByRole("button", { name: "Update Now", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Restart permission denied",
  );
  await expect(
    page.getByText(
      "The update is installed. Close and reopen the app, or retry restarting.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart app", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__updateCalls.restarts))
    .toBe(2);
  expect(
    await page.evaluate(() => (window as any).__updateCalls.downloads),
  ).toBe(1);
});

test("successful update requests restart once and keeps an explicit installed state", async ({
  page,
}) => {
  await updaterSession(page, "none");
  await page.getByRole("button", { name: "Update Now", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__updateCalls.restarts))
    .toBe(1);
  await expect(page.getByRole("dialog")).toContainText("Update installed");
  await expect(
    page.getByRole("button", { name: "Update Now", exact: true }),
  ).toHaveCount(0);
});
