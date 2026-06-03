# @yohakuforce/core

[![npm](https://img.shields.io/npm/v/@yohakuforce/core.svg)](https://www.npmjs.com/package/@yohakuforce/core)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**Salesforce metadata → SQLite knowledge graph → deterministic Markdown.**

Core is the deterministic foundation layer of the [余白フォース / yohakuforce](../../README.md) suite.
It turns Salesforce DX metadata into a queryable SQLite knowledge graph, then renders
documentation **deterministically** — the same input always produces the same output, and every
fact carries its provenance. **Core never calls an LLM**; it is the stable scaffold that AI tools
build on top of.

---

## Why deterministic?

AI-generated docs drift: re-run them and you get different prose, sometimes different facts.
Core separates the two concerns — it owns the **deterministic** half (extract → graph → render),
and leaves the **interpretive** half (explanations, summaries) to AI tools that consume the graph.
That makes the output auditable and reproducible.

## Install

```bash
npm install -g @yohakuforce/core
yohaku --help
```

## Quick start

```bash
# 1. Initialise the scaffold in your Salesforce DX project
yohaku init --bootstrap --profile standard

# 2. Build the knowledge graph from force-app/ metadata
yohaku graph build --incremental

# 3. Inspect the graph
yohaku graph schema --tables
yohaku graph query "SELECT name FROM sobject LIMIT 10"

# 4. Render documentation (deterministic Markdown)
yohaku render all            # everything
yohaku render system-index   # project overview
yohaku render objects        # per-SObject (fields / validation rules / dependencies)
yohaku render flows          # per-Flow
yohaku render apex           # per-ApexClass
```

## Pipeline

```
Salesforce metadata  →  SQLite knowledge graph  →  deterministic render  →  Markdown docs
   (SFDX / DX-MCP)        (yohaku graph build)        (yohaku render)
```

## Optional: Context-Hub context injection

Core can pull abstracted project context from [Context-Hub](https://pypi.org/project/yohakuforce-context-hub/)
to enrich `explain` / `change-summary` output. It is **opt-in** (default: `none`), configured in
`.yohaku/config.json`, and only abstracted context is used — customer names, PII and secrets are
never written into generated artifacts.

```bash
yohaku context --kind explain --fqn Account
```

## Design principles

1. **Three-layer separation** — deterministic processing lives here; AI inference does not.
2. **Deterministic I/O** — same input → same output, verified by golden tests.
3. **Read `force-app/`, never write it** — the source of truth is never mutated.
4. **Graph is CLI-only** — no direct INSERTs from AI or hooks.

## The suite

Core is one of three layers (Core / Context-Hub / AI Manager). See the official help site
at [yohakuforce.github.io/docs](https://yohakuforce.github.io/docs/) for how they fit together.

## License

Apache-2.0
