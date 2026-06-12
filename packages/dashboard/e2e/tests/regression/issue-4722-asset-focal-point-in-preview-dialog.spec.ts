import { expect, test } from '@playwright/test';

import { VENDURE_PORT } from '../../constants.js';

// #4722 — The focal-point editor was only available on the standalone Asset
// detail route. The fix wires it through the shared `AssetPreview` (and
// therefore the dialog used by Product / Variant detail pages), with a
// callback up to `EntityAssets` so re-opening the dialog after a save shows
// the new value rather than the stale one from the parent detail query.
//
// Setup: the seeded "Laptop" product already has a featured asset (imported
// from the core e2e fixtures via `importAssetsDir` in global-setup), so the
// test reads its id and drives the UI — no runtime asset upload or product
// creation. `beforeEach` resets the asset's focal point to null so every run
// (including a Playwright retry, which reuses the global-setup DB) starts from
// the deterministic "Not set" state the assertions below rely on.
//
// Coverage note: this exercises the featured-asset path. The multi-asset
// gallery / prev-next sync that `onAssetUpdated` also feeds is not covered here
// because the seeded product has a single asset; adding it would require
// re-introducing the runtime multi-asset seeding this rework removed.
test.describe('Issue 4722 — focal point editor in shared asset preview dialog', () => {
    let productId: string;

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        productId = await page.evaluate(async vendurePort => {
            const apiUrl = `http://localhost:${vendurePort}/admin-api`;
            const sessionToken = localStorage.getItem('vendure-session-token');
            if (!sessionToken) throw new Error('No vendure-session-token');
            const post = async (query: string, variables?: Record<string, unknown>) => {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'content-type': 'application/json',
                        authorization: `Bearer ${sessionToken}`,
                    },
                    body: JSON.stringify({ query, variables }),
                });
                const json = await res.json();
                if (json.errors?.length) throw new Error(`Admin API: ${JSON.stringify(json.errors)}`);
                return json.data;
            };

            const { product } = await post(`{ product(slug: "laptop") { id featuredAsset { id } } }`);
            if (!product?.featuredAsset) {
                // The featured asset comes from the "Laptop" row of
                // core/e2e/fixtures/e2e-products-full.csv being imported via
                // `importExportOptions.importAssetsDir` in global-setup. If this
                // throws, that CSV row lost its asset, the fixture image is gone,
                // or e2e/__data__ holds a stale pre-import DB (delete it to reseed).
                throw new Error(
                    'Seeded "laptop" product has no featured asset — check core e2e CSV / importAssetsDir / stale __data__ DB',
                );
            }

            // Reset to a clean "Not set" state so the assertions start from a
            // known baseline regardless of any previous (retried) run.
            await post(`mutation($input: UpdateAssetInput!) { updateAsset(input: $input) { id } }`, {
                input: { id: product.featuredAsset.id, focalPoint: null },
            });

            return product.id as string;
        }, VENDURE_PORT);
    });

    test('should let the user set a focal point from the preview dialog and persist across re-open', async ({
        page,
    }) => {
        test.setTimeout(45_000);

        await page.goto(`/products/${productId}`);

        // The Assets PageBlock in EntityAssets renders the featured asset
        // inside a `<div data-testid="entity-assets-featured">` wrapper. Target
        // its <img> directly so the test doesn't depend on the asset URL scheme.
        const featuredImage = page.getByTestId('entity-assets-featured').locator('img');
        await expect(featuredImage).toBeVisible({ timeout: 15_000 });
        await featuredImage.click();

        // The preview dialog opens with the new "Set focal point" button.
        const setFocalPointTrigger = page.getByTestId('asset-preview-set-focal-point');
        await expect(setFocalPointTrigger).toBeVisible({ timeout: 5_000 });

        // Baseline: the asset has no focal point, so the readout shows "Not set".
        // This makes the transition below a real state change rather than an
        // assertion that could pass against a pre-existing value.
        const focalPointValue = page.getByTestId('asset-preview-focal-point-value');
        await expect(focalPointValue).toContainText('Not set');

        // Activate the focal-point editor and confirm at the default centre
        // position the editor renders for an asset without a saved focal point.
        // (The exact dragged coordinate is not asserted: the editor's drag math
        // is screen-pixels / natural-image-pixels, so a pixel-precise Playwright
        // drag would be fragile. The Not-set → set → persist transition is the
        // load-bearing regression signal.)
        await setFocalPointTrigger.click();
        await page.getByTestId('asset-focal-point-editor-confirm').click();

        // After the mutation, the coords readout updates (the toast assertion
        // is skipped — sonner auto-dismisses too quickly to race against
        // reliably and the coords readout is the load-bearing signal).
        await expect(focalPointValue).toContainText('0.50, 0.50', { timeout: 10_000 });

        // Close the dialog (Escape) and re-open — the indicator must still
        // show the saved coords, not regress to the stale parent value.
        // Before the parent-sync fix, EntityAssets' local `assets` array would
        // still hold the pre-save focal point, so the re-opened dialog would
        // misreport "Not set".
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });

        await featuredImage.click();
        await expect(focalPointValue).toContainText('0.50, 0.50', { timeout: 5_000 });
    });
});
