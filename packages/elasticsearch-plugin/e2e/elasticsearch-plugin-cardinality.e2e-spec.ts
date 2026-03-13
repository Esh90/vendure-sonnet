import { Client } from '@elastic/elasticsearch';
import { DefaultJobQueuePlugin, mergeConfig } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import {
    SearchProductsShopQuery,
    SearchProductsShopQueryVariables,
} from '../../core/e2e/graphql/generated-e2e-shop-types';
import { SEARCH_PRODUCTS_SHOP } from '../../core/e2e/graphql/shop-definitions';
import { awaitRunningJobs } from '../../core/e2e/utils/await-running-jobs';
import { deleteIndices } from '../src/indexing/indexing-utils';
import { ElasticsearchPlugin } from '../src/plugin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { elasticsearchHost, elasticsearchPort } = require('./constants');

const INDEX_PREFIX = 'e2e-cardinality-tests';

/**
 * Tests for the `cardinalityPrecisionThreshold` SearchConfig option.
 *
 * Verifies that setting `cardinalityPrecisionThreshold` correctly propagates
 * to Elasticsearch cardinality aggregations used in `totalHits()` and
 * `getDistinctBucketsOfField()`, producing accurate totalItems and
 * facetValue counts.
 */
describe('Elasticsearch plugin cardinalityPrecisionThreshold', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig(), {
            plugins: [
                ElasticsearchPlugin.init({
                    indexPrefix: INDEX_PREFIX,
                    port: elasticsearchPort,
                    host: elasticsearchHost,
                    searchConfig: {
                        cardinalityPrecisionThreshold: 40000,
                    },
                }),
                DefaultJobQueuePlugin,
            ],
        }),
    );

    beforeAll(async () => {
        const esClient = new Client({ node: `${elasticsearchHost}:${elasticsearchPort}` });
        await deleteIndices(esClient, INDEX_PREFIX);
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-full.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await awaitRunningJobs(adminClient, 10_000, 1000);
        await adminClient.query(REINDEX);
        await awaitRunningJobs(adminClient);
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    // --- totalHits() with groupByProduct ---

    it('returns correct totalItems when grouped by product', async () => {
        const { search } = await shopClient.query<SearchProductsShopQuery, SearchProductsShopQueryVariables>(
            SEARCH_PRODUCTS_SHOP,
            { input: { groupByProduct: true } },
        );
        expect(search.totalItems).toBe(21);
    });

    it('returns correct totalItems when grouped by SKU', async () => {
        const { search } = await shopClient.query<SearchProductsShopQuery, SearchProductsShopQueryVariables>(
            SEARCH_PRODUCTS_SHOP,
            { input: { groupBySKU: true } },
        );
        expect(search.totalItems).toBe(34);
    });

    it('returns correct totalItems without grouping', async () => {
        const { search } = await shopClient.query<SearchProductsShopQuery, SearchProductsShopQueryVariables>(
            SEARCH_PRODUCTS_SHOP,
            { input: { groupByProduct: false, groupBySKU: false } },
        );
        expect(search.totalItems).toBe(35);
    });

    // --- getDistinctBucketsOfField() with groupByProduct ---

    it('returns correct facetValue counts when grouped by product', async () => {
        const result = await shopClient.query(SEARCH_GET_FACET_VALUES, {
            input: { groupByProduct: true },
        });
        expect(result.search.facetValues).toEqual([
            { count: 10, facetValue: { id: 'T_1', name: 'electronics' } },
            { count: 6, facetValue: { id: 'T_2', name: 'computers' } },
            { count: 4, facetValue: { id: 'T_3', name: 'photo' } },
            { count: 7, facetValue: { id: 'T_4', name: 'sports equipment' } },
            { count: 4, facetValue: { id: 'T_5', name: 'home & garden' } },
            { count: 4, facetValue: { id: 'T_6', name: 'plants' } },
        ]);
    });

    // --- pagination correctness ---

    it('does not produce empty last page when grouped by product', async () => {
        const { search: countSearch } = await shopClient.query<
            SearchProductsShopQuery,
            SearchProductsShopQueryVariables
        >(SEARCH_PRODUCTS_SHOP, {
            input: { groupByProduct: true },
        });
        const totalItems = countSearch.totalItems;
        const pageSize = 10;
        const lastPageSkip = Math.floor((totalItems - 1) / pageSize) * pageSize;

        const { search } = await shopClient.query<SearchProductsShopQuery, SearchProductsShopQueryVariables>(
            SEARCH_PRODUCTS_SHOP,
            {
                input: {
                    groupByProduct: true,
                    take: pageSize,
                    skip: lastPageSkip,
                },
            },
        );
        expect(search.items.length).toBeGreaterThan(0);
        expect(search.totalItems).toBe(totalItems);
    });
});

const REINDEX = gql`
    mutation Reindex {
        reindex {
            id
            queueName
            state
            progress
            duration
            result
        }
    }
`;

const SEARCH_GET_FACET_VALUES = gql`
    query SearchFacetValues($input: SearchInput!) {
        search(input: $input) {
            totalItems
            facetValues {
                count
                facetValue {
                    id
                    name
                }
            }
        }
    }
`;
