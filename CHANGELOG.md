# Changelog

## 2.0.0 (2026-10-20)

Fixes from an independent review. In 1.0.0 a page with a missing stylesheet, a missing script, a `console.error`, and a broken lazy-loaded image passed with zero errors.

- `console.error` messages now fail the audit (the docs already said they did).
- Failed requests and HTTP 4xx/5xx responses for stylesheets, scripts, and images now fail the audit (they were recorded but never reported).
- The page's own HTTP status is checked: a missing entry file or a 404 URL fails instead of passing.
- Relative folder paths work. 1.0.0 served a "Forbidden" page for `--dir ./site` and passed it.
- The page is scrolled before checking, so broken lazy-loaded images are found; the audit waits for the load event, not just the HTML.
- Errors are counted once, not once per screen width.
- Tap target minimum is 24px (WCAG 2.2 AA), configurable with `--min-touch`. 1.0.0 used 36px and cited the wrong WCAG criterion.
- Exit code 3 when the audit cannot run (no Chrome, dependencies not installed), so callers can tell "not checked" from "failed".
- Chrome's sandbox stays on unless running as root or `WB4G_NO_SANDBOX=1`.
- A URL target now wins over `--dir`; unknown options exit with code 2.
- Docs no longer contain the author's local file paths.
