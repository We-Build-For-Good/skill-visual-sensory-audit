import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runVisualSensoryAudit } from "../lib/audit-runner.mjs";

const TMP_DIR = path.resolve("test/.tmp-sensory-test");

test.beforeEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TMP_DIR, { recursive: true });
});

test.afterEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
});

test("passes clean on well-formed responsive HTML", async () => {
  const htmlPath = path.join(TMP_DIR, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Clean Responsive Page</title>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; box-sizing: border-box; }
    button { min-height: 44px; min-width: 80px; padding: 10px 16px; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome</h1>
    <p>This is a disciplined, responsive layout with zero overflows.</p>
    <button type="button">Action</button>
  </div>
</body>
</html>`,
    "utf8"
  );

  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [
      { name: "mobile", width: 375, height: 667, isMobile: true },
      { name: "desktop", width: 1440, height: 900, isMobile: false },
    ],
  });

  assert.equal(report.errorCount, 0);
  assert.equal(report.hasFailures, false);
});

test("detects horizontal layout overflow and identifies offending element", async () => {
  const htmlPath = path.join(TMP_DIR, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Overflow Page</title>
  <style>
    body { margin: 0; }
    #blowout-card { width: 750px; background: red; height: 100px; }
  </style>
</head>
<body>
  <div id="blowout-card">I am too wide for mobile</div>
</body>
</html>`,
    "utf8"
  );

  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [{ name: "mobile", width: 375, height: 667, isMobile: true }],
  });

  assert.equal(report.hasFailures, true);
  const mobileRes = report.viewportResults.mobile;
  assert.ok(mobileRes.overflow.hasOverflow);
  assert.ok(mobileRes.overflow.overflowPx >= 370);
  assert.equal(mobileRes.overflow.offenders[0].id, "blowout-card");
});

test("detects broken images in rendered page", async () => {
  const htmlPath = path.join(TMP_DIR, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Broken Image Page</title>
</head>
<body>
  <img id="missing-hero" src="non-existent-image-404.png" alt="Missing Hero">
</body>
</html>`,
    "utf8"
  );

  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [{ name: "mobile", width: 375, height: 667, isMobile: true }],
  });

  assert.equal(report.hasFailures, true);
  const mobileRes = report.viewportResults.mobile;
  assert.equal(mobileRes.brokenImages.brokenCount, 1);
  assert.equal(mobileRes.brokenImages.brokenImages[0].selector, "img#missing-hero");
});

test("detects uncaught client runtime exceptions", async () => {
  const htmlPath = path.join(TMP_DIR, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Crashing Page</title>
</head>
<body>
  <script>
    throw new Error("Simulated client initialization exception");
  </script>
</body>
</html>`,
    "utf8"
  );

  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [{ name: "desktop", width: 1440, height: 900, isMobile: false }],
  });

  assert.equal(report.hasFailures, true);
  assert.ok(report.pageErrors.length >= 1);
  assert.match(report.pageErrors[0].message, /Simulated client initialization exception/);
});

test("detects small touch targets on mobile viewports", async () => {
  const htmlPath = path.join(TMP_DIR, "index.html");
  fs.writeFileSync(
    htmlPath,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tiny Target Page</title>
  <style>
    #tiny-close-button { width: 16px; height: 16px; padding: 0; display: block; }
  </style>
</head>
<body>
  <button id="tiny-close-button" type="button">x</button>
</body>
</html>`,
    "utf8"
  );

  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [{ name: "mobile", width: 375, height: 667, isMobile: true }],
  });

  const mobileRes = report.viewportResults.mobile;
  assert.equal(mobileRes.touchTargets.smallCount, 1);
  assert.equal(mobileRes.touchTargets.smallTargets[0].selector, "button#tiny-close-button");
});

// Regression tests for the 2026-10-20 catalogue review. Each one passed a broken page on 1.0.0.

const MOBILE_ONLY = [{ name: "mobile", width: 375, height: 667, isMobile: true }];
const page = (body, head = "") => `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body>${body}</body></html>`;

test("missing stylesheet and script (HTTP 404) fail the audit", async () => {
  fs.writeFileSync(path.join(TMP_DIR, "index.html"), page("<h1>Hi</h1>", '<link rel="stylesheet" href="missing.css"><script src="missing.js"></script>'));
  const report = await runVisualSensoryAudit({ target: TMP_DIR, captureScreenshots: false, viewports: MOBILE_ONLY });
  assert.equal(report.hasFailures, true);
  assert.equal(report.failedRequests.length, 2);
});

test("console.error fails the audit and is counted once, not once per viewport", async () => {
  fs.writeFileSync(path.join(TMP_DIR, "index.html"), page('<script>console.error("boom")</script>'));
  const report = await runVisualSensoryAudit({
    target: TMP_DIR,
    captureScreenshots: false,
    viewports: [MOBILE_ONLY[0], { name: "desktop", width: 1440, height: 900 }]
  });
  assert.equal(report.consoleErrors.length, 1);
  assert.equal(report.errorCount, 1);
});

test("a relative folder path is served (1.0.0 served a 403 page and passed)", async () => {
  fs.writeFileSync(path.join(TMP_DIR, "index.html"), page("<h1>Hi</h1>"));
  const report = await runVisualSensoryAudit({ target: path.relative(process.cwd(), TMP_DIR), captureScreenshots: false, viewports: MOBILE_ONLY });
  assert.equal(report.errorCount, 0);
  assert.equal(report.documentErrors.length, 0);
});

test("an entry file that does not exist fails the audit", async () => {
  fs.writeFileSync(path.join(TMP_DIR, "index.html"), page("<h1>Hi</h1>"));
  const report = await runVisualSensoryAudit({ target: TMP_DIR, defaultFile: "nothere.html", captureScreenshots: false, viewports: MOBILE_ONLY });
  assert.equal(report.hasFailures, true);
  assert.match(report.documentErrors[0].message, /HTTP 404/);
});

test("lazy-loaded broken images below the fold are found", async () => {
  fs.writeFileSync(path.join(TMP_DIR, "index.html"), page('<div style="height:3000px"></div><img id="lazy" loading="lazy" src="nope.png" width="10" height="10">'));
  const report = await runVisualSensoryAudit({ target: TMP_DIR, captureScreenshots: false, viewports: MOBILE_ONLY });
  assert.equal(report.hasFailures, true);
});
