// Zoom Toast: Arc's zoom popup. Zooming a page shows the new zoom level in
// Zen's toast (top right, like "Copied current URL!").
//
// Zen only shows the zoom level inside the URL bar, so with the URL bar closed
// there's no feedback. Every way of zooming (Cmd+Plus/Minus/0, View > Zoom,
// the URL bar's zoom button, mouse wheel zoom) ends in FullZoom.enlarge,
// reduce or reset, so those three are wrapped. Firefox's "FullZoomChange"
// event would also fire when a site opens at its remembered zoom level, which
// shouldn't show anything.

const TOAST_ID = "mod-zoomtoast-level";
const FTL_FILE = "mod-zoomtoast.ftl";
const L10N_SOURCE = "mod-zoomtoast";

const fullZoom = window.FullZoom;
const original = {
  enlarge: fullZoom?.enlarge,
  reduce: fullZoom?.reduce,
  reset: fullZoom?.reset,
};

/**
 * Makes the toast string available to Zen's toasts, which only take Fluent
 * ids. The file sits next to this script; going through import.meta.url keeps
 * that true however Sine lays out the mod's folder.
 */
function registerStrings() {
  const registry = L10nRegistry.getInstance();
  // The registry is shared by every window, but this script runs once per window.
  if (!registry.hasSource(L10N_SOURCE)) {
    const folder = import.meta.url.replace(/[^/]*$/, "");
    registry.registerSources([
      new L10nFileSource(L10N_SOURCE, "app", ["en-US"], `${folder}locales/{locale}/`),
    ]);
  }
  // Optional: the file only exists in en-US. A required resource missing from
  // the user's locale would make Fluent drop that locale for the whole window.
  document.l10n.addResourceIds([{ path: FTL_FILE, optional: true }]);
}

/**
 * In Reader View and the PDF viewer, "zooming" changes the font size or the
 * viewer's own zoom instead, and the page zoom stays put. The PDF viewer shows
 * its own level, so the toast stays out of both.
 */
function changesPageZoom(browser) {
  if (browser.currentURI?.spec.startsWith("about:reader")) {
    return false;
  }
  return browser.contentPrincipal?.spec != "resource://pdf.js/web/viewer.html";
}

// The browser isn't always the selected one: mouse wheel zoom targets the page
// under the pointer, which in split view can be the unfocused side. It's still
// on screen, so its level is shown too.
function showZoomLevel(browser) {
  const l10nArgs = { percent: Math.round(ZoomManager.getZoomForBrowser(browser) * 100) };
  gZenUIManager.showToast(TOAST_ID, { l10nArgs });
  // Zen reuses a toast that's still on screen without updating its text, so
  // zooming again within 2 seconds would keep the first level. Its element is
  // created synchronously above, so it can be fixed right away.
  const container = document.getElementById("zen-toast-container");
  const toast = [...(container?.children ?? [])].find(el => el._messageId === TOAST_ID);
  const label = toast?.querySelector("label");
  if (label) {
    document.l10n.setAttributes(label, TOAST_ID, l10nArgs);
  }
}

/** Never let the toast get in the way of the zoom itself. */
function tryShowZoomLevel(browser) {
  try {
    showZoomLevel(browser);
  } catch (e) {
    console.error("[Zoom Toast]: couldn't show the zoom level", e);
  }
}

// enlarge and reduce set the new zoom synchronously, before their first
// await (which only saves it for the site), so the toast can show right away.
function enlarge(...args) {
  const browser = args[0] ?? gBrowser.selectedBrowser;
  const showToast = changesPageZoom(browser);
  const result = original.enlarge.apply(this, args);
  if (showToast) {
    tryShowZoomLevel(browser);
  }
  return result;
}

function reduce(...args) {
  const browser = args[0] ?? gBrowser.selectedBrowser;
  const showToast = changesPageZoom(browser);
  const result = original.reduce.apply(this, args);
  if (showToast) {
    tryShowZoomLevel(browser);
  }
  return result;
}

// reset looks up the default zoom level first, so the page only changes once
// its promise resolves.
function reset(...args) {
  const browser = args[0] ?? gBrowser.selectedBrowser;
  const showToast = changesPageZoom(browser);
  const result = original.reset.apply(this, args);
  if (showToast) {
    // The caller gets the original promise and its errors; this copy only
    // waits for it.
    Promise.resolve(result).then(
      () => tryShowZoomLevel(browser),
      () => {}
    );
  }
  return result;
}

const wrappers = { enlarge, reduce, reset };

if (
  Object.values(original).every(fn => typeof fn === "function") &&
  typeof window.gZenUIManager?.showToast === "function" &&
  typeof window.ZoomManager?.getZoomForBrowser === "function"
) {
  try {
    registerStrings();
  } catch (e) {
    console.error("[Zoom Toast]: couldn't load the toast string", e);
  }

  Object.assign(fullZoom, wrappers);

  window.addUnloadListener?.(() => {
    // FullZoom's methods are its own properties: assign the originals back.
    // Skip one that another mod has wrapped since, so its wrapper survives.
    for (const [name, wrapper] of Object.entries(wrappers)) {
      if (fullZoom[name] === wrapper) {
        fullZoom[name] = original[name];
      }
    }
    try {
      document.l10n.removeResourceIds([{ path: FTL_FILE, optional: true }]);
    } catch (e) {}
  });
} else {
  console.warn("[Zoom Toast]: FullZoom, ZoomManager or Zen's toasts not found; Zen may have changed.");
}
