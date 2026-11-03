# Command Palette Fade

Makes Zen's floating URL bar (the one that opens with `Cmd+T` / `Ctrl+T`) fade in while growing from 90% to full size, Arc-style, instead of snapping into place.

## Options

- **Open animation duration**: any CSS time value, e.g. `160ms` (default) or `0.25s`.
- **Grow in**: scale up from 90% along with the fade. On by default.

The animation is skipped when the system "Reduce motion" setting is on.

## Want a close animation too?

Zen removes the floating bar instantly when it closes, so a fade-out needs a small script, which Zen Mods can't include. The [Sine version](https://github.com/MatheusChein/zen-mods/tree/main/command-palette-fade) adds a matching fade-and-shrink close animation.
