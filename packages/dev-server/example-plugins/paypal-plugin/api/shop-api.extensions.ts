import gql from 'graphql-tag';

/**
 * Shop API GraphQL extensions for the PayPal plugin.
 *
 * `createPayPalOrder` — creates a PayPal order for the shopper's active Vendure order and
 * returns the PayPal order ID plus the buyer-approval URL so the storefront can redirect
 * the customer to PayPal (redirect flow) or initialise the PayPal JS SDK (embedded flow).
 */
export const shopApiExtensions = gql`
    type PayPalOrderResult {
        paypalOrderId: String!
        approvalUrl: String!
    }

    extend type Mutation {
        createPayPalOrder: PayPalOrderResult!
    }
`;
