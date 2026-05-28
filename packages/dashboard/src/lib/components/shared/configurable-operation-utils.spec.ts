import { describe, expect, it } from 'vitest';

import { ConfigurableOperationDefFragment } from '@/vdb/graphql/fragments.js';
import { getInitialConfigArgValue } from './configurable-operation-utils.js';

type ConfigArgDef = ConfigurableOperationDefFragment['args'][number];

const argDef = (overrides: Partial<ConfigArgDef>): ConfigArgDef =>
    ({
        name: 'test',
        type: 'string',
        required: true,
        defaultValue: null,
        list: false,
        ui: null,
        label: 'Test',
        description: null,
        ...overrides,
    }) as ConfigArgDef;

describe('getInitialConfigArgValue', () => {
    it('should initialize list args as JSON arrays', () => {
        expect(getInitialConfigArgValue(argDef({ list: true }))).toBe('[]');
        expect(getInitialConfigArgValue(argDef({ list: true, defaultValue: true }))).toBe('[true]');
    });

    it('should initialize boolean scalar args without defaults as false', () => {
        expect(getInitialConfigArgValue(argDef({ type: 'boolean' }))).toBe('false');
    });

    it('should preserve scalar defaults and empty scalar fallback', () => {
        expect(getInitialConfigArgValue(argDef({ defaultValue: 1 }))).toBe('1');
        expect(getInitialConfigArgValue(argDef({ type: 'string' }))).toBe('');
    });
});
