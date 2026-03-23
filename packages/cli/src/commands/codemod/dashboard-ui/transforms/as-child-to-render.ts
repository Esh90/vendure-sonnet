import { JsxAttribute, JsxElement, JsxSelfClosingElement, SourceFile, SyntaxKind } from 'ts-morph';

/**
 * Transforms `asChild` prop pattern to `render` prop pattern.
 *
 * BEFORE:
 * ```
 * <Button asChild>
 *     <Link to="./new">
 *         <PlusIcon />
 *         New
 *     </Link>
 * </Button>
 * ```
 *
 * AFTER:
 * ```
 * <Button render={<Link to="./new" />}>
 *     <PlusIcon />
 *     New
 * </Button>
 * ```
 */
export function transformAsChildToRender(sourceFile: SourceFile): number {
    let changeCount = 0;

    // Process iteratively since each replacement invalidates positions
    let foundOne = true;
    while (foundOne) {
        foundOne = false;

        // Find the first asChild attribute in the file
        const asChildAttr = sourceFile
            .getDescendantsOfKind(SyntaxKind.JsxAttribute)
            .find(attr => attr.getNameNode().getText() === 'asChild');

        if (!asChildAttr) {
            break;
        }

        // JsxAttribute → JsxAttributes → JsxOpeningElement
        const jsxAttributes = asChildAttr.getParent();
        const openingElement = jsxAttributes?.getParentIfKind(SyntaxKind.JsxOpeningElement);
        if (!openingElement) {
            break;
        }

        const parentJsxElement = openingElement.getParentIfKind(SyntaxKind.JsxElement);
        if (!parentJsxElement) {
            break;
        }

        // Get the JSX children (skip whitespace text nodes)
        const jsxChildren = parentJsxElement.getJsxChildren().filter(c => {
            if (c.getKind() === SyntaxKind.JsxText) {
                return c.getText().trim().length > 0;
            }
            return true;
        });

        if (jsxChildren.length !== 1) {
            break;
        }

        const childNode = jsxChildren[0];
        const childIsElement = childNode.getKind() === SyntaxKind.JsxElement;
        const childIsSelfClosing = childNode.getKind() === SyntaxKind.JsxSelfClosingElement;

        if (!childIsElement && !childIsSelfClosing) {
            break;
        }

        // Extract child tag name and props
        let childTagName: string;
        let childPropsText: string;
        let grandchildrenText: string;

        if (childIsElement) {
            const childEl = childNode as JsxElement;
            const childOpening = childEl.getOpeningElement();
            childTagName = childOpening.getTagNameNode().getText();
            const childAttrs = childOpening.getAttributes();
            childPropsText = childAttrs.map(a => a.getText()).join(' ');
            grandchildrenText = childEl
                .getJsxChildren()
                .map(c => c.getText())
                .join('');
        } else {
            const childEl = childNode as JsxSelfClosingElement;
            childTagName = childEl.getTagNameNode().getText();
            const childAttrs = childEl.getAttributes();
            childPropsText = childAttrs.map(a => a.getText()).join(' ');
            grandchildrenText = '';
        }

        // Build render prop value: <ChildTag ...props />
        const renderValue = childPropsText ? `<${childTagName} ${childPropsText} />` : `<${childTagName} />`;

        // Build new parent opening tag (remove asChild, add render prop)
        const parentTagName = openingElement.getTagNameNode().getText();
        const parentAttrs = openingElement
            .getAttributes()
            .filter(a => {
                if (a.getKind() === SyntaxKind.JsxAttribute) {
                    return (a as JsxAttribute).getNameNode().getText() !== 'asChild';
                }
                return true;
            })
            .map(a => a.getText());

        parentAttrs.push(`render={${renderValue}}`);
        const attrsStr = parentAttrs.join(' ');

        // Build replacement
        let replacement: string;
        if (grandchildrenText.trim()) {
            replacement = `<${parentTagName} ${attrsStr}>${grandchildrenText}</${parentTagName}>`;
        } else {
            replacement = `<${parentTagName} ${attrsStr} />`;
        }

        parentJsxElement.replaceWithText(replacement);
        changeCount++;
        foundOne = true;
    }

    return changeCount;
}
