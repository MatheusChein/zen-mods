// Search Engine Splash: restyles the moment you pick a search engine in the
// URL bar (an alias like "yt" + space, a one-off button, Cmd+K), and can play
// a splash of its own whenever the bar opens.
//
// Zen plays its splash on #urlbar::before while `animate-searchmode` is set
// and shows the engine's name in #urlbar-search-mode-indicator. chrome.css
// does the styling; this script only feeds it what CSS can't know:
//   - which splash and color the user picked (as attributes on #urlbar),
//   - the active engine's color and icon (as custom properties on #urlbar),
//   - when to play splashes Zen doesn't (the bar opening, Cmd+K),
//   - and an SVG outline of the bar for the Trace splash.
// Zen fires "Zen:UrlbarSearchModeChanged" before it updates the label and
// sets `animate-searchmode`, so values set here land in the same frame.

const PREF_BRANCH = "mod.searchenginesplash.";
const PREFS = {
  splash: `${PREF_BRANCH}splash`,
  color: `${PREF_BRANCH}color`,
  customColor: `${PREF_BRANCH}custom-color`,
  icon: `${PREF_BRANCH}icon`,
  openSplash: `${PREF_BRANCH}open-splash`,
  openColor: `${PREF_BRANCH}open-color`,
  openCustomColor: `${PREF_BRANCH}open-custom-color`,
  duration: `${PREF_BRANCH}duration`,
  openDuration: `${PREF_BRANCH}open-duration`,
};
const SPLASHES = ["glow", "sweep", "ripple", "trace", "zen", "none"];
const COLOR_MODES = ["engine", "accent", "custom"];
const OPEN_SPLASHES = ["off", "glow", "sweep", "ripple", "trace"];
const OPEN_COLOR_MODES = ["accent", "custom"];

const ATTR_SPLASH = "mod-searchenginesplash-splash";
const ATTR_ICON = "mod-searchenginesplash-icon";
const ATTR_OPENING = "mod-searchenginesplash-opening";
const ATTR_SEARCHING = "mod-searchenginesplash-searching";
const VAR_COLOR = "--mod-searchenginesplash-color";
const VAR_ICON = "--mod-searchenginesplash-icon";
const VAR_OPEN_COLOR = "--mod-searchenginesplash-open-color";
const VAR_DURATION = "--mod-searchenginesplash-search-duration";
const VAR_OPEN_DURATION = "--mod-searchenginesplash-open-duration";
const TRACE_ID = "mod-searchenginesplash-trace";
const SVG_NS = "http://www.w3.org/2000/svg";

const urlbar = window.gURLBar;
// Firefox moved the search service out of `Services` (it was Services.search).
const { SearchService } = ChromeUtils.importESModule(
  "moz-src:///toolkit/components/search/SearchService.sys.mjs"
);

/** Engine name -> Promise<{ color: string|null, iconURL: string|null }>. */
let engineLooks = new Map();
/** The search mode currently shown, to re-apply after a pref change. */
let currentSearchMode = null;

// Zen's splash attribute and how long Zen keeps it (SEARCH_MODE_ANIMATION_RESET_MS).
const ZEN_SPLASH_ATTR = "animate-searchmode";
const ZEN_SPLASH_MS = 1000;
// How long a "shortcut" search mode waits for the bar to open.
const PENDING_MS = 1000;
const DEFAULT_DURATION_MS = 900;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let searchSplashTimer = null;
let openingSplashTimer = null;
/** The engine of a search mode that started while the bar was closed. */
let pendingEngine = null;
let pendingEngineTimer = null;

// Sine only writes a pref once its settings page has been opened, so every
// read falls back to the default from preferences.json.
function readChoice(pref, choices) {
  const value = Services.prefs.getStringPref(pref, choices[0]);
  return choices.includes(value) ? value : choices[0];
}

