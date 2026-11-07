// Rename Tab Shortcut: Arc's "rename tab" shortcut (Cmd+Shift+E).
//
// Zen can rename tabs (double-click a label, or "Change Label…" in the tab
// menu) but has no command for it, so no shortcut can be assigned. This adds
// one that opens Zen's own rename field on the current tab, plus a File menu
// item, which is what makes the shortcut show up (and be changeable) in
// about:keyboard: that page lists menu items that have a shortcut.

// about:keyboard saves the user's custom shortcut under this id. Never change it.
const KEY_ID = "mod-renametabshortcut-key";
const KEYSET_ID = "mod-renametabshortcut-keyset";
const COMMANDSET_ID = "mod-renametabshortcut-commandset";
const COMMAND_ID = "mod-renametabshortcut-command";
const MENUITEM_ID = "mod-renametabshortcut-menuitem";
const OVERRIDE_PREF = "mod.renametabshortcut.override-pages";
const FTL_FILE = "mod-renametabshortcut.ftl";
const L10N_SOURCE = "mod-renametabshortcut";

/**
 * Makes the menu label available through Fluent, like the rest of the File
 * menu. The file sits next to this script; going through import.meta.url keeps
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
  // Optional: a required resource missing from the user's locale would make
  // Fluent drop that locale for the whole window.
  document.l10n.addResourceIds([{ path: FTL_FILE, optional: true }]);
}

/**
 * Gecko only reads a <key> when its keyset is inserted into the document, so
 * the key gets a keyset of its own (adding it to Zen's or Firefox's keyset
 * would do nothing), and changes to it mean re-inserting the keyset.
 * The keyset goes next to Firefox's mainKeyset: about:keyboard (CustomKeys)
 * watches that parent for new keysets and applies the user's saved shortcut.
 */
function insertKeyset(keyset) {
  const parent = document.getElementById("mainKeyset")?.parentElement ?? document.body;
  keyset.remove();
  parent.append(keyset);
}

function applyOverridePref(key) {
  // reserved="true" lets the browser handle the key before the page, like
  // Cmd+T and Cmd+W. Without it, pages that use Cmd+Shift+E keep it.
  if (Services.prefs.getBoolPref(OVERRIDE_PREF, true)) {
    key.setAttribute("reserved", "true");
  } else {
    key.removeAttribute("reserved");
  }
}

/**
 * Hands focus back to the page once Zen's rename field closes with Enter or
 * Escape, like Arc. Clicking away also closes it, but then focus belongs where
 * the user clicked.
 */
function onEditorKeydown(event) {
  if (event.key !== "Enter" && event.key !== "Escape") {
    return;
  }
  // Zen's own listener on the field runs first and finishes the rename
  // synchronously; wait for it to remove the field before moving focus.
  setTimeout(() => gBrowser.selectedBrowser.focus());
}

function renameCurrentTab() {
  const renamer = window.gZenTabRenamer;
  // With a Glance preview open, the selected tab is the preview; rename the
  // tab it came from, the way Zen's pin shortcut picks its tab.
  const selected = gBrowser.selectedTab;
  const tab = window.gZenGlanceManager?.getTabOrGlanceParent?.(selected) ?? selected;
  // Zen decides whether renaming is allowed: it does nothing for Essentials,
  // with the sidebar collapsed to icons, or with tab renaming turned off.
  renamer.start({ target: tab });

  // The field only exists, inside this tab, if Zen agreed to rename it.
  const input = document.getElementById("tab-label-input");
  if (input && tab.contains(input)) {
    input.addEventListener("keydown", onEditorKeydown);
  }
}

function createElements() {
  const commandset = document.createXULElement("commandset");
  commandset.id = COMMANDSET_ID;
  const command = document.createXULElement("command");
  command.id = COMMAND_ID;
  command.addEventListener("command", renameCurrentTab);
  commandset.append(command);
  document.body.append(commandset);

  // A key needs a command (or oncommand) to fire, so it points at the command
  // element, as does the menu item.
  const keyset = document.createXULElement("keyset");
  keyset.id = KEYSET_ID;
  const key = document.createXULElement("key");
  key.id = KEY_ID;
  key.setAttribute("modifiers", "accel,shift");
  key.setAttribute("key", "E");
  key.setAttribute("command", COMMAND_ID);
  applyOverridePref(key);
  keyset.append(key);
  insertKeyset(keyset);

  const menuitem = document.createXULElement("menuitem");
  menuitem.id = MENUITEM_ID;
  menuitem.setAttribute("command", COMMAND_ID);
  menuitem.setAttribute("key", KEY_ID);
  document.l10n.setAttributes(menuitem, "mod-renametabshortcut-menuitem");
  const newTabItem = document.getElementById("menu_newNavigatorTab");
  if (newTabItem) {
    newTabItem.after(menuitem);
  } else {
    document.getElementById("menu_FilePopup")?.prepend(menuitem);
  }
}

if (typeof window.gZenTabRenamer?.start === "function") {
  try {
    registerStrings();
  } catch (e) {
    console.error("[Rename Tab Shortcut]: couldn't load the menu label", e);
  }

  createElements();

  const prefObserver = () => {
    // The keyset may have been re-inserted by about:keyboard; find the key again.
    const key = document.getElementById(KEY_ID);
    if (key) {
      applyOverridePref(key);
      insertKeyset(key.parentElement);
    }
  };
  Services.prefs.addObserver(OVERRIDE_PREF, prefObserver);

  window.addUnloadListener?.(() => {
    Services.prefs.removeObserver(OVERRIDE_PREF, prefObserver);
    // about:keyboard may have re-inserted the keyset, so look elements up by id.
    for (const id of [KEYSET_ID, COMMANDSET_ID, MENUITEM_ID]) {
      document.getElementById(id)?.remove();
    }
    try {
      document.l10n.removeResourceIds([{ path: FTL_FILE, optional: true }]);
    } catch (e) {}
  });
} else {
  console.warn("[Rename Tab Shortcut]: gZenTabRenamer not found; Zen may have changed.");
}
