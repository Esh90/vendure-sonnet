import { DynamicModule, Injectable, Type } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';

import { ConfigService } from '../../config/config.service';
import { isDynamicModule } from '../../plugin/plugin-metadata';
import { TelemetryPluginInfo } from '../telemetry.types';

/**
 * Known Vendure plugins mapped to their npm package names.
 * This is more reliable than require.cache inspection which fails with ESM/TypeScript.
 */
const KNOWN_VENDURE_PLUGINS: Record<string, string> = {
    // @vendure/core
    DefaultSearchPlugin: '@vendure/core',
    DefaultJobQueuePlugin: '@vendure/core',
    DefaultSchedulerPlugin: '@vendure/core',
    // @vendure/asset-server-plugin
    AssetServerPlugin: '@vendure/asset-server-plugin',
    // @vendure/email-plugin
    EmailPlugin: '@vendure/email-plugin',
    // @vendure/admin-ui-plugin
    AdminUiPlugin: '@vendure/admin-ui-plugin',
    // @vendure/dashboard
    DashboardPlugin: '@vendure/dashboard',
    // @vendure/job-queue-plugin
    BullMQJobQueuePlugin: '@vendure/job-queue-plugin',
    // @vendure/graphiql-plugin
    GraphiqlPlugin: '@vendure/graphiql-plugin',
    // @vendure/harden-plugin
    HardenPlugin: '@vendure/harden-plugin',
    // Community plugins (moved to @vendure-community/*)
    ElasticsearchPlugin: '@vendure-community/elasticsearch-plugin',
    SentryPlugin: '@vendure-community/sentry-plugin',
    StripePlugin: '@vendure-community/stripe-plugin',
    MolliePlugin: '@vendure-community/mollie-plugin',
    BraintreePlugin: '@vendure-community/braintree-plugin',
};

/**
 * npm package names that identify official Vendure plugins, derived from the
 * known-plugin map above so there is a single source of truth.
 */
const KNOWN_VENDURE_PACKAGES = new Set(Object.values(KNOWN_VENDURE_PLUGINS));

/**
 * Determines whether an npm package name belongs to the Vendure plugin
 * ecosystem. Matches official packages, the public community/hub scopes, and
 * the documented `vendure-plugin` naming convention. Used to detect plugin
 * packages from the host `package.json` in a way that works under both
 * CommonJS and native ESM (unlike require.cache inspection).
 */
export function isVendurePluginPackage(name: string): boolean {
    return (
        KNOWN_VENDURE_PACKAGES.has(name) ||
        name.startsWith('@vendure-community/') ||
        name.startsWith('@vendure-hub/') ||
        /vendure-plugin/i.test(name)
    );
}

/**
 * Collects information about plugins used in the Vendure installation.
 * Detects npm packages by checking if the plugin originates from node_modules.
 * Custom plugin names are NOT collected for privacy.
 */
@Injectable()
export class PluginCollector {
    constructor(private readonly configService: ConfigService) {}

    collect(): TelemetryPluginInfo {
        try {
            const plugins = this.configService.plugins;
            const npmPlugins = new Set<string>();
            let customCount = 0;

            for (const plugin of plugins) {
                try {
                    const npmPackage = this.findNpmPackage(plugin);

                    if (npmPackage) {
                        npmPlugins.add(npmPackage);
                    } else {
                        customCount++;
                    }
                } catch {
                    customCount++;
                }
            }

            // Add Vendure ecosystem packages declared in the host package.json.
            // This filesystem-based detection is ESM-safe and catches official
            // and third-party plugin packages that require.cache inspection
            // misses when they are loaded as native ESM modules. Note: packages
            // are only added to the npm list; customCount is left untouched, so
            // an ESM-loaded third-party plugin may still be counted once as
            // custom (no worse than before this fallback existed).
            for (const pkg of this.getDeclaredVendurePackages()) {
                npmPlugins.add(pkg);
            }

            return {
                npm: Array.from(npmPlugins).sort((a, b) => a.localeCompare(b)),
                customCount,
            };
        } catch {
            return { npm: [], customCount: 0 };
        }
    }

