// Search Engine Shortcuts: a keyboard shortcut for each search engine.
//
// Pressing one opens the URL bar straight into that engine's search mode, as
// if you'd typed its alias and a space ("yt" + space). Zen has no shortcuts
// for this. Firefox's Cmd+K does the same for the default engine only.
//
// Every engine gets an item in a "Search With" submenu of the Tools menu,
// and a <key> with no shortcut. about:keyboard lists the shortcut of every
// menu item, including empty ones, so each engine shows up there under
// "Search With", ready to be given a shortcut. about:keyboard (CustomKeys)
// saves it under the key's id and applies it whenever the keyset is inserted.

const ID = "mod-searchengineshortcuts";
// about:keyboard saves shortcuts under `${KEY_PREFIX}<engine id>`: never change
// this prefix. Engine ids survive renaming an engine or changing its alias.
const KEY_PREFIX = `${ID}-key-`;
const COMMAND_PREFIX = `${ID}-command-`;
const KEYSET_ID = `${ID}-keyset`;
const COMMANDSET_ID = `${ID}-commandset`;
const MENU_ID = `${ID}-menu`;
const SEPARATOR_ID = `${ID}-separator`;
const OVERRIDE_PREF = "mod.searchengineshortcuts.override-pages";
const FTL_FILE = "mod-searchengineshortcuts.ftl";
const L10N_SOURCE = "mod-searchengineshortcuts";

// Firefox moved the search service out of `Services` (it was Services.search).
const { SearchService } = ChromeUtils.importESModule(
  "moz-src:///toolkit/components/search/SearchService.sys.mjs"
);

let unloaded = false;
/** Bumped on every rebuild, so an older, slower rebuild doesn't win. */
let buildGeneration = 0;
let rebuildTimer = null;

/**
 * Registers the mod's Fluent file. It sits next to this script; going through
 * import.meta.url keeps that true however Sine lays out the mod's folder.
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
}

/**
 * The submenu's label, which is also the section name in about:keyboard.
 *
 * It's formatted with a Localization of its own rather than the window's
 * document.l10n: with Sine and other mods loaded, document.l10n was seen
 * returning nothing for mods' strings while a fresh Localization of the same
 * file worked, which left the menu and the about:keyboard section unnamed.
 */
async function menuLabel() {
  try {
    const strings = new Localization([{ path: FTL_FILE, optional: true }]);
    const [message] = await strings.formatMessages([{ id: "mod-searchengineshortcuts-menu" }]);
    const label = message?.attributes?.find(attr => attr.name == "label")?.value;
    if (label) {
      return label;
    }
  } catch (e) {
    console.warn("[Search Engine Shortcuts]: couldn't format the menu label", e);
  }
  return "Search With";
}

/** Element ids allow only some characters; engine ids can be UUIDs in braces. */
function safeId(engine) {
  return engine.id.replace(/[^A-Za-z0-9_-]/g, "_");
}

/**
 * Opens the URL bar in the engine's search mode: the same steps as Firefox's
 * Cmd+K (UrlbarInput.searchModeShortcut), with this engine instead of the
 * default one. Search mode comes first and the bar opens after, so Search
 * Engine Splash (which waits for "shortcut" search modes) plays its splash.
 */
function searchWith(engineName) {
  // The setter clears the input if it showed the page's address.
  gURLBar.searchMode = { engineName, entry: "shortcut" };
  gURLBar.search(gURLBar.value);
  gURLBar.select();
}

/**
 * Gecko only reads a <key> when its keyset is inserted into the document, so
 * the keys get a keyset of their own, and changes mean re-inserting it. It
 * goes next to Firefox's mainKeyset: about:keyboard watches that parent for
 * new keysets and applies the user's saved shortcuts.
 */
function insertKeyset(keyset) {
  const parent = document.getElementById("mainKeyset")?.parentElement ?? document.body;
  keyset.remove();
  parent.append(keyset);
}

