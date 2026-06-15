import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';
import { PayPalBillingPlan } from '../subscription/entities/paypal-billing-plan.entity';
import { PayPalSubscription } from '../subscription/entities/paypal-subscription.entity';
import {
    CreateBillingPlanInput,
    PayPalSubscriptionService,
} from '../subscription/service/paypal-subscription.service';
import type { PayPalSubscriptionIntervalUnit } from '../types';

// ─── Return types ─────────────────────────────────────────────────────────────

interface BillingPlanResult {
    id: string;
    paypalPlanId: string;
    paypalProductId: string;
    name: string;
    description: string | null;
    status: string;
    amount: number;
    currencyCode: string;
    intervalUnit: string;
    intervalCount: number;
    paymentFailureThreshold: number;
}

interface SubscriptionAdminResult {
    id: string;
    paypalSubscriptionId: string;
    paypalPlanId: string;
    vendureCustomerId: string;
    status: string;
    approvalUrl: string | null;
    subscriberEmail: string | null;
    nextBillingTime: string | null;
    failedPaymentsCount: number;
}

function mapPlan(plan: PayPalBillingPlan): BillingPlanResult {
    return {
        id: String(plan.id),
        paypalPlanId: plan.paypalPlanId,
        paypalProductId: plan.paypalProductId,
        name: plan.name,
        description: plan.description || null,
        status: plan.status,
        amount: plan.amount,
        currencyCode: plan.currencyCode,
        intervalUnit: plan.intervalUnit,
        intervalCount: plan.intervalCount,
        paymentFailureThreshold: plan.paymentFailureThreshold,
    };
}

function mapSubscription(sub: PayPalSubscription): SubscriptionAdminResult {
    return {
        id: String(sub.id),
        paypalSubscriptionId: sub.paypalSubscriptionId,
        paypalPlanId: sub.paypalPlanId,
        vendureCustomerId: sub.vendureCustomerId,
        status: sub.status,
        approvalUrl: sub.approvalUrl || null,
        subscriberEmail: sub.subscriberEmail || null,
        nextBillingTime: sub.nextBillingTime || null,
        failedPaymentsCount: sub.failedPaymentsCount,
    };
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

@Resolver()
export class PayPalAdminResolver {
    constructor(private readonly subscriptionService: PayPalSubscriptionService) {}

    // ── Queries ────────────────────────────────────────────────────────────────

    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalBillingPlans(@Ctx() ctx: RequestContext): Promise<BillingPlanResult[]> {
        const plans = await this.subscriptionService.getBillingPlans(ctx);
        return plans.map(mapPlan);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<BillingPlanResult | null> {
        const plan = await this.subscriptionService.getBillingPlanById(ctx, args.id);
        return plan ? mapPlan(plan) : null;
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalSubscriptions(@Ctx() ctx: RequestContext): Promise<SubscriptionAdminResult[]> {
        const subs = await this.subscriptionService.getSubscriptions(ctx);
        return subs.map(mapSubscription);
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SubscriptionAdminResult | null> {
        const sub = await this.subscriptionService.getSubscriptionById(ctx, args.id);
        return sub ? mapSubscription(sub) : null;
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async createPaypalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args()
        args: {
            name: string;
            description?: string;
            amount: number;
            currencyCode: string;
            intervalUnit: string;
            intervalCount?: number;
            paymentFailureThreshold?: number;
        },
    ): Promise<BillingPlanResult> {
        const input: CreateBillingPlanInput = {
            name: args.name,
            description: args.description,
            amount: args.amount,
            currencyCode: args.currencyCode,
            intervalUnit: args.intervalUnit as PayPalSubscriptionIntervalUnit,
            intervalCount: args.intervalCount,
            paymentFailureThreshold: args.paymentFailureThreshold,
        };
        const plan = await this.subscriptionService.createBillingPlan(ctx, input);
        return mapPlan(plan);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async activatePaypalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<BillingPlanResult> {
        const plan = await this.subscriptionService.activateBillingPlan(ctx, args.id);
        return mapPlan(plan);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async updatePaypalBillingPlanThreshold(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; paymentFailureThreshold: number },
    ): Promise<BillingPlanResult> {
        const plan = await this.subscriptionService.updateBillingPlanThreshold(
            ctx,
            args.id,
            args.paymentFailureThreshold,
        );
        return mapPlan(plan);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async syncPaypalSubscriptionAdmin(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string },
    ): Promise<SubscriptionAdminResult> {
        const sub = await this.subscriptionService.syncSubscription(ctx, args.id);
        return mapSubscription(sub);
    }

    @Mutation()
    @Allow(Permission.SuperAdmin)
    async cancelPaypalSubscriptionAdmin(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: string; reason: string },
    ): Promise<SubscriptionAdminResult> {
        const sub = await this.subscriptionService.cancelSubscription(ctx, args.id, args.reason);
        return mapSubscription(sub);
    }
}
