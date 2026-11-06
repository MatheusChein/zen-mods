// Copy Selected URLs: Arc's Cmd+Shift+C with several tabs selected.
//
// Zen's "Copy current URL" (Cmd+Shift+C, the command palette action, the site
// panel button) all end in gZenCommonActions.copyCurrentURLToClipboard, which
// only ever reads the active tab. Wrapping that function, rather than adding
// a key, keeps working if the shortcut is remapped in Zen's settings. With one
// tab selected, Zen's own code runs untouched, so its toast and Share button
// stay exactly as they were.

const MARKDOWN_PREF = "mod.copyselectedurls.markdown";
const TOAST_ID = "mod-copyselectedurls-confirmation";
const MARKDOWN_TOAST_ID = "mod-copyselectedurls-markdown-confirmation";
const FTL_FILE = "mod-copyselectedurls.ftl";
const L10N_SOURCE = "mod-copyselectedurls";
const TOAST_TIMEOUT_MS = 3000; // Same as Zen's copy-URL toast.

// The same services Zen's single-tab copy uses (UrlbarInputBase.mjs).
const services = {
  get clipboard() {
    return Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);
  },
  get queryStripper() {
    return Cc["@mozilla.org/url-query-string-stripper;1"].getService(
      Ci.nsIURLQueryStringStripper
    );
  },
};

const actions = window.gZenCommonActions;
const originalCopy = actions?.copyCurrentURLToClipboard;
const originalCopyMarkdown = actions?.copyCurrentURLAsMarkdownToClipboard;

/**
 * Makes the toast strings available to Zen's toasts, which only take Fluent
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
 * The tabs to copy, in tab strip order. Zen doesn't clear multiselection when
 * switching Spaces, so tabs left selected in another Space are skipped.
 * Empty new-tab placeholders have nothing worth copying.
 */
function tabsToCopy() {
  const activeSpace = window.gZenWorkspaces?.activeWorkspace;
  return gBrowser.selectedTabs.filter(tab => {
    if (tab.hasAttribute("zen-empty-tab")) {
      return false;
    }
    const space = tab.getAttribute("zen-workspace-id");
    return !activeSpace || !space || tab.hasAttribute("zen-essential") || space === activeSpace;
  });
}

/**
 * The tab's address, cleaned the way Zen cleans the single-tab copy: tracking
 * parameters stripped (when Firefox's "strip on share" is on), reader mode
 * unwrapped, and decoded if browser.urlbar.decodeURLsOnCopy is set.
 *
 * Uses the loaded address, not what's typed in the URL bar: other tabs only
 * keep half-typed text there, and copying it would surprise.
 */
function copyableURL(tab) {
  // Unloaded tabs answer currentURI from session data, so this works for them too.
  let uri = tab.linkedBrowser.currentURI;
  try {
    uri = services.queryStripper.stripForCopyOrShare(uri) ?? uri;
  } catch (e) {
    // Throws for URIs it can't handle (about:, file:); copy those as they are.
  }
  uri = gURLBar.makeURIReadable(uri);

  let spec = uri.displaySpec;
  try {
    if (
      Services.prefs.getBoolPref("browser.urlbar.decodeURLsOnCopy", false) &&
      !uri.schemeIs("data")
    ) {
      spec = decodeURI(spec);
    }
  } catch (e) {}
  return spec;
}

function markdownLink(tab) {
  const title = tab.label.replace(/[\\[\]]/g, "\\$&");
  return `[${title}](${copyableURL(tab)})`;
}

function showToast(messageId, count) {
  const l10nArgs = { count };
  gZenUIManager.showToast(messageId, { l10nArgs, timeout: TOAST_TIMEOUT_MS });
  // Zen reuses a toast that's still on screen without updating its text, so a
  // second copy within 3 seconds would keep the first count. Its element is
  // created synchronously above, so it can be fixed right away.
  const container = document.getElementById("zen-toast-container");
  const toast = [...(container?.children ?? [])].find(el => el._messageId === messageId);
  const label = toast?.querySelector("label");
  if (label) {
    document.l10n.setAttributes(label, messageId, l10nArgs);
  }
}

function copyLines(lines, messageId) {
  // Plain text only. Firefox's BrowserUtils.copyLinks also writes HTML, which
  // rich editors (Slack, Notion, Docs) paste as titled links, not a URL list.
  services.clipboard.copyString(lines.join("\n"));
  showToast(messageId, lines.length);
}

function copySelectedURLs(...args) {
  const tabs = tabsToCopy();
  if (tabs.length < 2) {
    return originalCopy.apply(this, args);
  }
  const lines = tabs.map(copyableURL);
  return copyLines(lines, TOAST_ID);
}

function copySelectedAsMarkdown(...args) {
  const tabs = Services.prefs.getBoolPref(MARKDOWN_PREF, true) ? tabsToCopy() : [];
  if (tabs.length < 2) {
    return originalCopyMarkdown.apply(this, args);
  }
  const lines = tabs.map(markdownLink);
  return copyLines(lines, MARKDOWN_TOAST_ID);
}

if (typeof originalCopy === "function" && typeof originalCopyMarkdown === "function") {
  try {
    registerStrings();
  } catch (e) {
    console.error("[Copy Selected URLs]: couldn't load toast strings", e);
  }

  actions.copyCurrentURLToClipboard = copySelectedURLs;
  actions.copyCurrentURLAsMarkdownToClipboard = copySelectedAsMarkdown;

  window.addUnloadListener?.(() => {
    // gZenCommonActions is a plain object whose functions are its own
    // properties: assign the originals back (`delete` would remove Zen's).
    // Skip one that another mod has wrapped since, so its wrapper survives.
    if (actions.copyCurrentURLToClipboard === copySelectedURLs) {
      actions.copyCurrentURLToClipboard = originalCopy;
    }
    if (actions.copyCurrentURLAsMarkdownToClipboard === copySelectedAsMarkdown) {
      actions.copyCurrentURLAsMarkdownToClipboard = originalCopyMarkdown;
    }
    try {
      document.l10n.removeResourceIds([{ path: FTL_FILE, optional: true }]);
    } catch (e) {}
  });
} else {
  console.warn("[Copy Selected URLs]: gZenCommonActions copy functions not found; Zen may have changed.");
}
