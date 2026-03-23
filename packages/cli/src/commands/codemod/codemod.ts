import { log } from '@clack/prompts';

export interface CodemodOptions {
    /** Migrate dashboard extensions from Radix UI to Base UI patterns */
    dashboardUi?: boolean;
}

export async function codemodCommand(options?: CodemodOptions) {
    if (options?.dashboardUi) {
        const { dashboardUiMigration } = await import('./dashboard-ui/dashboard-ui-migration');
        await dashboardUiMigration();
        return;
    }

    log.error('No codemod specified. Available codemods: --dashboard-ui');
    process.exit(1);
}
