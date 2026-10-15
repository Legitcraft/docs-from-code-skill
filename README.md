# docs-from-code

Generate premium, GitBook-style HTML documentation from JavaScript, TypeScript, and Python source code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install as a skill

```bash
npx skills add Legitcraft/docs-from-code-skill
```

## CLI usage

```bash
npm install
node src/index.js <src-dir> [out-dir]
```

Defaults to `<src-dir>/docs` when no output dir is given.

## What it extracts

- Functions, classes, interfaces, type aliases, enums, constants
- JSDoc / Python docstrings
- `@param`, `@returns`, `@example` tags
- Signatures

## Requirements

- Node.js >= 18
- Python >= 3.9 (for Python files)

## License

MIT
