import { Client, Environment, OrdersController, PaymentsController, SubscriptionsController } from '@paypal/paypal-server-sdk';
import { Logger } from '@vendure/core';

const loggerCtx = 'PayPalClient';

let _client: Client | null = null;
let _ordersController: OrdersController | null = null;
let _paymentsController: PaymentsController | null = null;
let _subscriptionsController: SubscriptionsController | null = null;

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

export function getPaymentsController(): PaymentsController {
    if (!_paymentsController) {
        _paymentsController = new PaymentsController(getClient());
    }
    return _paymentsController;
}

export function getSubscriptionsController(): SubscriptionsController {
    if (!_subscriptionsController) {
        _subscriptionsController = new SubscriptionsController(getClient());
    }
    return _subscriptionsController;
}
