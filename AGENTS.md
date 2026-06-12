# Vendure

Headless e-commerce framework. Lerna monorepo with fixed versioning.

## Development Workflow

1. Make changes to a package
2. Build it (or `bun run watch` for continuous)
3. Update `packages/dev-server/dev-config.ts` if needed
4. Restart dev server
5. Run e2e tests from the package dir

- When editing `@vendure/core`, you usually need to watch `@vendure/common` too: `bun run watch:core-common`
- The dev-server imports packages via TypeScript paths, so rebuilds are picked up on restart
- Switch DB with env var: `DB=postgres` or `DB=sqlite` before `bun run populate`

## Testing

- **E2E cache**: Seed data gets cached in `packages/<name>/e2e/__data__/`. **Delete to reset after schema changes.**

### Dashboard E2E Tests

When adding a new test, **always check existing suites first** before creating a new file:

- `catalog/product-list.spec.ts` — product list behaviour (sorting, column settings, filtering)
- `catalog/products.spec.ts` — product detail page
- `catalog/custom-fields.spec.ts` — custom field rendering, editing, persistence
- `sales/orders.spec.ts` — draft orders, order detail, order modification
- `tests/regression/` — **only** for tests that genuinely don't fit any existing suite

Add a comment referencing the issue number above the test, e.g.:
```ts
// #4393 — product list should default to sorting by updatedAt descending
test('should apply descending updatedAt sort by default', async ({ page }) => {
```

Run dashboard e2e tests from `packages/dashboard`:
```bash
CI=true VITE_TEST_PORT=5176 bunx playwright test --config e2e/playwright.config.ts <test-path> --reporter=list
```

## Commits & Branches

- Include `Fixes #ISSUE_NUMBER` in body, or `Relates to #ISSUE_NUMBER` if not a full fix
- `master` — bug fixes (default PR target)
- `minor` — new features
- `major` — breaking changes

## Gotchas

- **Dashboard stale build**: `packages/dev-server/dist/` accumulates stale Vite build artifacts across branch switches. Vite doesn't clean old hashed files, so old chunks can interfere (e.g. overwriting `window.schemaInfo`). Always `rm -rf packages/dev-server/dist` before rebuilding. Build with `bunx vite build --base /dashboard/ --outDir ../dev-server/dist` from `packages/dashboard/`. Also check no stale Vite dev server is running on port 5173 — `DashboardPlugin` auto-proxies to it instead of serving static files.
- **Don't take port 3010**: this repo's `dev-config.ts` uses `API_PORT = 3010` in the user's local working copy. Killing or starting another process on 3010 stomps the long-running dev backend. For ad-hoc test setups use a different port or rely on playwright's e2e env on 3050.
- **Branch hygiene**: never run `git checkout HEAD -- file` on a branch that has uncommitted feature work without committing first — on a fresh branch HEAD == master, so the working copy is wiped.

## Claude workflow for Vendure tickets

Apply for every OSS/PDEV ticket that produces a code change. Skip the steps that don't apply (e.g. no UI to smoke), but never skip silently — say so.

1. **Plan first.** For anything beyond a one-line fix, show the diff + test plan and wait for explicit OK before writing code.
2. **Reviewers.** Spawn `nigel:nigel` and `vendurebot:vendurebot` in parallel on the proposed diff. Apply HIGH and MEDIUM feedback before commit; document why anything was skipped.
3. **Tests are mandatory.** Every PR ships with at least one automated regression. Default location: `packages/dashboard/e2e/tests/regression/issue-<NNNN>-<slug>.spec.ts`. The test must pass on the branch and fail on master — verify both. For prod-only behaviour (e.g. lingui warnings) or component-level edge cases not exercised by e2e, document the gap and the manual repro steps.
4. **Manual smoke for UI.** Drive the user's running dashboard on `localhost:5174` via `chrome-devtools` MCP (not a self-started backend). Clean up any test data through the same flow.
5. **Commit only after explicit OK from the user.** A failing test, a passing test, a successful manual smoke — none of those imply permission to commit. Wait.
6. **One commit per logical change.** Use the existing conventional-commit shape (`feat(dashboard):`, `fix(dashboard):`, `test(dashboard):`). Body explains *why*; ends with `Fixes #<gh-number>`.
7. **Push + open PR** after commit. PR body lists: summary, root cause, change, test plan with what passed automatically vs manually, and any follow-ups out of scope.
8. **Linear sync.** Move the ticket to `In Review`, post a comment with the PR link, a summary of the fix, and the verification (what tests, what smoke). Mirror any follow-ups as a separate comment.
9. **Recover, don't paper over.** If something breaks (lost stash, killed port, polluted DB), say so up front and propose the recovery path before continuing.
