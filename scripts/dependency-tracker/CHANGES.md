# Vendure dependency audit — change log

This document tracks the dependency footprint of Vendure across the stages of the
[dependency audit effort](#issue-reference). Each stage records the state of the
dependency graph after a discrete change (or batch of changes) has landed on this
branch, so we can quantify the reduction in supply-chain surface area over time.

## Issue reference

See [#4761](https://github.com/vendurehq/vendure/issues/4761) for the full
audit assessment, rationale, and prioritised plan. This document is the
running ledger of how the dependency footprint shrinks as each stage lands.

## How to add a stage

1. Land your changes (delete a dep, swap for a built-in, vendor a package, …).
2. Regenerate the lockfile (does not touch `node_modules`):
   ```bash
   npm install --package-lock-only
   ```
3. Append a snapshot to this file:
   ```bash
   node scripts/dependency-tracker/snapshot.mjs --stage="Stage N — <short description>" --append
   ```
4. Add a short prose `### Changes` section below the snapshot explaining what
   was removed / replaced and why.
5. Commit the lockfile + this file together so the diff in `CHANGES.md` is
   reproducible.

For a machine-readable JSON snapshot (useful for scripting deltas):

```bash
node scripts/dependency-tracker/snapshot.mjs --json > /tmp/before.json
# ... make changes, regen lockfile ...
node scripts/dependency-tracker/snapshot.mjs --json > /tmp/after.json
diff /tmp/before.json /tmp/after.json
```

---

## Stage 0 — Baseline (audit start)

- **Commit:** `51b439372` on `chore/dependency-audit`
- **Date:** 2026-05-21T07:20:14.801Z
- **Total unique production packages:** 1880

### Per-Vendure-package transitive footprint

| Package | Direct deps | Unique transitive (prod) |
|---------|-------------|--------------------------|
| `@vendure/core` | 41 | 453 |
| `@vendure/common` | 0 | 0 |
| `@vendure/email-plugin` | 7 | 290 |
| `@vendure/asset-server-plugin` | 3 | 20 |
| `@vendure/admin-ui-plugin` | 3 | 71 |
| `@vendure/telemetry-plugin` | 9 | 162 |
| `@vendure/harden-plugin` | 2 | 153 |
| `@vendure/job-queue-plugin` | 2 | 23 |
| `@vendure/graphiql-plugin` | 1 | 65 |
| `@vendure/testing` | 8 | 34 |
| `@vendure/cli` | 11 | 92 |
| `@vendure/create` | 11 | 46 |
| `@vendure/dashboard` | 67 | 838 |
| `@vendure/ui-devkit` | 11 | 810 |
| `@vendure/admin-ui` | 48 | 115 |

<details>
<summary>Per-direct-dep transitive counts (click to expand)</summary>

#### `@vendure/core`

| Direct dep | Transitive count |
|-----------|------------------|
| `@nestjs/terminus` | 295 |
| `@nestjs/typeorm` | 260 |
| `@nestjs/apollo` | 237 |
| `typeorm` | 186 |
| `@apollo/server` | 151 |
| `@nestjs/graphql` | 149 |
| `@nestjs/core` | 102 |
| `@nestjs/platform-express` | 102 |
| `express` | 65 |
| `body-parser` | 41 |
| `graphql-upload` | 32 |
| `http-proxy-middleware` | 19 |
| `@nestjs/common` | 18 |
| `@graphql-tools/stitch` | 17 |
| `ioredis` | 11 |
| `cookie-session` | 9 |
| `i18next-icu` | 9 |
| `intl-messageformat` | 8 |
| `fs-extra` | 4 |
| `bcrypt` | 3 |
| `graphql-scalars` | 3 |
| `graphql-tag` | 3 |
| `i18next` | 3 |
| `mime-types` | 2 |
| `rxjs` | 2 |
| `@vendure/common` | 1 |
| `cron-time-generator` | 1 |
| `croner` | 1 |
| `cronstrue` | 1 |
| `csv-parse` | 1 |
| `graphql` | 1 |
| `graphql-fields` | 1 |
| `i18next-fs-backend` | 1 |
| `i18next-http-middleware` | 1 |
| `image-size` | 1 |
| `ms` | 1 |
| `nanoid` | 1 |
| `picocolors` | 1 |
| `progress` | 1 |
| `reflect-metadata` | 1 |
| `semver` | 1 |

#### `@vendure/email-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `mjml` | 140 |
| `@types/nodemailer` | 77 |
| `express` | 65 |
| `handlebars` | 6 |
| `fs-extra` | 4 |
| `dateformat` | 1 |
| `nodemailer` | 1 |

#### `@vendure/asset-server-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `file-type` | 10 |
| `sharp` | 6 |
| `fs-extra` | 4 |

#### `@vendure/admin-ui-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `express-rate-limit` | 66 |
| `fs-extra` | 4 |
| `date-fns` | 1 |

#### `@vendure/telemetry-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `@opentelemetry/auto-instrumentations-node` | 161 |
| `@opentelemetry/sdk-node` | 78 |
| `@opentelemetry/exporter-logs-otlp-proto` | 25 |
| `@opentelemetry/exporter-trace-otlp-http` | 25 |
| `@opentelemetry/sdk-logs` | 6 |
| `@opentelemetry/resources` | 4 |
| `@opentelemetry/context-async-hooks` | 2 |
| `@opentelemetry/api` | 1 |
| `javascript-stringify` | 1 |

#### `@vendure/harden-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `@apollo/server` | 151 |
| `graphql-query-complexity` | 3 |

#### `@vendure/job-queue-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `bullmq` | 23 |
| `ioredis` | 11 |

#### `@vendure/graphiql-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `express` | 65 |

#### `@vendure/testing`

| Direct dep | Transitive count |
|-----------|------------------|
| `form-data` | 20 |
| `node-fetch` | 7 |
| `graphql-tag` | 3 |
| `@graphql-typed-document-node/core` | 2 |
| `@vendure/common` | 1 |
| `faker` | 1 |
| `graphql` | 1 |
| `sql.js` | 1 |

#### `@vendure/cli`

| Direct dep | Transitive count |
|-----------|------------------|
| `ts-node` | 35 |
| `ts-morph` | 26 |
| `change-case` | 16 |
| `@clack/prompts` | 4 |
| `fs-extra` | 4 |
| `tsconfig-paths` | 4 |
| `@vendure/common` | 1 |
| `commander` | 1 |
| `dotenv` | 1 |
| `picocolors` | 1 |
| `strip-json-comments` | 1 |

#### `@vendure/create`

| Direct dep | Transitive count |
|-----------|------------------|
| `open` | 10 |
| `tcp-port-used` | 7 |
| `cross-spawn` | 6 |
| `handlebars` | 6 |
| `tar` | 6 |
| `@clack/prompts` | 4 |
| `fs-extra` | 4 |
| `@vendure/common` | 1 |
| `commander` | 1 |
| `picocolors` | 1 |
| `semver` | 1 |

#### `@vendure/dashboard`

| Direct dep | Transitive count |
|-----------|------------------|
| `@vendure-io/ui` | 424 |
| `@vendure-io/design-tokens` | 325 |
| `@lingui/vite-plugin` | 281 |
| `@tanstack/router-plugin` | 261 |
| `@lingui/cli` | 191 |
| `@vitejs/plugin-react` | 175 |
| `@tailwindcss/vite` | 141 |
| `vite` | 132 |
| `@tanstack/eslint-plugin-query` | 113 |
| `@lingui/react` | 87 |
| `@lingui/babel-plugin-lingui-macro` | 85 |
| `@lingui/core` | 85 |
| `express-rate-limit` | 66 |
| `@tiptap/starter-kit` | 60 |
| `@babel/preset-typescript` | 51 |
| `@tiptap/react` | 51 |
| `@babel/preset-react` | 47 |
| `recharts` | 44 |
| `@tiptap/extension-floating-menu` | 40 |
| `@babel/core` | 39 |
| `@tiptap/extension-placeholder` | 38 |
| `@tiptap/extension-image` | 37 |
| `@tiptap/extension-table` | 37 |
| `@tiptap/extension-text-style` | 37 |
| `@tiptap/pm` | 35 |
| `vaul` | 33 |
| `@tanstack/router-devtools` | 21 |
| `fast-glob` | 18 |
| `@tanstack/react-router` | 15 |
| `react-dropzone` | 10 |
| `@dnd-kit/modifiers` | 8 |
| `@dnd-kit/sortable` | 8 |
| `motion` | 8 |
| `@dnd-kit/core` | 7 |
| `gql.tada` | 7 |
| `react-day-picker` | 6 |
| `@tanstack/react-query-devtools` | 5 |
| `@tanstack/react-table` | 5 |
| `@hookform/resolvers` | 4 |
| `@uidotdev/usehooks` | 4 |
| `fs-extra` | 4 |
| `input-otp` | 4 |
| `json-edit-react` | 4 |
| `next-themes` | 4 |
| `sonner` | 4 |
| `tsconfig-paths` | 4 |
| `@tanstack/react-query` | 3 |
| `@types/react-dom` | 3 |
| `react-dom` | 3 |
| `@types/react` | 2 |
| `acorn-walk` | 2 |
| `lucide-react` | 2 |
| `react-hook-form` | 2 |
| `@fontsource-variable/geist-mono` | 1 |
| `@fontsource-variable/inter` | 1 |
| `@fontsource-variable/public-sans` | 1 |
| `acorn` | 1 |
| `awesome-graphql-client` | 1 |
| `clsx` | 1 |
| `date-fns` | 1 |
| `graphql` | 1 |
| `react` | 1 |
| `strip-json-comments` | 1 |
| `tailwind-merge` | 1 |
| `tailwindcss` | 1 |
| `tw-animate-css` | 1 |
| `zod` | 1 |

#### `@vendure/ui-devkit`

| Direct dep | Transitive count |
|-----------|------------------|
| `@angular-devkit/build-angular` | 705 |
| `@angular/cli` | 221 |
| `@angular/compiler-cli` | 62 |
| `chokidar` | 15 |
| `glob` | 8 |
| `chalk` | 6 |
| `fs-extra` | 4 |
| `@angular/compiler` | 2 |
| `rxjs` | 2 |
| `@vendure/admin-ui` | 1 |
| `@vendure/common` | 1 |

#### `@vendure/admin-ui`

| Direct dep | Transitive count |
|-----------|------------------|
| `apollo-angular` | 36 |
| `apollo-upload-client` | 35 |
| `@apollo/client` | 32 |
| `@clr/angular` | 20 |
| `ngx-translate-messageformat-compiler` | 16 |
| `@clr/core` | 14 |
| `@clr/ui` | 12 |
| `@cds/core` | 11 |
| `prosemirror-menu` | 10 |
| `@angular/platform-browser-dynamic` | 9 |
| `@ng-select/ng-select` | 9 |
| `@angular/cdk` | 8 |
| `@angular/forms` | 8 |
| `@angular/router` | 8 |
| `@messageformat/core` | 8 |
| `prosemirror-gapcursor` | 8 |
| `prosemirror-tables` | 8 |
| `@angular/platform-browser` | 7 |
| `prosemirror-history` | 7 |
| `prosemirror-keymap` | 7 |
| `@angular/animations` | 6 |
| `@ngx-translate/core` | 6 |
| `@ngx-translate/http-loader` | 6 |
| `ngx-pagination` | 6 |
| `prosemirror-commands` | 6 |
| `prosemirror-dropcursor` | 6 |
| `prosemirror-inputrules` | 6 |
| `prosemirror-schema-list` | 6 |
| `@angular/common` | 5 |
| `messageformat` | 5 |
| `prosemirror-state` | 5 |
| `@angular/core` | 4 |
| `prosemirror-schema-basic` | 3 |
| `react-dom` | 3 |
| `@biesbjerg/ngx-translate-extract-marker` | 2 |
| `@clr/icons` | 2 |
| `rxjs` | 2 |
| `@angular/language-service` | 1 |
| `@vendure/common` | 1 |
| `@webcomponents/custom-elements` | 1 |
| `chartist` | 1 |
| `codejar` | 1 |
| `dayjs` | 1 |
| `graphql` | 1 |
| `just-extend` | 1 |
| `react` | 1 |
| `tslib` | 1 |
| `zone.js` | 1 |

</details>

## Stage 1 — @types/nodemailer: pick up upstream AWS SDK removal

- **Commit:** `905ec160a` on `chore/dependency-audit`
- **Date:** 2026-05-21T07:50:42.183Z
- **Total unique production packages:** 1807

### Per-Vendure-package transitive footprint

| Package | Direct deps | Unique transitive (prod) |
|---------|-------------|--------------------------|
| `@vendure/core` | 41 | 453 |
| `@vendure/common` | 0 | 0 |
| `@vendure/email-plugin` | 7 | 216 |
| `@vendure/asset-server-plugin` | 3 | 20 |
| `@vendure/admin-ui-plugin` | 3 | 71 |
| `@vendure/telemetry-plugin` | 9 | 162 |
| `@vendure/harden-plugin` | 2 | 153 |
| `@vendure/job-queue-plugin` | 2 | 23 |
| `@vendure/graphiql-plugin` | 1 | 65 |
| `@vendure/testing` | 8 | 34 |
| `@vendure/cli` | 11 | 92 |
| `@vendure/create` | 11 | 46 |
| `@vendure/dashboard` | 67 | 838 |
| `@vendure/ui-devkit` | 11 | 810 |
| `@vendure/admin-ui` | 48 | 115 |

<details>
<summary>Per-direct-dep transitive counts (click to expand)</summary>

#### `@vendure/core`

| Direct dep | Transitive count |
|-----------|------------------|
| `@nestjs/terminus` | 295 |
| `@nestjs/typeorm` | 260 |
| `@nestjs/apollo` | 237 |
| `typeorm` | 186 |
| `@apollo/server` | 151 |
| `@nestjs/graphql` | 149 |
| `@nestjs/core` | 102 |
| `@nestjs/platform-express` | 102 |
| `express` | 65 |
| `body-parser` | 41 |
| `graphql-upload` | 32 |
| `http-proxy-middleware` | 19 |
| `@nestjs/common` | 18 |
| `@graphql-tools/stitch` | 17 |
| `ioredis` | 11 |
| `cookie-session` | 9 |
| `i18next-icu` | 9 |
| `intl-messageformat` | 8 |
| `fs-extra` | 4 |
| `bcrypt` | 3 |
| `graphql-scalars` | 3 |
| `graphql-tag` | 3 |
| `i18next` | 3 |
| `mime-types` | 2 |
| `rxjs` | 2 |
| `@vendure/common` | 1 |
| `cron-time-generator` | 1 |
| `croner` | 1 |
| `cronstrue` | 1 |
| `csv-parse` | 1 |
| `graphql` | 1 |
| `graphql-fields` | 1 |
| `i18next-fs-backend` | 1 |
| `i18next-http-middleware` | 1 |
| `image-size` | 1 |
| `ms` | 1 |
| `nanoid` | 1 |
| `picocolors` | 1 |
| `progress` | 1 |
| `reflect-metadata` | 1 |
| `semver` | 1 |

#### `@vendure/email-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `mjml` | 140 |
| `express` | 65 |
| `handlebars` | 6 |
| `fs-extra` | 4 |
| `@types/nodemailer` | 3 |
| `dateformat` | 1 |
| `nodemailer` | 1 |

#### `@vendure/asset-server-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `file-type` | 10 |
| `sharp` | 6 |
| `fs-extra` | 4 |

#### `@vendure/admin-ui-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `express-rate-limit` | 66 |
| `fs-extra` | 4 |
| `date-fns` | 1 |

#### `@vendure/telemetry-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `@opentelemetry/auto-instrumentations-node` | 161 |
| `@opentelemetry/sdk-node` | 78 |
| `@opentelemetry/exporter-logs-otlp-proto` | 25 |
| `@opentelemetry/exporter-trace-otlp-http` | 25 |
| `@opentelemetry/sdk-logs` | 6 |
| `@opentelemetry/resources` | 4 |
| `@opentelemetry/context-async-hooks` | 2 |
| `@opentelemetry/api` | 1 |
| `javascript-stringify` | 1 |

#### `@vendure/harden-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `@apollo/server` | 151 |
| `graphql-query-complexity` | 3 |

#### `@vendure/job-queue-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `bullmq` | 23 |
| `ioredis` | 11 |

#### `@vendure/graphiql-plugin`

| Direct dep | Transitive count |
|-----------|------------------|
| `express` | 65 |

#### `@vendure/testing`

| Direct dep | Transitive count |
|-----------|------------------|
| `form-data` | 20 |
| `node-fetch` | 7 |
| `graphql-tag` | 3 |
| `@graphql-typed-document-node/core` | 2 |
| `@vendure/common` | 1 |
| `faker` | 1 |
| `graphql` | 1 |
| `sql.js` | 1 |

#### `@vendure/cli`

| Direct dep | Transitive count |
|-----------|------------------|
| `ts-node` | 35 |
| `ts-morph` | 26 |
| `change-case` | 16 |
| `@clack/prompts` | 4 |
| `fs-extra` | 4 |
| `tsconfig-paths` | 4 |
| `@vendure/common` | 1 |
| `commander` | 1 |
| `dotenv` | 1 |
| `picocolors` | 1 |
| `strip-json-comments` | 1 |

#### `@vendure/create`

| Direct dep | Transitive count |
|-----------|------------------|
| `open` | 10 |
| `tcp-port-used` | 7 |
| `cross-spawn` | 6 |
| `handlebars` | 6 |
| `tar` | 6 |
| `@clack/prompts` | 4 |
| `fs-extra` | 4 |
| `@vendure/common` | 1 |
| `commander` | 1 |
| `picocolors` | 1 |
| `semver` | 1 |

#### `@vendure/dashboard`

| Direct dep | Transitive count |
|-----------|------------------|
| `@vendure-io/ui` | 424 |
| `@vendure-io/design-tokens` | 325 |
| `@lingui/vite-plugin` | 281 |
| `@tanstack/router-plugin` | 261 |
| `@lingui/cli` | 191 |
| `@vitejs/plugin-react` | 175 |
| `@tailwindcss/vite` | 141 |
| `vite` | 132 |
| `@tanstack/eslint-plugin-query` | 113 |
| `@lingui/react` | 87 |
| `@lingui/babel-plugin-lingui-macro` | 85 |
| `@lingui/core` | 85 |
| `express-rate-limit` | 66 |
| `@tiptap/starter-kit` | 60 |
| `@babel/preset-typescript` | 51 |
| `@tiptap/react` | 51 |
| `@babel/preset-react` | 47 |
| `recharts` | 44 |
| `@tiptap/extension-floating-menu` | 40 |
| `@babel/core` | 39 |
| `@tiptap/extension-placeholder` | 38 |
| `@tiptap/extension-image` | 37 |
| `@tiptap/extension-table` | 37 |
| `@tiptap/extension-text-style` | 37 |
| `@tiptap/pm` | 35 |
| `vaul` | 33 |
| `@tanstack/router-devtools` | 21 |
| `fast-glob` | 18 |
| `@tanstack/react-router` | 15 |
| `react-dropzone` | 10 |
| `@dnd-kit/modifiers` | 8 |
| `@dnd-kit/sortable` | 8 |
| `motion` | 8 |
| `@dnd-kit/core` | 7 |
| `gql.tada` | 7 |
| `react-day-picker` | 6 |
| `@tanstack/react-query-devtools` | 5 |
| `@tanstack/react-table` | 5 |
| `@hookform/resolvers` | 4 |
| `@uidotdev/usehooks` | 4 |
| `fs-extra` | 4 |
| `input-otp` | 4 |
| `json-edit-react` | 4 |
| `next-themes` | 4 |
| `sonner` | 4 |
| `tsconfig-paths` | 4 |
| `@tanstack/react-query` | 3 |
| `@types/react-dom` | 3 |
| `react-dom` | 3 |
| `@types/react` | 2 |
| `acorn-walk` | 2 |
| `lucide-react` | 2 |
| `react-hook-form` | 2 |
| `@fontsource-variable/geist-mono` | 1 |
| `@fontsource-variable/inter` | 1 |
| `@fontsource-variable/public-sans` | 1 |
| `acorn` | 1 |
| `awesome-graphql-client` | 1 |
| `clsx` | 1 |
| `date-fns` | 1 |
| `graphql` | 1 |
| `react` | 1 |
| `strip-json-comments` | 1 |
| `tailwind-merge` | 1 |
| `tailwindcss` | 1 |
| `tw-animate-css` | 1 |
| `zod` | 1 |

#### `@vendure/ui-devkit`

| Direct dep | Transitive count |
|-----------|------------------|
| `@angular-devkit/build-angular` | 705 |
| `@angular/cli` | 221 |
| `@angular/compiler-cli` | 62 |
| `chokidar` | 15 |
| `glob` | 8 |
| `chalk` | 6 |
| `fs-extra` | 4 |
| `@angular/compiler` | 2 |
| `rxjs` | 2 |
| `@vendure/admin-ui` | 1 |
| `@vendure/common` | 1 |

#### `@vendure/admin-ui`

| Direct dep | Transitive count |
|-----------|------------------|
| `apollo-angular` | 36 |
| `apollo-upload-client` | 35 |
| `@apollo/client` | 32 |
| `@clr/angular` | 20 |
| `ngx-translate-messageformat-compiler` | 16 |
| `@clr/core` | 14 |
| `@clr/ui` | 12 |
| `@cds/core` | 11 |
| `prosemirror-menu` | 10 |
| `@angular/platform-browser-dynamic` | 9 |
| `@ng-select/ng-select` | 9 |
| `@angular/cdk` | 8 |
| `@angular/forms` | 8 |
| `@angular/router` | 8 |
| `@messageformat/core` | 8 |
| `prosemirror-gapcursor` | 8 |
| `prosemirror-tables` | 8 |
| `@angular/platform-browser` | 7 |
| `prosemirror-history` | 7 |
| `prosemirror-keymap` | 7 |
| `@angular/animations` | 6 |
| `@ngx-translate/core` | 6 |
| `@ngx-translate/http-loader` | 6 |
| `ngx-pagination` | 6 |
| `prosemirror-commands` | 6 |
| `prosemirror-dropcursor` | 6 |
| `prosemirror-inputrules` | 6 |
| `prosemirror-schema-list` | 6 |
| `@angular/common` | 5 |
| `messageformat` | 5 |
| `prosemirror-state` | 5 |
| `@angular/core` | 4 |
| `prosemirror-schema-basic` | 3 |
| `react-dom` | 3 |
| `@biesbjerg/ngx-translate-extract-marker` | 2 |
| `@clr/icons` | 2 |
| `rxjs` | 2 |
| `@angular/language-service` | 1 |
| `@vendure/common` | 1 |
| `@webcomponents/custom-elements` | 1 |
| `chartist` | 1 |
| `codejar` | 1 |
| `dayjs` | 1 |
| `graphql` | 1 |
| `just-extend` | 1 |
| `react` | 1 |
| `tslib` | 1 |
| `zone.js` | 1 |

</details>

### Changes

Bumped `@types/nodemailer` from `^6.4.9` to `^6.4.22` in both
`packages/email-plugin/package.json` and the workspace root `package.json`
(used by `dev-server` to satisfy `EmailPlugin` type resolution).

**Why:** `@types/nodemailer` versions `6.4.19` through `6.4.21` declared
`@aws-sdk/client-ses` as a runtime `dependencies` entry, pulling ~76 AWS SDK
and Smithy packages into every install that resolved the types — even
consumers who never touch SES. This was a regression introduced upstream in
DefinitelyTyped [PR #73297](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/73297)
and flagged on
[discussion #74080](https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/74080)
on 2025-11-14 — citing "the latest security issues on NPMJS" as the same
supply-chain motivation that prompted our audit.

The fix landed upstream as DefinitelyTyped
[PR #74249](https://github.com/DefinitelyTyped/DefinitelyTyped/pull/74249)
("Remove AWS SDK from dependencies, use structural types") and shipped to npm
as `@types/nodemailer@6.4.22` on 2026-01-26. Our existing spec floor of
`^6.4.9` already permitted it; the lockfile had simply never been refreshed
since. Bumping the floor to `^6.4.22` makes the fix mandatory and prevents a
future refresh from silently regressing back to 6.4.21.

**Caveat for future bumps:** the `7.0.x` line of `@types/nodemailer` still
carries `@aws-sdk/client-sesv2` as a runtime dep — the structural-types fix
was backported to v6 and forward-ported to v8, but not to v7. Stay on v6 (or
jump straight to v8) to keep the install clean.

**Results:**

| Metric | Before | After | Δ |
|---|---:|---:|---:|
| Total unique prod packages (repo-wide) | 1,880 | 1,807 | **−73** |
| `@vendure/email-plugin` transitive (prod) | 290 | 216 | **−74** |
| `@types/nodemailer` subtree | 77 | 3 | **−74** |
