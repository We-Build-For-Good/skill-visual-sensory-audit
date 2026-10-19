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