/**
 * A duration pref in milliseconds. Accepts CSS times ("900ms", "1.5s") and
 * plain numbers of milliseconds; anything else, or nothing, means the default.
 * Kept between 0.1 and 10 seconds.
 */
function readDuration(pref) {
  const match = Services.prefs
    .getStringPref(pref, "")
    .trim()
    .match(/^(\d+(?:\.\d+)?|\.\d+)\s*(ms|s)?$/i);
  if (!match) {
    return DEFAULT_DURATION_MS;
  }
  const ms = parseFloat(match[1]) * (match[2]?.toLowerCase() == "s" ? 1000 : 1);
  return Math.min(Math.max(ms, 100), 10000);
}

/** Both durations, for chrome.css (as custom properties) and for the timers. */
function applyDurations() {
  urlbar.style.setProperty(VAR_DURATION, `${readDuration(PREFS.duration)}ms`);
  urlbar.style.setProperty(VAR_OPEN_DURATION, `${readDuration(PREFS.openDuration)}ms`);
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max == min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max == r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max == g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return [h / 6, s, l];
}

/**
 * The icon's most prominent color, or null when it has none worth using (a
 * black-and-white logo like Wikipedia's or Perplexity's), in which case the
 * CSS falls back to Zen's accent color.
 *
 * Colorful pixels are grouped by hue and weighted by saturation; the heaviest
 * group wins. Its lightness is clamped so the glow shows on dark and light
 * bars alike.
 */
async function iconColor(iconURL) {
  const image = new window.Image();
  image.src = iconURL;
  await image.decode();

  const size = 32;
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);

  const HUE_GROUPS = 12;
  const groups = Array.from({ length: HUE_GROUPS }, () => ({ weight: 0, x: 0, y: 0, s: 0, l: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.5) {
      continue;
    }
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (s < 0.25 || l < 0.12 || l > 0.92) {
      continue;
    }
    const group = groups[Math.floor(h * HUE_GROUPS) % HUE_GROUPS];
    const weight = s * alpha;
    group.weight += weight;
    // Hue is averaged as an angle, so reds just below and above 0 don't
    // average out to cyan.
    group.x += Math.cos(h * 2 * Math.PI) * weight;
    group.y += Math.sin(h * 2 * Math.PI) * weight;
    group.s += s * weight;
    group.l += l * weight;
  }

  const best = groups.reduce((a, b) => (b.weight > a.weight ? b : a));
  // About a dozen fully colored pixels out of 1,024: less than that is a
  // stray anti-aliasing tint, not the logo's color.
  if (best.weight < 12) {
    return null;
  }
  const hue = ((Math.atan2(best.y, best.x) / (2 * Math.PI) + 1) % 1) * 360;
  const saturation = Math.max(best.s / best.weight, 0.5) * 100;
  const lightness = Math.min(Math.max(best.l / best.weight, 0.42), 0.62) * 100;
  return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
}

/** The icon and color for an engine, computed once per window. */
function lookForEngine(engineName) {
  let look = engineLooks.get(engineName);
  if (!look) {
    look = (async () => {
      const engine = SearchService.getEngineByName(engineName);
      const iconURL = (await engine?.getIconURL(32)) || null;
      let color = null;
      if (iconURL) {
        try {
          color = await iconColor(iconURL);
        } catch (e) {
          console.warn(`[Search Engine Splash]: couldn't read the icon of ${engineName}`, e);
        }
      }
      return { color, iconURL };
    })().catch(e => {
      console.warn(`[Search Engine Splash]: couldn't look up ${engineName}`, e);
      return { color: null, iconURL: null };
    });
    engineLooks.set(engineName, look);
  }
  return look;
}

function cssURL(url) {
  return `url("${url.replace(/["\\\n]/g, c => (c == "\n" ? "\\a " : `\\${c}`))}")`;
}

function setColor(color) {
  if (color) {
    urlbar.style.setProperty(VAR_COLOR, color);
  } else {
    urlbar.style.removeProperty(VAR_COLOR);
  }
}

