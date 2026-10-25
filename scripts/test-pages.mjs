import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { branchCountriesFixture } from "../tests/fixtures/branch-countries.mjs";

// Exercise the actual deployment artifact without Vite's SPA fallback masking 404s.
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const captures = fileURLToPath(new URL("../output/pages/", import.meta.url));
const port = 4181;
const origin = `http://127.0.0.1:${port}`;
const mime = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2",
  ".txt": "text/plain",
};
let prefix = "/";
const served = new Set();
const missing = new Set();
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
    const relative = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : null;
    if (relative === null) throw new Error("Outside the published path");
    const filename = path.resolve(root, relative || "index.html");
    if (!filename.startsWith(root)) throw new Error("Outside the artifact");
    const content = await fs.readFile(filename);
    served.add(pathname);
    response.writeHead(200, { "Content-Type": mime[path.extname(filename)] ?? "application/octet-stream" });
    response.end(content);
  } catch {
    missing.add(request.url);
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
});

async function checkArtifact(base) {
  for (const [file, type] of [
    ["", "text/html"], ["favicon.svg", "image/svg+xml"],
    ["data/hras-index.json", "application/json"],
    ["legal/LICENSE.txt", "text/plain"], ["legal/NOTICE.txt", "text/plain"],
  ]) {
    const response = await fetch(base + file, { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200, file || "index.html");
    assert.equal(response.headers.get("content-type")?.split(";")[0], type);
    if (file.endsWith(".json")) {
      const data = await response.json();
      assert.equal(data.format, "ynodus/hras-index-v3");
      assert.ok(data.nodes.length > 0);
      assert.ok(data.countryCodes.length > 0);
    } else {
      await response.arrayBuffer();
    }
  }
}

async function checkBrowser(browser, base, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const errors = [];
  const external = new Set();
  const workers = [];
  context.on("request", request => {
    if (!request.url().startsWith(origin)) external.add(request.url());
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("worker", worker => workers.push(worker.url()));
  try {
    // First load the real snapshot through the built Worker, without screenshots.
    await page.goto(base);
    await expect(page.locator(".empty-title")).toHaveText("Select at least one country.");
    await expect(page.locator("#export-csv")).toBeDisabled();
    await expect(page.locator("#result-body tr[data-result-role]")).toHaveCount(0);
    await page.goto(base + "?countries=RUS,SRB&presence=any");
    await expect(page.locator("#export-csv")).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    assert.ok(await page.locator("#result-body tr[data-result-role]").count());

    // Interaction and visual evidence use invented branches and aggregate counts.
    await context.route("**/data/hras-index.json", route => route.fulfill({ json: branchCountriesFixture() }));
    const query = "?countries=RUS,POL,FRA&presence=any&target=5500&window=0&min=0";
    await page.goto(base + query);
    const row = page.locator('#result-body tr[data-result-role]').first();
    await expect(row.locator(".table-branch-identity")).toHaveText("R-SYN-ROOT");
    await expect(row.locator(".table-total strong")).toHaveText("20");
    const countryButton = row.locator("[data-result-countries]");
    for (const locale of ["en", "ru"]) {
      await page.locator("#locale-switcher").selectOption(locale);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(countryButton).toHaveText(locale === "ru" ? "О странах" : "Countries");
      await countryButton.click();
      const dialog = page.locator("#result-countries-dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".result-country-item")).toHaveCount(3);
      await dialog.screenshot({ path: path.join(captures, `${prefix === "/" ? "root" : "project"}-${width}-${locale}-countries.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator("#export-csv")).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.screenshot({ path: path.join(captures, `${prefix === "/" ? "root" : "project"}-${width}-ru.png`) });

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-csv").click();
    const download = await downloadPromise;
    assert.equal(await download.failure(), null);
    assert.match(await fs.readFile(await download.path(), "utf8"), /R-SYN-ROOT/);

    await row.locator("[data-open-result-detail]").click();
    await expect(page.locator("#profile-workspace")).toBeVisible();
    assert.equal(new URL(page.url()).pathname, new URL(base).pathname);
    await page.reload();
    await expect(page.locator("#profile-content")).toContainText("R-SYN-ROOT");
    await page.locator('#profile-workspace [data-research-back]').click();
    await expect(row.locator(".table-total strong")).toHaveText("20");

    await page.goto(base + "?view=profile&clade=R-SYN-ROOT");
    await expect(page.locator("[data-profile-scope-total]")).toHaveText("20");
    await page.reload();
    await expect(page.locator("[data-profile-scope-total]")).toHaveText("20");
    await page.goto(base + "?view=country-overview&country=RUS");
    await expect(page.locator("#country-overview-content h3").first()).toContainText("RUS");
    await page.reload();
    await expect(page.locator("#country-overview-content h3").first()).toContainText("RUS");
    assert.equal(new URL(page.url()).pathname, new URL(base).pathname);
    assert.ok(workers.length >= 1);
    assert.ok(workers.every(url => url.startsWith(base + "assets/")));
    assert.deepEqual(errors, []);
    assert.deepEqual([...external], []);
    console.log(`PASS ${new URL(base).pathname} at ${width}px: real data/Worker, EN/RU, countries, CSV, direct links/reloads`);
  } finally {
    await context.close();
  }
}

let browser;
try {
  await fs.access(path.join(root, "index.html"));
  await fs.mkdir(captures, { recursive: true });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  assert.equal(server.address().port, port);
  const ready = await fetch(origin, { signal: AbortSignal.timeout(5_000) });
  assert.equal(ready.status, 200);
  await ready.arrayBuffer();
  console.log(`Static hosting ready: PID ${process.pid}, ${origin}`);
  browser = await chromium.launch();
  for (prefix of ["/", "/ynodus/"]) {
    served.clear(); missing.clear();
    const base = origin + prefix;
    await checkArtifact(base);
    for (const width of [1440, 390]) await checkBrowser(browser, base, width);
    assert.deepEqual([...missing], [], "Every requested file must exist at the published path");
    assert.ok([...served].some(url => url.endsWith(".css")), "Stylesheet was requested");
    assert.ok([...served].some(url => /assets\/.*\.svg$/.test(url)), "Flag assets were requested");
    assert.ok([...served].some(url => url.endsWith(".woff2")), "Local fonts were requested");
  }
  console.log("GitHub Pages deployment smoke passed.");
} finally {
  try {
    await browser?.close();
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
    }
    assert.equal(server.listening, false);
    console.log(`Static hosting listener ${port} closed.`);
  }
}
