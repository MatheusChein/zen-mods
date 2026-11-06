# Command Palette Fade

Arc-style animations for Zen's floating URL bar (the one that opens with `Cmd+T` / `Ctrl+T`):

- **Open**: fades in while growing from 90% to full size, instead of snapping into place.
- **Close**: fades out while shrinking back to 90%, instead of disappearing instantly.

The close animation respects mods that hide URL bar results (e.g. No Top Sites): whatever was on screen is what fades out.

## Works with themes

Themes that restyle the URL bar, like Arc 2.0, keep their look: the bar fades out with the same background, blur, size and corners it had while open. Only the motion comes from this mod. Other animations on the floating bar (slide-ins, result pop-ins, hover lifts) are switched off so they don't stack with these.

## Options

- **Open animation duration**: any CSS time value, e.g. `160ms` (default) or `0.25s`.
- **Close animation duration**: e.g. `180ms` (default).
- **Grow in / shrink out**: scale between 90% and full size along with the fade. On by default.

Both animations are skipped when the system "Reduce motion" setting is on.

## Notes

The close animation uses a small script (Zen removes the floating bar instantly, so CSS alone can't animate it out). A CSS-only version with just the open animation is available in the Zen Mods store.
