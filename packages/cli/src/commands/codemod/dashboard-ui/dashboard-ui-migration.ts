import { log, spinner } from '@clack/prompts';

import { getTsMorphProject } from '../../../utilities/ast-utils';

import { transformAccordionProps } from './transforms/accordion-props';
import { transformAsChildToRender } from './transforms/as-child-to-render';
import { transformFormComponents } from './transforms/form-components';
import { transformImportConsolidation } from './transforms/import-consolidation';
import { warnSelectItemsProp } from './transforms/select-items-prop';

/**
 * Runs all dashboard UI migration transforms on every .tsx file in the project.
 *
 * Transform order matters:
 * 1. asChild → render prop — must run before import consolidation so the
 *    `asChild` attribute is gone before imports are rewritten.
 * 2. FormField → FormFieldWrapper — removes old form imports and adds
 *    FormFieldWrapper. Must run before import consolidation so that any
 *    remaining form imports from third-party sources get caught.
 * 3. Import consolidation — rewrites @radix-ui/*, @vendure-io/ui, @base-ui
 *    imports to @vendure/dashboard. Runs after JSX transforms so it sees the
 *    final set of needed imports. Also rewrites namespace member access sites.
 * 4. Accordion prop removal — independent, order doesn't matter.
 * 5. Select items warning — read-only, no mutations.
 */
export async function dashboardUiMigration() {
    const s = spinner();
    s.start('Analyzing project...');

    const { project } = await getTsMorphProject();
    const sourceFiles = project.getSourceFiles().filter(sf => sf.getFilePath().endsWith('.tsx'));

    s.stop(`Found ${sourceFiles.length} TSX files`);

    let totalChanges = 0;
    let filesChanged = 0;

    for (const sourceFile of sourceFiles) {
        let fileChanges = 0;

        fileChanges += transformAsChildToRender(sourceFile);
        fileChanges += transformFormComponents(sourceFile);
        fileChanges += transformImportConsolidation(sourceFile);
        fileChanges += transformAccordionProps(sourceFile);
        warnSelectItemsProp(sourceFile);

        if (fileChanges > 0) {
            totalChanges += fileChanges;
            filesChanged++;
            log.info(`Updated: ${sourceFile.getFilePath()} (${fileChanges} changes)`);
        }
    }

    if (totalChanges > 0) {
        const saveSpinner = spinner();
        saveSpinner.start('Saving changes...');
        await project.save();
        saveSpinner.stop(`Done! ${totalChanges} changes across ${filesChanged} files`);
    } else {
        log.info('No Radix UI patterns found. Your code is already up to date!');
    }
}
