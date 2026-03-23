import { SourceFile } from 'ts-morph';

/**
 * Transforms old React Hook Form + shadcn FormField pattern to FormFieldWrapper.
 *
 * BEFORE:
 * ```
 * <FormField
 *     control={form.control}
 *     name="slug"
 *     render={({ field }) => (
 *         <FormItem>
 *             <FormLabel>Slug</FormLabel>
 *             <FormControl>
 *                 <Input {...field} />
 *             </FormControl>
 *             <FormDescription>The URL slug.</FormDescription>
 *             <FormMessage />
 *         </FormItem>
 *     )}
 * />
 * ```
 *
 * AFTER:
 * ```
 * <FormFieldWrapper
 *     control={form.control}
 *     name="slug"
 *     label="Slug"
 *     description="The URL slug."
 *     render={({ field }) => (
 *         <Input {...field} />
 *     )}
 * />
 * ```
 *
 * For cases that can't be auto-converted, a TODO comment is added.
 */
export function transformFormComponents(sourceFile: SourceFile): number {
    let changeCount = 0;
    let text = sourceFile.getFullText();

    // Check if there are any FormField usages
    if (!text.includes('<FormField')) {
        return 0;
    }

    // Match FormField self-closing elements with render prop containing FormItem/FormLabel/FormControl
    // This is a text-based transform due to JSX complexity
    let changed = true;
    while (changed) {
        changed = false;

        // Match the FormField pattern with render prop
        const formFieldRegex =
            /<FormField\s+([\s\S]*?)render=\{\(\{[\s\t ]*field[\s\t ]*\}\)[\s\t ]*=>[\s\t ]*\(([\s\S]*?)\)\s*\}\s*\/>/;

        const match = formFieldRegex.exec(text);
        if (!match) {
            break;
        }

        const [fullMatch, propsStr, renderBody] = match;

        // Extract label from <FormLabel>...</FormLabel>
        const labelMatch = /<FormLabel>(.*?)<\/FormLabel>/.exec(renderBody);
        const label = labelMatch ? labelMatch[1].trim() : undefined;

        // Extract description from <FormDescription>...</FormDescription>
        const descMatch = /<FormDescription>(.*?)<\/FormDescription>/.exec(renderBody);
        const description = descMatch ? descMatch[1].trim() : undefined;

        // Extract the content inside <FormControl>...</FormControl>
        const formControlMatch = /<FormControl>([\s\S]*?)<\/FormControl>/.exec(renderBody);

        if (!formControlMatch) {
            // Can't auto-convert - add TODO comment and skip
            const todoComment = `{/* TODO: Migrate this FormField to FormFieldWrapper manually */}\n`;
            text =
                text.slice(0, match.index) +
                todoComment +
                fullMatch +
                text.slice(match.index + fullMatch.length);
            changed = true;
            changeCount++;
            continue;
        }

        const innerContent = formControlMatch[1].trim();

        // Check for complex label (JSX inside FormLabel rather than plain text)
        if (labelMatch && /<[^>]+>/.test(labelMatch[1])) {
            // Complex label with JSX - add TODO and skip
            const todoComment = `{/* TODO: Migrate this FormField to FormFieldWrapper manually - complex label */}\n`;
            text =
                text.slice(0, match.index) +
                todoComment +
                fullMatch +
                text.slice(match.index + fullMatch.length);
            changed = true;
            changeCount++;
            continue;
        }

        // Build the replacement FormFieldWrapper
        const existingProps = propsStr.trim();
        let newProps = existingProps;

        if (label) {
            newProps += `\n    label="${label}"`;
        }
        if (description) {
            newProps += `\n    description="${description}"`;
        }

        const replacement = `<FormFieldWrapper\n    ${newProps}\n    render={({ field }) => (\n        ${innerContent}\n    )}\n/>`;

        text = text.slice(0, match.index) + replacement + text.slice(match.index + fullMatch.length);
        changeCount++;
        changed = true;
    }

    if (changeCount > 0) {
        sourceFile.replaceWithText(text);

        // Update imports: remove old form imports, add FormFieldWrapper
        const importDeclarations = sourceFile.getImportDeclarations();
        const newImportsNeeded: string[] = ['FormFieldWrapper'];

        for (const importDecl of importDeclarations) {
            const namedImports = importDecl.getNamedImports();
            const formImportNames = [
                'FormField',
                'FormItem',
                'FormLabel',
                'FormControl',
                'FormDescription',
                'FormMessage',
            ];

            const formImports = namedImports.filter(ni => formImportNames.includes(ni.getName()));
            if (formImports.length > 0) {
                // Remove the form-specific imports
                for (const fi of formImports) {
                    fi.remove();
                }
                // If no named imports left, remove the entire import declaration
                if (
                    importDecl.getNamedImports().length === 0 &&
                    !importDecl.getDefaultImport() &&
                    !importDecl.getNamespaceImport()
                ) {
                    importDecl.remove();
                }
            }
        }

        // Add FormFieldWrapper import
        const existingDashboardImport = sourceFile.getImportDeclaration(
            decl => decl.getModuleSpecifier().getLiteralValue() === '@vendure/dashboard',
        );
        if (existingDashboardImport) {
            const existing = existingDashboardImport.getNamedImports().map(ni => ni.getName());
            if (!existing.includes('FormFieldWrapper')) {
                existingDashboardImport.addNamedImport('FormFieldWrapper');
            }
        } else {
            sourceFile.addImportDeclaration({
                moduleSpecifier: '@vendure/dashboard',
                namedImports: newImportsNeeded,
            });
        }
    }

    return changeCount;
}
