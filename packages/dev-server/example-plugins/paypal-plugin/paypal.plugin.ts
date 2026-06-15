import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PayPalAdminResolver } from './api/paypal-admin-resolver';
import { PayPalReportingResolver } from './api/paypal-reporting-resolver';
import { PayPalShopResolver } from './api/paypal-shop-resolver';
import { PayPalShopSubscriptionResolver } from './api/paypal-shop-subscription-resolver';
import { adminApiExtensions } from './api/admin-api-extensions';
import { shopApiExtensions } from './api/shop-api-extensions';
import { paypalPaymentMethodHandler } from './config/paypal-payment-handler';
import { PayPalBillingPlan } from './subscription/entities/paypal-billing-plan.entity';
import { PayPalSubscription } from './subscription/entities/paypal-subscription.entity';
import { PayPalSubscriptionService } from './subscription/service/paypal-subscription.service';
import { initPayPalClient } from './service/paypal-client';
import type { PayPalPluginOptions } from './types';

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PayPalBillingPlan, PayPalSubscription],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentMethodHandler);
        return config;
    },
    providers: [PayPalSubscriptionService],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PayPalShopResolver, PayPalShopSubscriptionResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [PayPalAdminResolver, PayPalReportingResolver],
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
