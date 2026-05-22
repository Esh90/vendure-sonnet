---
name: vendure-cli
description: >-
  Use the Vendure CLI (`vendure`) to scaffold, run, build, migrate and
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

## Running the CLI

`@vendure/cli` is normally a project dependency, so run it through the
project's package manager — do **not** assume `npx`. Detect the package
manager from the lockfile in the project root and use the matching runner:

| Lockfile in project root | Package manager | Run the CLI with              |
| ------------------------ | --------------- | ----------------------------- |
| `bun.lock` / `bun.lockb` | bun             | `bunx vendure <command>`      |
| `pnpm-lock.yaml`         | pnpm            | `pnpm exec vendure <command>` |
| `yarn.lock`              | yarn            | `yarn vendure <command>`      |
| `package-lock.json`      | npm             | `npx vendure <command>`       |
| none found               | npm (fallback)  | `npx vendure <command>`       |

If `@vendure/cli` is installed globally, call `vendure <command>` directly.
List all commands with `vendure --help`.

The `commands/*.md` reference files write examples with a bare `vendure …` —
prefix each one with the runner for the detected package manager.

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

1. **Never hardcode `npx`.** Resolve the runner from the project's lockfile —
   see "Running the CLI" above (`bunx`, `pnpm exec`, `yarn`, `npx`).
2. **Prompt-capable commands (`add`, `migrate`, `schema`, `codemod`) need
   explicit flags/arguments from agents.** Run them with explicit inputs so they
   take the non-interactive path; otherwise the process rejects prompt-only
   invocations in non-interactive environments. Set
   `VENDURE_CLI_NON_INTERACTIVE=true` when calling the CLI from an agent so
   prompt-only invocations fail fast with examples instead of waiting on a
   terminal prompt. The exact non-interactive flags are in each command's
   reference file.
3. **`dev`, `start`, and `build --watch` are long-running processes.** Do not
   run them just to "check" something. Run them only when the user asks, and
   prefer running them in the background.
4. **Read the relevant `commands/*.md` file before building a command.** Valid
   targets and flags differ per command (e.g. `start` has no `dashboard`
   target; `--inspect` only applies to `dev`).
