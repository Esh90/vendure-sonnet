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

export interface PayPalRefundResponse {
    id: string;
    status: string;
    amount?: {
        currency_code: string;
        value: string;
    };
}

// ─── Subscriptions / Billing Plans ────────────────────────────────────────────

export type PayPalSubscriptionIntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type PayPalBillingPlanStatus = 'CREATED' | 'INACTIVE' | 'ACTIVE';
export type PayPalSubscriptionStatus =
    | 'APPROVAL_PENDING'
    | 'APPROVED'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'CANCELLED'
    | 'EXPIRED';

export interface PayPalProductApiResponse {
    id: string;
    name: string;
    description?: string;
    type: string;
    create_time: string;
    update_time: string;
}

export interface PayPalBillingPlanApiResponse {
    id: string;
    product_id: string;
    name: string;
    description?: string;
    status: PayPalBillingPlanStatus;
    billing_cycles: Array<{
        frequency: { interval_unit: PayPalSubscriptionIntervalUnit; interval_count: number };
        tenure_type: 'REGULAR' | 'TRIAL';
        sequence: number;
        total_cycles: number;
        pricing_scheme: { fixed_price: { currency_code: string; value: string } };
    }>;
    payment_preferences: {
        auto_bill_outstanding: boolean;
        payment_failure_threshold: number;
    };
    create_time: string;
    update_time: string;
}

export interface PayPalSubscriptionApiResponse {
    id: string;
    plan_id: string;
    status: PayPalSubscriptionStatus;
    start_time?: string;
    subscriber?: {
        name?: { given_name: string; surname: string };
        email_address?: string;
    };
    billing_info?: {
        outstanding_balance?: { currency_code: string; value: string };
        last_payment?: { amount: { currency_code: string; value: string }; time: string };
        next_billing_time?: string;
        failed_payments_count?: number;
    };
    links: PayPalOrderLink[];
    create_time: string;
    update_time: string;
}

/** JSON Patch operation used by PayPal's PATCH endpoints. */
export interface PatchOperation {
    op: 'add' | 'replace' | 'remove';
    path: string;
    value?: unknown;
}

// ─── Transaction Reporting ─────────────────────────────────────────────────────

export interface PayPalMoneyValue {
    currency_code: string;
    value: string;
}

export interface PayPalTransactionInfo {
    transaction_id: string;
    paypal_reference_id?: string;
    paypal_reference_id_type?: string;
    transaction_event_code: string;
    transaction_initiation_date: string;
    transaction_updated_date: string;
    transaction_amount: PayPalMoneyValue;
    fee_amount?: PayPalMoneyValue;
    transaction_status: string;
    transaction_subject?: string;
    transaction_note?: string;
    ending_balance?: PayPalMoneyValue;
}

export interface PayPalTransactionPayerInfo {
    account_id?: string;
    email_address?: string;
    payer_name?: { given_name?: string; surname?: string };
    country_code?: string;
}

export interface PayPalTransactionItem {
    transaction_info: PayPalTransactionInfo;
    payer_info?: PayPalTransactionPayerInfo;
    cart_info?: {
        item_details?: Array<{
            item_name?: string;
            item_quantity?: string;
            item_unit_price?: PayPalMoneyValue;
            item_amount?: PayPalMoneyValue;
        }>;
    };
}

export interface PayPalTransactionSearchResponse {
    transaction_details: PayPalTransactionItem[];
    account_number: string;
    start_date: string;
    end_date: string;
    last_refreshed_datetime?: string;
    page: number;
    total_items: number;
    total_pages: number;
    links: PayPalOrderLink[];
}

export interface PayPalBalanceCurrency {
    currency: string;
    primary: boolean;
    total_balance: PayPalMoneyValue;
    available_balance?: PayPalMoneyValue;
    withheld_balance?: PayPalMoneyValue;
}

export interface PayPalBalanceResponse {
    balances: PayPalBalanceCurrency[];
    account_id: string;
    as_of_time: string;
    last_refresh_time: string;
}
