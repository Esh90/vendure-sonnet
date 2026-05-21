/**
 * Minimal local replacements for the symbols previously imported from
 * `@nestjs/terminus`. The health check feature these support is deprecated and
 * will be removed in v4.0.0; until then these types preserve the public API
 * surface of {@link HealthCheckStrategy} and {@link HealthCheckRegistryService}
 * without forcing a transitive dependency on `@nestjs/terminus` (and its
 * 5-package subtree: boxen, check-disk-space, ansi-align, cli-boxes, widest-line).
 *
 * The shapes are structurally compatible with the terminus equivalents, so
 * plugin code that previously imported these names from `@nestjs/terminus`
 * can migrate by changing the import path to `@vendure/core` (one-line change).
 */

/**
 * @description
 * The result returned by a {@link HealthIndicatorFunction}. Keyed by the
 * indicator name, with a `status` of `'up'` or `'down'` and optional
 * additional diagnostic data.
 *
 * @docsCategory health-check
 * @deprecated Part of the deprecated health check feature; will be removed in v4.0.0.
 */
export type HealthIndicatorResult = {
    [key: string]: {
        status: 'up' | 'down';
        [optionalKey: string]: unknown;
    };
};

/**
 * @description
 * A function that performs a single health check and resolves to a
 * {@link HealthIndicatorResult}. Used as the return type of
 * {@link HealthCheckStrategy.getHealthIndicator}.
 *
 * @docsCategory health-check
 * @deprecated Part of the deprecated health check feature; will be removed in v4.0.0.
 */
export type HealthIndicatorFunction = () =>
    | PromiseLike<HealthIndicatorResult>
    | HealthIndicatorResult;

/**
 * @description
 * Thrown from a health indicator to signal a failed check. The `causes`
 * payload is forwarded to the `/health` response so callers can inspect
 * which indicator failed and why.
 *
 * @docsCategory health-check
 * @deprecated Part of the deprecated health check feature; will be removed in v4.0.0.
 */
export class HealthCheckError extends Error {
    causes: HealthIndicatorResult;

    constructor(message: string, causes: HealthIndicatorResult) {
        super(message);
        this.name = 'HealthCheckError';
        this.causes = causes;
    }
}

/**
 * @description
 * Base class for custom health indicators. Subclasses use {@link HealthIndicator.getStatus}
 * to build a {@link HealthIndicatorResult} and throw {@link HealthCheckError}
 * to signal failures.
 *
 * @docsCategory health-check
 * @deprecated Part of the deprecated health check feature; will be removed in v4.0.0.
 */
export abstract class HealthIndicator {
    protected getStatus(
        key: string,
        isHealthy: boolean,
        data?: { [optionalKey: string]: unknown },
    ): HealthIndicatorResult {
        return {
            [key]: { status: isHealthy ? 'up' : 'down', ...(data ?? {}) },
        };
    }
}
