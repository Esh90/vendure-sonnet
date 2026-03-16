import { pathToFileURL } from 'node:url';
import path from 'path';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

import { viteConfigPlugin } from '../vite-plugin-config.js';
import { dashboardMetadataPlugin } from '../vite-plugin-dashboard-metadata.js';
import { dashboardTailwindSourcePlugin } from '../vite-plugin-tailwind-source.js';
import { themeVariablesPlugin } from '../vite-plugin-theme.js';
import { transformIndexHtmlPlugin } from '../vite-plugin-transform-index.js';

// ─── themeVariablesPlugin ────────────────────────────────────────────────────

describe('themeVariablesPlugin', () => {
    it('returns null for non-styles.css files', () => {
        const plugin = themeVariablesPlugin({});
        // @ts-expect-error - calling hook directly for testing
        const result = plugin.transform('body { color: red; }', '/app/main.css');
        expect(result).toBeNull();
    });

    it('returns null when CSS has no @import virtual:admin-theme', () => {
        const plugin = themeVariablesPlugin({});
        // @ts-expect-error
        const result = plugin.transform('body { color: red; }', '/app/styles.css');
        expect(result).toBeNull();
    });

    it('replaces single-quoted @import with theme variables', () => {
        const plugin = themeVariablesPlugin({});
        const css = `@import 'virtual:admin-theme';\nbody { color: red; }`;
        // @ts-expect-error
        const result = plugin.transform(css, '/app/styles.css');
        expect(result).toContain(':root');
        expect(result).toContain('.dark');
        expect(result).toContain('--background:');
        expect(result).toContain('body { color: red; }');
    });

    it('replaces double-quoted @import with theme variables', () => {
        const plugin = themeVariablesPlugin({});
        const css = `@import "virtual:admin-theme";\nbody { color: red; }`;
        // @ts-expect-error
        const result = plugin.transform(css, '/app/styles.css');
        expect(result).toContain(':root');
        expect(result).toContain('.dark');
    });

    it('merges custom light theme colors with defaults', () => {
        const plugin = themeVariablesPlugin({
            theme: { light: { background: 'red' } },
        });
        const css = `@import 'virtual:admin-theme';`;
        // @ts-expect-error
        const result = plugin.transform(css, '/app/styles.css');
        expect(result).toContain('--background: red;');
        // Other defaults should still be present
        expect(result).toContain('--foreground:');
    });

    it('merges custom dark theme colors with defaults', () => {
        const plugin = themeVariablesPlugin({
            theme: { dark: { background: 'navy' } },
        });
        const css = `@import 'virtual:admin-theme';`;
        // @ts-expect-error
        const result = plugin.transform(css, '/app/styles.css');
        expect(result).toContain('.dark');
        expect(result).toContain('--background: navy;');
    });

    it('preserves surrounding CSS', () => {
        const plugin = themeVariablesPlugin({});
        const css = `.header { display: flex; }\n@import 'virtual:admin-theme';\n.footer { margin: 0; }`;
        // @ts-expect-error
        const result = plugin.transform(css, '/app/styles.css');
        expect(result).toContain('.header { display: flex; }');
        expect(result).toContain('.footer { margin: 0; }');
    });
});

// ─── transformIndexHtmlPlugin ────────────────────────────────────────────────

describe('transformIndexHtmlPlugin', () => {
    const sampleHtml = [
        '<html>',
        '<head>',
        '  <link rel="stylesheet" href="/dashboard/assets/style.css">',
        '  <script src="/dashboard/assets/main.js"></script>',
        '</head>',
        '<body></body>',
        '</html>',
    ].join('\n');

    it('returns HTML unchanged when base is "/"', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: 'index.html' });
        expect(result).toBe(sampleHtml);
    });

    it('strips base path from href attributes', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/dashboard/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: 'index.html' });
        expect(result).toContain('href="assets/style.css"');
    });

    it('strips base path from src attributes', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/dashboard/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: 'index.html' });
        expect(result).toContain('src="assets/main.js"');
    });

    it('adds <base> tag after <head>', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/dashboard/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: 'index.html' });
        expect(result).toContain('<base href="/dashboard/">');
    });

    it('does not transform Storybook HTML (iframe.html)', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/dashboard/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: '/path/to/iframe.html' });
        expect(result).toBe(sampleHtml);
    });

    it('does not transform Storybook HTML (storybook path)', () => {
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/dashboard/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(sampleHtml, { filename: '/storybook/index.html' });
        expect(result).toBe(sampleHtml);
    });

    it('handles multiple href/src attributes in one file', () => {
        const html = [
            '<html><head>',
            '<link href="/app/a.css">',
            '<link href="/app/b.css">',
            '<script src="/app/x.js"></script>',
            '<script src="/app/y.js"></script>',
            '</head><body></body></html>',
        ].join('\n');
        const plugin = transformIndexHtmlPlugin();
        // @ts-expect-error
        plugin.configResolved({ base: '/app/' });
        // @ts-expect-error
        const result = plugin.transformIndexHtml(html, { filename: 'index.html' });
        expect(result).toContain('href="a.css"');
        expect(result).toContain('href="b.css"');
        expect(result).toContain('src="x.js"');
        expect(result).toContain('src="y.js"');
    });
});

