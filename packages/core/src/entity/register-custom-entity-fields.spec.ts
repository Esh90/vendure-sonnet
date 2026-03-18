import { getMetadataArgsStorage } from 'typeorm';
import { beforeEach, describe, expect, it } from 'vitest';

import { CustomFields } from '../config/custom-field/custom-field-types';
import { VendureConfig } from '../config/vendure-config';

import { Asset } from './asset/asset.entity';
import { registerCustomEntityFields } from './register-custom-entity-fields';

const SINGLE_RELATION_FIELD = '__testRelationOptionsSingle__';
const LIST_RELATION_FIELD = '__testRelationOptionsList__';
const NON_RELATION_FIELD = '__testRelationOptionsNonRelation__';

describe('registerCustomEntityFields() relation options', () => {
    beforeEach(() => {
        removeTestMetadata();
    });
    it('applies cascade/onDelete/onUpdate/eager on many-to-one relation custom fields', () => {
        registerCustomEntityFields(
            createConfig({
                Product: [
                    { name: NON_RELATION_FIELD, type: 'string' },
                    {
                        name: SINGLE_RELATION_FIELD,
                        type: 'relation',
                        entity: Asset,
                        cascade: true,
                        onDelete: 'SET NULL',
                        onUpdate: 'CASCADE',
                        eager: true,
                    },
                ],
            }),
        );

        const relation = getMetadataArgsStorage()
            .filterRelations(getProductCustomFieldsClass())
            .find(r => r.propertyName === SINGLE_RELATION_FIELD);

        expect(relation?.relationType).toBe('many-to-one');
        expect(relation?.options).toMatchObject({
            cascade: true,
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
            eager: true,
        });
    });

    it('applies cascade/onDelete/onUpdate/eager on many-to-many relation custom fields', () => {
        registerCustomEntityFields(
            createConfig({
                Product: [
                    { name: NON_RELATION_FIELD, type: 'string' },
                    {
                        name: LIST_RELATION_FIELD,
                        type: 'relation',
                        list: true,
                        entity: Asset,
                        cascade: ['insert', 'update'],
                        onDelete: 'CASCADE',
                        onUpdate: 'RESTRICT',
                        eager: false,
                    },
                ],
            }),
        );

        const relation = getMetadataArgsStorage()
            .filterRelations(getProductCustomFieldsClass())
            .find(r => r.propertyName === LIST_RELATION_FIELD);

        expect(relation?.relationType).toBe('many-to-many');
        expect(relation?.options).toMatchObject({
            cascade: ['insert', 'update'],
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
            eager: false,
        });
    });
});

function createConfig(customFields: CustomFields): VendureConfig {
    return {
        customFields,
        dbConnectionOptions: {
            type: 'sqlite',
        },
    } as VendureConfig;
}

function getProductCustomFieldsClass() {
    const customFieldsEmbedded = getMetadataArgsStorage().embeddeds.find(item => {
        if (item.propertyName !== 'customFields') {
            return false;
        }
        const targetName = typeof item.target === 'string' ? item.target : item.target.name;
        return targetName === 'Product';
    });
    if (!customFieldsEmbedded) {
        throw new Error('Could not find Product customFields embedded metadata');
    }
    const customFieldsClass = customFieldsEmbedded.type();
    if (typeof customFieldsClass === 'string') {
        throw new Error('Expected Product customFields embedded type to be a class');
    }
    return customFieldsClass;
}

/**
 * Removes the metadata added by the tests in this file, to prevent pollution of other tests which use the same entity.
 */
function removeTestMetadata() {
    const metadata = getMetadataArgsStorage();
    const fieldNames = [SINGLE_RELATION_FIELD, LIST_RELATION_FIELD, NON_RELATION_FIELD];

    // @ts-ignore - accessing protected properties for test cleanup
    metadata.relations = metadata.relations.filter(r => !fieldNames.includes(r.propertyName));
    // @ts-ignore - accessing protected properties for test cleanup
    metadata.columns = metadata.columns.filter(c => !fieldNames.includes(c.propertyName));
    // @ts-ignore - accessing protected properties for test cleanup
    metadata.joinTables = metadata.joinTables.filter(jt => !fieldNames.includes(jt.propertyName));
    // @ts-ignore - accessing protected properties for test cleanup
    metadata.joinColumns = metadata.joinColumns.filter(jc => !fieldNames.includes(jc.propertyName));
}
