import {
    CancelPaymentErrorResult,
    CancelPaymentResult,
    CreatePaymentErrorResult,
    CreatePaymentResult,
    CreateRefundResult,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    SettlePaymentErrorResult,
    SettlePaymentResult,
} from '@vendure/core';
import { PAYPAL_PAYMENT_HANDLER_CODE, loggerCtx } from '../constants';
import { getPayPalClient } from '../service/paypal-client';

export const paypalPaymentMethodHandler = new PaymentMethodHandler({
    code: PAYPAL_PAYMENT_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'PayPal' }],

    args: {
        paymentIntent: {
            type: 'string' as const,
            defaultValue: 'CAPTURE',
            label: [{ languageCode: LanguageCode.en, value: 'Payment intent' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value:
                        'CAPTURE — funds are taken immediately at checkout. ' +
                        'AUTHORIZE — funds are reserved at checkout and captured when the merchant fulfils the order.',
                },
            ],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'CAPTURE', label: 'Capture immediately (Use Case 1)' },
                    { value: 'AUTHORIZE', label: 'Authorize, capture on fulfilment (Use Case 2)' },
                ],
            },
        },
    },

    /**
     * Use Case 1 – CAPTURE intent: captures the approved PayPal order immediately.
     * Use Case 2 – AUTHORIZE intent: reserves funds against the approved order.
     *
     * In both cases the storefront must supply the approved PayPal order ID in metadata:
     *   addPaymentToOrder({ method: 'paypal-payment', metadata: { paypalOrderId: '...' } })
     */
    createPayment: async (
        _ctx,
        _order,
        amount,
        args,
        metadata,
    ): Promise<CreatePaymentResult | CreatePaymentErrorResult> => {
        const paypalOrderId = metadata?.paypalOrderId as string | undefined;

        if (!paypalOrderId || typeof paypalOrderId !== 'string' || paypalOrderId.trim() === '') {
            return {
                amount,
                state: 'Error',
                errorMessage:
                    'Missing paypalOrderId in payment metadata. ' +
                    'The storefront must supply the approved PayPal order ID.',
            };
        }

        const intent = (args.paymentIntent as string) || 'CAPTURE';
        const orderId = paypalOrderId.trim();

        try {
            const client = getPayPalClient();

            // ── Use Case 1: Immediate Capture ─────────────────────────────────
            if (intent === 'CAPTURE') {
                const { captureId, status } = await client.captureOrder(orderId);

                if (status === 'COMPLETED') {
                    return {
                        amount,
                        state: 'Settled',
                        transactionId: captureId,
                        metadata: { paypalOrderId: orderId, captureId, captureStatus: status },
                    };
                }

                if (status === 'PENDING') {
                    Logger.warn(
                        `PayPal capture for order ${orderId} is PENDING (payment under review). ` +
                            `Capture ID: ${captureId}`,
                        loggerCtx,
                    );
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: captureId,
                        metadata: {
                            paypalOrderId: orderId,
                            captureId,
                            captureStatus: status,
                            pendingReason: 'PAYPAL_REVIEW',
                        },
                    };
                }

                Logger.warn(
                    `PayPal capture for order ${orderId} declined. Status: ${status}`,
                    loggerCtx,
                );
                return {
                    amount,
                    state: 'Declined',
                    errorMessage: `PayPal capture declined. Status: ${status}`,
                    metadata: { paypalOrderId: orderId, captureStatus: status },
                };
            }

            // ── Use Case 2: Authorize ─────────────────────────────────────────
            if (intent === 'AUTHORIZE') {
                const { authorizationId, status, expirationTime } =
                    await client.authorizeOrder(orderId);

                if (status === 'CREATED' || status === 'CAPTURED') {
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: authorizationId,
                        metadata: {
                            paypalOrderId: orderId,
                            authorizationId,
                            authorizationStatus: status,
                            authorizationExpiresAt: expirationTime ?? null,
                        },
                    };
                }

                if (status === 'PENDING') {
                    Logger.warn(
                        `PayPal authorization for order ${orderId} is PENDING. Auth ID: ${authorizationId}`,
                        loggerCtx,
                    );
                    return {
                        amount,
                        state: 'Authorized',
                        transactionId: authorizationId,
                        metadata: {
                            paypalOrderId: orderId,
                            authorizationId,
                            authorizationStatus: status,
                            pendingReason: 'PAYPAL_REVIEW',
                        },
                    };
                }

                Logger.warn(
                    `PayPal authorization for order ${orderId} declined. Status: ${status}`,
                    loggerCtx,
                );
                return {
                    amount,
                    state: 'Declined',
                    errorMessage: `PayPal authorization declined. Status: ${status}`,
                    metadata: { paypalOrderId: orderId, authorizationStatus: status },
                };
            }

            return {
                amount,
                state: 'Error',
                errorMessage: `Invalid paymentIntent arg value: "${intent}". Expected CAPTURE or AUTHORIZE.`,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `PayPal createPayment error (intent=${intent}, order=${orderId}): ${message}`,
                loggerCtx,
            );
            return {
                amount,
                state: 'Error',
                errorMessage: message,
                metadata: { paypalOrderId: orderId },
            };
        }
    },

    /**
     * Use Case 1 – CAPTURE intent: payment already settled in createPayment. No-op.
     * Use Case 2 – AUTHORIZE intent: captures the authorization stored in payment.metadata.
     *   Called by the merchant via the admin API when the order is ready to fulfil.
     */
    settlePayment: async (
        _ctx,
        _order,
        payment,
        args,
    ): Promise<SettlePaymentResult | SettlePaymentErrorResult> => {
        const intent = (args.paymentIntent as string) || 'CAPTURE';

        if (intent !== 'AUTHORIZE') {
            // UC1: already settled at creation time.
            return { success: true };
        }

        // UC2: capture the reserved authorization.
        const authorizationId = payment.metadata?.authorizationId as string | undefined;

        if (!authorizationId || typeof authorizationId !== 'string') {
            return {
                success: false,
                errorMessage:
                    'Cannot settle: authorizationId is missing from payment metadata. ' +
                    'Ensure createPayment completed successfully with AUTHORIZE intent.',
            };
        }

        try {
            const client = getPayPalClient();
            const { captureId, status } = await client.captureAuthorization(authorizationId);

            if (status === 'COMPLETED') {
                return {
                    success: true,
                    metadata: { captureId, captureStatus: status },
                };
            }

            // PENDING means PayPal has the capture but hasn't settled funds yet.
            // Treat as success — Vendure marks payment Settled, PayPal will clear shortly.
            if (status === 'PENDING') {
                Logger.warn(
                    `PayPal authorization capture ${authorizationId} is PENDING. Capture ID: ${captureId}`,
                    loggerCtx,
                );
                return {
                    success: true,
                    metadata: { captureId, captureStatus: status, pendingReason: 'PAYPAL_REVIEW' },
                };
            }

            return {
                success: false,
                errorMessage: `PayPal authorization capture returned unexpected status: ${status}`,
                metadata: { authorizationId, captureId, captureStatus: status },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `PayPal settlePayment error (authorizationId=${authorizationId}): ${message}`,
                loggerCtx,
            );
            return { success: false, errorMessage: message };
        }
    },

    /**
     * Use Case 3 – Payment Cancellation / Void.
     *
     * Voids an AUTHORIZE-intent payment that is in the Authorized state, releasing
     * the reserved funds back to the buyer without any charge.
     *
     * Constraints (enforced by PayPal):
     *   - The authorization must not have been captured (partially or fully).
     *   - The authorization must not have already been voided.
     *   - PayPal authorizations expire after 29 days; voiding an expired auth returns an error.
     *
     * For CAPTURE-intent payments (already Settled) this function will not normally be
     * reached (Vendure prevents cancelling a Settled payment), but returns an explanatory
     * error just in case.
     */
    cancelPayment: async (
        _ctx,
        _order,
        payment,
        args,
    ): Promise<CancelPaymentResult | CancelPaymentErrorResult> => {
        const intent = (args.paymentIntent as string) || 'CAPTURE';

        if (intent !== 'AUTHORIZE') {
            return {
                success: false,
                errorMessage:
                    'Cannot void a CAPTURE-intent payment — the funds have already been taken. ' +
                    'Issue a refund instead.',
            };
        }

        const authorizationId = payment.metadata?.authorizationId as string | undefined;

        if (!authorizationId || typeof authorizationId !== 'string') {
            return {
                success: false,
                errorMessage:
                    'Cannot cancel: authorizationId is missing from payment metadata. ' +
                    'Ensure createPayment completed successfully with AUTHORIZE intent.',
            };
        }

        try {
            const client = getPayPalClient();
            await client.voidAuthorization(authorizationId);

            return {
                success: true,
                metadata: { authorizationId, voidedAt: new Date().toISOString() },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(
                `PayPal cancelPayment error (authorizationId=${authorizationId}): ${message}`,
                loggerCtx,
            );
            return { success: false, errorMessage: message };
        }
    },

    /**
     * Use Case 4 – Full Refund
     * Use Case 5 – Partial Refund
     *
     * Both cases are handled here; the amount parameter determines which path runs:
     *
     *   amount >= payment.amount  →  Full refund (UC4)
     *     PayPal call omits amount so PayPal refunds the exact capture value.
     *     Idempotency key is stable: `refund-full-<captureId>`.
     *
     *   amount < payment.amount   →  Partial refund (UC5)
     *     PayPal call includes amount; PayPal validates it against the remaining
     *     refundable balance (returns REFUND_AMOUNT_EXCEEDED if over-refunded).
     *     Multiple partial refunds are allowed against the same capture up to the
     *     original captured value.
     *     Idempotency key is unique per invocation (`refund-partial-<captureId>-<paymentId>-<ts>`)
     *     so that two partial refunds of the same amount are treated as distinct
     *     operations. Note: a retry after a network failure will create a second
     *     refund — merchants should confirm the refund state before retrying.
     *
     * The captureId in payment.metadata comes from createPayment (CAPTURE intent)
     * or from settlePayment's returned metadata (AUTHORIZE intent).
     */
    createRefund: async (
        _ctx,
        _input,
        amount,
        order,
        payment,
    ): Promise<CreateRefundResult> => {
        const captureId = payment.metadata?.captureId as string | undefined;

        if (!captureId || typeof captureId !== 'string') {
            Logger.error(
                `PayPal createRefund: captureId missing from payment ${payment.id} metadata. ` +
                    'The payment may not have been settled via the PayPal handler.',
                loggerCtx,
            );
            return { state: 'Failed' };
        }

        const isFullRefund = amount >= payment.amount;

        // For partial refunds, generate a unique key per invocation so repeated
        // calls for the same amount create distinct PayPal refunds rather than
        // being collapsed into the same one by PayPal's idempotency layer.
        const partialKey = isFullRefund
            ? undefined
            : `refund-partial-${captureId}-${payment.id}-${Date.now()}`;

        try {
            const client = getPayPalClient();
            const { refundId, status } = await client.refundCapture(
                captureId,
                isFullRefund ? undefined : amount,
                isFullRefund ? undefined : order.currencyCode,
                partialKey,
            );

            if (status === 'COMPLETED') {
                return {
                    state: 'Settled',
                    transactionId: refundId,
                    metadata: {
                        refundId,
                        refundStatus: status,
                        refundType: isFullRefund ? 'FULL' : 'PARTIAL',
                        refundedAmount: amount,
                    },
                };
            }

            if (status === 'PENDING') {
                Logger.warn(
                    `PayPal refund ${refundId} for capture ${captureId} is PENDING`,
                    loggerCtx,
                );
                return {
                    state: 'Pending',
                    transactionId: refundId,
                    metadata: { refundId, refundStatus: status },
                };
            }

            Logger.error(
                `PayPal refund for capture ${captureId} returned unexpected status: ${status}`,
                loggerCtx,
            );
            return { state: 'Failed', metadata: { refundId, refundStatus: status } };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            Logger.error(`PayPal createRefund error (captureId=${captureId}): ${message}`, loggerCtx);
            return { state: 'Failed', metadata: { captureId, error: message } };
        }
    },
});
