import { Job, RateLimit } from '@vendure/core';
import { ConnectionOptions, Queue, QueueOptions, WorkerOptions } from 'bullmq';

/**
 * @description
 * This type is the third parameter to the `Queue.add()` method,
 * which allows additional options to be specified for the job.
 */
export type BullJobsOptions = Parameters<Queue['add']>[2];

/**
 * @description
 * Configuration options for the {@link BullMQJobQueuePlugin}.
 *
 * @since 1.2.0
 * @docsCategory core plugins/JobQueuePlugin
 * @docsPage BullMQPluginOptions
 * @docsWeight 0
 */
export interface BullMQPluginOptions {
    /**
     * @description
     * Connection options which will be passed directly to BullMQ when
     * creating a new Queue, Worker and Scheduler instance.
     *
     * If omitted, it will attempt to connect to Redis at `127.0.0.1:6379`.
     */
    connection?: ConnectionOptions;
    /**
     * @description
     * Additional options used when instantiating the BullMQ
     * Queue instance.
     * See the [BullMQ QueueOptions docs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/api/bullmq.queueoptions.md)
     */
    queueOptions?: Omit<QueueOptions, 'connection'>;
    /**
     * @description
     * Additional options used when instantiating the BullMQ
     * Worker instance.
     * See the [BullMQ WorkerOptions docs](https://github.com/taskforcesh/bullmq/blob/master/docs/gitbook/api/bullmq.workeroptions.md)
     */
    workerOptions?: Omit<WorkerOptions, 'connection'>;
    /**
     * @description
     * How many jobs from a given queue to process concurrently.
     *
     * Can be set to a function which receives the queue name and returns
     * the concurrency limit. This is useful for limiting concurrency on
     * queues which have resource-intensive jobs.
     *
     * **Important implementation note:** When using a function, workers are grouped
     * by the _concurrency value_, not by queue name. Because all Vendure job types
     * are stored in a single BullMQ queue (`QUEUE_NAME`), any worker can process
     * any job type. This means:
     *
     * - Multiple Vendure queues returning the same concurrency value will share a worker
     * - Jobs from different Vendure queues may be processed by the same worker
     * - The concurrency limit applies to the total jobs processed by that worker,
     *   not strictly per Vendure queue
     *
     * For strict per-queue concurrency isolation, consider:
     * - Creating separate BullMQ queues per Vendure queue (requires custom implementation)
     * - Using [BullMQ Pro Groups](https://docs.bullmq.io/bullmq-pro/groups)
     *
     * @example
     * ```ts
     * BullMQJobQueuePlugin.init({
     *   concurrency: (queueName) => {
     *     if (queueName === 'apply-collection-filters') {
     *       return 1;
     *     }
     *     return 5;
     *   }
     * })
     * ```
     *
     * @default 3
     */
    concurrency?: number | ((queueName: string) => number);
    /**
     * @description
     * When a job is added to the JobQueue using `JobQueue.add()`, the calling
     * code may specify the number of retries in case of failure. This option allows
     * you to override that number and specify your own number of retries based on
     * the job being added.
     *
     * @example
     * ```ts
     * setRetries: (queueName, job) => {
     *   if (queueName === 'send-email') {
     *     // Override the default number of retries
     *     // for the 'send-email' job because we have
     *     // a very unreliable email service.
     *     return 10;
     *   }
     *   return job.retries;
     * }
     *  ```
     *
     * @deprecated Use `setJobOptions` instead.
     * @since 1.3.0
     */
    setRetries?: (queueName: string, job: Job) => number;
    /**
     * @description
     * This allows you to specify the backoff settings when a failed job gets retried.
     * In other words, this determines how much time should pass before attempting to
     * process the failed job again. If the function returns `undefined`, the default
     * value of exponential/1000ms will be used.
     *
     * @example
     * ```ts
     * setBackoff: (queueName, job) => {
     *   return {
     *     type: 'exponential', // or 'fixed'
     *     delay: 10000 // first retry after 10s, second retry after 20s, 40s,...
     *   };
     * }
     * ```
     *
     * @deprecated Use `setJobOptions` instead.
     * @since 1.3.0
     * @default 'exponential', 1000
     */
    setBackoff?: (queueName: string, job: Job) => BackoffOptions | undefined;
    /**
     * @description
     * This allows you to specify additional options for a job when it is added to the queue.
     * The object returned is the BullMQ [JobsOptions](https://api.docs.bullmq.io/types/v5.JobsOptions.html)
     * type, which includes control over settings such as `delay`, `attempts`, `priority` and much more.
     *
     * This function is called every time a job is added to the queue, so you can return different options
     * based on the job being added.
     *
     * @example
     * ```ts
     * // Here we want to assign a higher priority to jobs in the 'critical' queue
     * setJobOptions: (queueName, job) => {
     *   const priority = queueName === 'critical' ? 1 : 5;
     *   return { priority };
     * }
     * ```
     *
     * @since 3.2.0
     */
    setJobOptions?: (queueName: string, job: Job) => BullJobsOptions;
    /**
     * @description
     * Configures a rate limit for one or more job queues. When set, at most
     * `max` jobs will be started per sliding window of length `duration` for
     * each matching queue. This is useful when a job handler interacts with an
     * external system which imposes its own rate limit.
     *
     * A value of `undefined` (or a function which returns `undefined`) disables
     * rate limiting for that queue, which is the default.
     *
     * **Implementation note:** For rate-limited queues, a dedicated BullMQ
     * `Worker` is created with BullMQ's native [`limiter`](https://docs.bullmq.io/guide/rate-limiting)
     * option forwarded, so the rate limit coordinates across multiple Vendure
     * worker processes via Redis. Because all Vendure queues share a single
     * BullMQ queue, the dedicated worker will defer any job whose name does
     * not match the rate-limited queue (via `moveToDelayed`) so the shared
     * worker can pick it up.
     *
     * @example
     * ```ts
     * BullMQJobQueuePlugin.init({
     *   rateLimit: (queueName) => {
     *     if (queueName === 'send-marketing-email') {
     *       return { max: 60, duration: '1h' };
     *     }
     *     return undefined;
     *   },
     * })
     * ```
     *
     * @since 3.7.0
     */
    rateLimit?: RateLimit | ((queueName: string) => RateLimit | undefined);
}

/**
 * @description
 * Configuration for the backoff function when retrying failed jobs.
 *
 * @since 1.3.0
 * @docsCategory core plugins/JobQueuePlugin
 * @docsPage BullMQPluginOptions
 * @docsWeight 1
 */
export interface BackoffOptions {
    type: 'exponential' | 'fixed';
    delay: number;
}

/**
 * @description
 * A definition for a Lua script used to define custom behavior in Redis
 */
export interface CustomScriptDefinition<T, Args extends any[]> {
    name: string;
    script: string;
    numberOfKeys: number;
}
