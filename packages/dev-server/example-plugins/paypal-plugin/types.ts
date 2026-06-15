export interface PayPalPluginOptions {
    /**
     * PayPal environment: 'sandbox' for testing, 'production' for live.
     * Defaults to 'sandbox'.
     */
    environment?: 'sandbox' | 'production';
    /**
     * PayPal client ID. Falls back to PAYPAL_CLIENT_ID env var.
     */
    clientId?: string;
    /**
     * PayPal client secret. Falls back to PAYPAL_CLIENT_SECRET env var.
     */
    clientSecret?: string;
    /**
     * Default return URL after PayPal redirect approval (redirect flow only).
     */
    returnUrl?: string;
    /**
     * Default cancel URL if buyer cancels on PayPal (redirect flow only).
     */
    cancelUrl?: string;
}

export interface PayPalTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface PayPalOrderLink {
    rel: string;
    href: string;
    method: string;
}

export interface PayPalCreateOrderResponse {
    id: string;
    status: string;
    links: PayPalOrderLink[];
}

export interface PayPalCaptureDetails {
    id: string;
    status: string;
    amount: {
        currency_code: string;
        value: string;
    };
}

export interface PayPalCaptureOrderResponse {
    id: string;
    status: string;
    purchase_units: Array<{
        payments: {
            captures: PayPalCaptureDetails[];
        };
    }>;
}

export interface PayPalErrorDetails {
    issue: string;
    description?: string;
}

export interface PayPalApiError {
    name: string;
    message: string;
    details?: PayPalErrorDetails[];
    debug_id?: string;
}

export interface PayPalAuthorizationDetails {
    id: string;
    status: string;
    expiration_time?: string;
    amount: {
        currency_code: string;
        value: string;
    };
}

export interface PayPalAuthorizeOrderResponse {
    id: string;
    status: string;
    purchase_units: Array<{
        payments: {
            authorizations: PayPalAuthorizationDetails[];
        };
    }>;
}

export interface PayPalCaptureAuthorizationResponse {
    id: string;
    status: string;
    amount: {
        currency_code: string;
        value: string;
    };
}
