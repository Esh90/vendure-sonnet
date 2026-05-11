# Spike #4719: Ship `@vendure/dashboard` as pre-built ESM bundle

> Tracking issue: https://github.com/vendurehq/vendure/issues/4719
> Motivating issue: https://github.com/vendurehq/vendure/issues/4715
> Branch: `spike/4719-bundled-dashboard`

## Working notes

This file is the working log of the spike. Updated as we go. **Not for merging to master** — final findings will be summarised on the GH issue and this file may be deleted before merge (if the spike is implemented) or kept (if it's reverted).

## Verification protocol

Each step has a clear input, a clear measurement, and a clear pass/fail criterion. Reproducible by anyone with the branch checked out.

### Tooling

- **`@vendure/create`** (latest from npm, or local build) — scaffold a fresh project
- **`@vendure/cli`** (latest from npm, or local build) — scaffold the plugin + dashboard extension
- **`chrome-devtools-mcp`** — accurate network request counts via the browser's network layer
- **`agent-browser`** — scriptable smoke flows
- **`npm pack`** — build & install spike version of `@vendure/dashboard`
- **manual IDE checks** — VS Code for type resolution + go-to-definition

### Scaffold (one-time setup)

```bash
cd /tmp
rm -rf vendure-spike-4719
npx -y @vendure/create@latest vendure-spike-4719 --ci
cd vendure-spike-4719
# server port may default to 3001 if 3000 is taken — update vite.config.mts accordingly
npx -y @vendure/cli@latest add --plugin cms
npx -y @vendure/cli@latest add --dashboard CmsPlugin
```

### Baseline (published dashboard)

Run **before** any changes. Use the version of `@vendure/dashboard` that `@vendure/create` installs from npm.

| Measurement | Tool | Target |
|---|---|---|
| Cold-load `/dashboard/` request count | chrome-devtools-mcp `list_network_requests` (resourceTypes=[script,fetch,xhr]) | _record_ |
| Top 10 raw `@fs/` URL buckets | jq aggregation over the request log | _record_ |
| DOMContentLoaded time | `performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd` | _record_ |
| JS heap used | `performance.memory.usedJSHeapSize` | _record_ |
| Console errors during full flow | chrome-devtools-mcp `list_console_messages` filter=error | _record_ |

### Build & install the spike `@vendure/dashboard`

```bash
cd /Users/micha/Development/vendure/vendure/packages/dashboard
bun run build
npm pack --pack-destination /tmp/spike-4719-artifacts
cd /tmp/vendure-spike-4719
npm install /tmp/spike-4719-artifacts/vendure-dashboard-<version>.tgz
rm -rf node_modules/.vite node_modules/@vendure/dashboard/node_modules/.vite
```

Restart dev servers, re-measure each gate.

## Verification gates

For each gate: ✅ PASS / ❌ FAIL / ⏳ NOT MEASURED YET.

### G1 — Request count reduction

| Sub-check | Baseline | Spike | Status |
|---|--:|--:|:--:|
| Total network requests on `/dashboard/` cold load | — | — | ⏳ |
| Count of `@fs/.*@base-ui/react/` requests | — | — | ⏳ |
| Count of `@fs/.*date-fns/locale/` requests | — | — | ⏳ |

**PASS** = total < 200 AND no @base-ui/react/* OR date-fns/locale/* raw module requests.

### G2 — Functional smoke tests

Run with `agent-browser --session spike-4719` after login.

| Flow | Step | Status |
|---|---|:--:|
| Login | Page renders, accepts creds, navigates to /dashboard/ | ⏳ |
| Dashboard home | Insights, widgets, charts render | ⏳ |
| Product list | Loads, sortable, paginated | ⏳ |
| Product detail | Opens, editable fields work | ⏳ |
| Orders list | Loads, filters work | ⏳ |
| Custom fields | Renders, edits persist | ⏳ |
| Extension Test Page | Renders via /dashboard/test, counter works | ⏳ |

**PASS** = all flows complete without console errors and visual artifacts match baseline screenshots.

### G3 — React Context identity (the showstopper from PR #3631)

Add an extension that consumes multiple Context hooks (`useAuth`, `useUserSettings`, `useServerConfig`). Render in an extension page.

**PASS** = no "must be used within a Provider" errors, hooks return expected values.

Test script: `verification/g3-context-extension.tsx` (TBD)

### G4 — Tailwind v4 class generation

| Sub-check | Method | Status |
|---|---|:--:|
| Built CSS contains all dashboard utility classes | Inspect compiled `dist/assets/index-*.css` | ⏳ |
| Visual regression: dashboard home looks identical to baseline | Screenshot diff | ⏳ |
| Extension author can add custom Tailwind classes | Add `bg-emerald-500` to test extension, verify it renders | ⏳ |

**PASS** = no missing styles in built dashboard, extensions can add classes.

### G5 — Lingui i18n

| Sub-check | Method | Status |
|---|---|:--:|
| Existing 25+ locales work | Switch to de, fr, zh-Hans → strings translated | ⏳ |
| Extension can add own catalogs | Add a `t\`Hello extension\`` to test page, provide po file, verify | ⏳ |
| Locales loaded lazily (not all upfront) | Network log shows only active locale fetched | ⏳ |

**PASS** = all three sub-checks pass.

### G6 — Extension developer experience

| Sub-check | Method | Status |
|---|---|:--:|
| TypeScript resolves `@vendure/dashboard` exports | `tsc --noEmit` in test extension passes | ⏳ |
| VS Code "Go to definition" jumps to source (via sourcemap) | Manual check | ⏳ |
| HMR for extension code still works | Edit extension component, observe reload | ⏳ |

**PASS** = all three pass.

### G7 — Build & bundle size

| Sub-check | Method | Status |
|---|---|:--:|
| `vite build` succeeds without errors | Build the test project | ⏳ |
| Bundle size for prod build ≤ current | Compare `dist/` sizes | ⏳ |
| First-paint metric not regressed | Lighthouse / chrome-devtools-mcp `performance_start_trace` on prod build | ⏳ |

**PASS** = all three pass.

## Implementation steps (we'll work through these one at a time)

These are the changes needed to make the spike viable. Order matters — each step should be verifiable before moving on.

1. **Add Vite build config** for `@vendure/dashboard` that produces an ESM bundle
   - Entry: `src/lib/index.ts`
   - Outputs: `dist/lib/index.js` + `dist/lib/index.d.ts`
   - External all peer deps (react, react-dom)
   - Inline all non-peer node_modules deps that don't need consumer config
   - Generate sourcemap
2. **Update `package.json` exports** to point at `dist/lib/index.js` for `.`, keep current paths for `vite` and `plugin` subpaths
3. **Compile Lingui macros** at publish time (use `@lingui/cli compile` or equivalent)
4. **Export Tailwind config** so consumers can extend it
   - May need to ship a compiled CSS file with all dashboard classes
   - Consumers add `@source` directive for their own extension code
5. **Update `vite-plugin-config.ts`** to remove the `@vendure/dashboard` and `@/vdb` exclusions (no longer needed)
6. **Update README & extension docs** to reflect the new shipping model
7. **Update `packages/create` templates** if any references break
8. **Verification** — run the full protocol from #1 above

## Findings log

### 2026-05-11 — G1 baseline measurement

**Setup:**
- `/tmp/vendure-4715-test` (scaffolded via `@vendure/create@3.6.3 --ci`)
- One dashboard extension installed via `npx @vendure/cli@3.6.3 add --dashboard CmsPlugin`
- `@vendure/dashboard@3.6.3` installed clean from npm (verified via `dist/vite/vite-plugin-config.js` matches the published source)
- Vite cache cleared (`rm -rf node_modules/@vendure/dashboard/node_modules/.vite`)
- Cold-load of `http://localhost:5173/dashboard/` (already-authenticated session → lands on Insights with sidebar)

**Network**:

| Metric | Value |
|---|--:|
| Total requests (script/fetch/xhr) | **3,054** |
| @fs requests (unbundled node_modules) | 2,492 |
| `src/*` requests (dashboard's own source) | 472 |
| `.vite/deps/*` (pre-bundled chunks) | 30 |
| Status 200 | 2,601 |
| Status 304 (cached) | 399 |

**Top @fs/ buckets (per-library, in node_modules):**

| Library | Requests |
|---|--:|
| `@base-ui/react` | 609 |
| `date-fns/locale` | 531 |
| `motion-dom` | 218 |
| `react-day-picker/dist` | 206 |
| `framer-motion/dist` | 150 |
| `zod/v4` | 69 |
| `@vendure-io/ui` | 57 |
| `graphql/validation` | 41 |
| `@base-ui/utils` | 40 |
| `motion-utils/dist` | 30 |
| `graphql/utilities` | 23 |
| `graphql/jsutils` | 23 |
| `graphql/language` | 16 |
| `@tiptap/pm` | 11 |
| `zod/v3` | 10 |
| others (use-callback-ref, use-sidecar, etc.) | ~50 combined |

**Other measurements:**

| Metric | Value |
|---|--:|
| DOMContentLoaded | 897 ms (fast Mac) |
| Load event | 903 ms |
| JS heap used | 168.3 MB |
| JS heap total | 203.5 MB |
| Console errors during load | 0 |

**Notes**:
- This is the *Insights* page, not the login page. The numbers are *higher* than the original #4715 login-page measurement (2,617) because the sidebar's Settings menu was expanded by default, eagerly loading more routes.
- A truly cold "login-page" measurement was 2,617 (recorded earlier in #4715 investigation).
- 472 dashboard `src/*` requests are unavoidable today because Vite's `root` is set to the dashboard package; if we ship as a bundle this drops to ~1 chunk.
- The aggregated `@fs` count (2,492) is exactly the contributors that bundle pre-bundling would collapse. Target after bundling: < 100 total.

**Verdict on G1 baseline:** ✅ Captured. Next step: implement Step 1 (Vite build config) and re-measure.


