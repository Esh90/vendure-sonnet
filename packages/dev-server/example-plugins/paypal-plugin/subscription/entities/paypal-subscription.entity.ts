import { VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import type { PayPalSubscriptionStatus } from '../../types';

@Entity()
export class PayPalSubscription extends VendureEntity {
    constructor(input?: Partial<PayPalSubscription>) {
        super(input);
        if (input) Object.assign(this, input);
    }

    /** The PayPal subscription ID (e.g. "I-XXXXXXXX"). */
    @Column({ unique: true })
    paypalSubscriptionId: string;

    /** The PayPal billing plan ID associated with this subscription. */
    @Column()
    paypalPlanId: string;

    /** Vendure customer ID — kept as a bare string to avoid a hard foreign-key dependency. */
    @Column()
    vendureCustomerId: string;

    /**
     * APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
     * Mirrors PayPal's subscription lifecycle.
     */
    @Column({ default: 'APPROVAL_PENDING' })
    status: PayPalSubscriptionStatus;

    /**
     * Buyer-approval URL (rel: "approve" from PayPal's response).
     * The customer must visit this URL once to activate the subscription.
     */
    @Column({ nullable: true })
    approvalUrl: string;

    /** ISO 8601 timestamp when the subscription should start billing. */
    @Column({ nullable: true })
    startTime: string;

    /** Subscriber's email address as reported by PayPal. */
    @Column({ nullable: true })
    subscriberEmail: string;

    /** ISO 8601 timestamp of the next scheduled billing date. Refreshed on sync. */
    @Column({ nullable: true })
    nextBillingTime: string;

    /** Number of consecutive failed payments reported by PayPal billing_info. */
    @Column({ default: 0 })
    failedPaymentsCount: number;
}
