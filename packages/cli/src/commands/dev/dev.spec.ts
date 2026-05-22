import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getDevProcessDefinitions, normalizeDevTarget, resolveVendureProjectDirectory } from './dev';

function createTempDir() {
    return mkdtempSync(path.join(tmpdir(), 'vendure-cli-dev-'));
}

function writePackageJson(dir: string, packageJson: Record<string, any>) {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(packageJson, null, 2));
}

describe('dev command', () => {
    describe('getDevProcessDefinitions()', () => {
        it('uses default entrypoints', () => {
            const definitions = getDevProcessDefinitions();

            expect(definitions.server.nodeArgs).toEqual([]);
            expect(definitions.server.args).toEqual(['./src/index.ts']);
            expect(definitions.worker.nodeArgs).toEqual([]);
            expect(definitions.worker.args).toEqual(['./src/index-worker.ts']);
            expect(definitions.dashboard.args).toEqual(['--clearScreen', 'false']);
        });

        it('uses custom entrypoints', () => {
            const definitions = getDevProcessDefinitions({
                serverEntry: './server.ts',
                workerEntry: './worker.ts',
                viteConfig: './config/vite.dashboard.mts',
            });

            expect(definitions.server.args).toEqual(['./server.ts']);
            expect(definitions.worker.args).toEqual(['./worker.ts']);
            expect(definitions.dashboard.args).toEqual([
                '--clearScreen',
                'false',
                '--config',
                './config/vite.dashboard.mts',
            ]);
        });

        it('adds inspector flags to a single dev target', () => {
            const definitions = getDevProcessDefinitions(
                {
                    inspect: '127.0.0.1:9230',
                },
                'server',
            );

            expect(definitions.server.nodeArgs).toEqual(['--inspect=127.0.0.1:9230']);
            expect(definitions.worker.nodeArgs).toEqual(['--inspect=127.0.0.1:9230']);
        });

        it('assigns adjacent inspector ports for dev all', () => {
            const definitions = getDevProcessDefinitions(
                {
                    inspect: true,
                },
                'all',
            );

            expect(definitions.server.nodeArgs).toEqual(['--inspect=9229']);
            expect(definitions.worker.nodeArgs).toEqual(['--inspect=9230']);
        });

        it('increments a custom inspector port for the worker in dev all', () => {
            const definitions = getDevProcessDefinitions(
                {
                    inspectBrk: '127.0.0.1:9330',
                },
                'all',
            );

            expect(definitions.server.nodeArgs).toEqual(['--inspect-brk=127.0.0.1:9330']);
            expect(definitions.worker.nodeArgs).toEqual(['--inspect-brk=127.0.0.1:9331']);
        });

        it('rejects inspect for the dashboard target', () => {
            expect(() =>
                getDevProcessDefinitions(
                    {
                        inspect: true,
                    },
                    'dashboard',
                ),
            ).toThrow('--inspect can only be used');
        });
    });

    describe('normalizeDevTarget()', () => {
        it('defaults to all', () => {
            expect(normalizeDevTarget()).toBe('all');
        });

        it('accepts known targets', () => {
            expect(normalizeDevTarget('all')).toBe('all');
            expect(normalizeDevTarget('server')).toBe('server');
            expect(normalizeDevTarget('worker')).toBe('worker');
            expect(normalizeDevTarget('dashboard')).toBe('dashboard');
        });

        it('rejects unknown targets', () => {
            expect(() => normalizeDevTarget('api')).toThrow('Unknown dev target');
        });
    });

    describe('resolveVendureProjectDirectory()', () => {
        it('returns the current directory for a Vendure package', () => {
            const dir = createTempDir();
            try {
                writePackageJson(dir, {
                    dependencies: {
                        '@vendure/core': '3.6.0',
                    },
                });

                expect(resolveVendureProjectDirectory(dir)).toBe(dir);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });

        it('finds a Vendure package in a monorepo root', () => {
            const dir = createTempDir();
            const serverDir = path.join(dir, 'apps', 'server');
            try {
                mkdirSync(serverDir, { recursive: true });
                writePackageJson(dir, {
                    private: true,
                    workspaces: ['apps/*'],
                });
                writePackageJson(serverDir, {
                    dependencies: {
                        '@vendure/core': '3.6.0',
                    },
                });

                expect(resolveVendureProjectDirectory(dir)).toBe(serverDir);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        });
    });
});
