import { getViewOptionDefaults } from '@/vdb/framework/data-table/data-table-extensions.js';
import { usePageBlock } from '@/vdb/hooks/use-page-block.js';
import { usePage } from '@/vdb/hooks/use-page.js';
import { useUserSettings } from '@/vdb/hooks/use-user-settings.js';

/**
 * @description
 * Merges code-defined data table view option defaults with any defaults
 * registered via the Dashboard Extension API and the current user's saved
 * settings. Precedence, from highest to lowest:
 *
 * 1. User-saved settings (column visibility / column order)
 * 2. Extension API defaults registered via `viewOptionDefaults`
 * 3. Code defaults supplied by the data table component
 */
export function useViewOptionDefaults<T extends string>(
    defaultColumnVisibility: Partial<Record<T, boolean>> | undefined,
    defaultColumnOrder: T[] | undefined,
) {
    const { pageId } = usePage();
    const pageBlock = usePageBlock({ optional: true });
    const { settings } = useUserSettings();
    const userTableSettings = pageId ? settings.tableSettings?.[pageId] : undefined;
    const viewOptionDefaults = pageId ? getViewOptionDefaults(pageId, pageBlock?.blockId) : {};
    const extensionColumnOrder = viewOptionDefaults?.columnOrder ?? [];
    return {
        defaultColumnVisibility: {
            ...(defaultColumnVisibility ?? {}),
            ...(viewOptionDefaults?.columnVisibility ?? {}),
            ...(userTableSettings?.columnVisibility ?? {}),
        },
        defaultColumnOrder: userTableSettings?.columnOrder ?? [
            ...extensionColumnOrder,
            ...(defaultColumnOrder?.filter(colId => !extensionColumnOrder.includes(colId)) ?? []),
        ],
    };
}
