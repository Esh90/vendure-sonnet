import { log } from '@clack/prompts';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

import { findPackageJsonWithDependency } from '../../utilities/monorepo-utils';

export type DevTarget = 'all' | 'server' | 'worker' | 'dashboard';

interface DevProcessDefinition {
    target: Exclude<DevTarget, 'all'>;
    packageName: string;
    binName: string;
    nodeArgs: string[];
    args: string[];
    requiredFile?: string;
    color: (text: string) => string;
}

export interface DevOptions {
    serverEntry?: string;
    workerEntry?: string;
    viteConfig?: string;
    inspect?: boolean | string;
    inspectBrk?: boolean | string;
}

const validTargets: DevTarget[] = ['all', 'server', 'worker', 'dashboard'];

export async function devCommand(targetArg?: string, options: DevOptions = {}): Promise<number> {
    try {
        const target = normalizeDevTarget(targetArg);
        const projectDir = resolveVendureProjectDirectory(process.cwd());
        const devProcessDefinitions = getDevProcessDefinitions(options, target);
        const processes =
            target === 'all'
                ? (['server', 'worker', 'dashboard'] as const).map(t => devProcessDefinitions[t])
                : [devProcessDefinitions[target]];
        const prefixOutput = processes.length > 1;

        validateProjectFiles(projectDir, processes);

        const children = processes.map(processDefinition =>
            startDevProcess(projectDir, processDefinition, { prefixOutput }),
        );
        return await waitForDevProcesses(children);
    } catch (e: unknown) {
        log.error(e instanceof Error ? e.message : String(e));
        return 1;
    }
}

export function getDevProcessDefinitions(
    options: DevOptions = {},
    target: DevTarget = 'all',
): Record<Exclude<DevTarget, 'all'>, DevProcessDefinition> {
    const serverEntry = options.serverEntry ?? './src/index.ts';
    const workerEntry = options.workerEntry ?? './src/index-worker.ts';
    const dashboardArgs = ['--clearScreen', 'false'];
    if (options.viteConfig) {
        dashboardArgs.push('--config', options.viteConfig);
    }

    return {
        server: {
            target: 'server',
            packageName: 'ts-node',
            binName: 'ts-node',
            nodeArgs: getInspectArgs(options, target, 'server'),
            args: [serverEntry],
            requiredFile: serverEntry,
            color: pc.blue,
        },
        worker: {
            target: 'worker',
            packageName: 'ts-node',
            binName: 'ts-node',
            nodeArgs: getInspectArgs(options, target, 'worker'),
            args: [workerEntry],
            requiredFile: workerEntry,
            color: pc.cyan,
        },
        dashboard: {
            target: 'dashboard',
            packageName: 'vite',
            binName: 'vite',
            nodeArgs: [],
            args: dashboardArgs,
            requiredFile: options.viteConfig,
            color: pc.magenta,
        },
    };
}

export function normalizeDevTarget(targetArg?: string): DevTarget {
    const target = (targetArg ?? 'all').trim();
    if (validTargets.includes(target as DevTarget)) {
        return target as DevTarget;
    }
    throw new Error(`Unknown dev target "${target}". Expected one of: ${validTargets.join(', ')}`);
}

export function resolveVendureProjectDirectory(cwd: string): string {
    if (hasVendureCoreDependency(path.join(cwd, 'package.json'))) {
        return cwd;
    }

    const packageJsonPath = findPackageJsonWithDependency(cwd, '@vendure/core');
    return packageJsonPath ? path.dirname(packageJsonPath) : cwd;
}

function startDevProcess(
    projectDir: string,
    processDefinition: DevProcessDefinition,
    options: { prefixOutput: boolean },
): ChildProcess {
    const binPath = resolvePackageBin(processDefinition.packageName, processDefinition.binName, projectDir);
    const child = spawn(
        process.execPath,
        [...processDefinition.nodeArgs, binPath, ...processDefinition.args],
        {
            cwd: projectDir,
            env: {
                ...process.env,
                FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
            },
            stdio: options.prefixOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
        },
    );
    if (options.prefixOutput) {
        pipePrefixedOutput(child.stdout, process.stdout, processDefinition);
        pipePrefixedOutput(child.stderr, process.stderr, processDefinition);
    }
    return child;
}

function getInspectArgs(
    options: DevOptions,
    commandTarget: DevTarget,
    processTarget: Exclude<DevTarget, 'all' | 'dashboard'>,
): string[] {
    if (options.inspect && options.inspectBrk) {
        throw new Error('Use either --inspect or --inspect-brk, not both.');
    }
    const inspectValue = options.inspectBrk ?? options.inspect;
    if (inspectValue == null || inspectValue === false) {
        return [];
    }
    if (commandTarget === 'dashboard') {
        throw new Error('--inspect can only be used with the server or worker dev targets.');
    }
    const inspectFlag = options.inspectBrk ? '--inspect-brk' : '--inspect';
    if (commandTarget === 'all') {
        return [`${inspectFlag}=${resolveInspectAddress(inspectValue, processTarget === 'server' ? 0 : 1)}`];
    }
    if (inspectValue === true) {
        return [inspectFlag];
    }
    return [`${inspectFlag}=${inspectValue}`];
}

