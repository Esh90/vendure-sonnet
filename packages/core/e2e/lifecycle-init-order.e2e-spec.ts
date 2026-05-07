import { Injectable, OnModuleInit } from '@nestjs/common';
import { AutoIncrementIdStrategy, Injector, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

let strategyInitedAt: number | null = null;
let consumerOnModuleInitAt: number | null = null;
let consumerSawStrategyInitialized = false;

class OrderingTestStrategy extends AutoIncrementIdStrategy {
    async init(_: Injector) {
        // Small delay so that, were ConfigModule to initialize strategies after
        // other modules' onModuleInit, the consumer below would observe a still-
        // null strategyInitedAt. With the correct ordering the delay does not
        // matter — strategy init must complete before any onModuleInit fires.
        await new Promise(resolve => setTimeout(resolve, 50));
        strategyInitedAt = Date.now();
    }
}

@Injectable()
class StrategyConsumerService implements OnModuleInit {
    onModuleInit() {
        consumerOnModuleInitAt = Date.now();
        consumerSawStrategyInitialized = strategyInitedAt !== null;
    }
}

@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [StrategyConsumerService],
})
class StrategyConsumerPlugin {
    // The constructor injection is required so that Nest instantiates the
    // service (and thus runs its onModuleInit). Without a reference, an
    // unused provider in an otherwise-empty plugin module is not exercised.
    constructor(_consumer: StrategyConsumerService) {
        // intentionally empty
    }
}

/**
 * Regression test for the contract that an InjectableStrategy's `init()` is
 * always invoked before any other module's `onModuleInit` runs, so that
 * strategies can be safely consumed via the `Injector` during module
 * initialization. This is implemented by having `ConfigModule` perform its
 * strategy initialization in `onModuleInit` rather than `onApplicationBootstrap`.
 *
 * NOTE: this test lives in its own file because the AppModule statically reads
 * `getConfig().plugins` once via `PluginModule.forRoot()`, so plugins added by
 * later test envs in the same file are not picked up.
 */
describe('strategy init order', () => {
    const { server } = createTestEnvironment({
        ...testConfig(),
        entityOptions: { entityIdStrategy: new OrderingTestStrategy() },
        plugins: [StrategyConsumerPlugin],
    });

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-empty.csv'),
            customerCount: 1,
        });
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('strategy init() completes before plugin service onModuleInit', () => {
        expect(strategyInitedAt).not.toBeNull();
        expect(consumerOnModuleInitAt).not.toBeNull();
        expect(consumerSawStrategyInitialized).toBe(true);
        expect(strategyInitedAt ?? Infinity).toBeLessThanOrEqual(consumerOnModuleInitAt ?? -Infinity);
    });
});
