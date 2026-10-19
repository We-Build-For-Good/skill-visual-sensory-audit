#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { runVisualSensoryAudit, DEFAULT_VIEWPORTS } from "../lib/audit-runner.mjs";

function printHelp() {
  console.log(`
We Build for Good: Visual Sensory Audit Engine (wb4g-visual-audit)

Usage:
  wb4g-visual-audit [target] [options]
  node visual-audit.mjs [target] [options]

Target:
  Local directory, HTML file path, or remote URL (e.g. https://webuildforgood.com/departure-alarm/).
  Defaults to current working directory.

Options:
  --dir <path>          Target directory to audit (default: current directory)
  --file <name>         Default HTML file to load (default: index.html)
  --output-dir <path>   Output directory for screenshots and report (default: ./sensory-audit-output)
  --no-screenshots      Skip saving PNG screenshots
  --strict              Treat touch target and layout warnings as fatal errors
  --json                Output results as JSON
  --help                Display this documentation
`);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const options = {
  target: null,
  defaultFile: "index.html",
  outputDir: "./sensory-audit-output",
  captureScreenshots: true,
  strict: false,
  json: false,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--dir" && args[i + 1]) {
    options.target = args[++i];
  } else if (arg === "--file" && args[i + 1]) {
    options.defaultFile = args[++i];
  } else if (arg === "--output-dir" && args[i + 1]) {
    options.outputDir = args[++i];
  } else if (arg === "--no-screenshots") {
    options.captureScreenshots = false;
  } else if (arg === "--strict") {
    options.strict = true;
  } else if (arg === "--json") {
    options.json = true;
  } else if (!arg.startsWith("--") && !options.target) {
    options.target = arg;
  }
}

if (!options.target) {
  options.target = process.cwd();
}

async function main() {
  try {
    const report = await runVisualSensoryAudit(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      const hasFail = options.strict
        ? report.errorCount > 0 || report.warningCount > 0
        : report.errorCount > 0;
      process.exit(hasFail ? 1 : 0);
    }

    const separator = "=".repeat(59);
    console.log(separator);
    console.log(" We Build for Good: Visual Sensory Audit");
    console.log(` Target               : ${report.target}`);
    console.log(` Resolved URL         : ${report.targetUrl}`);
    console.log(` Viewports Audited    : ${report.viewportsAudited.join(", ")}`);
    console.log(` Total Errors         : ${report.errorCount}`);
    console.log(` Total Warnings       : ${report.warningCount}`);
    if (options.captureScreenshots) {
      console.log(` Output Directory     : ${path.resolve(options.outputDir)}`);
    }
    console.log(separator);
    console.log("");

    for (const [vpName, vpData] of Object.entries(report.viewportResults)) {
      for (const failure of vpData.failures) {
        console.log(`[ERROR] [${vpName}] ${failure.message}`);
        if (failure.offenders) {
          for (const off of failure.offenders) {
            console.log(`        Offender: ${off.selector} (+${off.overflowPx}px beyond viewport edge)`);
          }
        }
        if (failure.brokenImages) {
          for (const img of failure.brokenImages) {
            console.log(`        Broken Image: ${img.src} (${img.selector})`);
          }
        }
      }

      for (const warning of vpData.warnings) {
        console.log(`[WARN ] [${vpName}] ${warning.message}`);
        if (warning.targets) {
          for (const t of warning.targets.slice(0, 3)) {
            console.log(`        Target: ${t.selector} "${t.text}" (${t.width}x${t.height}px)`);
          }
        }
      }
    }

    for (const pe of report.pageErrors) {
      console.log(`[ERROR] [runtime] Uncaught exception: ${pe.message}`);
    }

    for (const ce of report.consoleErrors) {
      console.log(`[ERROR] [console] ${ce.text}`);
    }

    console.log("");
    const isFailed = options.strict
      ? report.errorCount > 0 || report.warningCount > 0
      : report.errorCount > 0;

    if (isFailed) {
      console.log("Sensory audit failed. Visual or runtime defects detected.");
      process.exit(1);
    } else {
      if (report.warningCount > 0) {
        console.log("Sensory audit passed with warnings.");
      } else {
        console.log("Sensory audit passed clean. All viewports rendered properly.");
      }
      process.exit(0);
    }
  } catch (err) {
    console.error("Fatal error during visual sensory audit:", err.message);
    process.exit(1);
  }
}

main();
