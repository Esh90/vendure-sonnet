import { cancel, intro, isCancel, log, outro, select } from '@clack/prompts';
import pc from 'picocolors';

import { withInteractiveTimeout } from '../../utilities/utils';

/**
 * Registry of available codemods. To add a new codemod, just add an entry here.
 */
const CODEMODS: Record<string, { description: string; run: () => Promise<void> }> = {
    'dashboard-ui': {
        description: 'Migrate dashboard extensions from Radix UI to Base UI patterns',
        run: async () => {
            const { dashboardUiMigration } = await import('./dashboard-ui/dashboard-ui-migration');
            await dashboardUiMigration();
        },
    },
};

export async function codemodCommand(transform?: string, path?: string) {
    if (transform) {
        // Non-interactive: run the specified codemod
        const codemod = CODEMODS[transform];
        if (!codemod) {
            log.error(`Unknown codemod: "${transform}"`);
            log.info(`Available codemods:\n${formatCodemodList()}`);
            process.exit(1);
        }
        if (path) {
            process.chdir(path);
        }
        await codemod.run();
        return;
    }

    // Interactive: let the user pick a codemod
    // eslint-disable-next-line no-console
    console.log(`\n`);
    intro(pc.blue('🔧 Vendure Codemods'));

    const selected = await withInteractiveTimeout(async () => {
        return await select({
            message: 'Which codemod would you like to run?',
            options: Object.entries(CODEMODS).map(([name, { description }]) => ({
                value: name,
                label: `${pc.blue(name)} — ${description}`,
            })),
        });
    });

    if (isCancel(selected)) {
        cancel('Codemod cancelled.');
        process.exit(0);
    }

    await CODEMODS[selected as string].run();
    outro('✅ Done!');
}

function formatCodemodList(): string {
    return Object.entries(CODEMODS)
        .map(([name, { description }]) => `  ${name} — ${description}`)
        .join('\n');
}
