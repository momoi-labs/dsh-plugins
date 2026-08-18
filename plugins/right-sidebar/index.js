/**
 * DSH Plugin: Right Sidebar (API)
 *
 * Generic right-sidebar API backed by the shipped Details column.
 * When a consumer calls `open({ title, body })`, the plugin takes
 * over the `details` parent slot and renders an aligned header
 * (title) + body. When `isOpen()` returns false (no consumer), the
 * plugin yields the slot back to the shipped default.
 *
 * Consumers do:
 *   const sidebar = ctx.get('sidebar')
 *   sidebar.toggle({ title, body })  // open or close
 *   sidebar.open({ title, body })    // ensure open with this body
 *   sidebar.close()                  // force-close everything
 *   sidebar.isOpen()                 // current state
 *   sidebar.subscribe(fn)            // notified on every change
 *
 * Same shape as plugins/editor-diff (module.exports with host/client).
 */

function ClientApply(ctx) {
  const slots = ctx.get('slots');
  const layout = ctx.get('layout');
  if (slots === undefined || layout === undefined) return;

  // --- Open requests: latest wins. -------------------------------
  const queue = [];
  let openToken = 0;
  const subscribers = new Set();
  const notify = () => subscribers.forEach((fn) => { try { fn(); } catch (_) {} });

  function issueOpen({ title, body }) {
    if (typeof body !== 'function') {
      throw new Error('sidebar.open: body must be a function (props) => ReactElement');
    }
    const id = ++openToken;
    const item = { id, title: title || null, body, stale: false };
    queue.push(item);
    for (const o of queue) if (o.id !== id) o.stale = true;
    try { layout.openDetails(); } catch (_) {}
    notify();
    return function close() {
      if (item.stale) return;
      item.stale = true;
      const idx = queue.indexOf(item);
      if (idx >= 0) queue.splice(idx, 1);
      let live = false;
      for (const q of queue) if (!q.stale) { live = true; break; }
      if (!live) {
        try { layout.closeDetails(); } catch (_) {}
      }
      notify();
    };
  }

  function closeAll() {
    for (const item of queue) item.stale = true;
    queue.length = 0;
    try { layout.closeDetails(); } catch (_) {}
    notify();
  }

  function isOpen() {
    for (const q of queue) if (!q.stale) return true;
    return false;
  }

  function toggle(opts) {
    if (isOpen()) { closeAll(); return false; }
    if (opts) { issueOpen(opts); return true; }
    return false;
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return function unsubscribe() { subscribers.delete(fn); };
  }

  const sidebarService = {
    open: issueOpen,
    close: closeAll,
    toggle,
    isOpen,
    subscribe
  };

  ctx.provide('sidebar', sidebarService);

  // --- Take over the parent `details` slot ----------------------
  // The shipped Details column has its own rendering, but it renders
  // through a child slot (`conversation.details.tool`) that the
  // shell only mounts when a tool call is selected — leaving our
  // body invisible the rest of the time. By substituting the
  // parent `details` slot we guarantee the title + body render
  // whenever the column is open, regardless of selected tool call.
  //
  // When isOpen() is false we return null so the parent slot
  // commands the shipped default.
  slots.inject('details', () => slots.register(
    { name: 'details', id: 'rtside-shell' },
    (props) => {
      let item = null;
      for (let i = queue.length - 1; i >= 0; i--) {
        if (!queue[i].stale) { item = queue[i]; break; }
      }
      if (!item) return null;

      const session = props && props.session;
      const bodyProps = session ? { session } : {};
      let bodyEl;
      try { bodyEl = item.body(bodyProps); }
      catch (e) {
        bodyEl = React.createElement(
          'div',
          { style: { color: 'var(--danger, #c00)', padding: 12 } },
          'Sidebar body threw: ' + (e && e.message ? e.message : String(e))
        );
      }

      const children = [];
      if (item.title) {
        children.push(React.createElement(
          'div',
          {
            key: 'title',
            'data-rtside': 'title',
            style: {
              padding: '10px 14px', fontSize: '13px', fontWeight: 600,
              borderBottom: '1px solid var(--border-color, #e0e0e0)',
              color: 'var(--text-primary, #333)',
              background: 'var(--bg-secondary, #f5f5f5)',
              flex: '0 0 auto'
            }
          },
          String(item.title)
        ));
      }
      children.push(React.createElement(
        'div',
        {
          key: 'body',
          'data-rtside': 'body',
          style: { flex: '1 1 auto', minHeight: 0, overflow: 'auto' }
        },
        bodyEl
      ));

      return React.createElement(
        'div',
        {
          'data-rtside': 'shell',
          style: {
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            boxSizing: 'border-box',
            background: 'var(--bg-primary, #fff)'
          }
        },
        children
      );
    }
  ));
}

module.exports = {
  name: 'right-sidebar',
  version: '0.5.1',
  host: {
    apply() {
      // Reserved for future cross-host registration.
    },
  },
  client: {
    apply: ClientApply,
  },
};
