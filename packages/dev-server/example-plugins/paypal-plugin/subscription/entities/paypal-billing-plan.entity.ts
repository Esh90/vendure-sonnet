import { VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';
import type { PayPalBillingPlanStatus, PayPalSubscriptionIntervalUnit } from '../../types';

@Entity()
export class PayPalBillingPlan extends VendureEntity {
    constructor(input?: Partial<PayPalBillingPlan>) {
        super(input);
        if (input) Object.assign(this, input);
    }

    /** The PayPal plan ID returned by the Billing Plans API (e.g. "P-XXXXXXXX"). */
    @Column({ unique: true })
    paypalPlanId: string;

    /** The PayPal product ID this plan belongs to. */
    @Column()
    paypalProductId: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    /** CREATED | INACTIVE | ACTIVE */
    @Column({ default: 'CREATED' })
    status: PayPalBillingPlanStatus;

    /** Recurring charge in the smallest currency unit (e.g. cents). */
    @Column()
    amount: number;

    @Column({ length: 3 })
    currencyCode: string;

    /** DAY | WEEK | MONTH | YEAR */
    @Column()
    intervalUnit: PayPalSubscriptionIntervalUnit;

    /** How many intervalUnits between each billing cycle (e.g. 1 for monthly). */
    @Column({ default: 1 })
    intervalCount: number;

    /**
     * Number of consecutive failed payments before PayPal suspends the subscription.
     * 0 = no automatic retry; max 999.
     */
    @Column({ default: 3 })
    paymentFailureThreshold: number;
}
