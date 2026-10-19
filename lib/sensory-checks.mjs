// DOM inspection scripts executed within the browser page context

export const SENSORY_EVAL_SCRIPTS = {
  detectHorizontalOverflow: () => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const contentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    const hasOverflow = contentWidth > viewportWidth + 1;

    if (!hasOverflow) {
      return { hasOverflow: false, contentWidth, viewportWidth, offenders: [] };
    }

    const allElements = Array.from(document.body ? document.body.querySelectorAll("*") : []);
    const overflowing = [];

    for (const el of allElements) {
      // Ignore hidden or zero-size elements
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      if (rect.right > viewportWidth + 1) {
        const delta = Math.round(rect.right - viewportWidth);
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const classes = el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "";
        const selector = `${tag}${id}${classes}`;

        overflowing.push({
          selector,
          tag,
          id: el.id || null,
          overflowPx: delta,
          rect: {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          },
        });
      }
    }

    // Sort by largest overflow first
    overflowing.sort((a, b) => b.overflowPx - a.overflowPx);

    // Keep top distinct offenders (limit noise)
    const topOffenders = overflowing.slice(0, 10);

    return {
      hasOverflow: true,
      contentWidth,
      viewportWidth,
      overflowPx: contentWidth - viewportWidth,
      offenders: topOffenders,
    };
  },

  detectBrokenImages: () => {
    const images = Array.from(document.querySelectorAll("img"));
    const broken = [];

    for (const img of images) {
      // Check if image failed to load or has 0 natural dimensions
      const isComplete = img.complete;
      const naturalWidth = img.naturalWidth;
      const src = img.currentSrc || img.src || "";

      if (src && isComplete && naturalWidth === 0) {
        const tag = img.tagName.toLowerCase();
        const id = img.id ? `#${img.id}` : "";
        const classes = img.className && typeof img.className === "string"
          ? "." + img.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";

        broken.push({
          selector: `${tag}${id}${classes}`,
          src,
          alt: img.alt || null,
        });
      }
    }

    return {
      totalImages: images.length,
      brokenCount: broken.length,
      brokenImages: broken,
    };
  },

  detectSmallTouchTargets: (minDimension = 36) => {
    const targets = Array.from(
      document.querySelectorAll("button, a, input[type='button'], input[type='submit'], [role='button']")
    );
    const smallTargets = [];

    for (const el of targets) {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        continue;
      }

      // Skip inline text links inside paragraphs unless they are styled as buttons
      if (el.tagName.toLowerCase() === "a" && style.display === "inline") {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      if (rect.width < minDimension || rect.height < minDimension) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const text = (el.innerText || el.textContent || "").trim().slice(0, 30);
        smallTargets.push({
          selector: `${tag}${id}`,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          text,
        });
      }
    }

    return {
      totalChecked: targets.length,
      smallCount: smallTargets.length,
      smallTargets: smallTargets.slice(0, 10),
    };
  },
};
