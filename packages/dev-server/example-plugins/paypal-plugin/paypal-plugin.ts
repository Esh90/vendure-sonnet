import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PayPalAdminResolver } from './api/paypal-admin.resolver';
import { adminApiExtensions } from './api/admin-api.extensions';
import { PayPalShopResolver } from './api/paypal-shop.resolver';
import { shopApiExtensions } from './api/shop-api.extensions';
import { paypalPaymentHandler } from './payment/paypal-payment.handler';
import { PayPalReportingService } from './reporting/paypal-reporting.service';
import { PayPalSubscription } from './subscription/paypal-subscription.entity';
import { PayPalSubscriptionService } from './subscription/paypal-subscription.service';
import { PayPalService } from './paypal.service';

/**
 * PayPalPlugin integrates PayPal as a payment provider into Vendure.
 *
 * Implemented use cases:
 *   UC1 — Standard Checkout (Immediate Capture)
 *   UC2 — Authorize-then-Capture
 *   UC3 — Payment Cancellation / Void
 *   UC4 — Full Refund
 *   UC5 — Partial Refund
 *   UC6 — Subscription Billing (Recurring Payments)
 *   UC7 — Transaction Reporting (search + account balances)
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [PayPalSubscription],
    providers: [PayPalService, PayPalSubscriptionService, PayPalReportingService],
    shopApiExtensions: {
        schema: shopApiExtensions,
        resolvers: [PayPalShopResolver],
    },
    adminApiExtensions: {
        schema: adminApiExtensions,
        resolvers: [PayPalAdminResolver],
    },
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentHandler);
        return config;
    },
})
export class PayPalPlugin {}
