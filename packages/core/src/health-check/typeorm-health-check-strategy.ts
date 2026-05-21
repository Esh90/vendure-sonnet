import { Injector } from '../common/injector';
import { HealthCheckStrategy } from '../config/system/health-check-strategy';
import { TransactionalConnection } from '../connection/transactional-connection';

import { HealthCheckError, HealthIndicatorFunction, HealthIndicatorResult } from './terminus-compat';

let connection: TransactionalConnection;

/**
 * @deprecated This interface is part of the deprecated health check feature and will be removed in v4.0.0.
 */
export interface TypeORMHealthCheckOptions {
    key?: string;
    timeout?: number;
}

/**
 * @description
 * A {@link HealthCheckStrategy} used to check the health of the database. This health
 * check is included by default, but can be customized by explicitly adding it to the
 * `systemOptions.healthChecks` array:
 *
 * @example
 * ```ts
 * import { TypeORMHealthCheckStrategy } from '\@vendure/core';
 *
 * export const config = {
 *   // ...
 *   systemOptions: {
 *     healthChecks:[
 *         // The default key is "database" and the default timeout is 1000ms
 *         // Sometimes this is too short and leads to false negatives in the
 *         // /health endpoint.
 *         new TypeORMHealthCheckStrategy({ key: 'postgres-db', timeout: 5000 }),
 *     ]
 *   }
 * }
 * ```
 *
 * @docsCategory health-check
 * @deprecated Use infrastructure-level health checks (e.g. Kubernetes probes, Docker healthchecks,
 * load balancer checks) instead of application-level health checks. This class will be removed in v4.0.0.
 */
export class TypeORMHealthCheckStrategy implements HealthCheckStrategy {
    constructor(private options?: TypeORMHealthCheckOptions) {}

    async init(injector: Injector) {
        connection = await injector.resolve(TransactionalConnection);
    }

    getHealthIndicator(): HealthIndicatorFunction {
        const key = this.options?.key || 'database';
        const timeout = this.options?.timeout ?? 1000;
        return async (): Promise<HealthIndicatorResult> => {
            let timer: NodeJS.Timeout | undefined;
            try {
                await Promise.race([
                    connection.rawConnection.query('SELECT 1'),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(
                            () => reject(new Error(`database health check timed out after ${timeout}ms`)),
                            timeout,
                        );
                    }),
                ]);
                return { [key]: { status: 'up' } };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                throw new HealthCheckError(message, { [key]: { status: 'down', message } });
            } finally {
                if (timer) {
                    clearTimeout(timer);
                }
            }
        };
    }
}