// ─── viteConfigPlugin ────────────────────────────────────────────────────────

describe('viteConfigPlugin', () => {
    const packageRoot = '/fake/dashboard';

    it('sets root to packageRoot', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        expect(result.root).toBe(packageRoot);
    });

    it('sets default publicDir when not provided', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        expect(result.publicDir).toBe(path.join(packageRoot, 'public'));
    });

    it('preserves existing publicDir', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({ publicDir: '/custom/public' }, { command: 'serve' });
        expect(result.publicDir).toBe('/custom/public');
    });

    it('sets resolve aliases for @/vdb and @/graphql', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        const aliases = result.resolve.alias as Record<string, string>;
        expect(aliases['@/vdb']).toBe(path.resolve(packageRoot, './src/lib'));
        expect(aliases['@/graphql']).toBe(path.resolve(packageRoot, './src/lib/graphql'));
    });

    it('preserves existing resolve aliases', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        const config = { resolve: { alias: { '@custom': '/custom/path' } } };
        // @ts-expect-error
        const result = plugin.config(config, { command: 'serve' });
        const aliases = result.resolve.alias as Record<string, string>;
        expect(aliases['@custom']).toBe('/custom/path');
        expect(aliases['@/vdb']).toBeDefined();
    });

    it('sets optimizeDeps.exclude with virtual modules', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        expect(result.optimizeDeps.exclude).toContain('@vendure/dashboard');
        expect(result.optimizeDeps.exclude).toContain('virtual:vendure-ui-config');
        expect(result.optimizeDeps.exclude).toContain('virtual:dashboard-extensions');
    });

    it('sets optimizeDeps.include with recharts etc', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        expect(result.optimizeDeps.include).toContain('@/components > recharts');
        expect(result.optimizeDeps.include).toContain('@vendure/common/lib/generated-types');
    });

    it('build command: resolves relative outDir to absolute path from cwd', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({ build: { outDir: 'my-output' } }, { command: 'build' });
        expect(path.isAbsolute(result.build.outDir)).toBe(true);
        expect(result.build.outDir).toBe(path.resolve(process.cwd(), 'my-output'));
    });

    it('build command: preserves absolute outDir', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({ build: { outDir: '/abs/output' } }, { command: 'build' });
        expect(result.build.outDir).toBe('/abs/output');
    });

    it('build command: defaults outDir to cwd/dist', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'build' });
        expect(result.build.outDir).toBe(path.resolve(process.cwd(), 'dist'));
    });

    it('serve command: does not set build.outDir', () => {
        const plugin = viteConfigPlugin({ packageRoot });
        // @ts-expect-error
        const result = plugin.config({}, { command: 'serve' });
        expect(result.build).toBeUndefined();
    });
});

// ─── dashboardMetadataPlugin ─────────────────────────────────────────────────

describe('dashboardMetadataPlugin', () => {
    function setupPlugin(
        pluginInfo: Array<{
            name: string;
            pluginPath: string;
            dashboardEntryPath?: string;
            sourcePluginPath?: string;
        }>,
    ) {
        const plugin = dashboardMetadataPlugin();
        const fakeConfigLoader = {
            name: 'vendure:config-loader',
            api: {
                getVendureConfig: () =>
                    Promise.resolve({
                        pluginInfo,
                        vendureConfig: {},
                        exportedSymbolName: 'config',
                    }),
            },
        };
        // @ts-expect-error
        plugin.configResolved({ plugins: [fakeConfigLoader] });
        return plugin;
    }

    it('resolveId returns resolved ID for virtual:dashboard-extensions', () => {
        const plugin = setupPlugin([]);
        // @ts-expect-error
        const result = plugin.resolveId('virtual:dashboard-extensions');
        expect(result).toBe('\0virtual:dashboard-extensions');
    });

    it('resolveId returns undefined for other IDs', () => {
        const plugin = setupPlugin([]);
        // @ts-expect-error
        const result = plugin.resolveId('some-other-module');
        expect(result).toBeUndefined();
    });

    it('load generates runDashboardExtensions with correct import statements', async () => {
        const plugin = setupPlugin([
            {
                name: 'TestPlugin',
                pluginPath: '/path/to/plugin.js',
                dashboardEntryPath: './dashboard/index.tsx',
            },
        ]);
        const fakeContext = { debug: noop, info: noop };
        // @ts-expect-error
        const result = await plugin.load.call(fakeContext, '\0virtual:dashboard-extensions');
        expect(result).toContain('runDashboardExtensions');
        const expectedPath = path.resolve('/path/to', './dashboard/index.tsx');
        expect(result).toContain(pathToFileURL(expectedPath).toString());
    });

    it('load handles multiple extensions', async () => {
        const plugin = setupPlugin([
            { name: 'PluginA', pluginPath: '/a/plugin.js', dashboardEntryPath: './dashboard/index.tsx' },
            { name: 'PluginB', pluginPath: '/b/plugin.js', dashboardEntryPath: './ui/entry.tsx' },
        ]);
        const fakeContext = { debug: noop, info: noop };
        // @ts-expect-error
        const result = await plugin.load.call(fakeContext, '\0virtual:dashboard-extensions');
        const expectedA = pathToFileURL(path.resolve('/a', './dashboard/index.tsx')).toString();
        const expectedB = pathToFileURL(path.resolve('/b', './ui/entry.tsx')).toString();
        expect(result).toContain(expectedA);
        expect(result).toContain(expectedB);
    });

    it('load handles zero extensions', async () => {
        const plugin = setupPlugin([]);
        const fakeContext = { debug: noop, info: noop };
        // @ts-expect-error
        const result = await plugin.load.call(fakeContext, '\0virtual:dashboard-extensions');
        expect(result).toContain('runDashboardExtensions');
        // No import() calls
        expect(result).not.toContain('await import');
    });

    it('load skips plugins without dashboardEntryPath', async () => {
        const plugin = setupPlugin([
            { name: 'NoDashboard', pluginPath: '/x/plugin.js', dashboardEntryPath: undefined },
            {
                name: 'WithDashboard',
                pluginPath: '/y/plugin.js',
                dashboardEntryPath: './dashboard/index.tsx',
            },
        ]);
        const fakeContext = { debug: noop, info: noop };
        // @ts-expect-error
        const result = await plugin.load.call(fakeContext, '\0virtual:dashboard-extensions');
        const expectedY = pathToFileURL(path.resolve('/y', './dashboard/index.tsx')).toString();
        expect(result).toContain(expectedY);
        // Only one import
        expect((result.match(/await import/g) || []).length).toBe(1);
    });

    it('load returns undefined for non-matching IDs', async () => {
        const plugin = setupPlugin([]);
        const fakeContext = { debug: noop, info: noop };
        // @ts-expect-error
        const result = await plugin.load.call(fakeContext, 'some-other-id');
        expect(result).toBeUndefined();
    });
});

