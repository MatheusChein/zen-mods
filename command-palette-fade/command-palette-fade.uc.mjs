// Command Palette Fade: close animation.
// Holds Zen's floating URL bar on screen while the close animation in
// close.css plays, then lets Zen tear it down.
//
// Closing the results view removes the bar's [open] attribute, and with it
// every [open]-only style: Zen's floating layout and any theme's look (Arc
// 2.0's frosted background, for one). So right before that, the open bar's
// layout and background are copied into custom properties that close.css
// holds while the bar animates out.

const CLOSING_ATTR = "mod-cmdpalettefade-closing";
const SNAPSHOT_ATTR = "mod-cmdpalettefade-snapshot";
const CLOSE_ANIMATION_PREFIX = "mod-cmdpalettefade-close-";

// Computed styles copied from the open bar. Each becomes
// --mod-cmdpalettefade-snap-<part>-<property> on #urlbar; keep in sync with
// close.css.
const SNAPSHOT_PROPERTIES = {
  bar: [
    "width",
    "height",
    "top",
    "left",
    "font-size",
    "--urlbar-container-height",
    "--urlbar-margin-inline",
  ],
  background: [
    "background-color",
    "background-image",
    "backdrop-filter",
    "box-shadow",
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
    "outline-color",
    "outline-style",
    "outline-width",
    "outline-offset",
  ],
};

const SNAPSHOT_VARIABLES = Object.entries(SNAPSHOT_PROPERTIES).flatMap(([part, properties]) =>
  properties.map(property => ({
    part,
    property,
    variable: `--mod-cmdpalettefade-snap-${part}-${property.replace(/^--/, "")}`,
  }))
);

const urlbar = window.gURLBar;
const view = urlbar?.view;
const originalUpdatePopover = urlbar?.updatePopover;
const originalViewClose = view?.close;
let pendingClose = null;
let snapshot = null;

function wantsPopover(bar) {
  // Mirrors the open condition in UrlbarInputBase#updatePopover (minus the
  // private #popoverAllowed check, which only ever closes it sooner).
  return bar.view.isOpen || (bar.hasAttribute("in-page") && bar.focused);
}

function isFloating(bar) {
  return bar.getAttribute("zen-floating-urlbar") === "true" && bar.matches(":popover-open");
}

function takeSnapshot() {
  const elements = {
    bar: urlbar,
    background: urlbar.querySelector(":scope > .urlbar-background"),
  };
  if (!elements.background) {
    return null;
  }
  const styles = {
    bar: window.getComputedStyle(elements.bar),
    background: window.getComputedStyle(elements.background),
  };
  const values = new Map();
  for (const { part, property, variable } of SNAPSHOT_VARIABLES) {
    const value = styles[part].getPropertyValue(property).trim();
    if (value) {
      values.set(variable, value);
    }
  }
  return values;
}

function applySnapshot(values) {
  for (const [variable, value] of values) {
    urlbar.style.setProperty(variable, value);
  }
  urlbar.setAttribute(SNAPSHOT_ATTR, "");
}

function endClosingState() {
  urlbar.removeAttribute(CLOSING_ATTR);
  if (urlbar.hasAttribute(SNAPSHOT_ATTR)) {
    urlbar.removeAttribute(SNAPSHOT_ATTR);
    for (const { variable } of SNAPSHOT_VARIABLES) {
      urlbar.style.removeProperty(variable);
    }
  }
}

function finishClose() {
  pendingClose = null;
  originalUpdatePopover.call(urlbar);
  endClosingState();
}

function cancelClose() {
  pendingClose.cancelled = true;
  pendingClose = null;
  endClosingState();
}

function viewClose(...args) {
  // [open] is still set here, so the computed styles are the open ones.
  // Removing it (inside the original close) synchronously calls
  // updatePopover below, which uses the snapshot.
  if (this.isOpen && isFloating(urlbar)) {
    snapshot = takeSnapshot();
  }
  try {
    return originalViewClose.apply(this, args);
  } finally {
    snapshot = null;
  }
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

  if (!isFloating(this)) {
    return originalUpdatePopover.call(this);
  }

  // Read the last layout before anything flushes it: [open] is already gone,
  // but this still reflects whether the results were on screen (other mods,
  // like No Top Sites, may have been hiding them).
  const resultsWereVisible =
    window.windowUtils.getBoundsWithoutFlushing(this.view.panel).height > 0;
  if (snapshot) {
    applySnapshot(snapshot);
  }
  this.setAttribute(CLOSING_ATTR, resultsWereVisible ? "with-results" : "");
  const animations = this.getAnimations({ subtree: true }).filter(animation =>
    animation.animationName?.startsWith(CLOSE_ANIMATION_PREFIX)
  );

  // No animation means the styles are off or reduced motion is on.
  if (!animations.length) {
    endClosingState();
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
  // Without this hook the close still animates, using close.css's fallback
  // layout and whatever background the closed bar has.
  if (typeof originalViewClose === "function") {
    view.close = viewClose;
  }

  window.addUnloadListener?.(() => {
    if (pendingClose) {
      finishClose();
    }
    delete urlbar.updatePopover;
    delete view.close;
  });
} else {
  console.warn("[Command Palette Fade]: gURLBar.updatePopover not found; Zen may have changed.");
}
