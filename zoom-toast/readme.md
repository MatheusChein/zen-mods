# Zoom Toast

Arc's zoom popup. When you zoom a page, the new zoom level (e.g. **120%**) appears in Zen's toast at the top right, the same popup as "Copied current URL!". Zen on its own only shows the zoom level inside the URL bar, so you don't see it while the URL bar is closed.

It shows for every way of zooming:

- `Cmd +`, `Cmd -` and `Cmd 0` (`Ctrl` on Windows and Linux);
- **View → Zoom** in the menu bar;
- clicking the zoom level in the URL bar to reset it;
- zooming with the mouse wheel.

Zooming again while the toast is on screen updates the number in place.

## Notes

- Opening a site that Zen remembers a zoom level for doesn't show the toast; only zooming does.
- Pinch-to-zoom on a trackpad magnifies the page without changing its zoom level, so it doesn't show the toast (Zen shows nothing for it either).
- In Reader View and the PDF viewer, zooming changes the text size or the viewer's own zoom instead, so the toast stays out of the way there.
- This mod is a small script, so it needs a Zen restart after installing or updating. Turning it off takes effect right away.
