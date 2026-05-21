import { Socket, createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { isServerPortInUse } from './helpers';
import { log } from './logger';

// Replace the project's logger with a spy so we can assert on warning calls
// without coupling to its console-printing behaviour.
vi.mock('./logger', () => ({
    log: vi.fn(),
}));

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
        vi.restoreAllMocks();
        vi.mocked(log).mockClear();
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

    it.each([0, -1, 70000, 3.14, NaN, Number.POSITIVE_INFINITY])(
        'rejects with "Invalid port" for invalid input %s',
        async invalid => {
            await expect(isServerPortInUse(invalid)).rejects.toThrow(/Invalid port/);
        },
    );

    it('rejects with the underlying error on non-ECONNREFUSED socket failures', async () => {
        // Intercept Socket.connect so the next call emits a synthetic
        // EHOSTUNREACH error instead of actually opening a connection. This
        // covers the production code path that surfaces "real" socket
        // failures (e.g. EACCES on privileged ports, EHOSTUNREACH on DNS
        // misconfiguration) without needing elevated privileges or DNS
        // tricks at test time.
        const connectSpy = vi
            .spyOn(Socket.prototype, 'connect')
            .mockImplementation(function (this: Socket) {
                queueMicrotask(() => {
                    const err = new Error('Host unreachable') as NodeJS.ErrnoException;
                    err.code = 'EHOSTUNREACH';
                    this.emit('error', err);
                });
                return this;
            });

        await expect(isServerPortInUse(12345)).rejects.toMatchObject({ code: 'EHOSTUNREACH' });
        expect(connectSpy).toHaveBeenCalledOnce();
        expect(log).toHaveBeenCalledWith(expect.stringContaining('could not determine'));
    });
});
