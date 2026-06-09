import { Mutation, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PayPalService } from '../paypal.service';

@Resolver()
export class PayPalShopResolver {
    constructor(private readonly paypalService: PayPalService) {}

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
}