function setIcon(iconURL) {
  if (iconURL) {
    urlbar.style.setProperty(VAR_ICON, cssURL(iconURL));
    urlbar.setAttribute(ATTR_ICON, "true");
  } else {
    urlbar.style.removeProperty(VAR_ICON);
    urlbar.removeAttribute(ATTR_ICON);
  }
}

function applyLook(engineName, look) {
  const colorMode = readChoice(PREFS.color, COLOR_MODES);
  if (colorMode == "engine") {
    setColor(look?.color);
  } else if (colorMode == "custom") {
    const custom = Services.prefs.getStringPref(PREFS.customColor, "").trim();
    setColor(custom && CSS.supports("color", custom) ? custom : null);
  } else {
    setColor(null);
  }
  setIcon(engineName && Services.prefs.getBoolPref(PREFS.icon, true) ? look?.iconURL : null);
}

/**
 * Shows the colors for a search mode, or clears them when it ends. Search
 * modes without an engine (bookmarks, tabs, history, Zen's actions) use the
 * accent color and no icon.
 */
function showSearchMode(searchMode) {
  currentSearchMode = searchMode;
  const engineName = searchMode?.engineName;
  if (!engineName) {
    applyLook(null, null);
    return;
  }
  // Until the look is ready, use the fallback (accent color, no icon). A look
  // that's already computed resolves in a microtask, before the next paint,
  // so the splash's first frame already has the engine's color.
  applyLook(engineName, null);
  lookForEngine(engineName).then(look => {
    if (currentSearchMode?.engineName == engineName) {
      applyLook(engineName, look);
    }
  });
}

function applySplash() {
  urlbar.setAttribute(ATTR_SPLASH, readChoice(PREFS.splash, SPLASHES));
}

/**
 * The Trace splash draws dashes along the bar's outline, which CSS alone can't
 * do around rounded corners. So the bar gets an SVG with three rects the size
 * of the bar (tail, body and head of each streak), hidden unless Trace plays.
 * chrome.css explains the dash math.
 */
function createTrace() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = TRACE_ID;
  svg.setAttribute("aria-hidden", "true");
  for (const part of ["tail", "body", "head"]) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("class", `mod-searchenginesplash-trace-${part}`);
    rect.setAttribute("width", "100%");
    rect.setAttribute("height", "100%");
    rect.setAttribute("pathLength", "100");
    svg.append(rect);
  }
  urlbar.append(svg);
}

/**
 * Matches the trace's corners to the bar's, which differ between Zen's
 * floating bar and themes like Arc 2.0. Read when a search mode starts: the
 * bar is open by then, so this is its open shape.
 */
function fitTrace() {
  const svg = document.getElementById(TRACE_ID);
  const background = urlbar.querySelector(":scope > .urlbar-background");
  if (!svg || !background) {
    return;
  }
  const radius = parseFloat(getComputedStyle(background).borderTopLeftRadius) || 0;
  for (const rect of svg.children) {
    rect.setAttribute("rx", radius);
  }
}

/**
 * Plays the search-mode splash for the chosen duration.
 *
 * The splash runs on an attribute of the mod's own, [mod-searchenginesplash-
 * searching], rather than Zen's `animate-searchmode`, which Zen removes after
 * a fixed second and would cut a longer splash short. Zen's original glow is
 * the exception: Zen's own CSS draws it, keyed on Zen's attribute, so it keeps
 * Zen's one second (set here only when Zen didn't, for Cmd+K).
 */
