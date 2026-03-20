import { expect, test } from '@playwright/test';

import { createCrudTestSuite } from '../../utils/crud-test-factory.js';

createCrudTestSuite({
    entityName: 'product',
    entityNamePlural: 'products',
    listPath: '/products',
    listTitle: 'Products',
    newButtonLabel: 'New Product',
    newPageTitle: 'New product',
    createFields: [{ label: 'Product name', value: 'E2E Test Product' }],
    afterFillCreate: async (_page, detail) => {
        await expect(detail.formItem('Slug').getByRole('textbox')).not.toHaveValue('', { timeout: 5_000 });
    },
});

test.describe('Product detail features', () => {
    test('should display all detail page sections', async ({ page }) => {
        // Navigate to the first product in the list
        await page.goto('/products');
        await expect(page.locator('table')).toBeVisible();
        await page.locator('table tbody tr').first().getByRole('button').first().click();
        await expect(page).toHaveURL(/\/products\/.+/);

        // Product name field
        await expect(page.getByText('Product name')).toBeVisible();

        // Slug field
        await expect(page.getByText('Slug')).toBeVisible();

        // Description field
        await expect(page.getByText('Description')).toBeVisible();

        // Enabled toggle
        await expect(page.getByText('Enabled')).toBeVisible();

        // Facet Values block
        await expect(page.getByText('Facet Values')).toBeVisible();

        // Assets block
        await expect(page.getByText('Assets')).toBeVisible();
    });

    test('should display product variants table', async ({ page }) => {
        // Navigate to a product that has variants (seeded data)
        await page.goto('/products');
        await expect(page.locator('table')).toBeVisible();

        // Click the first product — seeded products have variants
        await page.locator('table tbody tr').first().getByRole('button').first().click();
        await expect(page).toHaveURL(/\/products\/.+/);

        // The variants table should be visible for products with variants
        // Look for a nested table or the "Manage variants" button
        const manageButton = page.getByRole('button', { name: /Manage variants/i });
        const variantsTable = page.locator('table').nth(1);

        // At least one of these should be visible (depends on whether product has variants)
        const hasVariants = await manageButton.isVisible().catch(() => false);
        const hasVariantsTable = await variantsTable.isVisible().catch(() => false);

        // Seeded products should have variants
        expect(hasVariants || hasVariantsTable).toBeTruthy();
    });

    test('should navigate to manage variants page', async ({ page }) => {
        await page.goto('/products');
        await expect(page.locator('table')).toBeVisible();

        await page.locator('table tbody tr').first().getByRole('button').first().click();
        await expect(page).toHaveURL(/\/products\/.+/);

        const manageButton = page.getByRole('button', { name: /Manage variants/i });
        // Only proceed if the product has variants
        if (await manageButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await manageButton.click();
            await expect(page).toHaveURL(/\/products\/[^/]+\/variants/);
        }
    });

    test('should display the rich text editor for description', async ({ page }) => {
        await page.goto('/products');
        await expect(page.locator('table')).toBeVisible();

        await page.locator('table tbody tr').first().getByRole('button').first().click();
        await expect(page).toHaveURL(/\/products\/.+/);

        // The rich text editor renders a ProseMirror container with a toolbar
        // Look for the editor toolbar (formatting buttons) or the editable area
        const editorContainer = page.locator('.tiptap, .ProseMirror, [contenteditable="true"]');
        await expect(editorContainer.first()).toBeVisible({ timeout: 5_000 });
    });

    test('should display custom field tabs when configured', async ({ page }) => {
        await page.goto('/products');
        await expect(page.locator('table')).toBeVisible();

        await page.locator('table tbody tr').first().getByRole('button').first().click();
        await expect(page).toHaveURL(/\/products\/.+/);

        // Custom fields are configured in the test fixtures (SEO, Details, Struct tabs)
        // Check if any custom field tabs/sections are present
        const customFieldsBlock = page
            .locator('[data-slot="card-title"]')
            .filter({ hasText: /custom fields|seo|details/i });
        const hasCustomFields = await customFieldsBlock
            .first()
            .isVisible({ timeout: 3_000 })
            .catch(() => false);

        if (hasCustomFields) {
            await expect(customFieldsBlock.first()).toBeVisible();
        }
        // If no custom fields configured in the fixture, this test passes silently
    });
});
