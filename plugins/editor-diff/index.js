/**
 * DSH Plugin: Editor Diff Viewer
 * Shows visual diffs of file edits (edit/write tools) above the composer input.
 */

module.exports = {
  name: 'editor-diff-viewer',
  version: '1.0.0',

  host: {
    apply(ctx) {
      // Host-side: minimal ping handler
      harness.handle('ping', () => ({ ok: true }));
    }
  },

  client: {
    apply(ctx) {
      const slots = ctx.get('slots');
      if (slots === undefined) return;

      slots.inject('conversation.input.dock', () => slots.register(
        { name: 'conversation.input.dock', id: 'diff-badge', order: 0 },
        (props) => {
          const session = props?.session;
          if (!session) return null;

          const nodes = session?.nodes || [];
          const edits = [];

          nodes.forEach((node) => {
            const blocks = node?.blocks || [];
            blocks.forEach((block) => {
              const blockType = block?.type || block?.kind || null;
              const toolName = block?.name || null;
              const argsRaw = block?.argsRaw || null;

              let input = {};
              if (argsRaw && typeof argsRaw === 'string') {
                try { input = JSON.parse(argsRaw); } catch (e) { input = {}; }
              } else if (argsRaw && typeof argsRaw === 'object') {
                input = argsRaw;
              }

              if ((blockType === 'tool-call' || blockType === 'tool_call') && (toolName === 'edit' || toolName === 'write')) {
                const path = input?.file_path || input?.path || null;
                if (path) {
                  edits.push({
                    tool: toolName,
                    path: path,
                    oldString: input?.old_string || '',
                    newString: input?.new_string || '',
                    content: input?.content || ''
                  });
                }
              }
            });
          });

          if (edits.length === 0) return null;

          const totalAdditions = edits.reduce((sum, e) => sum + (e?.newString?.length || 0) + (e?.content?.length || 0), 0);
          const totalRemovals = edits.reduce((sum, e) => sum + (e?.oldString?.length || 0), 0);

          const [open, setOpen] = React.useState(false);
          const [openFiles, setOpenFiles] = React.useState({});

          const toggleFile = (path) => setOpenFiles((prev) => ({ ...prev, [path]: !prev[path] }));

          const wrapperStyle = {
            marginTop: '8px',
            marginBottom: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          };

          const badgeStyle = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'var(--bg-secondary, #f5f5f5)',
            border: '1px solid var(--border-color, #e0e0e0)',
            borderRadius: '16px',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: 'var(--text-primary, #333)'
          };

          const additionsStyle = { color: 'var(--success, #0a0)', fontWeight: 'bold' };
          const removalsStyle = { color: 'var(--danger, #c00)', fontWeight: 'bold' };

          const panelStyle = {
            border: '1px solid var(--border-color, #e0e0e0)',
            borderRadius: '6px',
            overflow: 'hidden',
            background: 'var(--bg-primary, #fff)',
            marginTop: '8px',
            marginBottom: '8px',
            maxHeight: '400px',
            overflowY: 'auto',
            width: '100%',
            maxWidth: '800px'
          };

          const headerStyle = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--bg-secondary, #f5f5f5)',
            fontSize: '13px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            borderBottom: '1px solid var(--border-color, #e0e0e0)',
            color: 'var(--text-primary, #333)',
            position: 'sticky',
            top: 0,
            zIndex: 1
          };

          const fileStyle = {
            borderBottom: '1px solid var(--border-color, #e0e0e0)'
          };

          const fileHeaderStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            background: 'var(--bg-secondary, #f8f8f8)',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'monospace',
            border: 'none',
            width: '100%',
            textAlign: 'left',
            color: 'var(--text-primary, #333)'
          };

          const diffLineStyle = (type) => ({
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '2px 6px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            background: type === 'rem' ? 'rgba(255,0,0,0.06)' : type === 'add' ? 'rgba(0,255,0,0.06)' : 'transparent',
            color: type === 'rem' ? 'var(--danger, #c00)' : type === 'add' ? 'var(--success, #0a0)' : 'var(--text-primary, #333)',
            borderLeft: type === 'rem' ? '3px solid var(--danger, #c00)' : type === 'add' ? '3px solid var(--success, #0a0)' : '3px solid transparent',
            display: 'flex',
            gap: '8px'
          });

          const lineNumStyle = {
            minWidth: '28px',
            textAlign: 'right',
            color: 'var(--text-secondary, #888)',
            fontSize: '10px',
            userSelect: 'none'
          };

          function renderDiff(edit) {
            const lines = [];
            let lineNum = 1;

            if (edit.tool === 'edit') {
              const oldLines = (edit.oldString || '').split('\n');
              const newLines = (edit.newString || '').split('\n');
              oldLines.forEach((l) => lines.push({ type: 'rem', text: '-' + l, num: lineNum++ }));
              newLines.forEach((l) => lines.push({ type: 'add', text: '+' + l, num: lineNum++ }));
            } else if (edit.tool === 'write') {
              const newLines = (edit.content || '').split('\n');
              newLines.forEach((l) => lines.push({ type: 'add', text: '+' + l, num: lineNum++ }));
            }

            const isOpen = openFiles[edit.path] || false;

            return React.createElement('div', { key: edit.path, style: fileStyle }, [
              React.createElement('button', {
                key: 'h',
                style: fileHeaderStyle,
                onClick: () => toggleFile(edit.path)
              }, [
                React.createElement('span', { key: 'icon' }, isOpen ? '▼' : '▶'),
                React.createElement('span', { key: 'path', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } }, edit.path),
                React.createElement('span', { key: 'tool', style: { fontSize: '10px', color: 'var(--text-secondary, #888)', flexShrink: 0 } }, edit.tool)
              ]),
              isOpen ? React.createElement('div', { key: 'b', style: { padding: '4px 0' } },
                lines.map((ln, i) => React.createElement('div', { key: i, style: diffLineStyle(ln.type) }, [
                  React.createElement('span', { key: 'n', style: lineNumStyle }, ln.num),
                  React.createElement('span', { key: 't', style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, ln.text)
                ]))
              ) : null
            ]);
          }

          return React.createElement('div', { style: wrapperStyle }, [
            React.createElement('button', {
              key: 'badge',
              style: badgeStyle,
              onClick: () => setOpen((prev) => !prev)
            }, [
              React.createElement('span', { key: 'count' }, edits.length + ' file' + (edits.length > 1 ? 's' : '') + ' changed'),
              totalRemovals > 0 ? React.createElement('span', { key: 'rem', style: removalsStyle }, '-' + totalRemovals) : null,
              totalAdditions > 0 ? React.createElement('span', { key: 'add', style: additionsStyle }, '+' + totalAdditions) : null
            ]),
            open ? React.createElement('div', { key: 'panel', style: panelStyle }, [
              React.createElement('div', { key: 'header', style: headerStyle }, '📝 Diff Review'),
              React.createElement('div', { key: 'body' }, edits.map(renderDiff))
            ]) : null
          ]);
        }
      ));
    }
  }
};
