---
name: verify-ui
description: Check a UI change in Ultimate by looking at it with the screenshot and browser tools, on a preview or, after warning the user, the running host. Use after changing anything a person sees (web/, a web.tsx, a card, a renderer) and before reporting it done or asking for approval.
---

# Look at the change

Never claim a UI change works without an image of it.

## Where to look

- Prefer a preview: start one of your checkout (`instance start`) and pass its URL. A worktree, a branch or a project
  `.ultimate/extensions/` change reaches only a preview, and `server/` or `shared/` changes need a fresh one.
- The running host (omit `url`) is the user's own UI: driving it with `browser` or `screenshot` can switch their tabs
  and conversation. Use it only when that is faster (a change already live in the host's checkout) and warn or ask
  the user first; a branch asks through @ultimate. They may step away or open another session meanwhile.

## How

- `screenshot {url}` for a still image; `selector` for one element, `fullPage` for long pages, `width: 390` for phone,
  `theme: 'light'` and `'dark'` for both themes. Omit `path` so the PNG stays outside your checkout.
- `browser {url, steps}` to drive a state: `click`, `fill` (`#composer-input` is the composer), `press`
  (`Control+k` opens ⌘K), `wait`, `eval`. The result lists console errors and failed requests: read them.
- `eval` takes one expression and returns its value: `document.title`,
  `[...document.querySelectorAll('[data-entry-id]')].length`. Statements or `await` go in an async IIFE:
  `(async () => { const r = await fetch('/api/x'); return r.status })()`. A bare `const x = …; return x` fails.
- Scope selectors to the card or panel under test: `[data-entry-id="42"] button:has-text("Retry")`, not
  `button:has-text("Retry")`, which clicks the first match anywhere on the page.
- Wait on Ultimate's state, never a guessed time: `{send: 'prompt'}` submits without the composer, then
  `{until: 'idle'}` returns when that turn is done, `{until: 'quiet'}` when nothing runs (branches and subagents
  included), `{until: {entry: 'pi.tool-result'}}` or `{until: {event: 'workspaces.landed', where: {…}}}` when that
  appears. A timeout says what was still busy. `conversation: <id>` targets another conversation. Click and fill only
  when the interaction itself is under test; never a fixed `wait <ms>`.
- Set up state (model, thinking, Play/Pause, abort) through the page's SDK in one `eval`, or curl the preview's HTTP
  API, not by clicking menus: `{eval: "window.ultimate.api.configure({model: {provider: 'openai-codex', modelId:
  'gpt-6.1-sol'}}, 2)"}`. Also `api.abort(id)`, `api.compact(undefined, id)`, `api.action({extension: 'pause', name:
  'play'}, null)`; `extensions/browser/README.md` has the rest.
- `where` matches only fields the event carries, and events never carry text: after a send, match
  `{event: 'user.input', where: {conversation: <id>, kind: 'prompt'}}`, not the prompt. Each event's fields are in
  `extensions/browser/README.md` and its `defineEvent`. Tool calls live inside `pi.assistant`; there is no
  `pi.toolCall` entry.
- Open a conversation with `?conversation=<id>`. Right-panel section titles show their source text in sentence case
  (the `section-label` utility); match them with `textContent.startsWith('Skills')`, since counts and meta follow.
- Seed real state with real prompts on a preview; do not inject entries.

## When a selector fails

Do not retry with another guess or add a `wait`. Instead:

1. Look first: a `screenshot` of the state, or an `eval` that lists the candidates, such as
   `[...document.querySelectorAll('[data-entry-id]')].map((e) => e.dataset.entryId)`.
2. Pick a stable hook from what is there: a `data-*` attribute, an id or a role, scoped to its card or panel. Text
   and class names change with copy and styling.
3. When the element appears later, wait for the state behind it with `until` (`idle`, `quiet`, an entry or an
   event), then select.
4. No hook to hold on to? Add a `data-*` attribute to the component under test rather than chaining fragile selectors.

## What to check

1. Every state: loading, empty, error, one item, many items, a long title.
2. It matches its neighbours: an existing card or panel next to it, theme tokens, spacing.
3. Transcript UI, on a long conversation:
   1. scrollback: scroll up and back down; nothing jumps or reflows;
   2. live streaming: watch a reply and its tool calls stream in;
   3. folding: fold and unfold tool calls and update groups;
   4. phone width: a screenshot at `width: 390`.
4. No new console errors.

Say what you could not reach as unverified, with the reason.
