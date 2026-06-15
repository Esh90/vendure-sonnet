import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, Logger, OrderService, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import { getPayPalClient } from '../service/paypal-client';

interface CreatePaypalOrderArgs {
    vendureOrderId: string;
    intent?: 'CAPTURE' | 'AUTHORIZE';
    returnUrl?: string;
    cancelUrl?: string;
}

interface CreatePaypalOrderResult {
    paypalOrderId: string;
    approvalUrl: string;
}

@Resolver()
export class PayPalShopResolver {
    constructor(private readonly orderService: OrderService) {}

    @Mutation()
    async createPaypalOrder(
        @Ctx() ctx: RequestContext,
        @Args() args: CreatePaypalOrderArgs,
    ): Promise<CreatePaypalOrderResult> {
        const { vendureOrderId, intent = 'CAPTURE', returnUrl, cancelUrl } = args;

        const order = await this.orderService.findOne(ctx, vendureOrderId);
        if (!order) {
            throw new Error(`Order with ID "${vendureOrderId}" was not found.`);
        }

        Logger.info(
            `Creating PayPal order for Vendure order ${order.code} ` +
                `(${order.totalWithTax} ${order.currencyCode}, intent: ${intent})`,
            loggerCtx,
        );

        const client = getPayPalClient();
        return client.createOrder(order.totalWithTax, order.currencyCode, returnUrl, cancelUrl, intent);
    }
}
