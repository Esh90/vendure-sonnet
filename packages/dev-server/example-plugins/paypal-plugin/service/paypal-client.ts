import { Logger } from '@vendure/core';
import { loggerCtx, ZERO_DECIMAL_CURRENCIES } from '../constants';
import type {
    PatchOperation,
    PayPalApiError,
    PayPalAuthorizeOrderResponse,
    PayPalBillingPlanApiResponse,
    PayPalCaptureAuthorizationResponse,
    PayPalCaptureOrderResponse,
    PayPalCreateOrderResponse,
    PayPalPluginOptions,
    PayPalProductApiResponse,
    PayPalRefundResponse,
    PayPalSubscriptionApiResponse,
    PayPalSubscriptionIntervalUnit,
    PayPalTokenResponse,
} from '../types';

export interface CreateOrderResult {
    paypalOrderId: string;
    approvalUrl: string;
}

export interface CaptureOrderResult {
    captureId: string;
    status: string;
}

export interface AuthorizeOrderResult {
    authorizationId: string;
    status: string;
    expirationTime?: string;
}

export interface CaptureAuthorizationResult {
    captureId: string;
    status: string;
}

export interface RefundCaptureResult {
    refundId: string;
    status: string;
}

export interface CreateProductResult {
    productId: string;
}

export interface CreateBillingPlanResult {
    planId: string;
    status: string;
}

export interface CreateSubscriptionResult {
    subscriptionId: string;
    status: string;
    approvalUrl: string;
}

export interface GetSubscriptionResult {
    subscriptionId: string;
    planId: string;
    status: string;
    subscriberEmail?: string;
    nextBillingTime?: string;
    failedPaymentsCount: number;
}

/**
 * Thin HTTP client for the PayPal Orders v2 REST API.
 * Uses native Node.js fetch (available in Node 18+).
 */
export class PayPalClient {
    private accessToken: string | null = null;
    private tokenExpiry = 0;

    private readonly clientId: string;
    private readonly clientSecret: string;
    private readonly baseUrl: string;
    private readonly defaultReturnUrl: string;
    private readonly defaultCancelUrl: string;

    constructor(options: Required<PayPalPluginOptions>) {
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.defaultReturnUrl = options.returnUrl;
        this.defaultCancelUrl = options.cancelUrl;
        this.baseUrl =
            options.environment === 'production'
                ? 'https://api-m.paypal.com'
                : 'https://api-m.sandbox.paypal.com';
    }

    // ─── Authentication ────────────────────────────────────────────────────────

