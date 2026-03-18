import { globalRegistry } from '../registry/global-registry.js';
import { DashboardDetailFormLabelComponent } from './types/detail-form-labels.js';

/**
 * @description
 * Generates a component key based on the targeting properties.
 * Deviates from the existing pattern as blockId is not needed: pageId_fieldName
 */
export function generateInputComponentKey(pageId: string, field: string): string {
    return `${pageId}_${field}`;
}

/**
 * @description
 * Internal helper function to add a single form label to the registry.
 * Stores the label with a composite key combining pageId and field name.
 *
 * @internal
 */
export function addDetailFormLabel(pageId: string, labelComponent: DashboardDetailFormLabelComponent) {
    const formLabels = globalRegistry.get('formLabels');
    const compositeKey = generateInputComponentKey(pageId, labelComponent.field);

    if (formLabels.has(compositeKey)) {
        // eslint-disable-next-line no-console
        console.warn(
            `Form label for field "${labelComponent.field}" on page "${pageId}" is already registered and will be overwritten.`,
        );
    }

    formLabels.set(compositeKey, labelComponent.component);
}

/**
 * @description
 * Retrieves a custom form label for a specific field on a specific page.
 * Falls back to looking for global labels (without pageId) if page-scoped label is not found.
 *
 * @returns The custom label component if found, otherwise undefined
 *
 * @docsCategory extensions-api
 * @since 3.6.0
 */
export function getDetailFormLabel(pageId: string, fieldName: string): string | React.ReactNode | undefined {
    const formLabels = globalRegistry.get('formLabels');

    const compositeKey = generateInputComponentKey(pageId, fieldName);
    const label = formLabels.get(compositeKey);
    return label;
}
