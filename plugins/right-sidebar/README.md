# Right Sidebar API for DSH

A DeepSeek Harness (DSH) Cordis plugin that exposes a **generic
right-sidebar API**. Other plugins open the shipped "Details" column
programmatically and render their own UI inside it, aligned with the
same chrome (header bar, close button) the shipped sidebar uses.

The plugin injects a Client Service named `sidebar`; consumers
register with `ctx.get('sidebar')` and don't have to know anything
about slots, key domains, or registration ordering. The plugin
packages them into one self-contained occupant.

## Minimal consumer

In any Client plugin's `apply(ctx)`:

```js
const sidebar = ctx.get('sidebar')
if (sidebar === undefined) return

function MyView(props) {
  return React.createElement('div', { style: { padding: 14 } },
    'Hello from the right sidebar. Session id: ' + (props.session && props.session.id)
  )
}

// Open (or replace the current body):
sidebar.open({ title: 'My Plugin', body: MyView })

// Toggle from a button:
const onClick = () => sidebar.toggle({ title: 'My Plugin', body: MyView })

// Force-close:
sidebar.close()
```

## API

| Method | Signature | Returns | Notes |
| --- | --- | --- | --- |
| `open` | `({ title: string \| null, body: (props) => ReactElement })` | `() => close` | Latest caller wins; older open requests are silently flushed. Returns the per-call disposer that consumers usually ignore (the Service handles it). |
| `toggle` | `({ title, body })` | `boolean` | If `isOpen()` → calls `close()`; else calls `open()` with the args. Returns the new state. |
| `close` | `()` | `void` | Force-closes every open request. |
| `isOpen` | `()` | `boolean` | `true` if at least one open request is still live. |
| `subscribe` | `(fn: () => void) => () => void` | unsubscribe | `fn` runs after every state change. |

### `body(props)`

The `body` function receives `{ session }`. The session shape is
whatever the shell currently passes to the `details` slot — which is
typically **minimal** (often just `{ toolCallId }`). Do **not**
assume it carries `session.nodes`. If your body needs the full
session, the consumer pattern is to **cache the live session
observed in another slot you control** (e.g.,
`conversation.input.dock`) and fall back to it when the body's
`props.session` is sparse.

```js
let lastFullSession = null

slots.inject('conversation.input.dock', () => slots.register(
  { name: 'conversation.input.dock', id: 'consumer-cache', order: 0 },
  (props) => {
    if (props && props.session) lastFullSession = props.session
    return null
  }
))

function Body(props) {
  const session = (props.session && props.session.nodes)
    ? props.session
    : (lastFullSession || props.session)
  return React.createElement(MyDiffView, { session })
}
```

`body` may throw. The plugin wraps the throw and shows a small red
error message in place of the body, so other tools that depend on
the sidebar are not collateral-damaged by a faulty body.

### `title`

`title` may be a string or a React element (so a consumer can put
inline controls or icons in the header). When `title === null`, no
header row is rendered and only `body` is shown.

### Lifecycle / persistence

- **Latest-call-wins**: calling `open(...)` while another request is
  live flushes the older request. The older `close()` returns from
  the older `open(...)` becomes a no-op so a consumer that missed a
  refresh does not accidentally close the newer request.
- **State mirror**: `open(...)` calls `layout.openDetails()` and
  `close()` calls `layout.closeDetails()`. The column visibility
  stays in sync with the Service state.
- **Shipped "X" button**: clicking the shipped close button fires
  `layout.closeDetails()`. To the user, this looks the same as a
  Service `close()`. The next `open(...)` reopens with the
  caller's body.
- **Disposable**: when this plugin itself stops or updates, every
  open request is closed. `ctx.provide('sidebar', ...)` returns a
  disposer owned by this Fiber, so consumers that registered in
  `ctx.effect(() => sidebar.open(...))` are automatically cleaned
  up.

## How it works

The plugin substitutes the shipped `details` slot parent (single,
session scope). When `isOpen()` is `true`, it renders:

```
  ┌────────────────────────────────────────┐
  │  title (optional)                      │   ← data-rtside="title"
  ├────────────────────────────────────────┤
  │                                        │
  │  body(props)                           │   ← data-rtside="body"
  │                                        │
  └────────────────────────────────────────┘
```

When `isOpen()` is `false`, the plugin returns `null` so the
shipped default ("Click a tool row…") fills back in.

The shell child slot `conversation.details.tool` is **not** used
because the shell only mounts it when a tool call is selected —
that would leave body consumers invisible the rest of the time.
Substituting the parent guarantees visibility.

## Future improvements

- [ ] Stack multiple bodies with a tab strip inside `details`
- [ ] Optional `actions` array on `open` that renders header buttons
- [ ] Persistent open state per consumer / per session
- [ ] Optional left-pane Tab companion so consumers can host more
      than one body at a time

## Consumers

- [editor-diff](../editor-diff/README.md) — shows file edits in
  the sidebar via `sidebar.toggle({ title, body })` from the badge
  above the composer. See that plugin's README for the
  cached-session pattern.