    private async getAccessToken(): Promise<string> {
        const now = Date.now();
        if (this.accessToken !== null && now < this.tokenExpiry) {
            return this.accessToken;
        }

        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`PayPal authentication failed (HTTP ${response.status}): ${body}`);
        }

        const data = (await response.json()) as PayPalTokenResponse;
        this.accessToken = data.access_token;
        // Refresh 60 s before expiry to avoid edge-case races
        this.tokenExpiry = now + (data.expires_in - 60) * 1000;

        Logger.verbose('PayPal access token refreshed', loggerCtx);
        return this.accessToken;
    }

    // ─── Orders v2 ────────────────────────────────────────────────────────────

    /**
     * Creates a PayPal order with CAPTURE intent.
     * Returns the PayPal order ID and the buyer-approval URL.
     */
    async createOrder(
        amount: number,
        currencyCode: string,
        returnUrl?: string,
        cancelUrl?: string,
        intent: 'CAPTURE' | 'AUTHORIZE' = 'CAPTURE',
    ): Promise<CreateOrderResult> {
        // Per-call URLs take precedence; fall back to plugin-level defaults.
        const effectiveReturnUrl = returnUrl || this.defaultReturnUrl;
        const effectiveCancelUrl = cancelUrl || this.defaultCancelUrl || effectiveReturnUrl;

        if (!effectiveReturnUrl) {
            throw new Error(
                'PayPal createOrder requires a return_url. ' +
                    'Pass returnUrl in the createPaypalOrder mutation args or set ' +
                    'returnUrl in PayPalPlugin.init() / PAYPAL_RETURN_URL env var.',
            );
        }

        const token = await this.getAccessToken();
        const value = this.toPayPalAmount(amount, currencyCode);

        const body: Record<string, unknown> = {
            intent,
            purchase_units: [
                {
                    amount: {
                        currency_code: currencyCode.toUpperCase(),
                        value,
                    },
                },
            ],
            // application_context is always present for the redirect flow.
            // - user_action CONTINUE: tells PayPal the merchant will complete the
            //   capture after redirect (avoids the PAY_NOW inline-payment path).
            // - shipping_preference NO_SHIPPING: Vendure already collected the
            //   shipping address; prevents PayPal's approval page from stalling
            //   on a redundant shipping-address step.
            application_context: {
                return_url: effectiveReturnUrl,
                cancel_url: effectiveCancelUrl,
                user_action: 'CONTINUE',
                shipping_preference: 'NO_SHIPPING',
            },
        };

        const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal createOrder failed (HTTP ${response.status}): ${err}`);
        }

        const order = (await response.json()) as PayPalCreateOrderResponse;

        const approvalUrl =
            order.links.find(l => l.rel === 'payer-action')?.href ??
            order.links.find(l => l.rel === 'approve')?.href ??
            '';

        Logger.info(`PayPal order created: ${order.id}`, loggerCtx);
        return { paypalOrderId: order.id, approvalUrl };
    }

    /**
     * Captures a previously-approved PayPal order.
     * Returns the capture ID and status from PayPal.
     */
    async captureOrder(paypalOrderId: string): Promise<CaptureOrderResult> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    // Idempotency key scoped to this specific capture attempt
                    'PayPal-Request-Id': `capture-${paypalOrderId}`,
                },
                body: '{}',
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal captureOrder failed (HTTP ${response.status}): ${err}`);
        }

        const capture = (await response.json()) as PayPalCaptureOrderResponse;
        const captureDetails = capture.purchase_units[0]?.payments?.captures?.[0];

        if (!captureDetails) {
            throw new Error(
                `PayPal captureOrder response for order ${paypalOrderId} is missing capture details`,
            );
        }

        Logger.info(
            `PayPal order ${paypalOrderId} captured. Capture ID: ${captureDetails.id}, status: ${captureDetails.status}`,
            loggerCtx,
        );

        return { captureId: captureDetails.id, status: captureDetails.status };
    }

    /**
     * Authorizes a buyer-approved PayPal order (AUTHORIZE intent).
     * Reserves funds without moving money. Returns the authorization ID
     * which must be stored in payment.metadata for later capture.
     */
    async authorizeOrder(paypalOrderId: string): Promise<AuthorizeOrderResult> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/authorize`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'PayPal-Request-Id': `authorize-${paypalOrderId}`,
                },
                body: '{}',
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal authorizeOrder failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalAuthorizeOrderResponse;
        const authDetails = data.purchase_units[0]?.payments?.authorizations?.[0];

        if (!authDetails) {
            throw new Error(
                `PayPal authorizeOrder response for order ${paypalOrderId} is missing authorization details`,
            );
        }

        Logger.info(
            `PayPal order ${paypalOrderId} authorized. Auth ID: ${authDetails.id}, ` +
                `status: ${authDetails.status}, expires: ${authDetails.expiration_time ?? 'N/A'}`,
            loggerCtx,
        );

        return {
            authorizationId: authDetails.id,
            status: authDetails.status,
            expirationTime: authDetails.expiration_time,
        };
    }

    /**
     * Captures a previously authorized PayPal payment.
     * Called by settlePayment when the merchant is ready to charge the buyer
     * (e.g., just before shipment). Authorization IDs are valid for 29 days;
     * the capture window is 3 days after re-authorization.
     */
    async captureAuthorization(authorizationId: string): Promise<CaptureAuthorizationResult> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'PayPal-Request-Id': `capture-auth-${authorizationId}`,
                },
                body: JSON.stringify({ final_capture: true }),
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal captureAuthorization failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalCaptureAuthorizationResponse;

        Logger.info(
            `PayPal authorization ${authorizationId} captured. Capture ID: ${data.id}, status: ${data.status}`,
            loggerCtx,
        );

        return { captureId: data.id, status: data.status };
    }

    /**
     * Voids (cancels) a PayPal authorization, releasing the reserved funds back
     * to the buyer. Only valid for authorizations that have not been captured or
     * already voided. PayPal returns 204 No Content on success.
     *
     * Throws with a descriptive message on failure, including the PayPal error code
     * so callers can distinguish "already voided" from "already captured".
     */
    async voidAuthorization(authorizationId: string): Promise<void> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'PayPal-Request-Id': `void-${authorizationId}`,
                },
                body: '{}',
            },
        );

        // 204 = success, no body
        if (response.status === 204) {
            Logger.info(`PayPal authorization ${authorizationId} voided successfully`, loggerCtx);
            return;
        }

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal voidAuthorization failed (HTTP ${response.status}): ${err}`);
        }
    }

    /**
     * Refunds a captured PayPal payment.
     *
     * Full refund  (UC4): pass no amount/currencyCode — PayPal refunds the exact
     *   captured amount. Omitting the amount avoids rounding mismatches.
     *
     * Partial refund (UC5): pass amount, currencyCode, and a caller-generated
     *   idempotencyKey. The caller must generate a new key per refund invocation
     *   (not per amount) so that multiple same-amount partial refunds are treated
     *   as distinct operations by PayPal.
     *
     * Idempotency key:
     *   Full    → `refund-full-<captureId>` (stable; one full refund per capture)
     *   Partial → caller-supplied            (unique per invocation)
     */
    async refundCapture(
        captureId: string,
        amount?: number,
        currencyCode?: string,
        idempotencyKey?: string,
    ): Promise<RefundCaptureResult> {
        const token = await this.getAccessToken();
        const isPartial = amount !== undefined && currencyCode !== undefined;

        const body: Record<string, unknown> = {};
        if (isPartial) {
            body.amount = {
                currency_code: (currencyCode as string).toUpperCase(),
                value: this.toPayPalAmount(amount as number, currencyCode as string),
            };
        }

        const resolvedKey = idempotencyKey ?? (isPartial
            ? `refund-partial-${captureId}-${Date.now()}`
            : `refund-full-${captureId}`);

        const response = await fetch(
            `${this.baseUrl}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'PayPal-Request-Id': resolvedKey,
                },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal refundCapture failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalRefundResponse;

        Logger.info(
            `PayPal capture ${captureId} refunded${isPartial ? ` (partial: ${amount})` : ' (full)'}. ` +
                `Refund ID: ${data.id}, status: ${data.status}`,
            loggerCtx,
        );

        return { refundId: data.id, status: data.status };
    }

    // ─── Subscriptions v1 ────────────────────────────────────────────────────

    /**
     * Creates a PayPal Catalog Product (required before creating a billing plan).
     * Products are reusable across billing plans.
     */
    async createProduct(name: string, description?: string): Promise<CreateProductResult> {
        const token = await this.getAccessToken();

        const body: Record<string, unknown> = {
            name,
            type: 'SERVICE',
            ...(description ? { description } : {}),
        };

        const response = await fetch(`${this.baseUrl}/v1/catalogs/products`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'PayPal-Request-Id': `product-${name.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal createProduct failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalProductApiResponse;
        Logger.info(`PayPal product created: ${data.id}`, loggerCtx);
        return { productId: data.id };
    }

    /**
     * Creates a PayPal Billing Plan linked to the given product.
     * The plan is created in ACTIVE status by default.
     */
    async createBillingPlan(params: {
        productId: string;
        name: string;
        description?: string;
        amount: number;
        currencyCode: string;
        intervalUnit: PayPalSubscriptionIntervalUnit;
        intervalCount?: number;
        paymentFailureThreshold?: number;
    }): Promise<CreateBillingPlanResult> {
        const token = await this.getAccessToken();
        const {
            productId,
            name,
            description,
            amount,
            currencyCode,
            intervalUnit,
            intervalCount = 1,
            paymentFailureThreshold = 3,
        } = params;

        const body: Record<string, unknown> = {
            product_id: productId,
            name,
            ...(description ? { description } : {}),
            status: 'ACTIVE',
            billing_cycles: [
                {
                    frequency: { interval_unit: intervalUnit, interval_count: intervalCount },
                    tenure_type: 'REGULAR',
                    sequence: 1,
                    total_cycles: 0, // 0 = infinite
                    pricing_scheme: {
                        fixed_price: {
                            currency_code: currencyCode.toUpperCase(),
                            value: this.toPayPalAmount(amount, currencyCode),
                        },
                    },
                },
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                payment_failure_threshold: paymentFailureThreshold,
            },
        };

        const response = await fetch(`${this.baseUrl}/v1/billing/plans`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'PayPal-Request-Id': `plan-${productId}-${intervalUnit}-${intervalCount}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal createBillingPlan failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalBillingPlanApiResponse;
        Logger.info(`PayPal billing plan created: ${data.id}, status: ${data.status}`, loggerCtx);
        return { planId: data.id, status: data.status };
    }

    /**
     * Activates an INACTIVE billing plan.
     * PayPal returns 204 No Content on success.
     */
    async activateBillingPlan(planId: string): Promise<void> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}/activate`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: '{}',
            },
        );

        if (response.status === 204) {
            Logger.info(`PayPal billing plan ${planId} activated`, loggerCtx);
            return;
        }

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal activateBillingPlan failed (HTTP ${response.status}): ${err}`);
        }
    }

    /** Fetches the current state of a billing plan from PayPal. */
    async getBillingPlan(planId: string): Promise<PayPalBillingPlanApiResponse> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}`,
            {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal getBillingPlan failed (HTTP ${response.status}): ${err}`);
        }

        return (await response.json()) as PayPalBillingPlanApiResponse;
    }

    /**
     * Updates a billing plan using JSON Patch semantics.
     * Common use: change `payment_preferences/payment_failure_threshold`.
     * PayPal returns 204 No Content on success.
     */
    async updateBillingPlan(planId: string, patches: PatchOperation[]): Promise<void> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(patches),
            },
        );

        if (response.status === 204) {
            Logger.info(`PayPal billing plan ${planId} updated`, loggerCtx);
            return;
        }

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal updateBillingPlan failed (HTTP ${response.status}): ${err}`);
        }
    }

    /**
     * Creates a PayPal Subscription for the given plan.
     * Returns the subscription ID and the buyer-approval URL.
     * The subscriber must visit the approval URL once to activate the subscription.
     */
    async createSubscription(params: {
        planId: string;
        returnUrl: string;
        cancelUrl: string;
        subscriberEmail?: string;
        startTime?: string;
    }): Promise<CreateSubscriptionResult> {
        const token = await this.getAccessToken();
        const { planId, returnUrl, cancelUrl, subscriberEmail, startTime } = params;

        const body: Record<string, unknown> = {
            plan_id: planId,
            application_context: {
                return_url: returnUrl,
                cancel_url: cancelUrl,
                user_action: 'SUBSCRIBE_NOW',
                shipping_preference: 'NO_SHIPPING',
            },
        };

        if (startTime) {
            body.start_time = startTime;
        }

        if (subscriberEmail) {
            body.subscriber = { email_address: subscriberEmail };
        }

        const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'PayPal-Request-Id': `sub-${planId}-${Date.now()}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal createSubscription failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalSubscriptionApiResponse;
        const approvalUrl = data.links.find(l => l.rel === 'approve')?.href ?? '';

        Logger.info(
            `PayPal subscription created: ${data.id}, status: ${data.status}`,
            loggerCtx,
        );
        return { subscriptionId: data.id, status: data.status, approvalUrl };
    }

    /** Fetches the current subscription state from PayPal and maps it to a flat result. */
    async getSubscription(subscriptionId: string): Promise<GetSubscriptionResult> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
            {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            },
        );

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal getSubscription failed (HTTP ${response.status}): ${err}`);
        }

        const data = (await response.json()) as PayPalSubscriptionApiResponse;
        return {
            subscriptionId: data.id,
            planId: data.plan_id,
            status: data.status,
            subscriberEmail: data.subscriber?.email_address,
            nextBillingTime: data.billing_info?.next_billing_time,
            failedPaymentsCount: data.billing_info?.failed_payments_count ?? 0,
        };
    }

    /**
     * Activates a SUSPENDED subscription.
     * PayPal returns 204 No Content on success.
     */
    async activateSubscription(subscriptionId: string, reason: string): Promise<void> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/activate`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            },
        );

        if (response.status === 204) {
            Logger.info(`PayPal subscription ${subscriptionId} activated`, loggerCtx);
            return;
        }

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal activateSubscription failed (HTTP ${response.status}): ${err}`);
        }
    }

    /**
     * Cancels a ACTIVE or SUSPENDED subscription.
     * PayPal returns 204 No Content on success.
     */
    async cancelSubscription(subscriptionId: string, reason: string): Promise<void> {
        const token = await this.getAccessToken();

        const response = await fetch(
            `${this.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ reason }),
            },
        );

        if (response.status === 204) {
            Logger.info(`PayPal subscription ${subscriptionId} cancelled`, loggerCtx);
            return;
        }

        if (!response.ok) {
            const err = await this.parseError(response);
            throw new Error(`PayPal cancelSubscription failed (HTTP ${response.status}): ${err}`);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Converts a Vendure integer amount (smallest currency unit) to a PayPal
     * decimal string. Zero-decimal currencies are passed through unchanged.
     */
    private toPayPalAmount(amount: number, currencyCode: string): string {
        if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) {
            return String(amount);
        }
        return (amount / 100).toFixed(2);
    }

    private async parseError(response: Response): Promise<string> {
        try {
            const json = (await response.json()) as PayPalApiError;
            const details =
                json.details?.map(d => `${d.issue}: ${d.description ?? ''}`).join('; ') ?? '';
            return `${json.name} — ${json.message}${details ? ` (${details})` : ''}${json.debug_id ? ` [debug_id: ${json.debug_id}]` : ''}`;
        } catch {
            return await response.text();
        }
    }
}

// ─── Module-level singleton ────────────────────────────────────────────────────
// Handlers are not NestJS providers and cannot use dependency injection, so we
// expose the client through a module-level variable initialised by PayPalPlugin.init().

let _client: PayPalClient | null = null;

export function initPayPalClient(options: Required<PayPalPluginOptions>): void {
    _client = new PayPalClient(options);
}

export function getPayPalClient(): PayPalClient {
    if (!_client) {
        throw new Error(
            'PayPalPlugin is not initialised. Call PayPalPlugin.init() in your VendureConfig plugins array.',
        );
    }
    return _client;
}
