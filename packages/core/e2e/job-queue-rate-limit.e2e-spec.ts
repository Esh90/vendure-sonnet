import { OnApplicationBootstrap } from '@nestjs/common';
import {
    DefaultJobQueuePlugin,
    JobQueue,
    JobQueueService,
    mergeConfig,
    PluginCommonModule,
    VendurePlugin,
} from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

const RATE_LIMITED_QUEUE = 'test-rate-limited-queue';
const UNLIMITED_QUEUE = 'test-unlimited-queue';
const RATE_LIMIT_MAX = 2;
const RATE_LIMIT_DURATION_MS = 500;

@VendurePlugin({
    imports: [PluginCommonModule],
})
class RateLimitTestPlugin implements OnApplicationBootstrap {
    static rateLimitedStarts: number[] = [];
    static unlimitedCompleted: number[] = [];
    static rateLimitedQueue: JobQueue<{ id: number }>;
    static unlimitedQueue: JobQueue<{ id: number }>;

    constructor(private jobQueueService: JobQueueService) {}

    async onApplicationBootstrap() {
        RateLimitTestPlugin.rateLimitedQueue = await this.jobQueueService.createQueue({
            name: RATE_LIMITED_QUEUE,
            process: async job => {
                RateLimitTestPlugin.rateLimitedStarts.push(Date.now());
                // Resolve immediately — we care about the start cadence.
                return job.data;
            },
        });

        RateLimitTestPlugin.unlimitedQueue = await this.jobQueueService.createQueue({
            name: UNLIMITED_QUEUE,
            process: async job => {
                RateLimitTestPlugin.unlimitedCompleted.push(Date.now());
                return job.data;
            },
        });
    }

    static reset() {
        this.rateLimitedStarts = [];
        this.unlimitedCompleted = [];
    }
}

describe('Job queue rate limit', () => {
    const activeConfig = testConfig();
    if (activeConfig.dbConnectionOptions.type === 'sqljs') {
        it.only('skip rate-limit tests for sqljs', () => {
            // The tests in this suite will fail when running on sqljs because
            // the DB state is not persisted correctly with the polling nature
            // of the SQL job queue strategy.
            return;
        });
    }

    const { server, adminClient } = createTestEnvironment(
        mergeConfig(activeConfig, {
            plugins: [
                DefaultJobQueuePlugin.init({
                    pollInterval: 50,
                    // Give the rate-limited queue extra concurrency headroom so
                    // we can verify that the rate limit (not concurrency) is the
                    // binding constraint.
                    concurrency: () => 5,
                    rateLimit: queueName => {
                        if (queueName === RATE_LIMITED_QUEUE) {
                            return { max: RATE_LIMIT_MAX, duration: RATE_LIMIT_DURATION_MS };
                        }
                        return undefined;
                    },
                }),
                RateLimitTestPlugin,
            ],
        }),
    );

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-empty.csv'),
            customerCount: 0,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('should respect rate-limit max per sliding window', async () => {
        RateLimitTestPlugin.reset();

        const jobCount = 10;
        const jobPromises: Array<Promise<any>> = [];
        for (let i = 0; i < jobCount; i++) {
            jobPromises.push(RateLimitTestPlugin.rateLimitedQueue.add({ id: i }));
        }
        await Promise.all(jobPromises);

        // Wait long enough for all jobs to eventually drain.
        // 10 jobs / 2 per 500ms => ~2.5s worth of slots; give buffer.
        await new Promise(resolve => setTimeout(resolve, 4000));

        // All jobs processed
        expect(RateLimitTestPlugin.rateLimitedStarts.length).toBe(jobCount);

        // Validate the sliding window: no window of length RATE_LIMIT_DURATION_MS
        // should contain more than RATE_LIMIT_MAX starts. Applied as: for every
        // pair of starts at positions i and i + RATE_LIMIT_MAX, the window from
        // the earlier to the later must be >= RATE_LIMIT_DURATION_MS (minus a
        // small tolerance for poll timing).
        const tolerance = 50;
        const starts = [...RateLimitTestPlugin.rateLimitedStarts].sort((a, b) => a - b);
        for (let i = 0; i + RATE_LIMIT_MAX < starts.length; i++) {
            const delta = starts[i + RATE_LIMIT_MAX] - starts[i];
            expect(delta).toBeGreaterThanOrEqual(RATE_LIMIT_DURATION_MS - tolerance);
        }
    });

    it('should not rate-limit queues without a configured limit', async () => {
        RateLimitTestPlugin.reset();

        const jobCount = 10;
        const jobPromises: Array<Promise<any>> = [];
        for (let i = 0; i < jobCount; i++) {
            jobPromises.push(RateLimitTestPlugin.unlimitedQueue.add({ id: i }));
        }
        await Promise.all(jobPromises);

        await new Promise(resolve => setTimeout(resolve, 1500));

        expect(RateLimitTestPlugin.unlimitedCompleted.length).toBe(jobCount);

        // Without a rate limit, the entire batch should drain well under the
        // RATE_LIMIT_DURATION_MS window that would otherwise cap throughput to
        // RATE_LIMIT_MAX.
        const starts = [...RateLimitTestPlugin.unlimitedCompleted].sort((a, b) => a - b);
        const drainSpan = starts[starts.length - 1] - starts[0];
        expect(drainSpan).toBeLessThan(RATE_LIMIT_DURATION_MS * 2);
    });
});
