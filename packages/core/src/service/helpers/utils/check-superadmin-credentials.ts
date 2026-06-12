import { SUPER_ADMIN_USER_IDENTIFIER, SUPER_ADMIN_USER_PASSWORD } from '@vendure/common/lib/shared-constants';

import { Logger } from '../../../config/logger/vendure-logger';
import { SuperadminCredentials } from '../../../config/vendure-config';

const REMEDIATION_HINT =
    'Set `authOptions.superadminCredentials` in your VendureConfig — typically wired from environment variables, e.g. ' +
    '`{ identifier: process.env.SUPERADMIN_USERNAME, password: process.env.SUPERADMIN_PASSWORD }`.';

/**
 * @description
 * Verifies that the configured `superadminCredentials` are not the well-known
 * defaults shipped by `@vendure/common`. Used during bootstrap to fail loudly
 * in production environments and warn otherwise.
 *
 * Exported for unit testing — production callers should rely on the default
 * `process.env.NODE_ENV` and {@link Logger}.
 */
export function checkSuperadminCredentials(
    credentials: Pick<SuperadminCredentials, 'identifier' | 'password'>,
    options: { nodeEnv?: string; logger?: Pick<typeof Logger, 'warn'> } = {},
): void {
    const usingDefaults =
        credentials.identifier === SUPER_ADMIN_USER_IDENTIFIER ||
        credentials.password === SUPER_ADMIN_USER_PASSWORD;
    if (!usingDefaults) {
        return;
    }

    const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
    const message =
        'Default superadmin credentials are configured. This is INSECURE and must not be used in production. ' +
        REMEDIATION_HINT;

    if (nodeEnv === 'production') {
        throw new Error(`[Vendure] Refusing to start: ${message}`);
    }

    if (nodeEnv === 'test') {
        return;
    }

    const logger = options.logger ?? Logger;
    logger.warn(message);
}
