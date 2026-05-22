# vendure start

Runs a project that has already been compiled with `vendure build`.

## Usage

```
npx vendure start [target]
```

`target` (optional, default `all`): `all` | `server` | `worker`.

There is **no `dashboard` target** — the dashboard is built to static assets
and served by the server.

## Options

| Option                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `--server-entry <path>` | Path to the compiled server entry file   |
| `--worker-entry <path>` | Path to the compiled worker entry file   |

## Notes

- Run `vendure build` first. `start` does not compile anything; it runs the
  already-compiled output.
- This is a **long-running process** — run it only when the user asks, and
  prefer the background.

## Examples

```bash
npx vendure build && npx vendure start   # build then run
npx vendure start worker                 # run just the worker
```
