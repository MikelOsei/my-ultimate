The Appearance panel and the light and dark toggle: the project's window title and accent, and this browser's theme
and conversation text size.

⌘K **Appearance…**, or the palette button in the title bar beside the command palette, opens the panel:

- **Window title:** what the project's windows, tabs, sidebar and installed app are called; empty is the project's
  folder name. A branch's checkout keeps its `name #id`, and a test preview its `preview ·` prefix.
- **Theme:** Charcoal (the default), Ruby (Charcoal half a step darker with a ruby tinge), Dracula, Candy (plum and
  pastels) and Midnight (blue slate) are dark; Light is light. Each sets the surfaces, lines and text and brings a
  default accent; their tokens are in `web/src/index.css`, their names, accents and browser-bar colours in
  `appearance.tsx`. **Match system** follows the operating system's theme while the page is open: Light when it is
  light, the last chosen dark theme when it is dark. Choosing a theme stops matching.
- **Accent:** Theme (the theme's own) or one of seven presets for the one accent colour (`--brand`, also focus rings,
  text selection and the icon). Each theme fixes the accent's lightness, so a preset changes only its hue and chroma
  and reads as well as the default violet; the table is in `web/src/index.css`.
- **Conversation text:** 14 to 17 px for conversation prose (`--prose-size`); its code, tables and thinking follow it.
  The rest of the window scales with the browser's zoom.

The title and a chosen accent are the project's on this machine, shared by every browser of it: the server keeps them in
`appearance.json` in the project's home (never the repository) and serves the installed app's manifest
(`/api/manifest.webmanifest`, named for the title) and icon (`/api/icon.svg`, in the accent) from them
(`server/appearance.ts`). Chrome takes a new name or icon on when it next checks the manifest, asking first; reinstall
the app to see it at once. Without a chosen accent the app's icon is violet. The tab's icon follows the accent live.

The rest is a preference of this browser, not synced across devices: the shell keeps light or dark in
`localStorage` as `ultimate.theme` and applies it as the `dark` class; `appearance.tsx` keeps the rest, with a copy of
the accent shown, as `ultimate.appearance`, the dark theme as `data-theme` on the root, and `web/index.html` applies
both before the first paint, so a reload never flashes the default look. ⌘K **Toggle light and dark theme** switches with `context.setTheme` and stops following the
system.
