import { SourceFile } from 'ts-morph';

import { addImportsToFile } from '../../../../utilities/ast-utils';

/**
 * Rewrites imports from old Radix UI, @vendure-io/ui, and @base-ui/react
 * packages to the consolidated `@vendure/dashboard` import.
 *
 * BEFORE:
 * ```
 * import * as Dialog from '@radix-ui/react-dialog';
 * import { Button } from '@vendure-io/ui/components/ui/button';
 * import { Collapsible } from '@base-ui/react/collapsible';
 * ```
 *
 * AFTER:
 * ```
 * import { Dialog, Button, Collapsible } from '@vendure/dashboard';
 * ```
 *
 * - Namespace imports (e.g. `* as Dialog`) are converted to named imports.
 * - Merges with an existing `@vendure/dashboard` import if present.
 */
export function transformImportConsolidation(sourceFile: SourceFile): number {
    let changeCount = 0;

    const importDeclarations = sourceFile.getImportDeclarations();
    const collectedNamedImports: string[] = [];
    const declarationsToRemove: typeof importDeclarations = [];

    for (const importDecl of importDeclarations) {
        const moduleSpecifier = importDecl.getModuleSpecifier().getLiteralValue();

        const isRadixUi = moduleSpecifier.startsWith('@radix-ui/');
        const isVendureIoUi = moduleSpecifier.startsWith('@vendure-io/ui');
        const isBaseUi = moduleSpecifier.startsWith('@base-ui/react');

        if (!isRadixUi && !isVendureIoUi && !isBaseUi) {
            continue;
        }

        // Collect namespace imports as named imports
        const namespaceImport = importDecl.getNamespaceImport();
        if (namespaceImport) {
            collectedNamedImports.push(namespaceImport.getText());
            declarationsToRemove.push(importDecl);
            changeCount++;
            continue;
        }

        // Collect default imports as named imports
        const defaultImport = importDecl.getDefaultImport();
        if (defaultImport) {
            collectedNamedImports.push(defaultImport.getText());
        }

        // Collect named imports
        const namedImports = importDecl.getNamedImports();
        for (const namedImport of namedImports) {
            const alias = namedImport.getAliasNode();
            if (alias) {
                collectedNamedImports.push(`${namedImport.getName()} as ${alias.getText()}`);
            } else {
                collectedNamedImports.push(namedImport.getName());
            }
        }

        if (namedImports.length > 0 || defaultImport) {
            declarationsToRemove.push(importDecl);
            changeCount++;
        }
    }

    if (collectedNamedImports.length === 0) {
        return 0;
    }

    // Remove old import declarations (iterate in reverse to preserve indices)
    for (let i = declarationsToRemove.length - 1; i >= 0; i--) {
        declarationsToRemove[i].remove();
    }

    // Deduplicate collected imports
    const uniqueImports = [...new Set(collectedNamedImports)];

    // Add consolidated import using the shared utility
    addImportsToFile(sourceFile, {
        moduleSpecifier: '@vendure/dashboard',
        namedImports: uniqueImports,
    });

    return changeCount;
}
