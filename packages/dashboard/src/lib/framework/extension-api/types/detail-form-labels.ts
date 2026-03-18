import React from 'react';

/**
 * @description
 * Allows you to define custom label components for specific fields in detail forms.
 * The pageId is already defined in the detail form extension.
 *
 * @docsCategory extensions-api
 * @docsPage DetailFormLabels
 * @since 3.6.0
 */
export interface DashboardDetailFormLabelComponent {
    /**
     * @description
     * The name of the field where this label component should be used.
     */
    field: string;
    /**
     * @description
     * The React component that will be rendered as the label.
     * The component will be wrapped by a `<label>` element, so it should not include its own `<label>`.
     */
    component: React.ReactNode;
}

/**
 * @description
 * Allows you to set custom labels for specific fields in existing detail forms (e.g. on the product detail or customer detail pages).
 *
 * @since 3.6.0
 * @docsPage DetailFormLabels
 * @docsCategory extensions-api
 */
export interface DashboardDetailFormLabelsExtensionDefinition {
    /**
     * @description
     * The ID of the page where the detail form is located, e.g. `'product-detail'`, `'order-detail'`.
     */
    pageId: string;
    /**
     * @description
     * Custom labels for specific fields in the detail form.
     */
    labels?: DashboardDetailFormLabelComponent[];
}
