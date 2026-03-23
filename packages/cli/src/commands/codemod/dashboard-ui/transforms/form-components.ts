import { log } from '@clack/prompts';
import { JsxSelfClosingElement, SourceFile, SyntaxKind } from 'ts-morph';

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
 * Uses ts-morph AST for reliable parsing. Falls back to a TODO comment
 * for patterns that can't be auto-converted.
 */
export function transformFormComponents(sourceFile: SourceFile): number {
    let changeCount = 0;
    const text = sourceFile.getFullText();

    if (!text.includes('<FormField')) {
        return 0;
    }

    // Process iteratively — each replacement invalidates AST positions
    let foundOne = true;
    while (foundOne) {
        foundOne = false;

        // Find all self-closing <FormField /> elements
        const formFields = sourceFile
            .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
            .filter(el => el.getTagNameNode().getText() === 'FormField');

        if (formFields.length === 0) {
            break;
        }

        const formField = formFields[0];

        // Extract control and name props
        const controlAttr = getJsxAttributeValue(formField, 'control');
        const nameAttr = getJsxAttributeValue(formField, 'name');

        // Extract the render prop's arrow function body
        const renderAttr = formField.getAttribute('render');
        if (!renderAttr || renderAttr.getKind() !== SyntaxKind.JsxAttribute) {
            // No render prop — can't convert, add TODO and rename to prevent re-match
            addTodoAndRename(formField, 'missing render prop');
            changeCount++;
            foundOne = true;
            continue;
        }

        // Navigate into the render callback to find the JSX body
        const renderInitializer = renderAttr.asKindOrThrow(SyntaxKind.JsxAttribute).getInitializer();
        if (!renderInitializer) {
            addTodoAndRename(formField, 'empty render prop');
            changeCount++;
            foundOne = true;
            continue;
        }

        // The render body should contain a FormItem with FormLabel, FormControl, etc.
        const renderText = renderInitializer.getText();

        // Extract label from <FormLabel>plainText</FormLabel>
        const labelMatch = /<FormLabel>([^<]*)<\/FormLabel>/.exec(renderText);
        const label = labelMatch ? labelMatch[1].trim() : undefined;

        // Check for complex label (JSX inside FormLabel)
        const complexLabelMatch = /<FormLabel>([\s\S]*?)<\/FormLabel>/.exec(renderText);
        const hasComplexLabel = complexLabelMatch && /<[^>]+>/.test(complexLabelMatch[1]) && !labelMatch;

        if (hasComplexLabel) {
            addTodoAndRename(formField, 'complex JSX label');
            changeCount++;
            foundOne = true;
            continue;
        }

        // Extract description from <FormDescription>...</FormDescription>
        const descMatch = /<FormDescription>([^<]*)<\/FormDescription>/.exec(renderText);
        const description = descMatch ? descMatch[1].trim() : undefined;

        // Extract the content inside <FormControl>...</FormControl>
        const formControlMatch = /<FormControl>\s*([\s\S]*?)\s*<\/FormControl>/.exec(renderText);
        if (!formControlMatch) {
            addTodoAndRename(formField, 'no FormControl found');
            changeCount++;
            foundOne = true;
            continue;
        }

        const innerContent = formControlMatch[1].trim();

        // Build the replacement FormFieldWrapper
        let props = '';
        if (controlAttr) {
            props += `\n    control={${controlAttr}}`;
        }
        if (nameAttr) {
            props += `\n    name=${nameAttr}`;
        }
        if (label) {
            props += `\n    label="${label}"`;
        }
        if (description) {
            props += `\n    description="${description}"`;
        }
        props += `\n    render={({ field }) => (\n        ${innerContent}\n    )}`;

        const replacement = `<FormFieldWrapper${props}\n/>`;

        formField.replaceWithText(replacement);
        changeCount++;
        foundOne = true;
    }

    if (changeCount > 0) {
        removeUnusedFormImports(sourceFile);
    }

    return changeCount;
}

/**
 * Gets the raw value text of a JSX attribute (without quotes for string literals,
 * without braces for expressions).
 */
function getJsxAttributeValue(element: JsxSelfClosingElement, attrName: string): string | undefined {
    const attr = element.getAttribute(attrName);
    if (!attr || attr.getKind() !== SyntaxKind.JsxAttribute) {
        return undefined;
    }
    const initializer = attr.asKindOrThrow(SyntaxKind.JsxAttribute).getInitializer();
    if (!initializer) {
        return undefined;
    }
    const text = initializer.getText();
    // Strip surrounding braces from {expression}
    if (text.startsWith('{') && text.endsWith('}')) {
        return text.slice(1, -1);
    }
    return text;
}

/**
 * Adds a TODO comment and renames FormField → FormField_TODO to prevent
 * infinite re-matching in the while loop.
 */
function addTodoAndRename(formField: JsxSelfClosingElement, reason: string) {
    const filePath = formField.getSourceFile().getFilePath();
    const line = formField.getStartLineNumber();
    log.warn(`${filePath}:${line} — Cannot auto-convert FormField (${reason}). Added TODO comment.`);
    const original = formField.getText();
    formField.replaceWithText(
        `{/* TODO: Migrate this FormField to FormFieldWrapper manually — ${reason} */}\n${original}`,
    );
}

/**
 * Removes old form-specific imports (FormField, FormItem, FormControl, etc.)
 * and adds FormFieldWrapper. Import consolidation runs after this transform,
 * so we only handle the form-specific cleanup here.
 */
function removeUnusedFormImports(sourceFile: SourceFile) {
    const formImportNames = [
        'FormField',
        'FormItem',
        'FormLabel',
        'FormControl',
        'FormDescription',
        'FormMessage',
    ];

    const fullText = sourceFile.getFullText();

    for (const importDecl of sourceFile.getImportDeclarations()) {
        const namedImports = importDecl.getNamedImports();
        for (const namedImport of [...namedImports]) {
            const name = namedImport.getName();
            if (!formImportNames.includes(name)) {
                continue;
            }
            // Only remove if the name is no longer used in the file (outside of imports)
            // Simple heuristic: count occurrences. If it only appears in the import, remove it.
            const regex = new RegExp(`\\b${name}\\b`, 'g');
            const matches = fullText.match(regex);
            // 1 match = just the import itself
            if (matches && matches.length <= 1) {
                namedImport.remove();
            }
        }

        // Clean up empty import declarations
        if (
            importDecl.getNamedImports().length === 0 &&
            !importDecl.getDefaultImport() &&
            !importDecl.getNamespaceImport()
        ) {
            importDecl.remove();
        }
    }

    // Add FormFieldWrapper import if not already present
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
            namedImports: ['FormFieldWrapper'],
        });
    }
}
