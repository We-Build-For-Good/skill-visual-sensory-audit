# Visual Sensory Audit Engine (`@webuildforgood/skill-visual-sensory-audit`)

Deterministic multi-viewport sensory verification gate for agentic coding workflows.

Language models writing CSS and HTML operate blind. A coding agent can generate visually broken layouts, clipped cards, or horizontal blowouts while reporting that all logical unit tests pass.

The **Visual Sensory Audit Engine** (`wb4g-visual-audit`) closes the sensory perception loop. It drives headless Chrome across standard viewports (375px mobile, 768px tablet, 1440px desktop) to deterministically catch visual defects, layout blowouts, broken assets, and uncaught JavaScript errors before any human sees them.

---

## Key Features

1. **Horizontal Layout Blowout Detection**: Scans the DOM and flags any elements expanding beyond the viewport edge on mobile devices.
2. **Broken Media Auditor**: Identifies broken images (`naturalWidth === 0`) and failed asset network requests.
3. **Touch Ergonomics**: Flags buttons and clickable targets smaller than 36x36px on mobile.
4. **Console & Runtime Sentry**: Catches uncaught runtime exceptions (`pageerror`) and `console.error` logs.
5. **Multi-Viewport Visual Proof**: Automatically outputs high-fidelity PNG screenshots for mobile (375x667), tablet (768x1024), and desktop (1440x900).

---

## Installation

```bash
git clone https://github.com/We-Build-For-Good/skill-visual-sensory-audit.git
cd skill-visual-sensory-audit
npm install
```

---

## Usage

### Audit a Local Directory or HTML File
```bash
# Audits index.html in the current directory:
node bin/visual-audit.mjs

# Audits a specific project folder:
node bin/visual-audit.mjs --dir /path/to/project

# Audits a specific HTML file:
node bin/visual-audit.mjs --dir /path/to/project --file landing.html
```

### Audit a Live Staging or Production URL
```bash
node bin/visual-audit.mjs https://webuildforgood.com/departure-alarm/
```

### Options
```text
  --dir <path>          Target directory to audit (default: current directory)
  --file <name>         Default HTML file to load (default: index.html)
  --output-dir <path>   Output directory for screenshots and report (default: ./sensory-audit-output)
  --no-screenshots      Skip saving PNG screenshots
  --strict              Treat touch target and layout warnings as fatal errors
  --json                Output results as JSON
  --help                Display documentation
```

---

## Programmatic API

```javascript
import { runVisualSensoryAudit } from "@webuildforgood/skill-visual-sensory-audit/lib/audit-runner.mjs";

const report = await runVisualSensoryAudit({
  target: "/path/to/project",
  outputDir: "./artifacts/sensory",
  strict: false,
});

if (report.hasFailures) {
  console.error("Visual defects detected:", report.errorCount);
}
```

---

## Testing

```bash
npm test
```

All tests execute against local mock pages verifying clean passes, blowout detection, broken image capture, runtime errors, and touch target sizing.

---

## License

MIT © We Build for Good
