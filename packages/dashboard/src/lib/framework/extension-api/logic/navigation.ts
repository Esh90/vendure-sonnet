import {
    addNavMenuItem,
    addNavMenuSection,
    NavMenuConfig,
    NavMenuItem,
} from '../../nav-menu/nav-menu-extensions.js';
import { registerRoute } from '../../page/page-api.js';
import { DashboardNavSectionDefinition, DashboardRouteDefinition } from '../types/navigation.js';

export function registerNavigationExtensions(
    navSections?: DashboardNavSectionDefinition[] | ((config: NavMenuConfig) => NavMenuConfig),
    routes?: DashboardRouteDefinition[],
): ((config: NavMenuConfig) => NavMenuConfig) | undefined {
    let navMenuModifier: ((config: NavMenuConfig) => NavMenuConfig) | undefined;

    if (navSections) {
        if (typeof navSections === 'function') {
            navMenuModifier = navSections;
        } else {
            for (const section of navSections) {
                addNavMenuSection({
                    ...section,
                    placement: section.placement ?? 'top',
                    order: section.order ?? 999,
                    items: [],
                });
            }
        }
    }

    if (routes) {
        for (const route of routes) {
            if (route.navMenuItem) {
                // Add the nav menu item
                const item: NavMenuItem = {
                    url: route.navMenuItem.url ?? route.path,
                    id: route.navMenuItem.id ?? route.path,
                    title: route.navMenuItem.title ?? route.path,
                    order: route.navMenuItem.order,
                    requiresPermission: route.navMenuItem.requiresPermission,
                    icon: route.navMenuItem.icon,
                    placement: route.navMenuItem.placement,
                };
                addNavMenuItem(item, route.navMenuItem.sectionId);
            }
            if (route.path) {
                // Configure a list page
                registerRoute(route);
            }
        }
    }

    return navMenuModifier;
}
