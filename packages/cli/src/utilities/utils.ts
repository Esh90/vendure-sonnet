import { log } from '@clack/prompts';

interface TtyLike {
    isTTY?: boolean;
}

interface NonInteractiveEnvironmentOptions {
    stdin?: TtyLike;
    stdout?: TtyLike;
    env?: NodeJS.ProcessEnv;
}

/**
 * Since the AST manipulation is blocking, prompts will not get a
 * chance to be displayed unless we give a small async pause.
 */
export async function pauseForPromptDisplay() {
    await new Promise(resolve => setTimeout(resolve, 100));
}

export function isRunningInTsNode(): boolean {
    // @ts-ignore
    return process[Symbol.for('ts-node.register.instance')] != null;
}

export function isTruthyEnvVar(value: string | undefined): boolean {
    if (value == null) {
        return false;
    }
    return !['', '0', 'false'].includes(value.trim().toLowerCase());
}

export function isNonInteractiveEnvironment(options: NonInteractiveEnvironmentOptions = {}): boolean {
    const stdin = options.stdin ?? process.stdin;
    const stdout = options.stdout ?? process.stdout;
    const env = options.env ?? process.env;

    return (
        isTruthyEnvVar(env.CI) ||
        isTruthyEnvVar(env.VENDURE_CLI_NON_INTERACTIVE) ||
        stdin.isTTY !== true ||
        stdout.isTTY !== true
    );
}

export function abortIfNonInteractive(commandName: string, examples: string[]): boolean {
    if (!isNonInteractiveEnvironment()) {
        return false;
    }

    log.error(`Cannot run "${commandName}" interactively because non-interactive mode is active.`);
    log.info(
        'Provide explicit command flags, run from an interactive terminal, or unset VENDURE_CLI_NON_INTERACTIVE.',
    );
    if (examples.length) {
        log.info(`Examples:\n${examples.map(example => `   ${example}`).join('\n')}`);
    }
    process.exit(1);
    return true;
}

/**
 * Wraps an interactive prompt with a timeout to prevent hanging in automated environments.
 * After 60 seconds, it shows a helpful message for AI agents and exits.
 */
export async function withInteractiveTimeout<T>(
    promptFn: () => Promise<T>,
    timeoutMs: number = 60000,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            log.warning('\n⚠Interactive mode timeout after 60 seconds\n');
            log.info('This appears to be an automated environment (AI agent/editor).');
            log.info('Interactive prompts are not suitable for automated tools.\n');
            log.info('Please use the non-interactive mode with specific command flags.\n');
            log.info('Examples:');
            log.info('   vendure add -p MyPlugin');
            log.info('   vendure add -e MyEntity');
            log.info('   vendure add -s MyService');
            log.info('   vendure migrate -g my-migration');
            log.info('   vendure migrate -r\n');
            log.info('--- For complete usage information, run:');
            log.info('   vendure --help');
            log.info('   vendure add --help');
            log.info('   vendure migrate --help\n');

            process.exit(1);
        }, timeoutMs);

        promptFn()
            .then(result => {
                clearTimeout(timeout);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}