// ─── dashboardTailwindSourcePlugin ───────────────────────────────────────────

describe('dashboardTailwindSourcePlugin', () => {
    function setupPlugin(
        pluginInfo: Array<{
            name: string;
            pluginPath: string;
            dashboardEntryPath?: string;
            sourcePluginPath?: string;
        }>,
    ) {
        const plugin = dashboardTailwindSourcePlugin();
        const fakeConfigLoader = {
            name: 'vendure:config-loader',
            api: {
                getVendureConfig: () =>
                    Promise.resolve({
                        pluginInfo,
                        vendureConfig: {},
                        exportedSymbolName: 'config',
                    }),
            },
        };
        // @ts-expect-error
        plugin.configResolved({ plugins: [fakeConfigLoader] });
        return plugin;
    }

    const markerComment =
        '/* @source rules from extensions will be added here by the dashboardTailwindSourcePlugin */';

    it('returns undefined for non-styles.css files', async () => {
        const plugin = setupPlugin([]);
        const fakeContext = {};
        // @ts-expect-error
        const result = await plugin.transform.call(fakeContext, 'body {}', '/app/main.css');
        expect(result).toBeUndefined();
    });

    it('injects @source directives after the marker comment', async () => {
        const plugin = setupPlugin([
            {
                name: 'TestPlugin',
                pluginPath: '/ext/plugin.js',
                dashboardEntryPath: './dashboard/index.tsx',
            },
        ]);
        const css = `@tailwind base;\n${markerComment}\n@tailwind components;`;
        const fakeContext = {};
        // @ts-expect-error
        const result = await plugin.transform.call(fakeContext, css, '/some/app/styles.css');
        expect(result.code).toContain(markerComment);
        expect(result.code).toContain("@source '");
        // The @source directive line should appear right after the marker comment
        const lines: string[] = result.code.split('\n');
        const markerIdx: number = lines.findIndex((l: string) => l.includes(markerComment));
        const sourceIdx: number = lines.findIndex((l: string) => l.trimStart().startsWith("@source '"));
        expect(sourceIdx).toBe(markerIdx + 1);
    });

    it('appends @source directives at end if marker comment not found', async () => {
        const plugin = setupPlugin([
            {
                name: 'TestPlugin',
                pluginPath: '/ext/plugin.js',
                dashboardEntryPath: './dashboard/index.tsx',
            },
        ]);
        const css = '@tailwind base;\n@tailwind components;';
        const fakeContext = {};
        // @ts-expect-error
        const result = await plugin.transform.call(fakeContext, css, '/some/app/styles.css');
        expect(result.code).toContain("@source '");
        // Source should be at the end
        expect(result.code.endsWith("';")).toBe(true);
    });

    it('handles zero extensions (no @source directives)', async () => {
        const plugin = setupPlugin([]);
        const css = `@tailwind base;\n${markerComment}\n@tailwind components;`;
        const fakeContext = {};
        // @ts-expect-error
        const result = await plugin.transform.call(fakeContext, css, '/some/app/styles.css');
        // The empty sources string is still spliced in, but no actual @source directive exists
        const hasSourceDirective = result.code
            .split('\n')
            .some((l: string) => l.trimStart().startsWith("@source '"));
        expect(hasSourceDirective).toBe(false);
    });
});
