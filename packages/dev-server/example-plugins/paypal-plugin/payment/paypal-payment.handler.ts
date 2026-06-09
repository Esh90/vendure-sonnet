import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import { PAYPAL_HANDLER_CODE } from '../constants';
import { getOrdersController, getPaymentsController } from '../paypal-client';

const loggerCtx = 'PayPalPaymentHandler';

/**
 * PaymentMethodHandler for PayPal.
 *
 * UC1 — Standard Checkout (Immediate Capture):
 *   Storefront calls `createPayPalOrder`, buyer approves, then calls
 *   `addPaymentToOrder` with `metadata: { paypalOrderId }`.
 *   `createPayment` captures immediately → state: 'Settled'.
 *
 * UC2 — Authorize-then-Capture:
 *   Storefront calls `createPayPalOrderForAuthorization`, buyer approves, then calls
 *   `addPaymentToOrder` with `metadata: { paypalOrderId, intent: 'AUTHORIZE' }`.
 *   `createPayment` authorizes → state: 'Authorized'.
 *   When merchant is ready (e.g. before shipment), admin calls `settlePayment`
 *   which captures the held funds → state: 'Settled'.
 */
export const paypalPaymentHandler = new PaymentMethodHandler({
    code: PAYPAL_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'PayPal' }],
    args: {},

    createPayment: async (_ctx, _order, amount, _args, metadata) => {
        const paypalOrderId = metadata.paypalOrderId as string | undefined;
        const intent = metadata.intent as string | undefined;

        if (!paypalOrderId) {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'Missing paypalOrderId in payment metadata.',
                metadata: { errorMessage: 'Missing paypalOrderId in payment metadata.' },
            };
        }

        // ── UC2: Authorize ────────────────────────────────────────────────────
        if (intent === 'AUTHORIZE') {
            try {
                const ordersController = getOrdersController();
                const response = await ordersController.authorizeOrder({
                    id: paypalOrderId,
                    prefer: 'return=representation',
                });

                const auth =
                    response.result?.purchaseUnits?.[0]?.payments?.authorizations?.[0];

                if (!auth?.id) {
                    Logger.error(
                        `PayPal authorizeOrder returned no authorization ID. Order ID: ${paypalOrderId}`,
                        loggerCtx,
                    );
                    return {
                        amount,
                        state: 'Declined' as const,
                        errorMessage: 'PayPal authorization returned no authorization ID.',
                        metadata: { paypalOrderId },
                    };
                }

                // CREATED = funds are reserved; DENIED / PENDING are failure paths
                if (auth.status === 'DENIED') {
                    return {
                        amount,
                        state: 'Declined' as const,
                        errorMessage: 'PayPal authorization was denied.',
                        metadata: { paypalOrderId, authorizationId: auth.id, authorizationStatus: auth.status },
                    };
                }

                Logger.info(
                    `PayPal authorization created. Order ID: ${paypalOrderId}, Auth ID: ${auth.id}`,
                    loggerCtx,
                );

                return {
                    amount,
                    state: 'Authorized' as const,
                    transactionId: auth.id,
                    metadata: {
                        paypalOrderId,
                        authorizationId: auth.id,
                        authorizationStatus: auth.status,
                        intent: 'AUTHORIZE',
                    },
                };
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                Logger.error(`PayPal authorizeOrder failed: ${message}`, loggerCtx);
                return {
                    amount,
                    state: 'Error' as const,
                    errorMessage: message,
                    metadata: { paypalOrderId, errorMessage: message },
                };
            }
        }

        // ── UC1: Immediate Capture ────────────────────────────────────────────
        try {
            const ordersController = getOrdersController();
            const response = await ordersController.captureOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });

            const capture = response.result?.purchaseUnits?.[0]?.payments?.captures?.[0];

            if (!capture?.id) {
                Logger.error(
                    `PayPal captureOrder returned no capture ID. Order ID: ${paypalOrderId}`,
                    loggerCtx,
                );
                return {
                    amount,
                    state: 'Declined' as const,
                    errorMessage: 'PayPal capture returned no capture ID.',
                    metadata: { paypalOrderId },
                };
            }

            if (capture.status !== 'COMPLETED') {
                Logger.warn(
                    `PayPal capture status is "${capture.status}" (expected COMPLETED). ` +
                        `Order ID: ${paypalOrderId}, Capture ID: ${capture.id}`,
                    loggerCtx,
                );
                return {
                    amount,
                    state: 'Declined' as const,
                    errorMessage: `PayPal capture status: ${capture.status}`,
                    metadata: { paypalOrderId, captureId: capture.id, captureStatus: capture.status },
                };
            }

            Logger.info(
                `PayPal payment captured. Order ID: ${paypalOrderId}, Capture ID: ${capture.id}`,
                loggerCtx,
            );

            return {
                amount,
                state: 'Settled' as const,
                transactionId: capture.id,
                metadata: {
                    paypalOrderId,
                    captureId: capture.id,
                    captureStatus: capture.status,
                },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(`PayPal captureOrder failed: ${message}`, loggerCtx);
            return {
                amount,
                state: 'Error' as const,
                errorMessage: message,
                metadata: { paypalOrderId, errorMessage: message },
            };
        }
    },

    /**
     * UC3 — Payment Cancellation / Void.
     * Voids a PayPal authorization, releasing the reserved funds back to the buyer.
     * Only applicable to payments in the 'Authorized' state (UC2 flow).
     * Vendure's state machine prevents this from being called on 'Settled' payments.
     */
    cancelPayment: async (_ctx, _order, payment) => {
        const authorizationId = payment.metadata.authorizationId as string | undefined;

        if (!authorizationId) {
            return {
                success: false as const,
                errorMessage:
                    'Cannot void payment: no PayPal authorizationId found in metadata. ' +
                    'Only authorized (not yet captured) payments can be voided.',
            };
        }

        try {
            const paymentsController = getPaymentsController();
            await paymentsController.voidPayment({ authorizationId });

            Logger.info(
                `PayPal authorization voided. Auth ID: ${authorizationId}`,
                loggerCtx,
            );

            return {
                success: true as const,
                metadata: {
                    ...payment.metadata,
                    voidedAt: new Date().toISOString(),
                    authorizationStatus: 'VOIDED',
                },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `PayPal voidPayment failed: ${message}. Auth ID: ${authorizationId}`,
                loggerCtx,
            );
            return {
                success: false as const,
                errorMessage: message,
                metadata: { ...payment.metadata, errorMessage: message },
            };
        }
    },

    /**
     * UC1: payment is already Settled from createPayment — nothing to do.
     * UC2: payment is in Authorized state; capture the held funds now.
     */
    settlePayment: async (_ctx, _order, payment) => {
        const authorizationId = payment.metadata.authorizationId as string | undefined;

        // UC1 path — already captured during createPayment
        if (!authorizationId) {
            return { success: true as const };
        }

        // UC2 path — capture the authorization
        try {
            const paymentsController = getPaymentsController();
            const response = await paymentsController.captureAuthorizedPayment({
                authorizationId,
                prefer: 'return=representation',
            });

            const capture = response.result;

            if (capture?.status !== 'COMPLETED') {
                const msg = `PayPal capture status: ${capture?.status ?? 'unknown'}`;
                Logger.warn(
                    `${msg}. Authorization ID: ${authorizationId}`,
                    loggerCtx,
                );
                return {
                    success: false as const,
                    errorMessage: msg,
                    metadata: {
                        ...payment.metadata,
                        captureId: capture?.id,
                        captureStatus: capture?.status,
                    },
                };
            }

            Logger.info(
                `PayPal authorized payment captured. Auth ID: ${authorizationId}, Capture ID: ${capture.id}`,
                loggerCtx,
            );

            return {
                success: true as const,
                metadata: {
                    ...payment.metadata,
                    captureId: capture.id,
                    captureStatus: capture.status,
                },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `PayPal captureAuthorizedPayment failed: ${message}. Auth ID: ${authorizationId}`,
                loggerCtx,
            );
            return {
                success: false as const,
                errorMessage: message,
                metadata: { ...payment.metadata, errorMessage: message },
            };
        }
    },
});
