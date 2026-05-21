import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { isServerPortInUse } from './helpers';

/**
 * Binds an ephemeral port on 127.0.0.1 and returns both the server and its
 * port. The caller is responsible for closing the server (or relying on
 * `afterEach` cleanup).
 */
function listenOnEphemeralPort(): Promise<{ server: Server; port: number }> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (typeof address === 'object' && address !== null) {
                resolve({ server, port: address.port });
            } else {
                reject(new Error('Could not determine ephemeral port'));
            }
        });
    });
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
    });
}

describe('isServerPortInUse', () => {
    let openServers: Server[] = [];

    afterEach(async () => {
        for (const server of openServers) {
            await closeServer(server).catch(() => undefined);
        }
        openServers = [];
    });

    it('returns true when a server is listening on the port', async () => {
        const { server, port } = await listenOnEphemeralPort();
        openServers.push(server);

        await expect(isServerPortInUse(port)).resolves.toBe(true);
    });

    it('returns false when no server is listening on the port', async () => {
        // Reserve and release an ephemeral port so we know it's currently free.
        const { server, port } = await listenOnEphemeralPort();
        await closeServer(server);

        await expect(isServerPortInUse(port)).resolves.toBe(false);
    });

    it('returns false again once the server stops listening', async () => {
        const { server, port } = await listenOnEphemeralPort();
        openServers.push(server);
        await expect(isServerPortInUse(port)).resolves.toBe(true);

        await closeServer(server);
        openServers = [];
        await expect(isServerPortInUse(port)).resolves.toBe(false);
    });
});
