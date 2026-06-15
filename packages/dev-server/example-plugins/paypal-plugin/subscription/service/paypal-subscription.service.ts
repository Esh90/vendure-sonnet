import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { ID, Logger, RequestContext, TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
import { loggerCtx } from '../../constants';
import { getPayPalClient } from '../../service/paypal-client';
import type {
    PatchOperation,
    PayPalBillingPlanStatus,
    PayPalSubscriptionIntervalUnit,
    PayPalSubscriptionStatus,
} from '../../types';
import { PayPalBillingPlan } from '../entities/paypal-billing-plan.entity';
import { PayPalSubscription } from '../entities/paypal-subscription.entity';

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateBillingPlanInput {
    name: string;
    description?: string;
    amount: number;
    currencyCode: string;
    intervalUnit: PayPalSubscriptionIntervalUnit;
    intervalCount?: number;
    paymentFailureThreshold?: number;
}

export interface CreateSubscriptionInput {
    planId: ID;
    returnUrl?: string;
    cancelUrl?: string;
    startTime?: string;
    subscriberEmail?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PayPalSubscriptionService {
    constructor(private readonly connection: TransactionalConnection) {}

    // ─── Billing Plans ──────────────────────────────────────────────────────

    /**
     * Creates a PayPal Catalog Product and Billing Plan, then persists a local
     * `PayPalBillingPlan` entity that mirrors the remote state.
     */
    async createBillingPlan(
        ctx: RequestContext,
        input: CreateBillingPlanInput,
    ): Promise<PayPalBillingPlan> {
        const client = getPayPalClient();
        const repo = this.connection.getRepository(ctx, PayPalBillingPlan);

        const { productId } = await client.createProduct(input.name, input.description);

        const { planId, status } = await client.createBillingPlan({
            productId,
            name: input.name,
            description: input.description,
            amount: input.amount,
            currencyCode: input.currencyCode,
            intervalUnit: input.intervalUnit,
            intervalCount: input.intervalCount ?? 1,
            paymentFailureThreshold: input.paymentFailureThreshold ?? 3,
        });

        const plan = repo.create({
            paypalPlanId: planId,
            paypalProductId: productId,
            name: input.name,
            description: input.description ?? '',
            status: status as PayPalBillingPlanStatus,
            amount: input.amount,
            currencyCode: input.currencyCode.toUpperCase(),
            intervalUnit: input.intervalUnit,
            intervalCount: input.intervalCount ?? 1,
            paymentFailureThreshold: input.paymentFailureThreshold ?? 3,
        });

        const saved = await repo.save(plan);
        Logger.info(`Billing plan ${planId} saved locally (id: ${saved.id})`, loggerCtx);
        return saved;
    }

    async getBillingPlans(ctx: RequestContext): Promise<PayPalBillingPlan[]> {
        return this.connection.getRepository(ctx, PayPalBillingPlan).find();
    }

    async getBillingPlanById(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan | null> {
        return this.connection
            .getRepository(ctx, PayPalBillingPlan)
            .findOne({ where: { id: id as string } });
    }

    /**
     * Activates an INACTIVE billing plan on PayPal and updates the local record.
     */
    async activateBillingPlan(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan> {
        const repo = this.connection.getRepository(ctx, PayPalBillingPlan);
        const plan = await repo.findOne({ where: { id: id as string } });
        if (!plan) throw new Error(`Billing plan ${id} not found`);

        await getPayPalClient().activateBillingPlan(plan.paypalPlanId);
        plan.status = 'ACTIVE';
        return repo.save(plan);
    }

    /**
     * Updates numeric/string fields on a billing plan via PayPal PATCH + local DB.
     * Only `paymentFailureThreshold` is patchable via this helper.
     */
    async updateBillingPlanThreshold(
        ctx: RequestContext,
        id: ID,
        paymentFailureThreshold: number,
    ): Promise<PayPalBillingPlan> {
        const repo = this.connection.getRepository(ctx, PayPalBillingPlan);
        const plan = await repo.findOne({ where: { id: id as string } });
        if (!plan) throw new Error(`Billing plan ${id} not found`);

        const patches: PatchOperation[] = [
            {
                op: 'replace',
                path: '/payment_preferences/payment_failure_threshold',
                value: paymentFailureThreshold,
            },
        ];

        await getPayPalClient().updateBillingPlan(plan.paypalPlanId, patches);
        plan.paymentFailureThreshold = paymentFailureThreshold;
        return repo.save(plan);
    }

    // ─── Subscriptions ───────────────────────────────────────────────────────

    /**
     * Creates a PayPal Subscription for the given billing plan.
     * The customer must be redirected to the returned approvalUrl to activate it.
     */
    async createSubscription(
        ctx: RequestContext,
        input: CreateSubscriptionInput,
    ): Promise<PayPalSubscription> {
        const client = getPayPalClient();
        const planRepo = this.connection.getRepository(ctx, PayPalBillingPlan);
        const subRepo = this.connection.getRepository(ctx, PayPalSubscription);

        const plan = await planRepo.findOne({ where: { id: input.planId as string } });
        if (!plan) throw new Error(`Billing plan ${input.planId} not found`);
        if (plan.status !== 'ACTIVE') {
            throw new Error(
                `Cannot create subscription: billing plan ${plan.paypalPlanId} is not ACTIVE (status: ${plan.status}).`,
            );
        }

        const customerId = ctx.activeUserId
            ? String(ctx.activeUserId)
            : ctx.channelId
            ? String(ctx.channelId)
            : 'anonymous';

        const { subscriptionId, status, approvalUrl } = await client.createSubscription({
            planId: plan.paypalPlanId,
            returnUrl: input.returnUrl ?? '',
            cancelUrl: input.cancelUrl ?? input.returnUrl ?? '',
            subscriberEmail: input.subscriberEmail,
            startTime: input.startTime,
        });

        const sub = subRepo.create({
            paypalSubscriptionId: subscriptionId,
            paypalPlanId: plan.paypalPlanId,
            vendureCustomerId: customerId,
            status: status as PayPalSubscriptionStatus,
            approvalUrl,
            startTime: input.startTime ?? '',
            subscriberEmail: input.subscriberEmail ?? '',
            nextBillingTime: '',
            failedPaymentsCount: 0,
        });

        const saved = await subRepo.save(sub);
        Logger.info(`Subscription ${subscriptionId} saved locally (id: ${saved.id})`, loggerCtx);
        return saved;
    }

    async getSubscriptions(ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.connection.getRepository(ctx, PayPalSubscription).find();
    }

    async getSubscriptionById(ctx: RequestContext, id: ID): Promise<PayPalSubscription | null> {
        return this.connection
            .getRepository(ctx, PayPalSubscription)
            .findOne({ where: { id: id as string } });
    }

    /**
     * Syncs the subscription status from PayPal and updates the local record.
     * Call this after the buyer returns from the PayPal approval page.
     */
    async syncSubscription(ctx: RequestContext, id: ID): Promise<PayPalSubscription> {
        const repo = this.connection.getRepository(ctx, PayPalSubscription);
        const sub = await repo.findOne({ where: { id: id as string } });
        if (!sub) throw new Error(`Subscription ${id} not found`);

        const remote = await getPayPalClient().getSubscription(sub.paypalSubscriptionId);
        sub.status = remote.status as PayPalSubscriptionStatus;
        sub.subscriberEmail = remote.subscriberEmail ?? sub.subscriberEmail;
        sub.nextBillingTime = remote.nextBillingTime ?? sub.nextBillingTime;
        sub.failedPaymentsCount = remote.failedPaymentsCount;

        return repo.save(sub);
    }

    /**
     * Cancels an ACTIVE or SUSPENDED subscription on PayPal and marks it locally.
     */
    async cancelSubscription(
        ctx: RequestContext,
        id: ID,
        reason: string,
    ): Promise<PayPalSubscription> {
        const repo = this.connection.getRepository(ctx, PayPalSubscription);
        const sub = await repo.findOne({ where: { id: id as string } });
        if (!sub) throw new Error(`Subscription ${id} not found`);
        if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
            throw new Error(
                `Subscription ${sub.paypalSubscriptionId} is already ${sub.status}. Cannot cancel.`,
            );
        }

        await getPayPalClient().cancelSubscription(sub.paypalSubscriptionId, reason);
        sub.status = 'CANCELLED';
        return repo.save(sub);
    }
}
