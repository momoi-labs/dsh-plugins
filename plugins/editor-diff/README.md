# Editor Diff Viewer Plugin for DSH

A DeepSeek Harness (DSH) Cordis plugin that shows visual diffs of file edits (`edit`/`write` tools) directly in the GUI.

## Features

- **Visual diff panel**: Shows file changes with line numbers and color-coded additions/removals
- **Collapsible files**: Click ▶/▼ to expand/collapse individual file diffs
- **Above composer**: Badge appears above the input area for easy access
- **Dark mode support**: Uses CSS theme variables for automatic light/dark adaptation
- **Centered layout**: Badge and panel are centered for better readability

## How it works

The plugin monitors the session's tool call blocks and extracts `edit` and `write` tool calls. It then renders a badge showing the number of files changed and total additions/removals. Clicking the badge expands a panel showing the diff for each file.

## Installation

This plugin is designed to be loaded as a dynamic Cordis plugin in DSH. Future versions will support persistent installation.

## Future Improvements

- [ ] Split-screen diff view (like Cursor/VS Code)
- [ ] Right sidebar panel option
- [ ] Syntax highlighting
- [ ] File type icons
- [ ] Copy diff to clipboard
