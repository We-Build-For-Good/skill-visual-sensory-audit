import fs from "node:fs";
import path from "node:path";
import { findChromePath } from "./chrome-finder.mjs";
import { startLocalServer } from "./local-server.mjs";
import { SENSORY_EVAL_SCRIPTS } from "./sensory-checks.mjs";

export const DEFAULT_VIEWPORTS = [
  { name: "mobile", width: 375, height: 667, isMobile: true, deviceScaleFactor: 2 },
  { name: "tablet", width: 768, height: 1024, isMobile: false, deviceScaleFactor: 2 },
  { name: "desktop", width: 1440, height: 900, isMobile: false, deviceScaleFactor: 1 }
];

// WCAG 2.2 success criterion 2.5.8 (level AA) minimum target size.
export const DEFAULT_MIN_TOUCH_PX = 24;

/** Thrown when the audit could not run at all (no browser, missing dependency). */
export class AuditUnavailableError extends Error {}

const IGNORED_URL = /\/favicon\.ico(\?|$)/;
const RESOURCE_LOAD_CONSOLE = /^Failed to load resource:/;

async function loadPuppeteer() {
  try {
    return (await import("puppeteer-core")).default;
  } catch {
    throw new AuditUnavailableError("puppeteer-core is not installed. Run npm install in skill-visual-sensory-audit.");
  }
}

function sandboxArgs() {
  // Chrome's sandbox stays on unless it cannot work (running as root, e.g. in a container) or is explicitly disabled.
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  return isRoot || process.env.WB4G_NO_SANDBOX === "1" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];
}

export async function runVisualSensoryAudit(options = {}) {
  const target = options.target || process.cwd();
  const outputDir = path.resolve(options.outputDir || "./sensory-audit-output");
  const viewports = options.viewports || DEFAULT_VIEWPORTS;
  const captureScreenshots = options.captureScreenshots !== false;
  const timeoutMs = options.timeout || 30000;
  const minTouchPx = options.minTouchPx || DEFAULT_MIN_TOUCH_PX;

  const puppeteer = await loadPuppeteer();
  let chromePath;
  try {
    chromePath = findChromePath();
  } catch (err) {
    throw new AuditUnavailableError(err.message);
  }

  const isRemoteUrl = /^https?:\/\//i.test(target);
  let localServer = null;
  let targetUrl = target;
  if (!isRemoteUrl) {
    localServer = await startLocalServer(target, options.defaultFile || "index.html");
    targetUrl = localServer.url;
  }

  if (captureScreenshots) fs.mkdirSync(outputDir, { recursive: true });

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [...sandboxArgs(), "--disable-dev-shm-usage", "--disable-gpu"]
    });
  } catch (err) {
    if (localServer) await localServer.close();
    throw new AuditUnavailableError(`Could not start Chrome: ${err.message}`);
  }

  const report = {
    target: isRemoteUrl ? target : path.resolve(target),
    targetUrl,
    timestamp: new Date().toISOString(),
    viewportsAudited: viewports.map((v) => v.name),
    minTouchPx,
    hasFailures: false,
    errorCount: 0,
    warningCount: 0,
    documentErrors: [],
    viewportResults: {},
    consoleErrors: [],
    pageErrors: [],
    failedRequests: []
  };

  const seen = { console: new Set(), page: new Set(), request: new Set() };
  const addOnce = (kind, key, list, item) => {
    if (seen[kind].has(key)) return;
    seen[kind].add(key);
    list.push(item);
  };

  try {
    for (const vp of viewports) {
      const page = await browser.newPage();
      page.on("console", (msg) => {
        if (msg.type() !== "error" || RESOURCE_LOAD_CONSOLE.test(msg.text())) return;
        addOnce("console", msg.text(), report.consoleErrors, { text: msg.text(), location: msg.location(), viewport: vp.name });
      });
      page.on("pageerror", (err) => {
        addOnce("page", err.message, report.pageErrors, { message: err.message, stack: err.stack, viewport: vp.name });
      });
      page.on("requestfailed", (req) => {
        if (IGNORED_URL.test(req.url())) return;
        const failure = req.failure() ? req.failure().errorText : "request failed";
        if (failure === "net::ERR_ABORTED") return;
        addOnce("request", req.url(), report.failedRequests, { url: req.url(), failure, resourceType: req.resourceType() });
      });
      page.on("response", (res) => {
        if (res.status() < 400 || IGNORED_URL.test(res.url())) return;
        addOnce("request", res.url(), report.failedRequests, {
          url: res.url(),
          failure: `HTTP ${res.status()}`,
          resourceType: res.request().resourceType()
        });
      });

      await page.setViewport({
        width: vp.width,
        height: vp.height,
        isMobile: vp.isMobile || false,
        hasTouch: vp.isMobile || false,
        deviceScaleFactor: vp.deviceScaleFactor || 1
      });

      let response;
      try {
        response = await page.goto(targetUrl, { waitUntil: "load", timeout: timeoutMs });
      } catch (err) {
        report.documentErrors.push({ viewport: vp.name, message: `Page did not load: ${err.message}` });
        await page.close();
        continue;
      }
      if (!response || response.status() >= 400) {
        report.documentErrors.push({
          viewport: vp.name,
          message: `Page returned HTTP ${response ? response.status() : "no response"} for ${targetUrl}.`
        });
        await page.close();
        continue;
      }

      // Scroll through the page so lazy-loaded images load, then let the network settle.
      await page.evaluate(SENSORY_EVAL_SCRIPTS.scrollThrough);
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 5000 }).catch(() => {});

      const overflowResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectHorizontalOverflow);
      const brokenImagesResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectBrokenImages);
      const touchTargetsResult = await page.evaluate(SENSORY_EVAL_SCRIPTS.detectSmallTouchTargets, minTouchPx);

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
          message: `Horizontal overflow: page is ${overflowResult.overflowPx}px wider than the ${vp.width}px viewport.`,
          offenders: overflowResult.offenders
        });
      }
      if (brokenImagesResult.brokenCount > 0) {
        vpFailures.push({
          type: "broken-images",
          message: `${brokenImagesResult.brokenCount} broken image(s).`,
          brokenImages: brokenImagesResult.brokenImages
        });
      }
      if (vp.isMobile && touchTargetsResult.smallCount > 0) {
        vpWarnings.push({
          type: "small-touch-targets",
          message: `${touchTargetsResult.smallCount} control(s) smaller than ${minTouchPx}x${minTouchPx}px.`,
          targets: touchTargetsResult.smallTargets
        });
      }

      report.viewportResults[vp.name] = {
        viewport: vp,
        screenshot: screenshotPath,
        overflow: overflowResult,
        brokenImages: brokenImagesResult,
        touchTargets: touchTargetsResult,
        failures: vpFailures,
        warnings: vpWarnings
      };
      report.errorCount += vpFailures.length;
      report.warningCount += vpWarnings.length;
      await page.close();
    }

    report.errorCount +=
      report.documentErrors.length + report.pageErrors.length + report.consoleErrors.length + report.failedRequests.length;
    report.hasFailures = report.errorCount > 0;

    if (captureScreenshots) {
      fs.writeFileSync(path.join(outputDir, "sensory-report.json"), JSON.stringify(report, null, 2), "utf8");
    }
  } finally {
    await browser.close();
    if (localServer) await localServer.close();
  }

  return report;
}
