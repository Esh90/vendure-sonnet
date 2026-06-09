/**
 * Currency codes for which PayPal expects a whole-number string (no decimal places).
 * Source: PayPal documentation — currencies with no minor unit.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF', 'CLP', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Converts a Vendure integer amount (minor currency units, e.g. cents) to the
 * decimal string format required by the PayPal Orders/Payments API.
 *
 * Examples:
 *   toPayPalAmount(1000, 'USD') => '10.00'
 *   toPayPalAmount(500, 'JPY') => '500'
 */
export function toPayPalAmount(amountInMinorUnits: number, currencyCode: string): string {
    if (ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase())) {
        return amountInMinorUnits.toFixed(0);
    }
    return (amountInMinorUnits / 100).toFixed(2);
}
