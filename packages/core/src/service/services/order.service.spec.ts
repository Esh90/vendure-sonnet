import { describe, expect, it, vi } from 'vitest';

import { RequestContext } from '../../api/common/request-context';
import { Order } from '../../entity/order/order.entity';

import { OrderService } from './order.service';

describe('OrderService', () => {
    it('normalizes nested line product variant relations', () => {
        const service = Object.create(OrderService.prototype) as OrderService & {
            normalizeOrderRelations: (relations: string[]) => string[];
        };

        const relations = service.normalizeOrderRelations([
            'lines',
            'lines.productVariant.productVariantPrices',
        ]);

        expect(relations).toEqual(
            expect.arrayContaining([
                'lines',
                'lines.productVariant',
                'lines.productVariant.taxCategory',
                'lines.productVariant.productVariantPrices',
                'lines.productVariant.translations',
            ]),
        );
        expect(new Set(relations).size).toBe(relations.length);
    });

    it('normalizes nested line product relations', () => {
        const service = Object.create(OrderService.prototype) as OrderService & {
            normalizeOrderRelations: (relations: string[]) => string[];
        };

        const relations = service.normalizeOrderRelations(['lines', 'lines.productVariant.product']);

        expect(relations).toEqual(
            expect.arrayContaining([
                'lines',
                'lines.productVariant',
                'lines.productVariant.taxCategory',
                'lines.productVariant.translations',
                'lines.productVariant.product',
                'lines.productVariant.product.translations',
            ]),
        );
        expect(new Set(relations).size).toBe(relations.length);
    });

    it('includes line product variant translations in getOrderOrThrow defaults', async () => {
        const service = Object.create(OrderService.prototype) as OrderService & {
            findOne: ReturnType<typeof vi.fn>;
            getOrderOrThrow: (ctx: RequestContext, orderId: string) => Promise<Order>;
        };
        const ctx = RequestContext.empty();
        const order = new Order();
        service.findOne = vi.fn().mockResolvedValue(order);

        const result = await service.getOrderOrThrow(ctx, '1');

        expect(result).toBe(order);
        expect(service.findOne).toHaveBeenCalledWith(ctx, '1', [
            'lines',
            'lines.productVariant',
            'lines.productVariant.productVariantPrices',
            'lines.productVariant.translations',
            'shippingLines',
            'surcharges',
            'customer',
        ]);
    });
});