function playSearchSplash({ setZenAttr = false } = {}) {
  const style = urlbar.getAttribute(ATTR_SPLASH);
  clearTimeout(searchSplashTimer);
  if (style == "zen") {
    if (setZenAttr) {
      urlbar.setAttribute(ZEN_SPLASH_ATTR, "true");
      searchSplashTimer = setTimeout(() => {
        requestAnimationFrame(() => urlbar.removeAttribute(ZEN_SPLASH_ATTR));
      }, ZEN_SPLASH_MS);
    }
    return;
  }
  if (style == "none") {
    return;
  }
  if (style == "trace") {
    fitTrace();
  }
  // Restart a splash that's still playing.
  urlbar.removeAttribute(ATTR_SEARCHING);
  urlbar.getBoundingClientRect();
  urlbar.setAttribute(ATTR_SEARCHING, style);
  searchSplashTimer = setTimeout(() => {
    requestAnimationFrame(() => urlbar.removeAttribute(ATTR_SEARCHING));
  }, readDuration(PREFS.duration) + 50);
}

/** Removing Zen's attribute early is harmless: its own timer finds it gone. */
function stopSearchSplash() {
  clearTimeout(searchSplashTimer);
  urlbar.removeAttribute(ATTR_SEARCHING);
  urlbar.removeAttribute(ZEN_SPLASH_ATTR);
}

/**
 * The opening splash: its own style and color, set apart from the search-mode
 * splash by [mod-searchenginesplash-opening="<style>"] instead of Zen's
 * attribute. chrome.css plays the same splashes for either.
 */
function playOpeningSplash() {
  const style = readChoice(PREFS.openSplash, OPEN_SPLASHES);
  if (style == "off" || reducedMotion.matches) {
    return;
  }
  if (style == "trace") {
    fitTrace();
  }
  urlbar.setAttribute(ATTR_OPENING, style);
  clearTimeout(openingSplashTimer);
  openingSplashTimer = setTimeout(() => {
    requestAnimationFrame(() => urlbar.removeAttribute(ATTR_OPENING));
  }, readDuration(PREFS.openDuration) + 50);
}

function stopOpeningSplash() {
  clearTimeout(openingSplashTimer);
  urlbar.removeAttribute(ATTR_OPENING);
}

function applyOpenColor() {
  const custom = Services.prefs.getStringPref(PREFS.openCustomColor, "").trim();
  if (
    readChoice(PREFS.openColor, OPEN_COLOR_MODES) == "custom" &&
    custom &&
    CSS.supports("color", custom)
  ) {
    urlbar.style.setProperty(VAR_OPEN_COLOR, custom);
  } else {
    urlbar.style.removeProperty(VAR_OPEN_COLOR);
    urlbar.style.removeProperty(VAR_DURATION);
    urlbar.style.removeProperty(VAR_OPEN_DURATION);
  }
}

/**
 * Zen only splashes when the bar is already open. Cmd+K (Firefox's "search
 * the web" shortcut) and Search Engine Shortcuts enter search mode first and
 * open the bar right after, so Zen skips it. Remember the engine for a
 * second; if the bar opens in that time with the same search mode, the
 * search-mode splash plays then.
 */
function splashWhenBarOpens(engineName) {
  pendingEngine = engineName;
  clearTimeout(pendingEngineTimer);
  pendingEngineTimer = setTimeout(() => (pendingEngine = null), PENDING_MS);
}

function onBarOpened() {
  const engineName = pendingEngine;
  pendingEngine = null;
  clearTimeout(pendingEngineTimer);
  if (engineName) {
    if (urlbar.searchMode?.engineName == engineName) {
      playSearchSplash({ setZenAttr: true });
    }
    return;
  }
  // A bar that opens straight into a search mode shows that engine; the
  // opening splash would only compete with it.
  if (!urlbar.searchMode) {
    playOpeningSplash();
  }
}

/**
 * Watches the bar opening (`breakout-extend` added), Zen starting its own
 * search-mode splash (`animate-searchmode` set), and the bar closing. Both splashes
 * stop as soon as the bar starts closing: when its view loses `open`, or when
 * `breakout-extend` goes. Otherwise a splash would finish its second around
 * the small closed URL bar, because Command Palette Fade keeps
 * `breakout-extend` through its close animation, and the splash rules don't
 * require it anyway.
 */
