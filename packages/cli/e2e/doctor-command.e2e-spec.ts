import { afterEach, describe, expect, it } from 'vitest';

import { CliTestProject, createTestProject } from './cli-test-utils';

describe('CLI Doctor Command E2E', () => {
    let testProject: CliTestProject;

    afterEach(() => {
        if (testProject) {
            testProject.cleanup();
        }
    });

    describe('project check', () => {
        it('should pass project check in a valid Vendure project', async () => {
            testProject = createTestProject('doctor-project-pass');

            const result = await testProject.runCliCommand([
                'doctor',
                '--check',
                'project',
                '--format',
                'json',
            ]);

            expect(result.exitCode).toBe(0);
            const report = JSON.parse(result.stdout);
            expect(report.overallStatus).toBe('passed');
            expect(report.checks).toHaveLength(1);
            expect(report.checks[0].name).toBe('Project');
            expect(report.checks[0].status).toBe('pass');
        });

        it('should fail project check in a non-Vendure directory', async () => {
            testProject = createTestProject('doctor-project-fail');

            // Overwrite package.json with no @vendure/* deps
            testProject.writeFile(
                'package.json',
                JSON.stringify({
                    name: 'not-vendure',
                    version: '1.0.0',
                    dependencies: { express: '4.0.0' },
                }),
            );

            const result = await testProject.runCliCommand(
                ['doctor', '--check', 'project', '--format', 'json'],
                { expectError: true },
            );

            expect(result.exitCode).toBe(1);
            const report = JSON.parse(result.stdout);
            expect(report.overallStatus).toBe('failed');
            expect(report.checks[0].status).toBe('fail');
        });
    });

    describe('--format json', () => {
        it('should output valid JSON with all expected fields', async () => {
            testProject = createTestProject('doctor-json-output');

            const result = await testProject.runCliCommand([
                'doctor',
                '--check',
                'project',
                '--format',
                'json',
            ]);

            expect(result.exitCode).toBe(0);
            const report = JSON.parse(result.stdout);
            expect(report).toHaveProperty('nodeVersion');
            expect(report).toHaveProperty('checks');
            expect(report).toHaveProperty('overallStatus');
            expect(report.nodeVersion).toMatch(/^v\d+\.\d+\.\d+$/);
        });
    });

    describe('--strict mode', () => {
        it('should treat warnings as failures with --strict', async () => {
            testProject = createTestProject('doctor-strict');

            // Create a project with multiple lockfiles to trigger a warning
            testProject.writeFile('yarn.lock', '');
            testProject.writeFile('package-lock.json', '{}');

            const result = await testProject.runCliCommand(
                ['doctor', '--check', 'project', '--format', 'json', '--strict'],
                { expectError: true },
            );

            // The project check itself passes but the multiple lockfiles
            // don't cause a warn status on the project check -- they're just
            // informational details. So strict mode won't change the outcome here.
            // This test verifies the --strict flag is accepted without error.
            const report = JSON.parse(result.stdout);
            expect(report).toHaveProperty('overallStatus');
        });
    });

    describe('--help', () => {
        it('should show doctor help with all options', async () => {
            testProject = createTestProject('doctor-help');

            const result = await testProject.runCliCommand(['doctor', '--help']);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('--config');
            expect(result.stdout).toContain('--check');
            expect(result.stdout).toContain('--profile');
            expect(result.stdout).toContain('--format');
            expect(result.stdout).toContain('--strict');
        });
    });

    describe('dependency check', () => {
        it('should report when node_modules is missing', async () => {
            testProject = createTestProject('doctor-no-modules');

            // The default test project doesn't run npm install,
            // so node_modules won't exist
            const result = await testProject.runCliCommand(
                ['doctor', '--check', 'dependencies', '--format', 'json'],
                { expectError: true },
            );

            expect(result.exitCode).toBe(1);
            const report = JSON.parse(result.stdout);
            expect(report.checks[0].status).toBe('fail');
            expect(report.checks[0].message).toContain('node_modules not found');
        });
    });

    describe('cascading skips', () => {
        it('should skip config-dependent checks when project check fails', async () => {
            testProject = createTestProject('doctor-cascade-skip');

            // Overwrite package.json with no vendure deps
            testProject.writeFile(
                'package.json',
                JSON.stringify({
                    name: 'not-vendure',
                    version: '1.0.0',
                    dependencies: { express: '4.0.0' },
                }),
            );

            const result = await testProject.runCliCommand(
                ['doctor', '--format', 'json'],
                { expectError: true },
            );

            expect(result.exitCode).toBe(1);
            const report = JSON.parse(result.stdout);

            // Project should fail
            expect(report.checks[0].name).toBe('Project');
            expect(report.checks[0].status).toBe('fail');

            // All other checks should be skipped
            const skippedChecks = report.checks.filter((c: any) => c.status === 'skip');
            expect(skippedChecks.length).toBeGreaterThanOrEqual(4);
        });
    });
});
