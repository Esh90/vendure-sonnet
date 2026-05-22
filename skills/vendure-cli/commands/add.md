# vendure add

Scaffolds a feature into a Vendure project — a new plugin or a piece of an
existing plugin.

## Interactive vs non-interactive

`vendure add` with **no flags** launches an interactive wizard and blocks on
terminal prompts. **Agents must pass flags** so the command takes the
non-interactive path. Supplying any flag below switches to non-interactive
mode.

## Usage

```
npx vendure add <feature-flag> [value] [sub-options]
```

| Feature flag                  | Creates                                  | Required sub-options (non-interactive)         |
| ------------------------------ | ----------------------------------------- | ---------------------------------------------- |
| `-p, --plugin <name>`          | A new plugin                              | —                                              |
| `-e, --entity <name>`          | An entity in an existing plugin           | `--selected-plugin <name>`                     |
| `-s, --service <name>`         | A service in an existing plugin           | `--selected-plugin <name>`                     |
| `-j, --job-queue [plugin]`     | A job queue handler                       | `--name <name>`, `--selected-service <name>`   |
| `-c, --codegen [plugin]`       | GraphQL codegen configuration             | —                                              |
| `-a, --api-extension [plugin]` | An API extension scaffold                 | `--selected-service <name>`                    |
| `-d, --dashboard [plugin]`     | Dashboard UI extensions                   | —                                              |
| `-u, --ui-extensions [plugin]` | Admin UI extensions (**deprecated** — prefer `--dashboard`) | —                     |

### Sub-options

| Sub-option                  | Used with        | Description                                         |
| --------------------------- | ---------------- | --------------------------------------------------- |
| `--selected-plugin <name>`  | `-e`, `-s`       | Plugin to add the entity/service to                 |
| `--custom-fields`           | `-e`             | Add custom fields support to the entity             |
| `--translatable`            | `-e`             | Make the entity translatable                        |
| `--type <basic\|entity>`    | `-s`             | Service type (default `basic`)                      |
| `--selected-entity <name>`  | `-s`             | Entity for an entity service (forces `--type entity`) |
| `--name <name>`             | `-j`             | Name for the job queue                              |
| `--selected-service <name>` | `-j`, `-a`       | Service to attach the job queue / API extension to  |
| `--query-name <name>`       | `-a`             | Name for the generated query                        |
| `--mutation-name <name>`    | `-a`             | Name for the generated mutation                     |
| `--config <path>`           | any              | Path to a custom Vendure config file                |

## Notes

- `--entity` and `--service` require `--selected-plugin` in non-interactive
  mode, or the command errors out.
- If the target plugin/service does not exist yet, create it first
  (`vendure add -p <name>`).

## Examples

```bash
# New plugin
npx vendure add -p ReviewsPlugin

# Translatable entity with custom fields, in an existing plugin
npx vendure add -e ProductReview --selected-plugin ReviewsPlugin --custom-fields --translatable

# Entity-backed service
npx vendure add -s ReviewService --selected-plugin ReviewsPlugin --type entity --selected-entity ProductReview

# API extension with a query and mutation
npx vendure add -a ReviewsPlugin --selected-service ReviewService --query-name reviews --mutation-name createReview

# GraphQL codegen + dashboard extensions
npx vendure add -c ReviewsPlugin
npx vendure add -d ReviewsPlugin
```