function applyOverridePref(key) {
  // reserved="true" lets the browser handle the key before the page, like
  // Cmd+T and Cmd+W. Without it, a page that uses the same keys keeps them.
  if (Services.prefs.getBoolPref(OVERRIDE_PREF, true)) {
    key.setAttribute("reserved", "true");
  } else {
    key.removeAttribute("reserved");
  }
}

function removeElements() {
  // about:keyboard may have re-inserted the keyset, so look elements up by id.
  for (const id of [KEYSET_ID, COMMANDSET_ID, MENU_ID, SEPARATOR_ID]) {
    document.getElementById(id)?.remove();
  }
}

/** (Re)creates the commands, keys and menu items for the visible engines. */
async function build() {
  const generation = ++buildGeneration;
  await SearchService.init();
  const engines = await SearchService.getVisibleEngines();
  const icons = await Promise.all(engines.map(engine => engine.getIconURL(16).catch(() => null)));
  const label = await menuLabel();
  if (unloaded || generation != buildGeneration) {
    return;
  }
  removeElements();

  const commandset = document.createXULElement("commandset");
  commandset.id = COMMANDSET_ID;
  const keyset = document.createXULElement("keyset");
  keyset.id = KEYSET_ID;
  const menu = document.createXULElement("menu");
  menu.id = MENU_ID;
  menu.setAttribute("label", label);
  const popup = document.createXULElement("menupopup");
  menu.append(popup);

  engines.forEach((engine, i) => {
    const name = engine.name;
    // A key needs a command (or oncommand) to fire, so it points at a command
    // element, as does the menu item.
    const command = document.createXULElement("command");
    command.id = COMMAND_PREFIX + safeId(engine);
    command.addEventListener("command", () => searchWith(name));
    commandset.append(command);

    // No modifiers or key: no shortcut until the user picks one.
    const key = document.createXULElement("key");
    key.id = KEY_PREFIX + safeId(engine);
    key.setAttribute("command", command.id);
    applyOverridePref(key);
    keyset.append(key);

    const item = document.createXULElement("menuitem");
    item.setAttribute("label", name);
    item.setAttribute("command", command.id);
    item.setAttribute("key", key.id);
    if (icons[i]) {
      item.classList.add("menuitem-iconic");
      item.setAttribute("image", icons[i]);
    }
    popup.append(item);
  });

  document.body.append(commandset);
  insertKeyset(keyset);

  const separator = document.createXULElement("menuseparator");
  separator.id = SEPARATOR_ID;
  const toolsPopup = document.getElementById("menu_ToolsPopup");
  if (toolsPopup) {
    toolsPopup.prepend(menu, separator);
  } else {
    // Without a Tools menu, the shortcuts still work; they just can't be
    // changed in about:keyboard.
    document.getElementById("main-menubar")?.append(menu);
  }
}

function rebuildSoon() {
  // Engine changes come in bursts (an added engine fires several times).
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    build().catch(e => console.error("[Search Engine Shortcuts]: couldn't update the engines", e));
  }, 250);
}

const engineObserver = { observe: rebuildSoon };

function onOverridePrefChanged() {
  const keyset = document.getElementById(KEYSET_ID);
  if (keyset) {
    for (const key of keyset.children) {
      applyOverridePref(key);
    }
    insertKeyset(keyset);
  }
}

if (window.gURLBar && SearchService) {
  try {
    registerStrings();
  } catch (e) {
    console.error("[Search Engine Shortcuts]: couldn't load the menu label", e);
  }

  build().catch(e => console.error("[Search Engine Shortcuts]: couldn't add the shortcuts", e));
  Services.obs.addObserver(engineObserver, "browser-search-engine-modified");
  Services.prefs.addObserver(OVERRIDE_PREF, onOverridePrefChanged);

  window.addUnloadListener?.(() => {
    unloaded = true;
    clearTimeout(rebuildTimer);
    Services.obs.removeObserver(engineObserver, "browser-search-engine-modified");
    Services.prefs.removeObserver(OVERRIDE_PREF, onOverridePrefChanged);
    removeElements();
  });
} else {
  console.warn("[Search Engine Shortcuts]: the URL bar or the search service wasn't found; Zen may have changed.");
}
