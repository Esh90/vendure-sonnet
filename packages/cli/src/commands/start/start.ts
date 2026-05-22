import { log } from '@clack/prompts';
import { ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

import { resolveVendureProjectDirectory } from '../dev/dev';

export type StartTarget = 'all' | 'server' | 'worker';

interface StartProcessDefinition {
    target: Exclude<StartTarget, 'all'>;
    args: string[];
    requiredFile: string;
    color: (text: string) => string;
}

export interface StartOptions {
    serverEntry?: string;
    workerEntry?: string;
}

const validTargets: StartTarget[] = ['all', 'server', 'worker'];

export async function startCommand(targetArg?: string, options: StartOptions = {}): Promise<number> {
    try {
        const target = normalizeStartTarget(targetArg);
        const projectDir = resolveVendureProjectDirectory(process.cwd());
        const startProcessDefinitions = getStartProcessDefinitions(options);
        const processes = getStartProcessesForTarget(target, startProcessDefinitions);
        const prefixOutput = processes.length > 1;

        validateProjectFiles(projectDir, processes);

        const children = processes.map(processDefinition =>
            startProcess(projectDir, processDefinition, { prefixOutput }),
        );
        return await waitForStartProcesses(children);
    } catch (e: unknown) {
        log.error(e instanceof Error ? e.message : String(e));
        return 1;
    }
}

export function getStartProcessDefinitions(
    options: StartOptions = {},
): Record<Exclude<StartTarget, 'all'>, StartProcessDefinition> {
    const serverEntry = options.serverEntry ?? './dist/index.js';
    const workerEntry = options.workerEntry ?? './dist/index-worker.js';

    return {
        server: {
            target: 'server',
            args: [serverEntry],
            requiredFile: serverEntry,
            color: pc.blue,
        },
        worker: {
            target: 'worker',
            args: [workerEntry],
            requiredFile: workerEntry,
            color: pc.cyan,
        },
    };
}

export function getStartProcessesForTarget(
    target: StartTarget,
    startProcessDefinitions: Record<Exclude<StartTarget, 'all'>, StartProcessDefinition>,
): StartProcessDefinition[] {
    if (target === 'all') {
        return [startProcessDefinitions.server, startProcessDefinitions.worker];
    }
    return [startProcessDefinitions[target]];
}

export function normalizeStartTarget(targetArg?: string): StartTarget {
    const target = (targetArg ?? 'all').trim();
    if (validTargets.includes(target as StartTarget)) {
        return target as StartTarget;
    }
    throw new Error(`Unknown start target "${target}". Expected one of: ${validTargets.join(', ')}`);
}

function startProcess(
    projectDir: string,
    processDefinition: StartProcessDefinition,
    options: { prefixOutput: boolean },
): ChildProcess {
    const child = spawn(process.execPath, processDefinition.args, {
        cwd: projectDir,
        env: {
            ...process.env,
            FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
        },
        stdio: options.prefixOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    if (options.prefixOutput) {
        pipePrefixedOutput(child.stdout, process.stdout, processDefinition);
        pipePrefixedOutput(child.stderr, process.stderr, processDefinition);
    }
    return child;
}

function pipePrefixedOutput(
    stream: NodeJS.ReadableStream | null,
    output: NodeJS.WriteStream,
    processDefinition: StartProcessDefinition,
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

function waitForStartProcesses(children: ChildProcess[]): Promise<number> {
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

function validateProjectFiles(projectDir: string, processes: StartProcessDefinition[]) {
    for (const processDefinition of processes) {
        assertFileExists(projectDir, processDefinition.requiredFile);
    }
}

function assertFileExists(projectDir: string, relativePath: string) {
    if (!existsSync(path.join(projectDir, relativePath))) {
        throw new Error(
            `Could not find ${relativePath}. Run this command after building your Vendure server project.`,
        );
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
