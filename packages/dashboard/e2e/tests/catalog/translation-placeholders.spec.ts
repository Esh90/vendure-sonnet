import { type Page, expect, test } from '@playwright/test';

import { BaseDetailPage } from '../../page-objects/detail-page.base.js';
import { BaseListPage } from '../../page-objects/list-page.base.js';
import { VendureAdminClient } from '../../utils/vendure-admin-client.js';

// Translation fallback placeholder feature:
// When switching to a non-default content language, translatable fields (name,
// slug, description) show the default-language value as an HTML placeholder.
// This suite verifies placeholder presence, absence, and behaviour.
//
// All tests share the same "Laptop" product and must run serially because
// they mutate the channel's available languages and the content language state.

const listPage = (page: Page) =>
    new BaseListPage(page, {
        path: '/products',
        title: 'Products',
        newButtonLabel: 'New Product',
    });

const detailPage = (page: Page) =>
    new BaseDetailPage(page, {
        newPath: '/products/new',
        pathPrefix: '/products/',
        newTitle: 'New product',
    });

/** Navigate to the Laptop product detail page and wait for the form to finish loading. */
async function goToLaptopProduct(page: Page) {
    const lp = listPage(page);
    await lp.goto();
    await lp.expectLoaded();
    await lp.search('Laptop');
    await lp.clickEntity('Laptop');
    await expect(page).toHaveURL(/\/products\/[^/]+$/);
    const dp = detailPage(page);
    await expect(dp.formItem('Product name').getByRole('textbox')).toHaveValue('Laptop', { timeout: 10_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeDisabled({ timeout: 10_000 });
}

/**
 * Switch the dashboard content language via the channel-switcher sidebar menu.
 *
 * Opens the channel-switcher dropdown, hovers the "Content:" sub-trigger to
 * open the language submenu, then clicks the target language option.
 */
async function switchContentLanguage(page: Page, languageLabel: string) {
    // Open the channel-switcher dropdown in the sidebar
    const channelButton = page.locator('[data-slot="sidebar-menu-button"]').first();
    await channelButton.click();

    // Hover the "Content:" sub-trigger to open the language submenu
    const contentSubTrigger = page.locator('[data-slot="dropdown-menu-sub-trigger"]').filter({
        hasText: 'Content:',
    });
    await contentSubTrigger.hover();

    // Wait for the submenu to appear
    const subContent = page.locator('[data-slot="dropdown-menu-sub-content"]');
    await expect(subContent).toBeVisible({ timeout: 5_000 });

    // Click the target language
    await subContent.locator('[data-slot="dropdown-menu-item"]').filter({ hasText: languageLabel }).click();

    // Wait for the page to re-fetch data in the new language
    await page.waitForLoadState('networkidle');
}

test.describe('Translation fallback placeholders', () => {
    test.describe.configure({ mode: 'serial' });

    // ── Setup: add German to the channel's available languages ──────────

    test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        const client = new VendureAdminClient(page);
        await client.login();

        // Get the active channel ID
        const channelData = await client.gql(`
            query {
                activeChannel {
                    id
                    availableLanguageCodes
                }
            }
        `);
        const channelId = channelData.activeChannel.id;
        const currentLanguages: string[] = channelData.activeChannel.availableLanguageCodes;

        // Add German if not already present
        if (!currentLanguages.includes('de')) {
            await client.gql(
                `mutation UpdateChannel($input: UpdateChannelInput!) {
                    updateChannel(input: $input) {
                        ... on Channel { id availableLanguageCodes }
                        ... on LanguageNotAvailableError { errorCode message }
                    }
                }`,
                {
                    input: {
                        id: channelId,
                        availableLanguageCodes: [...currentLanguages, 'de'],
                    },
                },
            );
        }

        await page.close();
    });

    // ── Test 1: Name placeholder when switching to non-default language ─

    test('should show fallback placeholder for name field when switching to non-default language', async ({
        page,
    }) => {
        // Force a full page reload so the dashboard picks up the channel config
        // change from beforeAll (German was added via direct GraphQL mutation,
        // but the dashboard's channel cache still shows English-only).
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await goToLaptopProduct(page);

        // Switch content language to German
        await switchContentLanguage(page, 'German');

        // The name input should now show the English name as a placeholder
        const nameInput = detailPage(page).formItem('Product name').getByRole('textbox');
        await expect(nameInput).toHaveAttribute('placeholder', 'Fallback: Laptop', { timeout: 10_000 });
    });

    // ── Test 2: Slug placeholder ────────────────────────────────────────

    test('should show fallback placeholder for slug field', async ({ page }) => {
        await goToLaptopProduct(page);
        await switchContentLanguage(page, 'German');

        // The slug input is inside a SlugInput component. When no value is
        // set for German and the slug is in readonly mode, the external
        // placeholder from TranslatableFormFieldWrapper is used.
        // The slug field renders an <input> inside the SlugInput wrapper.
        const slugFormItem = detailPage(page).formItem('Slug');
        const slugInput = slugFormItem.locator('input').first();
        await expect(slugInput).toHaveAttribute('placeholder', /Fallback: .*laptop/, { timeout: 10_000 });
    });

    // ── Test 3: No placeholder on default language ──────────────────────

    test('should NOT show placeholder when on default language', async ({ page }) => {
        await goToLaptopProduct(page);

        // We're on English (default language) - no placeholder should be present
        // or the placeholder should NOT be the fallback value "Laptop"
        const nameInput = detailPage(page).formItem('Product name').getByRole('textbox');

        // On the default language, the input has the actual value, not a fallback placeholder.
        // The placeholder attribute should either be absent or empty (not the English name).
        await expect(nameInput).toHaveValue('Laptop');
        const placeholder = await nameInput.getAttribute('placeholder');
        expect(placeholder ?? '').not.toBe('Fallback: Laptop');
    });

    // ── Test 4: Placeholder hidden once user types a translation ────────

    test('should remove placeholder when user types a translation', async ({ page }) => {
        await goToLaptopProduct(page);
        await switchContentLanguage(page, 'German');

        const nameInput = detailPage(page).formItem('Product name').getByRole('textbox');

        // Verify the placeholder is present first
        await expect(nameInput).toHaveAttribute('placeholder', 'Fallback: Laptop', { timeout: 10_000 });

        // Type a German translation
        await nameInput.fill('Laptop (Deutsch)');

        // The HTML placeholder is still in the DOM, but with a value present
        // the browser hides it visually. Verify the input has the typed value.
        await expect(nameInput).toHaveValue('Laptop (Deutsch)');
    });

    // ── Test 5: Placeholder for rich text description ───────────────────

    test('should show placeholder for rich text description', async ({ page }) => {
        await goToLaptopProduct(page);
        await switchContentLanguage(page, 'German');

        // TipTap's Placeholder extension adds a `data-placeholder` attribute to
        // the first empty child element with class `is-editor-empty`. The CSS
        // displays it via `content: attr(data-placeholder)`.
        const editorContainer = page.getByTestId('rich-text-editor');
        await expect(editorContainer).toBeVisible({ timeout: 10_000 });

        // The placeholder is set on the empty paragraph element inside the editor.
        // When the description field is empty for the German translation, TipTap
        // adds the `.is-editor-empty` class and the `data-placeholder` attribute.
        const emptyEditorNode = editorContainer.locator('.is-editor-empty[data-placeholder]');
        await expect(emptyEditorNode).toBeVisible({ timeout: 10_000 });

        // Verify the data-placeholder contains the English description text
        // (stripped of HTML tags by RichTextInput). The Laptop description
        // starts with "Now equipped with seventh-generation..."
        const placeholderValue = await emptyEditorNode.getAttribute('data-placeholder');
        expect(placeholderValue).toBeTruthy();
        expect(placeholderValue).toContain('Now equipped with seventh-generation');
    });

    // ── Cleanup: switch back to English ─────────────────────────────────

    test.afterAll(async ({ browser }) => {
        const page = await browser.newPage();
        const client = new VendureAdminClient(page);
        await client.login();

        // Restore the channel to English only
        const channelData = await client.gql(`
            query {
                activeChannel {
                    id
                }
            }
        `);
        await client.gql(
            `mutation UpdateChannel($input: UpdateChannelInput!) {
                updateChannel(input: $input) {
                    ... on Channel { id availableLanguageCodes }
                    ... on LanguageNotAvailableError { errorCode message }
                }
            }`,
            {
                input: {
                    id: channelData.activeChannel.id,
                    availableLanguageCodes: ['en'],
                },
            },
        );

        await page.close();
    });
});
