import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PayPalShopResolver } from './api/paypal-shop.resolver';
import { shopApiExtensions } from './api/shop-api.extensions';
import { paypalPaymentHandler } from './payment/paypal-payment.handler';
import { PayPalService } from './paypal.service';

/**
 * PayPalPlugin integrates PayPal as a payment provider into Vendure.
 *
 * Implemented use cases:
 *   UC1 — Standard Checkout (Immediate Capture)
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [PayPalService],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PayPalShopResolver],
    },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentHandler);
        return config;
    },
})
export class PayPalPlugin {}
