import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PayPalShopResolver } from './api/paypal-shop-resolver';
import { shopApiExtensions } from './api/shop-api-extensions';
import { paypalPaymentMethodHandler } from './config/paypal-payment-handler';
import { initPayPalClient } from './service/paypal-client';
import type { PayPalPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentMethodHandler);
        return config;
    },
    providers: [PayPalShopResolver],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PayPalShopResolver],
    },
    compatibility: '>=3.0.0',
})
export class PayPalPlugin {
    private static options: Required<PayPalPluginOptions>;

    /**
     * Initialise the PayPal plugin. Call this in your VendureConfig plugins array:
     *
     * ```ts
     * PayPalPlugin.init({
     *   environment: 'sandbox',
     *   clientId: process.env.PAYPAL_CLIENT_ID,
     *   clientSecret: process.env.PAYPAL_CLIENT_SECRET,
     *   returnUrl: 'https://my-store.com/checkout/return',
     *   cancelUrl: 'https://my-store.com/checkout/cancel',
     * })
     * ```
     */
    static init(options: PayPalPluginOptions): typeof PayPalPlugin {
        PayPalPlugin.options = {
            environment: options.environment ?? 'sandbox',
            clientId: options.clientId ?? process.env.PAYPAL_CLIENT_ID ?? '',
            clientSecret: options.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET ?? '',
            returnUrl: options.returnUrl ?? '',
            cancelUrl: options.cancelUrl ?? '',
        };

        if (!PayPalPlugin.options.clientId || !PayPalPlugin.options.clientSecret) {
            throw new Error(
                'PayPalPlugin: clientId and clientSecret are required. ' +
                    'Provide them via plugin options or the PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars.',
            );
        }

        initPayPalClient(PayPalPlugin.options);
        return PayPalPlugin;
    }
}
