# Rename Tab Shortcut

Arc's keyboard shortcut for renaming a tab. Press `Cmd+Shift+E` (`Ctrl+Shift+E` on Windows and Linux) and the current tab's name turns into a text field, just like double-clicking it:

- **Enter** saves the new name.
- **Escape** cancels.
- Saving an **empty name** goes back to the page's own title.

After Enter or Escape, focus goes back to the page, so you can keep typing or scrolling.

## Changing the shortcut

The shortcut appears as **Rename Tab** in the File menu, and in Zen's keyboard shortcut settings (`about:keyboard`), where you can change it like any built-in shortcut.

## Options

- **Use the shortcut even on pages that have their own**: on by default, so the shortcut always renames the tab, the way `Cmd+T` always opens a new tab. Turn it off to let pages that use `Cmd+Shift+E` (Google Docs uses it to center text) keep it.

## Notes

- It renames the tab you're on: the focused side in split view, or the original tab when a Glance preview is open.
- It follows Zen's own rules for renaming: it does nothing for Essentials, when the sidebar is collapsed to icons, or when tab renaming is turned off in Zen's settings. In compact mode, the sidebar slides out while you rename.
- This mod is a small script, so it needs a Zen restart after installing or updating. Turning it off takes effect right away.
