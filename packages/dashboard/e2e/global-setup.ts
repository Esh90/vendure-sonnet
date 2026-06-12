import type { AssetStorageStrategy } from '@vendure/core';
import { mergeConfig } from '@vendure/core';
import {
    createTestEnvironment,
    testConfig as defaultTestConfig,
    registerInitializer,
    SqljsInitializer,
} from '@vendure/testing';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Readable, Stream, Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { VENDURE_PORT } from './constants.js';
import { e2eCustomFields, e2ePaymentMethodHandlers } from './fixtures/e2e-shared-config.js';
import { initialData } from './fixtures/initial-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * Minimal in-memory storage strategy used only by the dashboard e2e suite.
 * Emits a parseable absolute URL so VendureImage's `new URL(asset.preview)`
 * does not throw on assets created during tests. No bytes are persisted and
 * no real HTTP server (and no AssetServerPlugin) is required.
 *
 * This duplicates a little of `TestingAssetStorageStrategy` rather than
 * subclassing it because that class is not part of `@vendure/testing`'s public
 * API — the only behaviour we need to change is `toAbsoluteUrl` returning a
 * URL that `new URL(...)` can parse.
 */
class E2eAssetStorageStrategy implements AssetStorageStrategy {
    toAbsoluteUrl(_req: unknown, identifier: string) {
        return `http://test-asset.local/${identifier}`;
    }
    writeFileFromBuffer(fileName: string) {
        return Promise.resolve(`test-assets/${fileName}`);
    }
    writeFileFromStream(fileName: string, data: Stream) {
        return new Promise<string>((resolve, reject) => {
            const w = new Writable({ write: (_c, _e, cb) => cb() });
            data.on('error', reject);
            data.pipe(w);
            w.on('finish', () => resolve(`test-assets/${fileName}`));
            w.on('error', reject);
        });
    }
    readFileToBuffer() {
        return Promise.resolve(Buffer.alloc(0));
    }
    readFileToStream() {
        const s = new Readable();
        s.push(null);
        return Promise.resolve(s);
    }
    fileExists() {
        return Promise.resolve(false);
    }
    deleteFile() {
        return Promise.resolve();
    }
}

/**
 * Compiles a TypeScript fixture with SWC so that NestJS parameter decorators
 * and emitDecoratorMetadata work correctly. Playwright's built-in transpiler
 * (esbuild/Babel) does not support these features.
 */
async function importWithSwc<T>(fixturePath: string): Promise<T> {
    const { transformFileSync } = await import('@swc/core');
    const { code } = transformFileSync(fixturePath, {
        jsc: {
            parser: { syntax: 'typescript', decorators: true },
            transform: { decoratorMetadata: true, useDefineForClassFields: false },
            target: 'es2017',
        },
        module: { type: 'es6' },
    });
    const outDir = path.join(__dirname, 'fixtures', '.compiled');
    const outFile = path.join(outDir, path.basename(fixturePath).replace(/\.ts$/, '.mjs'));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, code);
    return import(pathToFileURL(outFile).href) as Promise<T>;
}

export default async function globalSetup() {
    // CustomHistoryEntryPlugin uses NestJS constructor injection which requires
    // SWC compilation (emitDecoratorMetadata). It is loaded dynamically here
    // rather than statically imported because Playwright's built-in TypeScript
    // transpiler (esbuild/Babel) does not support emitDecoratorMetadata.
    const { CustomHistoryEntryPlugin } = await importWithSwc<{
        CustomHistoryEntryPlugin: new () => unknown;
    }>(path.join(__dirname, 'fixtures', 'custom-history-entry-plugin.ts'));

    const config = mergeConfig(defaultTestConfig, {
        apiOptions: {
            port: VENDURE_PORT,
        },
        paymentOptions: {
            paymentMethodHandlers: e2ePaymentMethodHandlers,
        },
        // The default test-asset storage strategy emits a non-parseable
        // `test-url/test-assets/...` placeholder that `VendureImage` cannot
        // parse with `new URL(...)`, which crashes any page showing a real
        // asset. The minimal strategy below emits a parseable absolute URL —
        // all the asset-preview tests actually require — without pulling in
        // AssetServerPlugin (not in the dashboard-e2e build scope on CI).
        assetOptions: {
            assetStorageStrategy: new E2eAssetStorageStrategy(),
        },
        // Point the CSV asset importer at the core e2e fixture images so the
        // seeded products (e.g. "Laptop") get a real featured asset. This lets
        // asset-dependent tests use a seeded product directly instead of
        // uploading one at runtime.
        importExportOptions: {
            importAssetsDir: path.join(__dirname, '../../core/e2e/fixtures/assets'),
        },
        plugins: [CustomHistoryEntryPlugin],
        customFields: e2eCustomFields,
    });

    // mergeConfig won't replace a boolean with an object, so set CORS explicitly.
    // The dashboard's fetch uses credentials: 'include', which requires the server
    // to reflect the request origin (not wildcard *) and set credentials: true.
    config.apiOptions.cors = {
        origin: true,
        credentials: true,
    };

    const { server } = createTestEnvironment(config);
    await server.init({
        initialData,
        productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-full.csv'),
        customerCount: 5,
    });
    (globalThis as any).__VENDURE_SERVER__ = server;
}
