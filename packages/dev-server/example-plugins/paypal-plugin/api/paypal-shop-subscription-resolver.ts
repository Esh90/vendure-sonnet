import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext } from '@vendure/core';
import { PayPalSubscription } from '../subscription/entities/paypal-subscription.entity';
import {
    CreateSubscriptionInput,
    PayPalSubscriptionService,
} from '../subscription/service/paypal-subscription.service';

interface CreateSubscriptionArgs {
    planId: string;
    returnUrl?: string;
    cancelUrl?: string;
    startTime?: string;
    subscriberEmail?: string;
}

interface SubscriptionResult {
    id: string;
    paypalSubscriptionId: string;
    paypalPlanId: string;
    status: string;
    approvalUrl: string | null;
    subscriberEmail: string | null;
    nextBillingTime: string | null;
    failedPaymentsCount: number;
}

function mapSubscription(sub: PayPalSubscription): SubscriptionResult {
    return {
        id: String(sub.id),
        paypalSubscriptionId: sub.paypalSubscriptionId,
        paypalPlanId: sub.paypalPlanId,
        status: sub.status,
        approvalUrl: sub.approvalUrl || null,
        subscriberEmail: sub.subscriberEmail || null,
        nextBillingTime: sub.nextBillingTime || null,
        failedPaymentsCount: sub.failedPaymentsCount,
    };
}

@Resolver()
export class PayPalShopSubscriptionResolver {
    constructor(private readonly subscriptionService: PayPalSubscriptionService) {}

    @Mutation()
    async createPaypalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: CreateSubscriptionArgs,
    ): Promise<SubscriptionResult> {
        const input: CreateSubscriptionInput = {
            planId: args.planId,
            returnUrl: args.returnUrl,
            cancelUrl: args.cancelUrl,
            startTime: args.startTime,
            subscriberEmail: args.subscriberEmail,
        };
        const sub = await this.subscriptionService.createSubscription(ctx, input);
        return mapSubscription(sub);
    }

    @Mutation()
    async syncPaypalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SubscriptionResult> {
        const sub = await this.subscriptionService.syncSubscription(ctx, args.id);
        return mapSubscription(sub);
    }

    @Mutation()
    async cancelPaypalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; reason: string },
    ): Promise<SubscriptionResult> {
        const sub = await this.subscriptionService.cancelSubscription(ctx, args.id, args.reason);
        return mapSubscription(sub);
    }
}
