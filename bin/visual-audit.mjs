#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { runVisualSensoryAudit, AuditUnavailableError, DEFAULT_MIN_TOUCH_PX } from "../lib/audit-runner.mjs";

const HELP = `
We Build for Good: Visual Sensory Audit (wb4g-visual-audit)

Usage:
  wb4g-visual-audit [target] [options]

Target:
  A folder, an HTML file, or an http(s) URL. Defaults to the current folder.

Options:
  --dir <path>          Folder to audit (same as passing it as the target)
  --file <name>         HTML file to open inside the folder (default: index.html)
  --output-dir <path>   Where screenshots and sensory-report.json go (default: ./sensory-audit-output)
  --no-screenshots      Do not save screenshots or the report file
  --min-touch <px>      Smallest acceptable touch target on mobile (default: ${DEFAULT_MIN_TOUCH_PX}, WCAG 2.2 AA)
  --strict              Treat warnings (small touch targets) as failures
  --json                Print the report as JSON
  --help, -h            Show this help

Exit codes: 0 passed, 1 defects found, 2 bad options, 3 the audit could not run (no Chrome, dependencies not installed).
`;

function parseArgs(args) {
  const options = { target: null, defaultFile: "index.html", outputDir: "./sensory-audit-output", captureScreenshots: true, strict: false, json: false, minTouchPx: DEFAULT_MIN_TOUCH_PX, help: false, errors: [] };
  const take = (i, flag) => {
    if (i + 1 >= args.length || args[i + 1].startsWith("--")) {
      options.errors.push(`${flag} needs a value.`);
      return null;
    }
    return args[i + 1];
  };
  let dir = null;
  let positional = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dir") { dir = take(i, arg); i++; }
    else if (arg === "--file") { options.defaultFile = take(i, arg) || options.defaultFile; i++; }
    else if (arg === "--output-dir") { options.outputDir = take(i, arg) || options.outputDir; i++; }
    else if (arg === "--min-touch") {
      const n = Number(take(i, arg)); i++;
      if (!Number.isFinite(n) || n <= 0) options.errors.push("--min-touch must be a positive number of pixels.");
      else options.minTouchPx = n;
    }
    else if (arg === "--no-screenshots") options.captureScreenshots = false;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--json") options.json = true;
    else if (arg.startsWith("-")) options.errors.push(`Unknown option: ${arg}`);
    else if (positional) options.errors.push(`Only one target can be given (got "${positional}" and "${arg}").`);
    else positional = arg;
  }
  if (dir && positional && !/^https?:\/\//i.test(positional)) {
    options.errors.push("Give the folder either with --dir or as the target, not both.");
  }
  // A URL target wins over --dir (callers may pass both).
  options.target = positional || dir || process.cwd();
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  if (options.errors.length) {
    options.errors.forEach((e) => console.error(`Error: ${e}`));
    return 2;
  }

  let report;
  try {
    report = await runVisualSensoryAudit(options);
  } catch (err) {
    if (err instanceof AuditUnavailableError) {
      console.error(`Visual audit could not run: ${err.message}`);
      return 3;
    }
    console.error(`Visual audit failed to run: ${err.message}`);
    return 1;
  }

  const failed = report.errorCount > 0 || (options.strict && report.warningCount > 0);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return failed ? 1 : 0;
  }

  const line = "=".repeat(59);
  console.log(line);
  console.log(" We Build for Good: Visual Sensory Audit");
  console.log(` Target     : ${report.target}`);
  console.log(` URL        : ${report.targetUrl}`);
  console.log(` Viewports  : ${report.viewportsAudited.join(", ")}`);
  console.log(` Errors     : ${report.errorCount}`);
  console.log(` Warnings   : ${report.warningCount}`);
  if (options.captureScreenshots) console.log(` Output     : ${path.resolve(options.outputDir)}`);
  console.log(line + "\n");

  for (const d of report.documentErrors) console.log(`[ERROR] [${d.viewport}] ${d.message}`);
  for (const [vpName, vpData] of Object.entries(report.viewportResults)) {
    for (const failure of vpData.failures) {
      console.log(`[ERROR] [${vpName}] ${failure.message}`);
      for (const off of failure.offenders || []) console.log(`        ${off.selector} (+${off.overflowPx}px past the edge)`);
      for (const img of failure.brokenImages || []) console.log(`        ${img.selector}: ${img.src}`);
    }
    for (const warning of vpData.warnings) {
      console.log(`[WARN ] [${vpName}] ${warning.message}`);
      for (const t of (warning.targets || []).slice(0, 3)) console.log(`        ${t.selector} "${t.text}" (${t.width}x${t.height}px)`);
    }
  }
  for (const r of report.failedRequests) console.log(`[ERROR] [network] ${r.failure} ${r.url}`);
  for (const pe of report.pageErrors) console.log(`[ERROR] [runtime] Uncaught exception: ${pe.message}`);
  for (const ce of report.consoleErrors) console.log(`[ERROR] [console] ${ce.text}`);

  console.log("");
  if (failed) console.log("Visual audit failed.");
  else console.log(report.warningCount ? "Visual audit passed with warnings." : "Visual audit passed.");
  return failed ? 1 : 0;
}

process.exitCode = await main();
