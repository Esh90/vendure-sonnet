# vendure codemod

Runs an automated code transform over a Vendure project.

## Interactive vs non-interactive

Running `vendure codemod` with **no `transform` argument** launches an
interactive picker that blocks on a prompt. **Agents must pass the transform
name** so the command runs non-interactively.

## Usage

```
npx vendure codemod <transform> [path]
```

- `transform` — name of the codemod to run (see below).
- `path` — optional file or directory to transform. Defaults to the current
  working directory. Only supported in non-interactive mode.

## Available transforms

| Transform           | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `dashboard-base-ui` | Migrate dashboard extensions from Radix UI to Base UI patterns  |

Run `npx vendure codemod` (interactively) or check the CLI's codemod registry
for the current list if a transform name is not recognised.

## Examples

```bash
npx vendure codemod dashboard-base-ui
npx vendure codemod dashboard-base-ui ./src/plugins/my-plugin
```
