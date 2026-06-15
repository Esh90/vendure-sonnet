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

    # ── Reporting types ───────────────────────────────────────────────────────

    type PaypalMoneyValue {
        currencyCode: String!
        value: String!
    }

    type PaypalTransactionInfo {
        transactionId: String!
        transactionEventCode: String!
        transactionInitiationDate: String!
        transactionUpdatedDate: String!
        transactionAmount: PaypalMoneyValue!
        feeAmount: PaypalMoneyValue
        transactionStatus: String!
        transactionSubject: String
        endingBalance: PaypalMoneyValue
    }

    type PaypalTransactionPayerInfo {
        emailAddress: String
        payerName: String
        countryCode: String
    }

    type PaypalTransaction {
        transactionInfo: PaypalTransactionInfo!
        payerInfo: PaypalTransactionPayerInfo
    }

    type PaypalTransactionSearchResult {
        transactions: [PaypalTransaction!]!
        totalItems: Int!
        totalPages: Int!
        page: Int!
        startDate: String!
        endDate: String!
        "Transactions appear in reports with up to a 3-hour delay after execution."
        lastRefreshedDatetime: String
    }

    type PaypalBalance {
        currency: String!
        primary: Boolean!
        totalBalance: PaypalMoneyValue!
        availableBalance: PaypalMoneyValue
        withheldBalance: PaypalMoneyValue
    }

    type PaypalBalanceResult {
        balances: [PaypalBalance!]!
        "ISO 8601 timestamp of when this balance snapshot was taken."
        asOfTime: String!
        lastRefreshTime: String!
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

        """
        Searches PayPal transactions within the given date range.
        Dates must be ISO 8601 strings with a timezone offset
        (e.g. "2024-01-01T00:00:00-0700").
        The range must not exceed 31 days (PayPal API constraint).
        Transactions appear with up to a 3-hour delay after execution.
        """
        paypalTransactions(
            startDate: String!
            endDate: String!
            "Page number (1-based). Defaults to 1."
            page: Int
            "Results per page, max 500. Defaults to 100."
            pageSize: Int
        ): PaypalTransactionSearchResult!

        """
        Returns the current PayPal account balances.
        Optionally pass asOfTime (ISO 8601) to query a historical snapshot.
        """
        paypalBalance(asOfTime: String): PaypalBalanceResult!
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
