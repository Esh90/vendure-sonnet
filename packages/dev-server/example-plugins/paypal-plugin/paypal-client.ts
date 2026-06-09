import { Client, Environment, OrdersController } from '@paypal/paypal-server-sdk';
import { Logger } from '@vendure/core';

const loggerCtx = 'PayPalClient';

let _client: Client | null = null;
let _ordersController: OrdersController | null = null;

function createClient(): Client {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        Logger.error(
            'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables must be set. ' +
                'The PayPal plugin will not function correctly.',
            loggerCtx,
        );
    }

    const environment =
        process.env.PAYPAL_ENVIRONMENT === 'production'
            ? Environment.Production
            : Environment.Sandbox;

    Logger.info(`Initializing PayPal client (environment: ${environment})`, loggerCtx);

    return new Client({
        clientCredentialsAuthCredentials: {
            oAuthClientId: clientId ?? '',
            oAuthClientSecret: clientSecret ?? '',
        },
        environment,
    });
}

function getClient(): Client {
    if (!_client) {
        _client = createClient();
    }
    return _client;
}

export function getOrdersController(): OrdersController {
    if (!_ordersController) {
        _ordersController = new OrdersController(getClient());
    }
    return _ordersController;
}
