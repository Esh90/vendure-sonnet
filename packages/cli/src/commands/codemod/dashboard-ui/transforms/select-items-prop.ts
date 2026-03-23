import { log } from '@clack/prompts';
import { SourceFile, SyntaxKind } from 'ts-morph';

/**
 * Warns about `<Select` elements that are missing the `items` prop,
 * which is required by the new Base UI Select component.
 *
 * This transform does NOT auto-fix because the `items` prop requires
 * knowledge of the data shape that can't be inferred from the template alone.
 */
export function warnSelectItemsProp(sourceFile: SourceFile): void {
    const jsxElements = [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ];

    const selectElements = jsxElements.filter(el => {
        const tagName = el.getTagNameNode().getText();
        return tagName === 'Select';
    });

    for (const element of selectElements) {
        const attributes = element.getAttributes();
        const hasItemsProp = attributes.some(attr => {
            if (attr.getKind() !== SyntaxKind.JsxAttribute) {
                return false;
            }
            const jsxAttr = attr.asKind(SyntaxKind.JsxAttribute);
            return jsxAttr?.getNameNode().getText() === 'items';
        });

        if (!hasItemsProp) {
            const filePath = sourceFile.getFilePath();
            const line = element.getStartLineNumber();
            log.warn(
                `${filePath}:${line} — <Select> is missing the required "items" prop. ` +
                    `Please add it manually based on your data shape.`,
            );
        }
    }
}
