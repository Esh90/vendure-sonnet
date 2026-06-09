import { Injectable } from '@nestjs/common';
import { IntervalUnit, TenureType } from '@paypal/paypal-server-sdk';
import {
    CustomerService,
    ID,
    Logger,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { getSubscriptionsController } from '../paypal-client';
import { PayPalSubscription } from './paypal-subscription.entity';

const loggerCtx = 'PayPalSubscriptionService';

export interface CreateBillingPlanInput {
    /** PayPal product ID (create one once in the PayPal dashboard or via the Products API) */
    productId: string;
    name: string;
    description?: string;
    /** Recurring price as a decimal string, e.g. "9.99" */
    price: string;
    /** ISO-4217 currency code, e.g. "USD" */
    currencyCode: string;
    /** DAY | WEEK | MONTH | YEAR */
    intervalUnit: string;
    /** How many interval units between charges, e.g. 1 for monthly */
    intervalCount: number;
    /** Number of billing cycles before the plan ends; 0 = infinite (default) */
    totalCycles?: number;
}

@Injectable()
export class PayPalSubscriptionService {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly customerService: CustomerService,
    ) {}

    // ── Merchant: Plan management ────────────────────────────────────────────

    /**
     * Creates a PayPal billing plan. Returns the new plan ID and status.
     * After creation the plan is in INACTIVE status — call activateBillingPlan next.
     */
    async createBillingPlan(
        input: CreateBillingPlanInput,
    ): Promise<{ planId: string; name: string; status: string }> {
        const ctrl = getSubscriptionsController();

        const intervalUnit = input.intervalUnit.toUpperCase() as IntervalUnit;

        const response = await ctrl.createBillingPlan({
            prefer: 'return=representation',
            body: {
                productId: input.productId,
                name: input.name,
                description: input.description,
                billingCycles: [
                    {
                        frequency: {
                            intervalUnit,
                            intervalCount: input.intervalCount,
                        },
                        tenureType: TenureType.Regular,
                        sequence: 1,
                        totalCycles: input.totalCycles ?? 0,
                        pricingScheme: {
                            fixedPrice: {
                                value: input.price,
                                currencyCode: input.currencyCode,
                            },
                        },
                    },
                ],
                paymentPreferences: {
                    autoBillOutstanding: true,
                    paymentFailureThreshold: 3,
                },
            },
        });

        const plan = response.result;
        if (!plan?.id) {
            throw new Error('PayPal did not return a plan ID after createBillingPlan.');
        }

        Logger.info(`PayPal billing plan created. Plan ID: ${plan.id}, Name: ${plan.name}`, loggerCtx);
        return { planId: plan.id, name: plan.name ?? input.name, status: plan.status ?? 'INACTIVE' };
    }

    /**
     * Activates an INACTIVE PayPal billing plan so customers can subscribe to it.
     */
    async activateBillingPlan(planId: string): Promise<void> {
        const ctrl = getSubscriptionsController();
        await ctrl.activateBillingPlan(planId);
        Logger.info(`PayPal billing plan activated. Plan ID: ${planId}`, loggerCtx);
    }

    // ── Customer: Subscription lifecycle ────────────────────────────────────

    /**
     * Creates a PayPal subscription for the logged-in customer and persists it
     * locally. Returns the PayPal subscription ID and the buyer-approval URL.
     */
    async createSubscription(
        ctx: RequestContext,
        planId: string,
    ): Promise<{ subscriptionId: string; approvalUrl: string }> {
        if (!ctx.session?.user?.id) {
            throw new UserInputError('You must be logged in to create a subscription.');
        }

        const customer = await this.customerService.findOneByUserId(ctx, ctx.session.user.id);
        if (!customer) {
            throw new UserInputError('No customer account found for the current user.');
        }

        const returnUrl =
            process.env.PAYPAL_SUBSCRIPTION_RETURN_URL ??
            'http://localhost:3000/subscription/paypal-return';
        const cancelUrl =
            process.env.PAYPAL_SUBSCRIPTION_CANCEL_URL ??
            'http://localhost:3000/subscription/paypal-cancel';

        const ctrl = getSubscriptionsController();

        const response = await ctrl.createSubscription({
            prefer: 'return=representation',
            body: {
                planId,
                applicationContext: {
                    returnUrl,
                    cancelUrl,
                },
                customId: String(customer.id),
            },
        });

        const sub = response.result;
        if (!sub?.id) {
            throw new Error('PayPal did not return a subscription ID after createSubscription.');
        }

        const approvalLink = sub.links?.find(
            link => link.rel === 'approve' || link.rel === 'payer-action',
        );
        if (!approvalLink?.href) {
            throw new Error('PayPal subscription created but no buyer-approval URL was returned.');
        }

        // Persist locally so we can query and manage subscriptions from the admin panel
        // Newly-created subscriptions are always APPROVAL_PENDING until the buyer
        // approves on PayPal. The SDK's Subscription type omits the status field
        // even though the API returns it, so we hardcode the known initial state.
        const entity = new PayPalSubscription({
            paypalSubscriptionId: sub.id,
            paypalPlanId: planId,
            status: 'APPROVAL_PENDING',
            approvalUrl: approvalLink.href,
            customerId: customer.id,
        });
        await this.connection.getRepository(ctx, PayPalSubscription).save(entity);

        Logger.info(
            `PayPal subscription created. Sub ID: ${sub.id}, Customer: ${customer.id}`,
            loggerCtx,
        );

        return { subscriptionId: sub.id, approvalUrl: approvalLink.href };
    }

    /**
     * Cancels a PayPal subscription on PayPal and marks it CANCELLED locally.
     */
    async cancelSubscription(
        ctx: RequestContext,
        subscriptionId: string,
        reason?: string,
    ): Promise<void> {
        const ctrl = getSubscriptionsController();
        await ctrl.cancelSubscription({
            id: subscriptionId,
            body: reason ? { reason } : undefined,
        });

        await this.connection
            .getRepository(ctx, PayPalSubscription)
            .update({ paypalSubscriptionId: subscriptionId }, { status: 'CANCELLED', approvalUrl: null });

        Logger.info(`PayPal subscription cancelled. Sub ID: ${subscriptionId}`, loggerCtx);
    }

    /**
     * Captures an outstanding subscription payment (used to retry after a failed charge).
     * Reactivates a SUSPENDED subscription and captures the outstanding balance.
     */
    async captureSubscriptionPayment(
        ctx: RequestContext,
        subscriptionId: string,
    ): Promise<void> {
        const ctrl = getSubscriptionsController();

        // Reactivate the suspended subscription first
        await ctrl.activateSubscription({
            id: subscriptionId,
            body: { reason: 'Manual retry by merchant' },
        });

        // Capture the outstanding payment
        await ctrl.captureSubscription({ id: subscriptionId });

        await this.connection
            .getRepository(ctx, PayPalSubscription)
            .update({ paypalSubscriptionId: subscriptionId }, { status: 'ACTIVE' });

        Logger.info(
            `PayPal subscription payment captured (retry). Sub ID: ${subscriptionId}`,
            loggerCtx,
        );
    }

    // ── Admin: Reporting ────────────────────────────────────────────────────

    /**
     * Returns all locally-stored subscription records (for the admin panel).
     */
    async listSubscriptions(ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.connection
            .getRepository(ctx, PayPalSubscription)
            .find({ order: { createdAt: 'DESC' } });
    }
}
