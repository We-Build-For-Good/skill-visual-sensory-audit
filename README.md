# Visual Sensory Audit (`skill-visual-sensory-audit`)

Opens a page in headless Chrome at phone, tablet, and desktop widths and fails if it finds rendering defects an AI coding agent cannot see from the code alone.

Part of the **We Build for Good** open-source skills library.

---

## What it checks

At 375px, 768px, and 1440px wide:

| Check | Result |
|---|---|
| The page itself does not load (HTTP 4xx/5xx, timeout, missing entry file) | Error |
| Horizontal overflow (the page is wider than the screen), with the offending elements | Error |
| Broken images, including lazy-loaded ones further down the page (it scrolls to load them) | Error |
| Any stylesheet, script, image, or other request that fails or returns HTTP 4xx/5xx | Error |
| Uncaught JavaScript exceptions and `console.error` messages (each reported once, not once per width) | Error |
| Tap targets on mobile smaller than 24x24px (the WCAG 2.2 AA minimum; change with `--min-touch`) | Warning (error with `--strict`) |

It also saves a screenshot per width and a `sensory-report.json`.

What it does **not** check: whether the design looks right, colour contrast, or anything that only appears after a click. It looks at the page as it first loads.

---

## Install

Needs Node 18+ and Chrome, Chromium, Edge, or Brave installed. Set `CHROME_PATH` if yours is somewhere unusual.

```bash
git clone https://github.com/We-Build-For-Good/skill-visual-sensory-audit.git
cd skill-visual-sensory-audit
npm install
```

## Usage

```bash
node bin/visual-audit.mjs                                   # index.html in the current folder
node bin/visual-audit.mjs --dir path/to/site                # a folder
node bin/visual-audit.mjs --dir path/to/site --file landing.html
node bin/visual-audit.mjs https://staging.example.com/      # a live URL
node bin/visual-audit.mjs --dir dist --strict --json        # CI
```

Options: `--output-dir <path>`, `--no-screenshots`, `--min-touch <px>`, `--strict`, `--json`, `--help`.

Exit codes: `0` passed, `1` defects found, `2` bad options, `3` the audit could not run (no Chrome found, or `npm install` not done). Callers such as `skill-safe-deploy` treat `3` as "not run", never as a pass.

Chrome runs with its sandbox on. It is turned off only when running as root (common in containers) or when `WB4G_NO_SANDBOX=1` is set.

## Programmatic use

```javascript
import { runVisualSensoryAudit } from "./lib/audit-runner.mjs";

const report = await runVisualSensoryAudit({ target: "path/to/site", outputDir: "./artifacts/visual" });
if (report.hasFailures) console.error(`${report.errorCount} visual defects`);
```

## Tests

```bash
npm test
```

## License

MIT. We Build for Good
