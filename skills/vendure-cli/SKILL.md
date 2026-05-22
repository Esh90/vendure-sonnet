---
name: vendure-cli
description: >-
  Use the Vendure CLI (`npx vendure`) to scaffold, run, build, migrate and
  maintain a Vendure ecommerce project. Use whenever working inside a Vendure
  project that needs a dev server, a production build, database migrations,
  plugin/entity/service scaffolding, GraphQL schema generation, or codemods.
allowed-tools: Bash, Read, Edit, Glob, Grep
---

# Vendure CLI

The Vendure CLI (`@vendure/cli`, binary `vendure`) drives the full lifecycle of
a Vendure project. Use it instead of hand-writing boilerplate or guessing build
and migration commands.

## Detecting a Vendure project

A directory is a Vendure project if its `package.json` — or a parent's —
depends on `@vendure/core`. The CLI walks up the directory tree to find it, so
commands can be run from any subdirectory of the project.

## Invoking the CLI

- If `@vendure/cli` is a project dependency: `npx vendure <command>`
- If installed globally: `vendure <command>`
- List commands and version: `npx vendure --help`

## Commands

| Command   | Use it to…                                              | Reference             |
| --------- | ------------------------------------------------------- | --------------------- |
| `dev`     | Run server + worker + dashboard in development mode     | `commands/dev.md`     |
| `build`   | Compile the project for production                      | `commands/build.md`   |
| `start`   | Run an already-built project                            | `commands/start.md`   |
| `add`     | Scaffold a plugin, entity, service, API extension, etc. | `commands/add.md`     |
| `migrate` | Generate, run or revert database migrations             | `commands/migrate.md` |
| `schema`  | Generate a GraphQL schema file from the Admin/Shop API  | `commands/schema.md`  |
| `codemod` | Run automated code transforms (e.g. UI migrations)      | `commands/codemod.md` |

## Critical rules for agents

1. **`add` and `codemod` are interactive by default.** Run them with explicit
   flags/arguments so they take the non-interactive path — otherwise the
   process blocks waiting on a terminal prompt. The exact non-interactive flags
   are in each command's reference file.
2. **`dev`, `start`, and `build --watch` are long-running processes.** Do not
   run them just to "check" something. Run them only when the user asks, and
   prefer running them in the background.
3. **Read the relevant `commands/*.md` file before building a command.** Valid
   targets and flags differ per command (e.g. `start` has no `dashboard`
   target; `--inspect` only applies to `dev`).
