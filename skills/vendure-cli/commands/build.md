# vendure build

Compiles a Vendure project for production: the server and worker are compiled
with TypeScript, the dashboard with Vite.

## Usage

```
npx vendure build [target]
```

`target` (optional, default `all`): `all` | `server` | `worker` | `dashboard`.

## Options

| Option                     | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| `--tsconfig <path>`        | Server TypeScript config (also used by the worker unless overridden) |
| `--worker-tsconfig <path>` | Separate TypeScript config for the worker                            |
| `--vite-config <path>`     | Vite config used by the dashboard build                              |
| `--experimental-tsgo`      | Use the experimental native TypeScript compiler for server/worker    |
| `--clean`                  | Delete build output directories before building                      |
| `--watch`                  | Rebuild on source changes (long-running)                             |
| `--no-progress`            | Disable spinner/progress rendering — use for stable CI logs          |
| `--verbose`                | Show full output from the underlying build tools                     |

## Notes

- For CI or scripted builds, prefer `--no-progress` so logs stay parseable, and
  `--verbose` when you need to diagnose a failure.
- `--watch` is long-running — do not use it for a one-off build.

## Examples

```bash
npx vendure build                       # build everything
npx vendure build server --clean        # clean rebuild of just the server
npx vendure build --no-progress --verbose
```
