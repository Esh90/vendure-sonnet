import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigService } from '../../config/config.service';

import { FeaturesCollector } from './features.collector';

describe('FeaturesCollector', () => {
    let collector: FeaturesCollector;
    let mockConnection: Record<string, any>;
    let mockConfigService: Record<string, any>;
    let mockRepositories: Record<string, any>;

    beforeEach(() => {
        mockRepositories = {
            Channel: { count: vi.fn().mockResolvedValue(1) },
            Seller: { count: vi.fn().mockResolvedValue(1) },
            StockLocation: { count: vi.fn().mockResolvedValue(1) },
            ApiKey: { count: vi.fn().mockResolvedValue(0) },
        };

        mockConnection = {
            rawConnection: {
                isInitialized: true,
                getRepository: vi.fn().mockImplementation((entity: any) => {
                    return mockRepositories[entity.name] || { count: vi.fn().mockResolvedValue(0) };
                }),
            },
        };

        mockConfigService = {
            orderOptions: {
                orderSellerStrategy: {
                    constructor: { name: 'DefaultOrderSellerStrategy' },
                },
            } as any,
            customFields: {
                Product: [{ name: 'f1' }],
            } as any,
            schedulerOptions: {
                tasks: [{ name: 'clean-sessions' }],
            } as any,
        };

        collector = new FeaturesCollector(mockConnection as any, mockConfigService as ConfigService);
    });

    describe('multiChannel', () => {
        it('returns false when Channel count is 1', async () => {
            const result = await collector.collect();
            expect(result.multiChannel).toBe(false);
        });

        it('returns true when Channel count is > 1', async () => {
            mockRepositories.Channel.count.mockResolvedValue(3);

            const result = await collector.collect();

            expect(result.multiChannel).toBe(true);
        });

        it('returns undefined when DB is not initialized', async () => {
            mockConnection.rawConnection.isInitialized = false;

            const result = await collector.collect();

            expect(result.multiChannel).toBeUndefined();
        });
    });

    describe('multiVendor', () => {
        it('returns false when Seller count is 1 and strategy is DefaultOrderSellerStrategy', async () => {
            const result = await collector.collect();
            expect(result.multiVendor).toBe(false);
        });

        it('returns true when Seller count is > 1', async () => {
            mockRepositories.Seller.count.mockResolvedValue(3);

            const result = await collector.collect();

            expect(result.multiVendor).toBe(true);
        });

        it('returns true when custom OrderSellerStrategy is used', async () => {
            mockConfigService.orderOptions.orderSellerStrategy = {
                constructor: { name: 'MyCustomOrderSellerStrategy' },
            };

            const result = await collector.collect();

            expect(result.multiVendor).toBe(true);
        });

        it('returns undefined on error', async () => {
            mockRepositories.Seller.count.mockRejectedValue(new Error('DB error'));
            // Also break the strategy so the whole method throws
            mockConfigService.orderOptions = null;

            const result = await collector.collect();

            expect(result.multiVendor).toBeUndefined();
        });
    });

    describe('multiStockLocation', () => {
        it('returns false when StockLocation count is 1', async () => {
            const result = await collector.collect();
            expect(result.multiStockLocation).toBe(false);
        });

        it('returns true when StockLocation count is > 1', async () => {
            mockRepositories.StockLocation.count.mockResolvedValue(5);

            const result = await collector.collect();

            expect(result.multiStockLocation).toBe(true);
        });

        it('returns undefined when DB is not initialized', async () => {
            mockConnection.rawConnection.isInitialized = false;

            const result = await collector.collect();

            expect(result.multiStockLocation).toBeUndefined();
        });
    });

    describe('apiKeysEnabled', () => {
        it('returns false when ApiKey count is 0', async () => {
            const result = await collector.collect();
            expect(result.apiKeysEnabled).toBe(false);
        });

        it('returns true when ApiKey count is > 0', async () => {
            mockRepositories.ApiKey.count.mockResolvedValue(2);

            const result = await collector.collect();

            expect(result.apiKeysEnabled).toBe(true);
        });

        it('returns undefined when DB is not initialized', async () => {
            mockConnection.rawConnection.isInitialized = false;

            const result = await collector.collect();

            expect(result.apiKeysEnabled).toBeUndefined();
        });
    });

    describe('customFieldsInUse', () => {
        it('returns true when custom fields exist', async () => {
            const result = await collector.collect();
            expect(result.customFieldsInUse).toBe(true);
        });

        it('returns false when no custom fields are configured', async () => {
            mockConfigService.customFields = {};

            const result = await collector.collect();

            expect(result.customFieldsInUse).toBe(false);
        });

        it('returns undefined on error', async () => {
            mockConfigService.customFields = null;

            const result = await collector.collect();

            expect(result.customFieldsInUse).toBeUndefined();
        });
    });

    describe('scheduledTasks', () => {
        it('returns true when tasks exist', async () => {
            const result = await collector.collect();
            expect(result.scheduledTasks).toBe(true);
        });

        it('returns false when tasks is an empty array', async () => {
            mockConfigService.schedulerOptions.tasks = [];

            const result = await collector.collect();

            expect(result.scheduledTasks).toBe(false);
        });

        it('returns false when tasks is undefined', async () => {
            mockConfigService.schedulerOptions.tasks = undefined;

            const result = await collector.collect();

            expect(result.scheduledTasks).toBe(false);
        });

        it('returns undefined on error', async () => {
            mockConfigService.schedulerOptions = null;

            const result = await collector.collect();

            expect(result.scheduledTasks).toBeUndefined();
        });
    });

    describe('DB not ready', () => {
        it('returns undefined for all DB-dependent fields when rawConnection is not initialized', async () => {
            mockConnection.rawConnection.isInitialized = false;

            const result = await collector.collect();

            expect(result.multiChannel).toBeUndefined();
            expect(result.multiStockLocation).toBeUndefined();
            expect(result.apiKeysEnabled).toBeUndefined();
        });

        it('still returns values for config-only fields when DB is down', async () => {
            mockConnection.rawConnection.isInitialized = false;

            const result = await collector.collect();

            expect(result.customFieldsInUse).toBe(true);
            expect(result.scheduledTasks).toBe(true);
        });
    });

    describe('independence', () => {
        it('one DB query failing does not affect other fields', async () => {
            mockRepositories.Channel.count.mockRejectedValue(new Error('Channel query failed'));

            const result = await collector.collect();

            expect(result.multiChannel).toBeUndefined();
            // Other DB-dependent fields should still resolve
            expect(result.multiStockLocation).toBe(false);
            expect(result.apiKeysEnabled).toBe(false);
            expect(result.multiVendor).toBe(false);
            // Config-only fields unaffected
            expect(result.customFieldsInUse).toBe(true);
            expect(result.scheduledTasks).toBe(true);
        });
    });
});
