import gql from 'graphql-tag';

export const shopApiExtensions = gql`
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
        """
        createPaypalOrder(
            vendureOrderId: ID!
            "URL PayPal redirects the buyer to after approval. Overrides the plugin-level default."
            returnUrl: String
            "URL PayPal redirects the buyer to if they cancel. Defaults to returnUrl."
            cancelUrl: String
        ): PaypalOrderResult!
    }
`;
