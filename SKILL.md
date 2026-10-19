---
name: visual-sensory-audit
description: Deterministic multi-viewport sensory verification gate. Emulates mobile (375px), tablet (768px), and desktop (1440px) viewports using headless Chrome to detect horizontal layout blowouts, broken assets, touch target collisions, and uncaught console errors. Use before committing front-end code, deploying web applications, or accepting pull requests.
license: MIT
metadata:
  author: We Build for Good
  version: "1.0.0"
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

## Sensory Verification Pillars

### 1. Horizontal Layout Overflow Detector (`detectHorizontalOverflow`)
* **Standard:** Mobile pages must never scroll horizontally.
* **Invariant:** `contentWidth <= viewportWidth`.
* **Detection:** Traverses the live DOM to identify the exact offending CSS selectors and bounding boxes pushing beyond the viewport boundary.
* **Severity:** Fatal error on any viewport.

### 2. Broken Asset & Media Auditor (`detectBrokenImages`)
* **Standard:** All images, icons, and media elements must resolve with positive natural dimensions.
* **Detection:** Inspects `img.complete` and `img.naturalWidth === 0`, as well as failed HTTP asset responses.
* **Severity:** Fatal error.

### 3. Touch Target Ergonomics (`detectSmallTouchTargets`)
* **Standard:** Actionable buttons, touch controls, and form inputs on mobile viewports must meet ergonomic touch requirements (minimum 36x36px bounding box).
* **Detection:** Evaluates interactive controls against Apple Human Interface and WCAG 2.5.5 sizing baselines.
* **Severity:** Warning in default mode; fatal error in `--strict` mode.

### 4. Runtime Console & Exception Capture
* **Standard:** No uncaught JavaScript exceptions (`pageerror`) or `console.error` calls during initial page boot or layout reflow.
* **Detection:** Listens to Chrome DevTools Protocol event streams and captures stack traces.
* **Severity:** Fatal error.

### 5. Multi-Viewport Visual Snapshot Proof
* **Standard:** High-fidelity PNG snapshots captured for mobile (375x667), tablet (768x1024), and desktop (1440x900).
* **Storage:** Saved to `./sensory-audit-output/` alongside `sensory-report.json`.

---

## CLI Usage

### Basic Audit
Run the audit on any local folder (automatically spins up an ephemeral static server):
```bash
node /Users/lizzie/wb4g-skills/skill-visual-sensory-audit/bin/visual-audit.mjs --dir /Users/lizzie/departure-alarm
```

### Auditing a Single HTML File
```bash
node /Users/lizzie/wb4g-skills/skill-visual-sensory-audit/bin/visual-audit.mjs --dir /Users/lizzie/departure-alarm --file landing.html
```

### Auditing a Remote Production or Staging URL
```bash
node /Users/lizzie/wb4g-skills/skill-visual-sensory-audit/bin/visual-audit.mjs https://webuildforgood.com/departure-alarm/
```

### Strict Mode & Machine-Readable Output
```bash
node /Users/lizzie/wb4g-skills/skill-visual-sensory-audit/bin/visual-audit.mjs --dir . --strict --json
```

---

## Integration in the Autonomous Coordinator Loop

When paired with `skill-system-invariant-engine`, the Visual Sensory Audit provides the second half of the verification gate:

1. **Gate 1: System Invariant Engine (`wb4g-invariants`)**
   Enforces character invariants (no em dashes), universal Prettier formatting, file boundaries (<400 lines), and brand integrity.
2. **Gate 2: Visual Sensory Audit (`wb4g-visual-audit`)**
   Enforces rendering invariants: zero horizontal scroll, zero broken media, zero console exceptions, and mobile touch ergonomics.

Only when both Gate 1 and Gate 2 exit with code `0` is a changeset eligible for pull request or production broadcast.
