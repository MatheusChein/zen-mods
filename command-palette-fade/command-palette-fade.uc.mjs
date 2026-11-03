// Command Palette Fade: close animation.
// Holds Zen's floating URL bar on screen while the close animation in
// close.css plays, then lets Zen tear it down.

const CLOSING_ATTR = "mod-cmdpalettefade-closing";
const CLOSE_ANIMATION_PREFIX = "mod-cmdpalettefade-close-";

const urlbar = window.gURLBar;
const originalUpdatePopover = urlbar?.updatePopover;
let pendingClose = null;

function wantsPopover(bar) {
  // Mirrors the open condition in UrlbarInputBase#updatePopover.
  return bar.view.isOpen || (bar.hasAttribute("in-page") && bar.focused);
}

function finishClose() {
  pendingClose = null;
  originalUpdatePopover.call(urlbar);
  urlbar.removeAttribute(CLOSING_ATTR);
}

function cancelClose() {
  pendingClose.cancelled = true;
  pendingClose = null;
  urlbar.removeAttribute(CLOSING_ATTR);
}

function updatePopover() {
  if (wantsPopover(this)) {
    if (pendingClose) {
      cancelClose();
    }
    return originalUpdatePopover.call(this);
  }

  if (pendingClose) {
    return undefined;
  }

  if (this.getAttribute("zen-floating-urlbar") !== "true" || !this.matches(":popover-open")) {
    return originalUpdatePopover.call(this);
  }

  // Read the last layout before anything flushes it: [open] is already gone,
  // but this still reflects whether the results were on screen (other mods,
  // like No Top Sites, may have been hiding them).
  const resultsWereVisible =
    window.windowUtils.getBoundsWithoutFlushing(this.view.panel).height > 0;
  this.setAttribute(CLOSING_ATTR, resultsWereVisible ? "with-results" : "");
  const animations = this.getAnimations({ subtree: true }).filter(animation =>
    animation.animationName?.startsWith(CLOSE_ANIMATION_PREFIX)
  );

  // No animation means the styles are off or reduced motion is on.
  if (!animations.length) {
    this.removeAttribute(CLOSING_ATTR);
    return originalUpdatePopover.call(this);
  }

  const close = { cancelled: false };
  pendingClose = close;
  Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
    if (!close.cancelled) {
      finishClose();
    }
  });
  return undefined;
}

if (typeof originalUpdatePopover === "function") {
  urlbar.updatePopover = updatePopover;

  window.addUnloadListener?.(() => {
    if (pendingClose) {
      finishClose();
    }
    delete urlbar.updatePopover;
  });
} else {
  console.warn("[Command Palette Fade]: gURLBar.updatePopover not found; Zen may have changed.");
}
