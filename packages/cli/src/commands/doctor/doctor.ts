import { log } from '@clack/prompts';
import { RuntimeVendureConfig } from '@vendure/core';

import { runConfigCheck } from './checks/config-check';
import { runDependencyCheck } from './checks/dependency-check';
import { runProjectCheck } from './checks/project-check';
import { runSchemaCheck } from './checks/schema-check';
import { formatConsoleReport } from './formatters/console-formatter';
import { formatJsonReport } from './formatters/json-formatter';
import { CheckResult, DoctorOptions, DoctorReport } from './types';

const ALL_CHECKS = ['project', 'dependencies', 'config', 'schema', 'database'] as const;

/**
 * Entry point for the `vendure doctor` command.
 * Runs diagnostic checks on a Vendure project and reports results.
 */
export async function doctorCommand(options?: DoctorOptions) {
    const checksToRun = resolveChecks(options?.check);

    const results: CheckResult[] = [];
    let loadedConfig: RuntimeVendureConfig | undefined;

    // Check 1: Project detection & config discovery
    if (checksToRun.includes('project')) {
        const projectResult = await runProjectCheck(options?.config);
        results.push(projectResult);

        // If project check fails, skip remaining checks that depend on it
        if (projectResult.status === 'fail' && checksToRun.length > 1) {
            for (const check of checksToRun.filter(c => c !== 'project')) {
                results.push({
                    name: capitalize(check),
                    status: 'skip',
                    message: 'Skipped due to project check failure',
                });
            }
            outputReport(buildReport(results, options), options);
            return;
        }
    }

    // Check 2: Dependency version alignment, singleton duplication, DB driver
    if (checksToRun.includes('dependencies')) {
        results.push(await runDependencyCheck());
    }

    // Check 3: Config loading, validation, plugin compatibility
    if (checksToRun.includes('config')) {
        const configResult = await runConfigCheck(options?.config);
        results.push(configResult.check);
        loadedConfig = configResult.config;

        // If config check fails, skip checks that depend on a loaded config
        if (configResult.check.status === 'fail') {
            const configDependentChecks = ['schema', 'database'];
            for (const check of configDependentChecks.filter(c => checksToRun.includes(c))) {
                results.push({
                    name: capitalize(check),
                    status: 'skip',
                    message: 'Skipped due to config check failure',
                });
            }
            outputReport(buildReport(results, options), options);
            return;
        }
    }

    // Check 4: GraphQL schema generation
    if (checksToRun.includes('schema')) {
        if (loadedConfig) {
            results.push(await runSchemaCheck(loadedConfig));
        } else {
            results.push({
                name: 'Schema',
                status: 'skip',
                message: 'Skipped (config check must run first)',
            });
        }
    }

    // Check 5 (database) will use loadedConfig when implemented.

    outputReport(buildReport(results, options), options);
}

function resolveChecks(checkFlags?: string[]): string[] {
    if (!checkFlags || checkFlags.length === 0) {
        return [...ALL_CHECKS];
    }
    const valid = checkFlags.filter(c => (ALL_CHECKS as readonly string[]).includes(c));
    const invalid = checkFlags.filter(c => !(ALL_CHECKS as readonly string[]).includes(c));
    if (invalid.length > 0) {
        log.warn(`Unknown check(s): ${invalid.join(', ')}. Valid checks: ${ALL_CHECKS.join(', ')}`);
    }
    return valid.length > 0 ? valid : [...ALL_CHECKS];
}

function buildReport(checks: CheckResult[], options?: DoctorOptions): DoctorReport {
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    const overallStatus = hasFail || (options?.strict && hasWarn) ? 'failed' : 'passed';

    return {
        nodeVersion: process.version,
        checks,
        overallStatus,
    };
}

function outputReport(report: DoctorReport, options?: DoctorOptions): void {
    if (options?.format === 'json') {
        formatJsonReport(report);
    } else {
        formatConsoleReport(report);
    }

    if (report.overallStatus === 'failed') {
        process.exit(1);
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
