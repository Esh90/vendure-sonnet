import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    type PaypalBillingPlanResult {
        id: ID!
        paypalPlanId: String!
        paypalProductId: String!
        name: String!
        description: String
        status: String!
        amount: Int!
        currencyCode: String!
        intervalUnit: String!
        intervalCount: Int!
        paymentFailureThreshold: Int!
    }

    type PaypalSubscriptionAdminResult {
        id: ID!
        paypalSubscriptionId: String!
        paypalPlanId: String!
        vendureCustomerId: String!
        status: String!
        approvalUrl: String
        subscriberEmail: String
        nextBillingTime: String
        failedPaymentsCount: Int!
    }

    extend type Query {
        "Returns all PayPal billing plans stored in the local database."
        paypalBillingPlans: [PaypalBillingPlanResult!]!

        "Returns a single PayPal billing plan by its local entity ID."
        paypalBillingPlan(id: ID!): PaypalBillingPlanResult

        "Returns all PayPal subscriptions stored in the local database."
        paypalSubscriptions: [PaypalSubscriptionAdminResult!]!

        "Returns a single PayPal subscription by its local entity ID."
        paypalSubscription(id: ID!): PaypalSubscriptionAdminResult
    }

    extend type Mutation {
        """
        Creates a PayPal Catalog Product and Billing Plan.
        The plan is created in ACTIVE status on PayPal and persisted locally.
        """
        createPaypalBillingPlan(
            name: String!
            description: String
            "Recurring charge in the smallest currency unit (e.g. cents for USD)."
            amount: Int!
            "ISO 4217 currency code (e.g. USD)."
            currencyCode: String!
            "Billing frequency: DAY | WEEK | MONTH | YEAR"
            intervalUnit: String!
            "Number of intervalUnits between charges. Defaults to 1."
            intervalCount: Int
            "Consecutive failures before PayPal suspends the subscription. Defaults to 3."
            paymentFailureThreshold: Int
        ): PaypalBillingPlanResult!

        "Activates an INACTIVE billing plan."
        activatePaypalBillingPlan(id: ID!): PaypalBillingPlanResult!

        "Updates the payment failure threshold on an existing billing plan."
        updatePaypalBillingPlanThreshold(id: ID!, paymentFailureThreshold: Int!): PaypalBillingPlanResult!

        "Syncs a subscription status from PayPal and updates the local record."
        syncPaypalSubscriptionAdmin(id: ID!): PaypalSubscriptionAdminResult!

        "Cancels an ACTIVE or SUSPENDED subscription from the admin panel."
        cancelPaypalSubscriptionAdmin(id: ID!, reason: String!): PaypalSubscriptionAdminResult!
    }
`;
