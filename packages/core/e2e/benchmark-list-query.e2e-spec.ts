/* eslint-disable no-console */
import { FacetValue, VendureConfig } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { gql } from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { testConfig } from '../../../e2e-common/test-config';

describe('ListQueryBuilder Optimization Benchmark', () => {
    const capturedQueries: string[] = [];
    const baseConfig = testConfig();

    const benchmarkConfig: VendureConfig = {
        ...baseConfig,
        customFields: {
            Product: [
                {
                    name: 'testRelation',
                    type: 'relation',
                    entity: FacetValue,
                    graphQLType: 'FacetValue',
                    list: true, // ManyToMany para probar múltiples EXISTS
                },
            ],
        },
        dbConnectionOptions: {
            ...baseConfig.dbConnectionOptions,
            logging: ['query'],
            logger: {
                logQuery(query: string) {
                    if (
                        query.includes('SELECT') &&
                        (query.includes('"product"') || query.includes('`product`'))
                    ) {
                        capturedQueries.push(query);
                    }
                },
                logQueryError: (error: string) => console.error(error),
                logQuerySlow: (time: number, query: string) => console.warn(query, time),
                logSchemaBuild: () => {
                    /* no-op */
                },
                logMigration: () => {
                    /* no-op */
                },
                log: () => {
                    /* no-op */
                },
            } as any,
        },
    };

    const { server, adminClient } = createTestEnvironment(benchmarkConfig);

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-full.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();

        // Asignamos valores a la relación para el Producto 1
        // (Esto es opcional para el SQL, pero bueno para los resultados)
    }, 240000);

    afterAll(async () => {
        await server.destroy();
    });

    it('benchmarks multiple AND filters on a CUSTOM FIELD relation', async () => {
        const GET_PRODUCTS = gql`
            query GetProducts($options: ProductListOptions) {
                products(options: $options) {
                    items {
                        id
                    }
                    totalItems
                }
            }
        `;

        capturedQueries.length = 0;

        // Intentamos filtrar por el mismo Custom Field dos veces
        await adminClient.query(GET_PRODUCTS, {
            options: {
                filter: {
                    _and: [{ testRelationId: { eq: '1' } }, { testRelationId: { eq: '2' } }],
                },
            },
        });

        const lastQuery = capturedQueries.find(q => q.includes('WHERE') && q.includes('testRelation'));
        console.log(`\n--- SQL FOR CUSTOM FIELD RELATION ---`);
        if (lastQuery) {
            console.log(lastQuery);
            const existsCount = (lastQuery.match(/EXISTS/g) || []).length;
            console.log(`\nEXISTS count: ${existsCount}`);
        } else {
            console.log(`Query not captured or filter not applied.`);
            console.log(`Available queries: ${capturedQueries.length}`);
            if (capturedQueries.length > 0) {
                console.log(
                    `Last query: ${capturedQueries[capturedQueries.length - 1].substring(0, 200)}...`,
                );
            }
        }
    }, 120000);
});