const barObserver = new MutationObserver(records => {
  const extended = urlbar.hasAttribute("breakout-extend");
  const opened = records.some(r => r.attributeName == "breakout-extend" && r.oldValue === null);
  const viewClosed = records.some(r => r.attributeName == "open") && !urlbar.hasAttribute("open");
  if (!extended || viewClosed) {
    stopSearchSplash();
    stopOpeningSplash();
    return;
  }
  if (opened) {
    onBarOpened();
  }
  // Zen decided to splash (an alias, a one-off button): play ours instead,
  // for as long as the user chose.
  const zenSplashed = records.some(r => r.attributeName == ZEN_SPLASH_ATTR);
  if (zenSplashed && urlbar.hasAttribute(ZEN_SPLASH_ATTR) && urlbar.getAttribute(ATTR_SPLASH) != "zen") {
    playSearchSplash();
  }
});

function onSearchModeChanged(event) {
  try {
    const searchMode = event.detail?.searchMode;
    if (searchMode) {
      // The engine's splash takes over from the opening one.
      stopOpeningSplash();
      if (urlbar.getAttribute(ATTR_SPLASH) == "trace") {
        fitTrace();
      }
    }
    if (
      searchMode?.entry == "shortcut" &&
      searchMode.engineName &&
      !urlbar.hasAttribute("breakout-extend") &&
      !reducedMotion.matches
    ) {
      splashWhenBarOpens(searchMode.engineName);
    }
    showSearchMode(searchMode ?? null);
  } catch (e) {
    console.error("[Search Engine Splash]: couldn't style the search mode", e);
  }
}

const prefObserver = {
  observe() {
    applySplash();
    applyOpenColor();
    applyDurations();
    if (currentSearchMode) {
      showSearchMode(currentSearchMode);
    }
  },
};

const engineObserver = {
  observe() {
    // An engine's icon or name changed, or one was added: start over.
    engineLooks = new Map();
  },
};

/** Computes every engine's look in the background, so even the first splash is colored. */
async function prepareEngines() {
  await SearchService.init();
  for (const engine of await SearchService.getVisibleEngines()) {
    await lookForEngine(engine.name).catch(() => {});
  }
}

if (urlbar && SearchService) {
  applySplash();
  applyOpenColor();
  applyDurations();
  createTrace();
  barObserver.observe(urlbar, {
    attributes: true,
    attributeFilter: ["breakout-extend", "open", ZEN_SPLASH_ATTR],
    attributeOldValue: true,
  });
  window.addEventListener("Zen:UrlbarSearchModeChanged", onSearchModeChanged);
  Services.prefs.addObserver(PREF_BRANCH, prefObserver);
  Services.obs.addObserver(engineObserver, "browser-search-engine-modified");
  window.requestIdleCallback(() => prepareEngines().catch(() => {}));

  window.addUnloadListener?.(() => {
    window.removeEventListener("Zen:UrlbarSearchModeChanged", onSearchModeChanged);
    Services.prefs.removeObserver(PREF_BRANCH, prefObserver);
    Services.obs.removeObserver(engineObserver, "browser-search-engine-modified");
    urlbar.removeAttribute(ATTR_SPLASH);
    urlbar.removeAttribute(ATTR_ICON);
    urlbar.style.removeProperty(VAR_COLOR);
    urlbar.style.removeProperty(VAR_ICON);
    urlbar.style.removeProperty(VAR_OPEN_COLOR);
    urlbar.style.removeProperty(VAR_DURATION);
    urlbar.style.removeProperty(VAR_OPEN_DURATION);
    document.getElementById(TRACE_ID)?.remove();
    barObserver.disconnect();
    stopSearchSplash();
    stopOpeningSplash();
    clearTimeout(pendingEngineTimer);
  });
} else {
  console.warn("[Search Engine Splash]: the URL bar or the search service wasn't found; Zen may have changed.");
}
