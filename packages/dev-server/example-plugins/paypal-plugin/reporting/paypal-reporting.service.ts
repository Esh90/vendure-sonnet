import { Injectable } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { getTransactionSearchController } from '../paypal-client';

const loggerCtx = 'PayPalReportingService';

export interface TransactionSearchInput {
    startDate: string;
    endDate: string;
    transactionId?: string;
    transactionStatus?: string;
    transactionCurrency?: string;
    pageSize?: number;
    page?: number;
}

export interface PayPalMoney {
    value: string;
    currencyCode: string;
}

export interface PayPalTransactionRow {
    transactionId?: string;
    transactionEventCode?: string;
    transactionInitiationDate?: string;
    transactionUpdatedDate?: string;
    transactionAmount?: PayPalMoney;
    feeAmount?: PayPalMoney;
    transactionStatus?: string;
    transactionSubject?: string;
    invoiceId?: string;
    customField?: string;
    payerEmail?: string;
    payerName?: string;
}

export interface TransactionSearchResult {
    transactions: PayPalTransactionRow[];
    totalItems: number;
    totalPages: number;
    page: number;
}

export interface PayPalBalanceRow {
    currency: string;
    primary?: boolean;
    totalBalance: PayPalMoney;
    availableBalance?: PayPalMoney;
    withheldBalance?: PayPalMoney;
}

@Injectable()
export class PayPalReportingService {
    async searchTransactions(input: TransactionSearchInput): Promise<TransactionSearchResult> {
        const ctrl = getTransactionSearchController();

        const response = await ctrl.searchTransactions({
            startDate: input.startDate,
            endDate: input.endDate,
            transactionId: input.transactionId,
            transactionStatus: input.transactionStatus,
            transactionCurrency: input.transactionCurrency,
            pageSize: input.pageSize ?? 100,
            page: input.page ?? 1,
            fields: 'transaction_info,payer_info',
        });

        const result = response.result;

        Logger.info(
            `PayPal transaction search: ${result.totalItems ?? 0} items found (page ${result.page ?? 1}/${result.totalPages ?? 1})`,
            loggerCtx,
        );

        const transactions: PayPalTransactionRow[] = (result.transactionDetails ?? []).map(detail => {
            const ti = detail.transactionInfo;
            const pi = detail.payerInfo;

            const assembled = [pi?.payerName?.givenName, pi?.payerName?.surname].filter(Boolean).join(' ');
            const payerFullName = pi?.payerName?.fullName ?? (assembled || undefined);

            return {
                transactionId: ti?.transactionId,
                transactionEventCode: ti?.transactionEventCode,
                transactionInitiationDate: ti?.transactionInitiationDate,
                transactionUpdatedDate: ti?.transactionUpdatedDate,
                transactionAmount: ti?.transactionAmount
                    ? { value: ti.transactionAmount.value, currencyCode: ti.transactionAmount.currencyCode }
                    : undefined,
                feeAmount: ti?.feeAmount
                    ? { value: ti.feeAmount.value, currencyCode: ti.feeAmount.currencyCode }
                    : undefined,
                transactionStatus: ti?.transactionStatus,
                transactionSubject: ti?.transactionSubject,
                invoiceId: ti?.invoiceId,
                customField: ti?.customField,
                payerEmail: pi?.emailAddress,
                payerName: payerFullName,
            };
        });

        return {
            transactions,
            totalItems: result.totalItems ?? 0,
            totalPages: result.totalPages ?? 1,
            page: result.page ?? 1,
        };
    }

    async getBalances(asOfTime?: string, currencyCode?: string): Promise<PayPalBalanceRow[]> {
        const ctrl = getTransactionSearchController();

        const response = await ctrl.searchBalances({ asOfTime, currencyCode });
        const balances = response.result.balances ?? [];

        Logger.info(`PayPal balances fetched: ${balances.length} currency balance(s)`, loggerCtx);

        return balances.map(b => ({
            currency: b.currency,
            primary: b.primary,
            totalBalance: { value: b.totalBalance.value, currencyCode: b.totalBalance.currencyCode },
            availableBalance: b.availableBalance
                ? { value: b.availableBalance.value, currencyCode: b.availableBalance.currencyCode }
                : undefined,
            withheldBalance: b.withheldBalance
                ? { value: b.withheldBalance.value, currencyCode: b.withheldBalance.currencyCode }
                : undefined,
        }));
    }
}
