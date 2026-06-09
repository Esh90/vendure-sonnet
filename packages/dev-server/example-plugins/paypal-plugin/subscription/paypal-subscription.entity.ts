import { DeepPartial, ID, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * Stores a PayPal subscription record alongside the Vendure customer it belongs to.
 * Created when a customer initiates a subscription; updated as its status changes.
 */
@Entity()
export class PayPalSubscription extends VendureEntity {
    constructor(input?: DeepPartial<PayPalSubscription>) {
        super(input);
    }

    @Column()
    paypalSubscriptionId!: string;

    @Column()
    paypalPlanId!: string;

    /** Mirrors the PayPal status: APPROVAL_PENDING, ACTIVE, SUSPENDED, CANCELLED, EXPIRED */
    @Column({ default: 'APPROVAL_PENDING' })
    status!: string;

    /** Buyer-approval URL — present while status is APPROVAL_PENDING, null once approved */
    @Column({ type: 'varchar', nullable: true })
    approvalUrl!: string | null;

    /** Vendure Customer ID who owns this subscription */
    @Column({ type: 'varchar' })
    customerId!: ID;
}
