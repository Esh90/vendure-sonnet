import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PayPalService } from '../paypal.service';
import { PayPalSubscriptionService } from '../subscription/paypal-subscription.service';

@Resolver()
export class PayPalShopResolver {
    constructor(
        private readonly paypalService: PayPalService,
        private readonly subscriptionService: PayPalSubscriptionService,
    ) {}

    /**
     * Creates a PayPal order for the caller's active cart and returns the PayPal order ID
     * along with the buyer-approval URL.
     *
     * The storefront must redirect (or open a popup) to `approvalUrl` so the buyer can
     * approve the payment on PayPal.  Once approved, call `addPaymentToOrder` with
     * `method: 'paypal-payment-handler'` and `metadata: { paypalOrderId }`.
     */
    @Mutation()
    @Allow(Permission.Owner)
    createPayPalOrder(@Ctx() ctx: RequestContext) {
        return this.paypalService.createPayPalOrder(ctx);
    }

    /**
     * UC2 — Creates a PayPal order with AUTHORIZE intent.
     * After buyer approval, call `addPaymentToOrder` with
     * `metadata: { paypalOrderId, intent: 'AUTHORIZE' }`.
     * The payment will be in 'Authorized' state until the merchant captures it.
     */
    @Mutation()
    @Allow(Permission.Owner)
    createPayPalOrderForAuthorization(@Ctx() ctx: RequestContext) {
        return this.paypalService.createPayPalOrderForAuthorization(ctx);
    }

    /**
     * UC6 — Initiates a recurring PayPal subscription for the logged-in customer.
     * Returns the PayPal subscription ID and the buyer-approval URL.
     * After buyer approves, PayPal auto-bills on each cycle.
     */
    @Mutation()
    @Allow(Permission.Owner)
    createPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() { planId }: { planId: string },
    ) {
        return this.subscriptionService.createSubscription(ctx, planId);
    }

    /**
     * UC6 — Allows the logged-in customer to cancel their own subscription.
     */
    @Mutation()
    @Allow(Permission.Owner)
    async cancelMyPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() { subscriptionId, reason }: { subscriptionId: string; reason?: string },
    ): Promise<boolean> {
        await this.subscriptionService.cancelSubscription(ctx, subscriptionId, reason);
        return true;
    }
}