function resolveInspectAddress(inspectValue: boolean | string, portOffset: number): string {
    if (inspectValue === true) {
        return String(9229 + portOffset);
    }
    if (inspectValue === false) {
        return String(9229 + portOffset);
    }
    const match = inspectValue.match(/^(.*:)?(\d+)$/);
    if (!match) {
        throw new Error('When using --inspect with "dev all", pass a numeric port or host:port value.');
    }
    const host = match[1] ?? '';
    const port = Number(match[2]);
    return `${host}${port + portOffset}`;
}

function pipePrefixedOutput(
    stream: NodeJS.ReadableStream | null,
    output: NodeJS.WriteStream,
    processDefinition: DevProcessDefinition,
) {
    if (!stream) {
        return;
    }
    let buffered = '';
    const prefix = processDefinition.color(`[${processDefinition.target}]`);
    stream.on('data', data => {
        buffered += data.toString();
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';
        for (const line of lines) {
            output.write(line.length ? `${prefix} ${line}\n` : '\n');
        }
    });
    stream.on('end', () => {
        if (buffered.length) {
            output.write(`${prefix} ${buffered}\n`);
        }
    });
}

function waitForDevProcesses(children: ChildProcess[]): Promise<number> {
    if (children.length === 0) {
        return Promise.resolve(0);
    }

    return new Promise(resolve => {
        let resolved = false;
        let shutdownRequested = false;
        let remainingChildren = children.length;

        const cleanup = () => {
            process.off('SIGINT', handleSigint);
            process.off('SIGTERM', handleSigterm);
        };
        const resolveOnce = (code: number) => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(code);
            }
        };
        const stopChildren = (signal: NodeJS.Signals) => {
            shutdownRequested = true;
            for (const child of children) {
                if (!child.killed) {
                    child.kill(signal);
                }
            }
        };
        const handleSigint = () => stopChildren('SIGINT');
        const handleSigterm = () => stopChildren('SIGTERM');

        process.once('SIGINT', handleSigint);
        process.once('SIGTERM', handleSigterm);

        for (const child of children) {
            child.once('error', error => {
                log.error(error.message);
                stopChildren('SIGTERM');
                resolveOnce(1);
            });
            child.once('close', (code, signal) => {
                remainingChildren--;
                if (!shutdownRequested) {
                    stopChildren('SIGTERM');
                    resolveOnce(code ?? signalToExitCode(signal) ?? 1);
                    return;
                }
                if (remainingChildren === 0) {
                    resolveOnce(code ?? signalToExitCode(signal) ?? 0);
                }
            });
        }
    });
}

function validateProjectFiles(projectDir: string, processes: DevProcessDefinition[]) {
    for (const processDefinition of processes) {
        if (processDefinition.requiredFile) {
            assertFileExists(projectDir, processDefinition.requiredFile);
        }
    }
}

function assertFileExists(projectDir: string, relativePath: string) {
    if (!existsSync(path.join(projectDir, relativePath))) {
        throw new Error(
            `Could not find ${relativePath}. Run this command from a Vendure server project root.`,
        );
    }
}

function resolvePackageBin(packageName: string, binName: string, projectDir: string): string {
    const packageJsonPath = resolvePackageJsonPath(packageName, projectDir);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
        bin?: string | Record<string, string>;
    };
    const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.[binName];

    if (!bin) {
        throw new Error(`Could not find the "${binName}" binary in "${packageName}".`);
    }
    return path.resolve(path.dirname(packageJsonPath), bin);
}

function resolvePackageJsonPath(packageName: string, projectDir: string): string {
    try {
        return require.resolve(`${packageName}/package.json`, { paths: [projectDir] });
    } catch (e: unknown) {
        try {
            return require.resolve(`${packageName}/package.json`);
        } catch {
            throw new Error(`Could not find "${packageName}". Make sure @vendure/cli is installed.`);
        }
    }
}

function hasVendureCoreDependency(packageJsonPath: string): boolean {
    if (!existsSync(packageJsonPath)) {
        return false;
    }
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        return !!(
            packageJson.dependencies?.['@vendure/core'] ?? packageJson.devDependencies?.['@vendure/core']
        );
    } catch {
        return false;
    }
}

function signalToExitCode(signal: NodeJS.Signals | null): number | undefined {
    if (signal === 'SIGINT') {
        return 130;
    }
    if (signal === 'SIGTERM') {
        return 143;
    }
}