    /**
     * Reads every `package.json` found by walking up from each search directory
     * and returns the names of declared Vendure plugin packages. Relies only on
     * the filesystem, so it works regardless of whether plugins were loaded via
     * CommonJS or native ESM.
     *
     * Monorepo-aware: it merges manifests up the tree (stopping at the repo
     * root) and searches from both the current working directory and the
     * application entry point. This covers workspace layouts where plugin
     * dependencies live in a sub-package and/or the repository root, and where
     * the process is started from a different directory than the app package.
     * Returns an empty array on any failure.
     */
    getDeclaredVendurePackages(searchDirs: string[] = this.getManifestSearchDirs()): string[] {
        const found = new Set<string>();
        const visited = new Set<string>();

        for (const startDir of searchDirs) {
            for (const pkgPath of this.findPackageJsonPaths(startDir)) {
                if (visited.has(pkgPath)) {
                    continue;
                }
                visited.add(pkgPath);
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                    const depNames = [
                        ...Object.keys(pkg.dependencies ?? {}),
                        ...Object.keys(pkg.devDependencies ?? {}),
                        ...Object.keys(pkg.optionalDependencies ?? {}),
                    ];
                    for (const name of depNames) {
                        if (isVendurePluginPackage(name)) {
                            found.add(name);
                        }
                    }
                } catch {
                    // Ignore unreadable/malformed manifests and continue
                }
            }
        }

        return Array.from(found);
    }

    /**
     * The directories from which to search for package.json manifests. Includes
     * the current working directory and (in a monorepo) the directory of the
     * application entry point, which may sit in a different workspace package.
     */
    private getManifestSearchDirs(): string[] {
        const dirs = [process.cwd()];
        const mainFile = typeof require !== 'undefined' ? require.main?.filename : undefined;
        const entryFile = mainFile ?? process.argv[1];
        if (entryFile) {
            dirs.push(path.dirname(entryFile));
        }
        return dirs;
    }

    /**
     * Returns the paths of all `package.json` files found by walking up from
     * `startDir`, stopping at the repository root (a directory containing a
     * `.git` entry) or the filesystem root, whichever comes first.
     */
    private findPackageJsonPaths(startDir: string): string[] {
        const paths: string[] = [];
        let dir = startDir;
        // Walk up a bounded number of levels to avoid infinite loops
        for (let i = 0; i < 30; i++) {
            const candidate = path.join(dir, 'package.json');
            if (fs.existsSync(candidate)) {
                paths.push(candidate);
            }
            // Stop at the repo root so we don't read manifests outside the project
            if (fs.existsSync(path.join(dir, '.git'))) {
                break;
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
        return paths;
    }

    /**
     * Finds the npm package name for a plugin.
     * First checks against known Vendure plugins, then falls back to require.cache inspection.
     */
    private findNpmPackage(plugin: Type<any> | DynamicModule): string | undefined {
        const pluginClass = isDynamicModule(plugin) ? plugin.module : plugin;
        if (!pluginClass) {
            return undefined;
        }
        const pluginName = pluginClass.name ?? 'unknown';

        // First, check against known Vendure plugins (most reliable)
        const knownPackage = KNOWN_VENDURE_PLUGINS[pluginName];
        if (knownPackage) {
            return knownPackage;
        }

        // Fall back to require.cache inspection for third-party npm plugins
        return this.findInRequireCache(pluginClass);
    }

    /**
     * Searches the require cache for a plugin class.
     * This is a fallback for third-party npm plugins not in our known list.
     */
    private findInRequireCache(pluginClass: Type<any>): string | undefined {
        // Check if require.cache is available (may not be in ESM-only environments)
        if (typeof require === 'undefined' || !require.cache) {
            return undefined;
        }

        try {
            for (const [modulePath, moduleObj] of Object.entries(require.cache)) {
                if (!moduleObj?.exports || !modulePath.includes('node_modules')) {
                    continue;
                }

                try {
                    const exports = moduleObj.exports;

                    // Direct match or default export match
                    if (exports === pluginClass || exports?.default === pluginClass) {
                        return this.extractPackageName(modulePath);
                    }

                    // Check named exports
                    if (typeof exports === 'object' && exports !== null) {
                        const exportValues = Object.values(exports);
                        if (exportValues.includes(pluginClass)) {
                            return this.extractPackageName(modulePath);
                        }
                    }
                } catch {
                    // Skip modules with problematic exports
                    continue;
                }
            }
        } catch {
            // Ignore errors accessing require.cache
        }

        return undefined;
    }

    /**
     * Extracts the npm package name from a node_modules path.
     * Handles both scoped (@scope/package) and unscoped packages.
     */
    private extractPackageName(modulePath: string): string | undefined {
        const nodeModulesIndex = modulePath.lastIndexOf('node_modules');
        if (nodeModulesIndex === -1) {
            return undefined;
        }

        const pathAfterNodeModules = modulePath.slice(nodeModulesIndex + 'node_modules/'.length);
        const parts = pathAfterNodeModules.split(/[/\\]/);

        if (parts[0].startsWith('@')) {
            // Scoped package: @scope/package
            return `${parts[0]}/${parts[1]}`;
        }
        return parts[0];
    }
}
