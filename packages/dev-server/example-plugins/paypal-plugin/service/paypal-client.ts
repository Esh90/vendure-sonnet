import { Logger } from '@vendure/core';
import { loggerCtx, ZERO_DECIMAL_CURRENCIES } from '../constants';
import type {
    PayPalApiError,
    PayPalCaptureOrderResponse,
    PayPalCreateOrderResponse,
    PayPalPluginOptions,
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
            intent: 'CAPTURE',
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
