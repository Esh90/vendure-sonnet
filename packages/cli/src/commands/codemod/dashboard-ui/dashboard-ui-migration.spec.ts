import { log } from '@clack/prompts';
import { Project, QuoteKind, ScriptKind } from 'ts-morph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transformAccordionProps } from './transforms/accordion-props';
import { transformAsChildToRender } from './transforms/as-child-to-render';
import { transformFormComponents } from './transforms/form-components';
import { transformImportConsolidation } from './transforms/import-consolidation';
import { warnSelectItemsProp } from './transforms/select-items-prop';

vi.mock('@clack/prompts', () => ({
    log: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        step: vi.fn(),
        message: vi.fn(),
    },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    intro: vi.fn(),
    outro: vi.fn(),
}));

// Share a single Project instance across all tests to avoid repeated TypeScript compiler init
const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 2 /* JsxEmit.React */ },
    manipulationSettings: {
        quoteKind: QuoteKind.Single,
        useTrailingCommas: true,
    },
});

let fileCounter = 0;
function createSourceFile(code: string) {
    fileCounter++;
    return project.createSourceFile(`test-${fileCounter}.tsx`, code, { scriptKind: ScriptKind.TSX });
}

// ─── asChild → render ────────────────────────────────────────────────

describe('transformAsChildToRender', () => {
    it('should transform Button with asChild wrapping Link', () => {
        const sf = createSourceFile(`
const el = (
    <Button asChild>
        <Link to="./new">
            <PlusIcon />
            New
        </Link>
    </Button>
);
`);
        const changes = transformAsChildToRender(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('render={<Link to="./new" />}');
        expect(text).not.toContain('asChild');
        expect(text).toContain('<PlusIcon />');
        expect(text).toContain('New');
    });

    it('should transform asChild with self-closing child', () => {
        const sf = createSourceFile(`
const el = (
    <Button asChild>
        <Link to="/home" />
    </Button>
);
`);
        const changes = transformAsChildToRender(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('render={<Link to="/home" />}');
        expect(text).not.toContain('asChild');
    });

    it('should preserve other props on the parent element', () => {
        const sf = createSourceFile(`
const el = (
    <Button variant="outline" asChild className="my-btn">
        <Link to="./edit">
            Edit
        </Link>
    </Button>
);
`);
        const changes = transformAsChildToRender(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('variant="outline"');
        expect(text).toContain('className="my-btn"');
        expect(text).toContain('render={<Link to="./edit" />}');
        expect(text).not.toContain('asChild');
    });

    it('should handle multiple asChild transforms in the same file', () => {
        const sf = createSourceFile(`
function App() {
    return (
        <div>
            <Button asChild>
                <Link to="/a">
                    Go A
                </Link>
            </Button>
            <Button asChild>
                <Link to="/b">
                    Go B
                </Link>
            </Button>
        </div>
    );
}
`);
        const changes = transformAsChildToRender(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        expect(text).not.toContain('asChild');
        expect(text).toContain('render={<Link to="/a" />}');
        expect(text).toContain('render={<Link to="/b" />}');
    });

    it('should return 0 when no asChild patterns found', () => {
        const sf = createSourceFile(`
const el = (
    <Button onClick={handleClick}>
        Click me
    </Button>
);
`);
        const changes = transformAsChildToRender(sf);
        expect(changes).toBe(0);
    });

    it('should skip unconvertible asChild and still process valid ones after it', () => {
        const sf = createSourceFile(`
function App() {
    return (
        <div>
            <Button asChild>
                {condition && <Link to="/maybe" />}
            </Button>
            <Button asChild>
                <Link to="/valid">
                    Valid
                </Link>
            </Button>
        </div>
    );
}
`);
        const changes = transformAsChildToRender(sf);
        // First one is skipped (JSX expression child), second one converts
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('render={<Link to="/valid" />}');
    });
});

// ─── FormField → FormFieldWrapper ────────────────────────────────────

describe('transformFormComponents', () => {
    it('should transform a basic FormField to FormFieldWrapper', () => {
        const sf = createSourceFile(`
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@vendure/dashboard';

const el = (
    <FormField
        control={form.control}
        name="slug"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormDescription>The URL slug.</FormDescription>
                <FormMessage />
            </FormItem>
        )}
    />
);
`);
        const changes = transformFormComponents(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('FormFieldWrapper');
        expect(text).toContain('label="Slug"');
        expect(text).toContain('description="The URL slug."');
        expect(text).toContain('<Input {...field} />');
        expect(text).not.toContain('<FormItem>');
        expect(text).not.toContain('<FormControl>');
    });

    it('should handle FormField without FormDescription', () => {
        const sf = createSourceFile(`
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@vendure/dashboard';

const el = (
    <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);
`);
        const changes = transformFormComponents(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('FormFieldWrapper');
        expect(text).toContain('label="Title"');
        expect(text).not.toContain('description=');
    });

    it('should return 0 when no FormField patterns found', () => {
        const sf = createSourceFile(`
const el = <Input value="hello" onChange={handleChange} />;
`);
        const changes = transformFormComponents(sf);
        expect(changes).toBe(0);
    });

    it('should add TODO comment when FormControl is missing', () => {
        const sf = createSourceFile(`
import { FormField, FormItem, FormLabel } from '@vendure/dashboard';

const el = (
    <FormField
        control={form.control}
        name="custom"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Custom</FormLabel>
                <div><Input {...field} /></div>
            </FormItem>
        )}
    />
);
`);
        const changes = transformFormComponents(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('TODO');
        expect(text).toContain('no FormControl found');
    });

    it('should not infinite loop when multiple FormFields cannot be converted', () => {
        const sf = createSourceFile(`
import { FormField, FormItem, FormLabel } from '@vendure/dashboard';

const el = (
    <div>
        <FormField
            control={form.control}
            name="a"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>A</FormLabel>
                    <div><Input {...field} /></div>
                </FormItem>
            )}
        />
        <FormField
            control={form.control}
            name="b"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>B</FormLabel>
                    <div><Input {...field} /></div>
                </FormItem>
            )}
        />
    </div>
);
`);
        // Should complete without hanging — both get TODO comments
        const changes = transformFormComponents(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        const todoCount = (text.match(/TODO/g) || []).length;
        expect(todoCount).toBe(2);
    });

    it('should remove old form imports when they become unused', () => {
        const sf = createSourceFile(`
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@vendure/dashboard';
import { Input } from './input';

const el = (
    <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
            <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                    <Input {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);
`);
        const changes = transformFormComponents(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain("from './input'");
        expect(text).toContain('FormFieldWrapper');
    });
});

// ─── Import consolidation ────────────────────────────────────────────

describe('transformImportConsolidation', () => {
    it('should consolidate @radix-ui namespace imports', () => {
        const sf = createSourceFile(`
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';

function App() {
    return <Dialog.Root />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        expect(text).not.toContain('@radix-ui');
        expect(text).toContain('@vendure/dashboard');
    });

    it('should rewrite namespace member access sites', () => {
        const sf = createSourceFile(`
import * as Dialog from '@radix-ui/react-dialog';

function App() {
    return (
        <Dialog.Root>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Content>
                <Dialog.Title>Title</Dialog.Title>
            </Dialog.Content>
        </Dialog.Root>
    );
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('Dialog.Root');
        expect(text).not.toContain('Dialog.Trigger');
        expect(text).not.toContain('Dialog.Content');
        expect(text).not.toContain('Dialog.Title');
        expect(text).toContain('<Dialog>');
        expect(text).toContain('<DialogTrigger>');
        expect(text).toContain('<DialogContent>');
        expect(text).toContain('<DialogTitle>');
    });

    it('should consolidate @vendure-io/ui named imports', () => {
        const sf = createSourceFile(`
import { Button } from '@vendure-io/ui/components/ui/button';
import { Input } from '@vendure-io/ui/components/ui/input';

function App() {
    return <Button />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        expect(text).not.toContain('@vendure-io/ui');
        expect(text).toContain('@vendure/dashboard');
        expect(text).toContain('Button');
        expect(text).toContain('Input');
    });

    it('should consolidate @base-ui/react imports', () => {
        const sf = createSourceFile(`
import { Collapsible } from '@base-ui/react/collapsible';

function App() {
    return <Collapsible />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('@base-ui/react');
        expect(text).toContain('@vendure/dashboard');
        expect(text).toContain('Collapsible');
    });

    it('should merge into existing @vendure/dashboard import', () => {
        const sf = createSourceFile(`
import { usePageContext } from '@vendure/dashboard';
import { Button } from '@vendure-io/ui/components/ui/button';

function App() {
    return <Button />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('@vendure-io/ui');
        const dashboardImports = text.match(/@vendure\/dashboard/g);
        expect(dashboardImports?.length).toBe(1);
        expect(text).toContain('usePageContext');
        expect(text).toContain('Button');
    });

    it('should handle aliased imports', () => {
        const sf = createSourceFile(`
import { Button as RadixButton } from '@radix-ui/react-button';

function App() {
    return <RadixButton />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).toContain('@vendure/dashboard');
    });

    it('should return 0 when no matching imports found', () => {
        const sf = createSourceFile(`
import { useState } from 'react';

function App() {
    return <div />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(0);
    });

    it('should deduplicate imports when the same name appears in multiple sources', () => {
        const sf = createSourceFile(`
import { Button } from '@radix-ui/react-button';
import { Button } from '@vendure-io/ui/components/ui/button';

function App() {
    return <Button />;
}
`);
        const changes = transformImportConsolidation(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        const buttonImportMatches = text.match(/\bButton\b/g);
        // One in import, one in JSX
        expect(buttonImportMatches).toBeTruthy();
        expect(text).toContain('@vendure/dashboard');
    });
});

// ─── Accordion props ─────────────────────────────────────────────────

describe('transformAccordionProps', () => {
    it('should remove type="single" from Accordion', () => {
        const sf = createSourceFile(`
const el = (
    <Accordion type="single" className="w-full">
        <AccordionItem value="item-1" />
    </Accordion>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('type="single"');
        expect(text).toContain('className="w-full"');
    });

    it('should remove type="multiple" from Accordion', () => {
        const sf = createSourceFile(`
const el = (
    <Accordion type="multiple">
        <AccordionItem value="item-1" />
    </Accordion>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('type="multiple"');
    });

    it('should remove collapsible attribute from Accordion', () => {
        const sf = createSourceFile(`
const el = (
    <Accordion collapsible>
        <AccordionItem value="item-1" />
    </Accordion>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(1);
        const text = sf.getFullText();
        expect(text).not.toContain('collapsible');
    });

    it('should remove both type and collapsible in one pass', () => {
        const sf = createSourceFile(`
const el = (
    <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1" />
    </Accordion>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        expect(text).not.toContain('type="single"');
        expect(text).not.toContain('collapsible');
        expect(text).toContain('className="w-full"');
    });

    it('should not touch non-Accordion elements', () => {
        const sf = createSourceFile(`
const el = (
    <Select type="single">
        <option>One</option>
    </Select>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(0);
    });

    it('should return 0 when no Accordion elements found', () => {
        const sf = createSourceFile(`
const el = (
    <div className="container">
        <p>Hello</p>
    </div>
);
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(0);
    });

    it('should handle self-closing Accordion', () => {
        const sf = createSourceFile(`
const el = <Accordion type="single" collapsible />;
`);
        const changes = transformAccordionProps(sf);
        expect(changes).toBe(2);
        const text = sf.getFullText();
        expect(text).not.toContain('type="single"');
        expect(text).not.toContain('collapsible');
    });
});

// ─── Select items prop warning ───────────────────────────────────────

describe('warnSelectItemsProp', () => {
    beforeEach(() => {
        vi.mocked(log.warn).mockClear();
    });

    it('should warn when Select is missing items prop', () => {
        const sf = createSourceFile(`
const el = (
    <Select value={value} onChange={handleChange}>
        <option>One</option>
    </Select>
);
`);
        warnSelectItemsProp(sf);
        expect(log.warn).toHaveBeenCalledTimes(1);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('missing the required "items" prop'));
    });

    it('should not warn when Select has items prop', () => {
        const sf = createSourceFile(`
const el = (
    <Select items={options} value={value} onChange={handleChange}>
        <option>One</option>
    </Select>
);
`);
        warnSelectItemsProp(sf);
        expect(log.warn).not.toHaveBeenCalled();
    });

    it('should warn for each Select missing items', () => {
        const sf = createSourceFile(`
const el = (
    <div>
        <Select value={a}>
            <option>A</option>
        </Select>
        <Select value={b}>
            <option>B</option>
        </Select>
    </div>
);
`);
        warnSelectItemsProp(sf);
        expect(log.warn).toHaveBeenCalledTimes(2);
    });

    it('should not warn for non-Select elements', () => {
        const sf = createSourceFile(`
const el = <Input value="hello" />;
`);
        warnSelectItemsProp(sf);
        expect(log.warn).not.toHaveBeenCalled();
    });
});
