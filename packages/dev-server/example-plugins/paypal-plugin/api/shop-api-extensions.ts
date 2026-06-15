import gql from 'graphql-tag';

export const shopApiExtensions = gql`
    enum PaypalOrderIntent {
        "Funds are captured immediately at checkout (Use Case 1)."
        CAPTURE
        "Funds are reserved now and captured when the merchant fulfils the order (Use Case 2)."
        AUTHORIZE
    }

    type PaypalOrderResult {
        """The PayPal order ID. Pass this as metadata.paypalOrderId when calling addPaymentToOrder."""
        paypalOrderId: String!
        """The PayPal buyer-approval URL. Redirect the customer here for the redirect flow."""
        approvalUrl: String!
    }

    extend type Mutation {
        """
        Creates a PayPal order for the given active Vendure order and returns the PayPal
        order ID plus a buyer-approval URL (redirect flow).

        Redirect flow:
          1. Call this mutation to get approvalUrl.
          2. Redirect the buyer to approvalUrl.
          3. After approval PayPal redirects back to returnUrl with ?token=<paypalOrderId>.
          4. Call addPaymentToOrder with metadata: { paypalOrderId: token }.

        Embedded (Smart Payment Buttons) flow:
          The PayPal JS SDK handles order creation itself; this mutation is not needed.
          After the buyer approves, call addPaymentToOrder with
          metadata: { paypalOrderId: <id from onApprove> }.

        intent must match the paymentIntent configured on the PayPal payment method:
          CAPTURE  → immediate charge (Use Case 1)
          AUTHORIZE → reserve now, capture on fulfilment (Use Case 2)
        """
        createPaypalOrder(
            vendureOrderId: ID!
            "Payment intent — must match the PayPal payment method configuration. Defaults to CAPTURE."
            intent: PaypalOrderIntent
            "URL PayPal redirects the buyer to after approval. Overrides the plugin-level default."
            returnUrl: String
            "URL PayPal redirects the buyer to if they cancel. Defaults to returnUrl."
            cancelUrl: String
        ): PaypalOrderResult!

        """
        Creates a PayPal Subscription under the given billing plan.

        Flow:
          1. Admin creates a billing plan via createPaypalBillingPlan.
          2. Storefront calls createPaypalSubscription — gets back an approvalUrl.
          3. Redirect the customer to approvalUrl; PayPal activates the subscription.
          4. After return, call syncPaypalSubscription to refresh the local status.
        """
        createPaypalSubscription(
            "ID of the local PayPalBillingPlan entity."
            planId: ID!
            "URL PayPal redirects the buyer to after subscription approval."
            returnUrl: String
            "URL PayPal redirects if the buyer cancels. Defaults to returnUrl."
            cancelUrl: String
            "ISO 8601 start time. Defaults to immediate."
            startTime: String
            "Pre-fill the subscriber's email on the PayPal approval page."
            subscriberEmail: String
        ): PaypalSubscriptionResult!

        """
        Syncs the subscription status from PayPal into the local database.
        Call this when the customer returns from the PayPal approval URL.
        """
        syncPaypalSubscription(id: ID!): PaypalSubscriptionResult!

        """
        Cancels an ACTIVE or SUSPENDED PayPal subscription.
        """
        cancelPaypalSubscription(id: ID!, reason: String!): PaypalSubscriptionResult!
    }

    type PaypalSubscriptionResult {
        id: ID!
        paypalSubscriptionId: String!
        paypalPlanId: String!
        status: String!
        approvalUrl: String
        subscriberEmail: String
        nextBillingTime: String
        failedPaymentsCount: Int!
    }
`;
