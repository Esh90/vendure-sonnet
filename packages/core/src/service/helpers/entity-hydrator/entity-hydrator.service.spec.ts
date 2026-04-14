import { LanguageCode } from '@vendure/common/lib/generated-types';
import { describe, expect, it } from 'vitest';

import { VendureEntity } from '../../../entity/base/base.entity';
import { OrderLine } from '../../../entity/order-line/order-line.entity';
import { Order } from '../../../entity/order/order.entity';
import { ProductVariantTranslation } from '../../../entity/product-variant/product-variant-translation.entity';
import { ProductVariant } from '../../../entity/product-variant/product-variant.entity';
import { Product } from '../../../entity/product/product.entity';

import { HydrateOptions } from './entity-hydrator-types';
import { EntityHydrator } from './entity-hydrator.service';

describe('EntityHydrator', () => {
    function getMissingRelations<Entity extends VendureEntity>(target: Entity, relations: string[]) {
        const hydrator = Object.create(EntityHydrator.prototype) as EntityHydrator & {
            getMissingRelations: (target: Entity, options: HydrateOptions<Entity>) => string[];
        };

        return hydrator.getMissingRelations(target, {
            relations: relations as HydrateOptions<Entity>['relations'],
        });
    }

    it('preserves nested relation paths on bare entities when a top-level relation is missing', () => {
        const product = new Product();

        expect(getMissingRelations(product, ['facetValues.facet'])).toEqual([
            'facetValues',
            'facetValues.facet',
        ]);
    });

    it('preserves the full nested order line relation path when an intermediate relation is missing', () => {
        const order = new Order({
            lines: [new OrderLine()],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([
            'lines',
            'lines.productVariant',
            'lines.productVariant.translations',
        ]);
    });

    it('detects missing nested relations on later array elements', () => {
        const order = new Order({
            lines: [
                new OrderLine({
                    productVariant: new ProductVariant({
                        translations: [
                            new ProductVariantTranslation({
                                languageCode: LanguageCode.en,
                                name: 'Loaded variant',
                            }),
                        ],
                    }),
                }),
                new OrderLine({
                    productVariant: new ProductVariant(),
                }),
            ],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([
            'lines',
            'lines.productVariant',
            'lines.productVariant.translations',
        ]);
    });

    it('stops traversing sibling array elements after finding a missing relation', () => {
        let secondLineChecked = false;
        const secondLine = new OrderLine();
        Object.defineProperty(secondLine, 'productVariant', {
            configurable: true,
            get: () => {
                secondLineChecked = true;
                return new ProductVariant({
                    translations: [
                        new ProductVariantTranslation({
                            languageCode: LanguageCode.en,
                            name: 'Loaded variant',
                        }),
                    ],
                });
            },
        });

        const order = new Order({
            lines: [new OrderLine(), secondLine],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([
            'lines',
            'lines.productVariant',
            'lines.productVariant.translations',
        ]);
        expect(secondLineChecked).toBe(false);
    });

    it('does not mark nested relations on empty loaded arrays as missing', () => {
        const order = new Order({
            lines: [],
        });

        expect(getMissingRelations(order, ['lines.productVariant.translations'])).toEqual([]);
    });
});
