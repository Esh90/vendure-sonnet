import {
    CreatePaymentErrorResult,
    CreatePaymentResult,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    SettlePaymentResult,
} from '@vendure/core';
import { PAYPAL_PAYMENT_HANDLER_CODE, loggerCtx } from '../constants';
import { getPayPalClient } from '../service/paypal-client';

export const paypalPaymentMethodHandler = new PaymentMethodHandler({
    code: PAYPAL_PAYMENT_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'PayPal' }],
    args: {},

    /**
     * Use Case 1 – Standard Checkout (Immediate Capture)
     *
     * The storefront must pass the approved PayPal order ID in metadata before
     * calling addPaymentToOrder:
     *   - Embedded flow: obtain orderId via PayPal JS SDK onApprove callback
     *   - Redirect flow: obtain orderId via the createPaypalOrder Shop API mutation,
     *     then extract the `token` query parameter from the return URL
     *
     * On success the payment is captured immediately and enters the Settled state.
     */
    createPayment: async (
        _ctx,
        _order,
        amount,
        _args,
        metadata,
    ): Promise<CreatePaymentResult | CreatePaymentErrorResult> => {
        const paypalOrderId = metadata?.paypalOrderId as string | undefined;

        if (!paypalOrderId || typeof paypalOrderId !== 'string' || paypalOrderId.trim() === '') {
            return {
                amount,
                state: 'Error',
                errorMessage:
                    'Missing paypalOrderId in payment metadata. ' +
                    'The storefront must provide the approved PayPal order ID before calling addPaymentToOrder.',
            };
        }

        try {
            const client = getPayPalClient();
            const { captureId, status } = await client.captureOrder(paypalOrderId.trim());

            if (status === 'COMPLETED') {
                return {
                    amount,
                    state: 'Settled',
                    transactionId: captureId,
                    metadata: {
                        paypalOrderId,
                        captureId,
                        captureStatus: status,
                    },
                };
            }

            if (status === 'PENDING') {
                // Funds are reserved but subject to review; treated as Authorized
                // so a merchant can settle manually once PayPal clears the payment.
                Logger.warn(
                    `PayPal capture for order ${paypalOrderId} returned PENDING status. ` +
                        'The payment may be under review. Capture ID: ' + captureId,
                    loggerCtx,
                );
                return {
                    amount,
                    state: 'Authorized',
                    transactionId: captureId,
                    metadata: {
                        paypalOrderId,
                        captureId,
                        captureStatus: status,
                        pendingReason: 'PAYPAL_REVIEW',
                    },
                };
            }

            // Any other status (DECLINED, FAILED, etc.) is a hard decline.
            Logger.warn(
                `PayPal capture for order ${paypalOrderId} declined with status: ${status}`,
                loggerCtx,
            );
            return {
                amount,
                state: 'Declined',
                errorMessage: `PayPal capture declined. Status: ${status}`,
                metadata: { paypalOrderId, captureId, captureStatus: status },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(`PayPal createPayment error for order ${paypalOrderId}: ${message}`, loggerCtx);
            return {
                amount,
                state: 'Error',
                errorMessage: message,
                metadata: { paypalOrderId },
            };
        }
    },

    /**
     * Use Case 1 – payment is already Settled in createPayment (immediate capture).
     * This is a no-op that satisfies the interface requirement.
     *
     * Use Case 2 (authorize-then-capture) will override this logic.
     */
    settlePayment: async (_ctx, _order, _payment, _args): Promise<SettlePaymentResult> => {
        return { success: true };
    },
});
