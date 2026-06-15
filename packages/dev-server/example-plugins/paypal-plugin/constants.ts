export const PAYPAL_PAYMENT_HANDLER_CODE = 'paypal';

export const loggerCtx = 'PayPalPlugin';

/**
 * Zero-decimal currencies per PayPal's documentation.
 * For these, Vendure's integer amount IS the final PayPal value (no division by 100).
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF',
    'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV',
    'XAF', 'XOF', 'XPF',
]);
