/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { HistoryEntryType } from '@vendure/common/lib/generated-types';
import {
    CustomOrderProcess,
    defaultOrderProcess,
    HistoryService,
    mergeConfig,
    Order,
    OrderService,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import { createErrorResultGuard, createTestEnvironment, ErrorResultGuard } from '@vendure/testing';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

import { testSuccessfulPaymentMethod } from './fixtures/test-payment-methods';
import { FragmentOf as FragmentOfShop } from './graphql/graphql-shop';
import {
    addItemToOrderDocument,
    setCustomerDocument,
    setShippingAddressDocument,
    setShippingMethodDocument,
    testOrderFragment,
} from './graphql/shop-definitions';

// #4686 — onTransitionEnd that throws must not corrupt the order
//
// On master without the fix, the sequence inside OrderService.transitionToState is:
//   1. save(order) — commits new order.state to DB
//   2. publish OrderStateTransitionEvent
//   3. finalize() — runs onTransitionEnd hooks (stock allocation, history entry,
//      OrderPlacedStrategy flipping order.active / orderPlacedAt, etc.)
//   4. save(order) — persists in-memory mutations from finalize()
//
// If any onTransitionEnd hook throws, step 4 never runs. When the caller has no
// outer @Transaction() (worker job, scheduled task, plugin code without the
// decorator, event-bus subscriber), step 1 has already committed and the order
// is left in a corrupted half-committed state: state=<new>, active=true,
// orderPlacedAt=null, no ORDER_STATE_TRANSITION history entry.
//
// This test simulates the non-transactional caller by invoking OrderService
// directly through server.app.get(...). After the fix (withTransaction wrap
// inside transitionToState), the order must roll back atomically.

const ROLLBACK_FAILURE_TARGET = 'ArrangingPayment';
const FAILURE_MESSAGE = 'simulated onTransitionEnd failure';

const failingOrderProcess: CustomOrderProcess<never> = {
    transitions: {},
    onTransitionEnd(fromState, toState) {
        if (toState === ROLLBACK_FAILURE_TARGET) {
            throw new Error(FAILURE_MESSAGE);
        }
    },
};

type TestOrderFragmentType = FragmentOfShop<typeof testOrderFragment>;
const testOrderGuard: ErrorResultGuard<TestOrderFragmentType> = createErrorResultGuard(
    input => !!input.lines,
);

describe('Order process — onTransitionEnd rollback (#4686)', () => {
    const { server, shopClient, adminClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            orderOptions: { process: [defaultOrderProcess, failingOrderProcess] as any },
            paymentOptions: {
                paymentMethodHandlers: [testSuccessfulPaymentMethod],
            },
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData: {
                ...initialData,
                paymentMethods: [
                    {
                        name: testSuccessfulPaymentMethod.code,
                        handler: { code: testSuccessfulPaymentMethod.code, arguments: [] },
                    },
                ],
            },
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-full.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('rolls back atomically when called from a non-transactional context', async () => {
        // Build an order ready to transition into ArrangingPayment.
        await shopClient.asAnonymousUser();
        const { addItemToOrder } = await shopClient.query(addItemToOrderDocument, {
            productVariantId: 'T_1',
            quantity: 1,
        });
        testOrderGuard.assertSuccess(addItemToOrder);
        await shopClient.query(setCustomerDocument, {
            input: {
                firstName: 'Rollback',
                lastName: 'Test',
                emailAddress: 'rollback@example.com',
            },
        });
        await shopClient.query(setShippingAddressDocument, {
            input: {
                fullName: 'Rollback Test',
                streetLine1: '12 the street',
                city: 'foo',
                postalCode: '123456',
                countryCode: 'US',
                phoneNumber: '4444444',
            },
        });
        await shopClient.query(setShippingMethodDocument, { id: ['T_1'] });

        // GraphQL IDs are prefixed (e.g. "T_1") via the configured EntityIdStrategy;
        // strip the prefix to get the raw DB id used by services and TypeORM.
        const orderId = +String(addItemToOrder.id).replace(/^\D+/g, '');
        const orderService = server.app.get(OrderService);
        const historyService = server.app.get(HistoryService);
        const ctxBuilder = server.app.get(RequestContextService);
        const connection = server.app.get(TransactionalConnection);

        // A fresh, non-transactional ctx — equivalent to a worker job or plugin
        // mutation that omits @Transaction().
        const ctx = await ctxBuilder.create({ apiType: 'admin' });

        const orderBefore = await connection.rawConnection
            .getRepository(Order)
            .findOneOrFail({ where: { id: orderId } });
        expect(orderBefore.state).toBe('AddingItems');
        expect(orderBefore.active).toBe(true);
        expect(orderBefore.orderPlacedAt).toBeNull();

        let thrown: Error | undefined;
        try {
            await orderService.transitionToState(ctx, orderId, ROLLBACK_FAILURE_TARGET);
        } catch (e) {
            thrown = e as Error;
        }
        expect(thrown).toBeDefined();
        expect(thrown!.message).toContain(FAILURE_MESSAGE);

        // Re-read from the database. Assert literal values so the assertions
        // can't go vacuously true if the pre-condition silently breaks.
        const orderAfter = await connection.rawConnection
            .getRepository(Order)
            .findOneOrFail({ where: { id: orderId } });

        expect(orderAfter.state).toBe('AddingItems');
        expect(orderAfter.active).toBe(true);
        expect(orderAfter.orderPlacedAt).toBeNull();

        // No ORDER_STATE_TRANSITION history entry should exist for the failed step.
        const history = await historyService.getHistoryForOrder(ctx, orderId, false);
        const failedTransitionEntry = history.items.find(
            entry =>
                entry.type === HistoryEntryType.ORDER_STATE_TRANSITION &&
                (entry.data )?.to === ROLLBACK_FAILURE_TARGET,
        );
        expect(failedTransitionEntry).toBeUndefined();
    });
});
