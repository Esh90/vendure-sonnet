import { globalRegistry } from '../../registry/global-registry.js';
import { DashboardExtension } from '../extension-api-types.js';
import { addDetailFormLabel } from '../label-component-extensions.js';

globalRegistry.register('formLabels', new Map<string, string | React.ReactNode>());

/**
 * @description
 * Registers custom form labels for a specific detail page. Labels are stored with a composite key
 * combining the pageId and field name to allow different labels for the same field across different pages.
 *
 * @example
 * ```ts
 * registerDetailFormLabels({
 *   pageId: 'product-detail',
 *   labels: [
 *     { field: 'name', component: 'Product Name' },
 *     { field: 'sku', component: <Trans>SKU Code</Trans> }
 *   ]
 * })
 * ```
 *
 * @docsCategory extensions-api
 * @since 3.6.0
 */
export function registerDetailFormLabels(customFormLabels?: DashboardExtension['detailFormLabels']) {
    if (customFormLabels) {
        const { pageId, labels } = customFormLabels;

        if (labels) {
            for (const labelComponent of labels) {
                addDetailFormLabel(pageId, labelComponent);
            }
        }
    }
}
