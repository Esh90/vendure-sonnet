import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import {
    EventBus,
    FulfillmentStateTransitionEvent,
    Logger,
    Order,
    TransactionalConnection,
} from '@vendure/core';
import { filter } from 'rxjs/operators';
import { PAYPAL_PAYMENT_HANDLER_CODE, loggerCtx } from '../constants';
import { getPayPalClient } from '../service/paypal-client';
import type { PayPalTrackerInput } from '../types';

/**
 * Maps common shipping carrier names (case-insensitive) to PayPal carrier codes.
 * Returns { carrier: 'OTHER', carrierNameOther: <original> } for unrecognised carriers
 * so PayPal still receives the name in a human-readable form.
 */
function mapToPayPalCarrier(method: string): Pick<PayPalTrackerInput, 'carrier' | 'carrierNameOther'> {
    const KNOWN: Record<string, string> = {
        fedex: 'FEDEX',
        ups: 'UPS',
        usps: 'USPS',
        dhl: 'DHL',
        tnt: 'TNT',
        aramex: 'ARAMEX',
        purolator: 'PUROLATOR',
        'canada post': 'CANADA_POST',
        canadapost: 'CANADA_POST',
        'royal mail': 'ROYAL_MAIL',
        royalmail: 'ROYAL_MAIL',
        'australia post': 'AUSTRALIA_POST',
        australiapost: 'AUSTRALIA_POST',
        dpd: 'DPD',
        gls: 'GLS',
        hermes: 'HERMES',
        ontrac: 'ONTRAC',
        lasership: 'LASER_SHIP',
        'laser ship': 'LASER_SHIP',
    };

    const normalized = method.trim().toLowerCase();
    const code = KNOWN[normalized];
    if (code) return { carrier: code };
    return { carrier: 'OTHER', carrierNameOther: method };
}

@Injectable()
export class PayPalTrackingSubscriber implements OnApplicationBootstrap {
    constructor(
        private readonly eventBus: EventBus,
        private readonly connection: TransactionalConnection,
    ) {}

    onApplicationBootstrap(): void {
        this.eventBus
            .ofType(FulfillmentStateTransitionEvent)
            .pipe(filter(event => event.toState === 'Shipped'))
            .subscribe(event => {
                this.pushTrackingToPayPal(event).catch((err: unknown) => {
                    Logger.error(
                        `PayPal tracking push failed for fulfillment ${event.fulfillment.id}: ` +
                            `${err instanceof Error ? err.message : String(err)}`,
                        loggerCtx,
                    );
                });
            });
    }

    private async pushTrackingToPayPal(event: FulfillmentStateTransitionEvent): Promise<void> {
        const { fulfillment } = event;

        if (!fulfillment.trackingCode) {
            Logger.verbose(
                `Fulfillment ${fulfillment.id} has no tracking code — skipping PayPal tracking push.`,
                loggerCtx,
            );
            return;
        }

        // Find all orders linked to this fulfillment with their payments loaded.
        // We query through rawConnection to avoid channel-scoping issues on the
        // join table that links orders to fulfillments.
        const orders = await this.connection.rawConnection
            .createQueryBuilder(Order, 'order')
            .innerJoin('order.fulfillments', 'fulfillment', 'fulfillment.id = :fid', {
                fid: fulfillment.id,
            })
            .leftJoinAndSelect('order.payments', 'payment')
            .getMany();

        if (!orders.length) {
            Logger.warn(
                `No orders found for fulfillment ${fulfillment.id} — skipping PayPal tracking push.`,
                loggerCtx,
            );
            return;
        }

        const client = getPayPalClient();
        const carrierFields = mapToPayPalCarrier(fulfillment.method ?? '');

        for (const order of orders) {
            // Find the first settled PayPal payment that has a capture ID.
            const paypalPayment = order.payments?.find(
                p =>
                    p.method === PAYPAL_PAYMENT_HANDLER_CODE &&
                    p.state === 'Settled' &&
                    (p.metadata?.captureId || p.transactionId),
            );

            if (!paypalPayment) {
                Logger.verbose(
                    `Order ${order.code} has no settled PayPal payment — skipping tracking push.`,
                    loggerCtx,
                );
                continue;
            }

            // For CAPTURE payments captureId === payment.transactionId.
            // For AUTHORIZE→CAPTURE payments captureId is written to metadata by settlePayment.
            const captureId =
                (paypalPayment.metadata?.captureId as string | undefined) ??
                paypalPayment.transactionId;

            const tracker: PayPalTrackerInput = {
                transactionId: captureId,
                trackingNumber: fulfillment.trackingCode,
                status: 'SHIPPED',
                ...carrierFields,
            };

            await client.addTrackingInfo([tracker]);

            Logger.info(
                `PayPal tracking pushed for order ${order.code} — ` +
                    `carrier: ${carrierFields.carrier}, tracking: ${fulfillment.trackingCode}`,
                loggerCtx,
            );
        }
    }
}
