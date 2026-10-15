---
name: docs-from-code
description: >
  Generate premium HTML documentation from JavaScript, TypeScript, and Python source
  by parsing AST and JSDoc/docstrings. Produces a GitBook-like three-column docs site
  with symbols, params, returns, and examples. Use when the user asks to "generate docs",
  "document codebase", or "create API reference".
version: 1.0.0
license: MIT
author: "@Legitcraft"
tags:
  - documentation
  - jsdoc
  - typescript
  - python
  - html
agents:
  - claude-code
  - codex
  - opencode
  - cursor
  - github-copilot
---

# docs-from-code

Generate a premium, GitBook-style documentation site from your JS/TS/Python source.

## Quick start

```bash
npm install
node src/index.js <src-dir> [out-dir]
```

Default output dir is `<src-dir>/docs`.

## Features

- Parses JavaScript, TypeScript, and Python via language ASTs.
- Extracts functions, classes, interfaces, types, enums, constants.
- Renders JSDoc/Python docstrings, params, returns, and examples.
- Premium GitBook-like HTML with sidebar, content, and on-page TOC.
- File and symbol search.

## Requirements

- Node.js >= 18 (for TS/JS)
- Python >= 3.9 (for Python files)

## Example

```bash
node src/index.js ./src ./docs
```

Open `./docs/index.html` in a browser.
