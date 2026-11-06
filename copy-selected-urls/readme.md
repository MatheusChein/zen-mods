# Copy Selected URLs

Arc's `Cmd+Shift+C` for several tabs at once. Select tabs (`Cmd`-click or `Shift`-click them in the sidebar), press `Cmd+Shift+C` (`Ctrl+Shift+C` on Windows and Linux), and every selected tab's URL is copied, one per line:

```
https://github.com/MatheusChein/zen-mods
https://zen-browser.app/
https://sineorg.github.io/
```

With a single tab selected, nothing changes: Zen copies the current URL and shows its usual toast.

## Details

- URLs come out in the order the tabs appear in the sidebar.
- They're cleaned up the same way Zen cleans the single-tab copy: tracking parameters are stripped when Firefox's "strip on share" is on, and reader view copies the original page's address.
- Unloaded tabs are included with their real URL.
- Tabs left selected in another Space are skipped, and so are empty new tabs.
- The list is copied as plain text, so it pastes as URLs everywhere, including Slack, Notion and Google Docs.
- If you've changed the shortcut in Zen's keyboard shortcut settings, the new one works too. So does the "Copy current URL" action in the command palette.

## Options

- **Also copy every selected tab with Cmd+Opt+Shift+C**: Zen's "copy as Markdown" shortcut copies one `[Title](url)` line per selected tab. On by default.

## Notes

This mod is a small script, so it needs a Zen restart after installing or updating. Turning it off takes effect right away.
