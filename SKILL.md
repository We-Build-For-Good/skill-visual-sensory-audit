---
name: visual-sensory-audit
description: Opens a page in headless Chrome at 375px, 768px, and 1440px and fails on rendering defects an agent cannot see from code - page not loading, horizontal overflow, broken images, failed stylesheet/script requests, JavaScript errors - and warns on undersized tap targets. Use before committing front-end code, deploying a web app, or accepting a pull request.
license: MIT
metadata:
  author: We Build for Good
  version: "2.0.0"
---

# Visual Sensory Audit: Deterministic Multi-Viewport Gate

Language models writing CSS and HTML operate blind. A coding agent can generate visually broken layouts, clipped cards, or horizontal blowouts while reporting that all logical unit tests pass.

An agent that cannot observe rendered visual consequences cannot be trusted to build autonomous software for client workplaces.

The **Visual Sensory Audit Engine** (`wb4g-visual-audit`) closes the sensory perception loop. It drives headless Chrome across standard viewports (375px mobile, 768px tablet, 1440px desktop) to deterministically catch visual defects, layout blowouts, broken assets, and uncaught JavaScript errors before any human sees them.

---

## The Prime Directive

**Never ship front-end code to human users that an agent has only evaluated through text or blind unit tests.**

Passing unit tests verify logical invariants; visual sensory audits verify perceptual invariants. Both gates must pass before work is deemed production-ready.

---

## What it checks

| Check | Severity |
|---|---|
| The page does not load (HTTP error, timeout, missing entry file) | Error |
| Horizontal overflow: the page is wider than the screen. Reports the offending elements. | Error |
| Broken images, including lazy-loaded ones (the audit scrolls the page to load them) | Error |
| Failed requests: any stylesheet, script, image, or other resource that fails or returns HTTP 4xx/5xx | Error |
| Uncaught exceptions and `console.error` messages, reported once each | Error |
| Mobile tap targets smaller than 24x24px (WCAG 2.2 success criterion 2.5.8, level AA). Use `--min-touch 44` for the stricter AAA / Apple guideline. | Warning; error with `--strict` |

Screenshots for each width and `sensory-report.json` are saved to `./sensory-audit-output/` (change with `--output-dir`).

It checks the page as it first loads. It cannot judge whether the design looks right, and it does not click through flows: look at the screenshots.

---

## How to run it

```bash
node bin/visual-audit.mjs --dir path/to/site                    # a folder (serves index.html)
node bin/visual-audit.mjs --dir path/to/site --file landing.html
node bin/visual-audit.mjs https://staging.example.com/           # a live URL
node bin/visual-audit.mjs --dir dist --strict --json             # CI
```

Exit codes: `0` passed, `1` defects found, `2` bad options, `3` could not run (no Chrome, or dependencies not installed). Treat `3` as "not checked", never as a pass.

---

## Using it with the other gates

Run it after `skill-system-invariant-engine` (text rules) and before release. `skill-safe-deploy` runs both automatically when they are installed side by side, and reports any gate that could not run.
