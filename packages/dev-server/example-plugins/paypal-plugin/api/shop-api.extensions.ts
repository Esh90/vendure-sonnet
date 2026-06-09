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

    type PayPalSubscriptionResult {
        subscriptionId: String!
        approvalUrl: String!
    }

    extend type Mutation {
        """UC1 — Create a PayPal order with immediate-capture intent."""
        createPayPalOrder: PayPalOrderResult!

        """UC2 — Create a PayPal order with authorize intent (funds reserved, not yet moved)."""
        createPayPalOrderForAuthorization: PayPalOrderResult!

        """UC6 — Start a recurring subscription for the logged-in customer."""
        createPayPalSubscription(planId: String!): PayPalSubscriptionResult!

        """UC6 — Cancel the customer's own subscription."""
        cancelMyPayPalSubscription(subscriptionId: String!, reason: String): Boolean!
    }
`;
