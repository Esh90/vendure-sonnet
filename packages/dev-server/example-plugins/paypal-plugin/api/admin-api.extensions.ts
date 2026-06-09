import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    type PayPalBillingPlan {
        planId: String!
        name: String!
        status: String!
    }

    type PayPalSubscription {
        id: ID!
        paypalSubscriptionId: String!
        paypalPlanId: String!
        status: String!
        approvalUrl: String
        customerId: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    input CreatePayPalBillingPlanInput {
        """PayPal product ID — create one in the PayPal dashboard before calling this."""
        productId: String!
        name: String!
        description: String
        """Recurring price as a decimal string, e.g. \\"9.99\\"."""
        price: String!
        """ISO-4217 currency code, e.g. \\"USD\\"."""
        currencyCode: String!
        """Billing interval: DAY, WEEK, MONTH, or YEAR."""
        intervalUnit: String!
        """Number of interval units between charges, e.g. 1 for monthly."""
        intervalCount: Int!
        """Total billing cycles before the plan ends. 0 means infinite (default)."""
        totalCycles: Int
    }

    extend type Query {
        """List all PayPal subscriptions stored in Vendure."""
        paypalSubscriptions: [PayPalSubscription!]!
    }

    extend type Mutation {
        """UC6 — Create a PayPal billing plan (INACTIVE by default; call activatePayPalBillingPlan next)."""
        createPayPalBillingPlan(input: CreatePayPalBillingPlanInput!): PayPalBillingPlan!

        """UC6 — Activate an INACTIVE PayPal billing plan so customers can subscribe."""
        activatePayPalBillingPlan(planId: String!): Boolean!

        """UC6 — Cancel a subscription on PayPal and mark it CANCELLED locally."""
        cancelPayPalSubscription(subscriptionId: String!, reason: String): Boolean!

        """UC6 — Retry a failed subscription payment: reactivates the suspended subscription and captures the outstanding balance."""
        capturePayPalSubscriptionPayment(subscriptionId: String!): Boolean!
    }
`;
