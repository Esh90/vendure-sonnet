import { globalRegistry } from '@/vdb/framework/registry/global-registry.js';
import { ComponentType, createElement, ReactNode, useMemo } from 'react';

import { useDashboardExtensions } from './use-dashboard-extensions.js';

export type DashboardCustomProviderDefinition = {
    /**
     * Unique identifier for this custom provider.
     */
    id: string;
    /**
     * React component that will be rendered by this provider.
     */
    component: ComponentType<{ children: ReactNode }>;
    /**
     * Optional. Controls the priority or rendering order of this provider
     * relative to others. Lower numbers appear before higher numbers.
     */
    order?: number;
    /**
     * Determines where the custom provider will be applied in the dashboard hierarchy.
     * - 'app': Applies the provider at the application (root) level.
     * - 'layout': Applies the provider at the layout level.
     *
     * Optional. Defaults to 'app' if not specified.
     */
    location?: 'app' | 'layout';
};

globalRegistry.register(
    'dashboardCustomProvidersRegistry',
    new Map<string, DashboardCustomProviderDefinition>(),
);

export function getDashboardCustomProvidersRegistry() {
    return globalRegistry.get('dashboardCustomProvidersRegistry');
}

export function registerDashboardCustomProvider(customProvider: DashboardCustomProviderDefinition) {
    globalRegistry.set('dashboardCustomProvidersRegistry', map => {
        map.set(customProvider.id, {
            ...customProvider,
            location: customProvider.location ?? 'app',
        });
        return map;
    });
}

export function registerDashboardCustomProviders(providers?: DashboardCustomProviderDefinition[]) {
    if (providers) {
        for (const provider of providers) {
            registerDashboardCustomProvider(provider);
        }
    }
}

export const renderProviders = (
    providers: DashboardCustomProviderDefinition[],
    children: ReactNode,
): ReactNode => {
    if (providers.length === 0) {
        return children;
    }

    const [currentProvider, ...remainingProviders] = providers;
    const ProviderComponent = currentProvider.component;

    return createElement(ProviderComponent, null, renderProviders(remainingProviders, children));
};

export interface CustomProvidersProps {
    location: DashboardCustomProviderDefinition['location'];
    children: ReactNode;
}

export function CustomProviders({ location, children }: Readonly<CustomProvidersProps>) {
    const { extensionsLoaded, reloadCount } = useDashboardExtensions();
    const providersToRender = useMemo(() => {
        const customProviders = Array.from(getDashboardCustomProvidersRegistry().values());
        return customProviders
            .filter(provider => provider.location === location)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [extensionsLoaded, reloadCount, location]);

    return renderProviders(providersToRender, children);
}
