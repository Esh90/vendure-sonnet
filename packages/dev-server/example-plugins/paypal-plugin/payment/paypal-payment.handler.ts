import { LanguageCode, Logger, PaymentMethodHandler } from '@vendure/core';
import { PAYPAL_HANDLER_CODE } from '../constants';
import { getOrdersController } from '../paypal-client';

const loggerCtx = 'PayPalPaymentHandler';

/**
 * PaymentMethodHandler for PayPal.
 *
 * UC1 — Standard Checkout (Immediate Capture):
 *   The storefront first calls the `createPayPalOrder` Shop API mutation to create a PayPal
 *   order and obtain the buyer-approval URL. After the buyer approves on PayPal, the storefront
 *   calls `addPaymentToOrder` with `metadata: { paypalOrderId: '<approved-order-id>' }`.
 *   `createPayment` immediately captures the approved order, transitioning Vendure payment to
 *   'Settled'.  `settlePayment` is a no-op because the capture already occurred.
 */
export const paypalPaymentHandler = new PaymentMethodHandler({
    code: PAYPAL_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'PayPal' }],
    args: {},

    createPayment: async (_ctx, _order, amount, _args, metadata) => {
        const paypalOrderId = metadata.paypalOrderId as string | undefined;

        if (!paypalOrderId) {
            return {
                amount,
                state: 'Declined' as const,
                errorMessage: 'Missing paypalOrderId in payment metadata.',
                metadata: { errorMessage: 'Missing paypalOrderId in payment metadata.' },
            };
        }

        try {
            const ordersController = getOrdersController();
            const response = await ordersController.captureOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });

            const capturedOrder = response.result;
            const capture = capturedOrder?.purchaseUnits?.[0]?.payments?.captures?.[0];

            if (!capture?.id) {
                Logger.error(
                    `PayPal captureOrder succeeded but returned no capture ID. ` +
                        `Order ID: ${paypalOrderId}`,
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
                    metadata: {
                        paypalOrderId,
                        captureId: capture.id,
                        captureStatus: capture.status,
                    },
                };
            }

            Logger.info(
                `PayPal payment captured successfully. Order ID: ${paypalOrderId}, Capture ID: ${capture.id}`,
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
     * The payment is already captured (Settled) during `createPayment`, so nothing to
     * do here.  This method is only invoked when transitioning from 'Authorized' →
     * 'Settled', which does not happen in the UC1 immediate-capture flow.
     */
    settlePayment: async () => ({ success: true as const }),
});
