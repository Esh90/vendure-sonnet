import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import {
    PayPalReportingService,
    TransactionSearchInput,
} from '../reporting/paypal-reporting.service';
import {
    CreateBillingPlanInput,
    PayPalSubscriptionService,
} from '../subscription/paypal-subscription.service';

@Resolver()
export class PayPalAdminResolver {
    constructor(
        private readonly subscriptionService: PayPalSubscriptionService,
        private readonly reportingService: PayPalReportingService,
    ) {}

    @Query()
    @Allow(Permission.ReadOrder)
    paypalSubscriptions(@Ctx() ctx: RequestContext) {
        return this.subscriptionService.listSubscriptions(ctx);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async createPayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() { input }: { input: CreateBillingPlanInput },
    ) {
        return this.subscriptionService.createBillingPlan(input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async activatePayPalBillingPlan(
        @Ctx() _ctx: RequestContext,
        @Args() { planId }: { planId: string },
    ): Promise<boolean> {
        await this.subscriptionService.activateBillingPlan(planId);
        return true;
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async cancelPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() { subscriptionId, reason }: { subscriptionId: string; reason?: string },
    ): Promise<boolean> {
        await this.subscriptionService.cancelSubscription(ctx, subscriptionId, reason);
        return true;
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async capturePayPalSubscriptionPayment(
        @Ctx() ctx: RequestContext,
        @Args() { subscriptionId }: { subscriptionId: string },
    ): Promise<boolean> {
        await this.subscriptionService.captureSubscriptionPayment(ctx, subscriptionId);
        return true;
    }

    // ── UC7 — Transaction Reporting ─────────────────────────────────────────

    @Query()
    @Allow(Permission.ReadOrder)
    paypalTransactions(
        @Args() { input }: { input: TransactionSearchInput },
    ) {
        return this.reportingService.searchTransactions(input);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    paypalBalances(
        @Args() { asOfTime, currencyCode }: { asOfTime?: string; currencyCode?: string },
    ) {
        return this.reportingService.getBalances(asOfTime, currencyCode);
    }
}
