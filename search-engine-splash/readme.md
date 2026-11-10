# Search Engine Splash

Makes picking a search engine in the URL bar feel like Arc. When you type an engine's alias and a space (`yt` + space for YouTube), use ⌘K, or click a one-off search button, the bar plays a splash in **that engine's own color**, and the engine's label gets the same color plus its icon.

## Splashes

- **Glow**: a ring of color around the bar that blooms outward and fades (the default).
- **Sweep**: a band of color washes across the bar.
- **Ripple**: a circle of color spreads out from the engine's label.
- **Trace**: two glowing streaks race around the border from opposite corners, each ending at the other's starting corner.
- **Zen's original** keeps Zen's own glow, and **None** turns the splash off.

## Colors

- **Match the search engine's icon** (default): the color is taken from the engine's icon, so YouTube splashes red, Bing blue and DuckDuckGo orange. Black-and-white icons (Wikipedia, Perplexity) use Zen's accent color instead.
- **Zen's accent color**, or a **custom color** (any CSS color, like `#8b5cf6` or `tomato`).

## Splash when the URL bar opens

Optionally, a splash can also play every time the URL bar opens, with its own style and its own color. By default it uses Zen's accent color, which follows each Space's theme. When the bar opens straight into a search engine (⌘K, or a shortcut from Search Engine Shortcuts), only that engine's splash plays.

## Options

- **Splash animation** and **Color**, as above.
- **Splash duration**, e.g. `900ms` (default) or `1.5s`.
- **Show the search engine's icon in the label.**
- **Splash when the URL bar opens**: Off by default. Its color and duration have their own settings.

## Notes

- ⌘K (Firefox's "search the web" shortcut) opens the bar in the default engine's search mode. Zen plays no splash for it, but this mod does.
- Works alongside Command Palette Fade: the splash plays while the bar fades in, and stops as soon as the bar starts closing.
- With **Search Engine Shortcuts**, each engine can have its own keyboard shortcut, and pressing one plays that engine's splash.
- Respects the system's reduce motion setting: no splashes and no label animation.
- This mod includes a small script, so it needs a Zen restart after installing or updating.
