import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { findChromePath } from "./chrome-finder.mjs";
import { startLocalServer } from "./local-server.mjs";
import { SENSORY_EVAL_SCRIPTS } from "./sensory-checks.mjs";

export const DEFAULT_VIEWPORTS = [
  { name: "mobile", width: 375, height: 667, isMobile: true, deviceScaleFactor: 2 },
  { name: "tablet", width: 768, height: 1024, isMobile: false, deviceScaleFactor: 2 },
  { name: "desktop", width: 1440, height: 900, isMobile: false, deviceScaleFactor: 1 },
];

export async function runVisualSensoryAudit(options = {}) {
  const target = options.target || process.cwd();
  const outputDir = path.resolve(options.outputDir || "./sensory-audit-output");
  const viewports = options.viewports || DEFAULT_VIEWPORTS;
  const captureScreenshots = options.captureScreenshots !== false;
  const timeoutMs = options.timeout || 30000;

  if (captureScreenshots && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const isRemoteUrl = /^https?:\/\//i.test(target);
  let localServer = null;
  let targetUrl = target;

  if (!isRemoteUrl) {
    localServer = await startLocalServer(target, options.defaultFile || "index.html");
    targetUrl = localServer.url;
  }

  const chromePath = findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const report = {
    target: isRemoteUrl ? target : path.resolve(target),
    targetUrl,
    timestamp: new Date().toISOString(),
    viewportsAudited: viewports.map((v) => v.name),
    hasFailures: false,
    errorCount: 0,
    warningCount: 0,
    viewportResults: {},
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  try {
    const page = await browser.newPage();

    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        report.consoleErrors.push({
          type: "console.error",
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Listen for uncaught exceptions
    page.on("pageerror", (err) => {
      report.pageErrors.push({
        type: "pageerror",
        message: err.message,
        stack: err.stack,
      });
    });

    // Listen for failed network requests
    page.on("requestfailed", (req) => {
      report.failedRequests.push({
        url: req.url(),
        failure: req.failure() ? req.failure().errorText : "Unknown error",
        resourceType: req.resourceType(),
      });
    });

    for (const vp of viewports) {
      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile || false,
        deviceScaleFactor: vp.deviceScaleFactor || 1,
      });

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      // Brief settling pause for layout reflows and fonts
      await new Promise((r) => setTimeout(r, 400));

      // Run sensory evaluation scripts in page context
      const overflowResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectHorizontalOverflow);
      const brokenImagesResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectBrokenImages);
      const touchTargetsResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectSmallTouchTargets);

      let screenshotPath = null;
      if (captureScreenshots) {
        screenshotPath = path.join(outputDir, `${vp.name}-${vp.width}x${vp.height}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }

      const vpFailures = [];
      const vpWarnings = [];

      if (overflowResult.hasOverflow) {
        vpFailures.push({
          type: "horizontal-overflow",
          message: `Horizontal layout blowout detected (${overflowResult.overflowPx}px wider than viewport ${vp.width}px).`,
          offenders: overflowResult.offenders,
        });
      }

      if (brokenImagesResult.brokenCount > 0) {
        vpFailures.push({
          type: "broken-images",
          message: `${brokenImagesResult.brokenCount} broken image(s) detected.`,
          brokenImages: brokenImagesResult.brokenImages,
        });
      }

      if (vp.isMobile && touchTargetsResult.smallCount > 0) {
        vpWarnings.push({
          type: "small-touch-targets",
          message: `${touchTargetsResult.smallCount} interactive control(s) smaller than 36px touch boundary.`,
          targets: touchTargetsResult.smallTargets,
        });
      }

      report.viewportResults[vp.name] = {
        viewport: vp,
        screenshot: screenshotPath,
        overflow: overflowResult,
        brokenImages: brokenImagesResult,
        touchTargets: touchTargetsResult,
        failures: vpFailures,
        warnings: vpWarnings,
      };

      report.errorCount += vpFailures.length;
      report.warningCount += vpWarnings.length;
    }

    report.errorCount += report.pageErrors.length;
    report.hasFailures = report.errorCount > 0;

    if (captureScreenshots) {
      const reportFile = path.join(outputDir, "sensory-report.json");
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf8");
    }

    await page.close();
  } finally {
    await browser.close();
    if (localServer) {
      await localServer.close();
    }
  }

  return report;
}
