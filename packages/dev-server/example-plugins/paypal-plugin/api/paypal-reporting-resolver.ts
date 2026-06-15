import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Logger, Permission, RequestContext } from '@vendure/core';
import { loggerCtx } from '../constants';
import type { GetBalanceResult, ListTransactionsResult } from '../service/paypal-client';
import { getPayPalClient } from '../service/paypal-client';
import type { PayPalBalanceCurrency, PayPalTransactionItem } from '../types';

// ─── GraphQL return shapes ────────────────────────────────────────────────────

interface MoneyValue {
    currencyCode: string;
    value: string;
}

interface TransactionInfoResult {
    transactionId: string;
    transactionEventCode: string;
    transactionInitiationDate: string;
    transactionUpdatedDate: string;
    transactionAmount: MoneyValue;
    feeAmount: MoneyValue | null;
    transactionStatus: string;
    transactionSubject: string | null;
    endingBalance: MoneyValue | null;
}

interface TransactionPayerInfoResult {
    emailAddress: string | null;
    payerName: string | null;
    countryCode: string | null;
}

interface TransactionResult {
    transactionInfo: TransactionInfoResult;
    payerInfo: TransactionPayerInfoResult | null;
}

interface TransactionSearchResult {
    transactions: TransactionResult[];
    totalItems: number;
    totalPages: number;
    page: number;
    startDate: string;
    endDate: string;
    lastRefreshedDatetime: string | null;
}

interface BalanceItemResult {
    currency: string;
    primary: boolean;
    totalBalance: MoneyValue;
    availableBalance: MoneyValue | null;
    withheldBalance: MoneyValue | null;
}

interface BalanceResult {
    balances: BalanceItemResult[];
    asOfTime: string;
    lastRefreshTime: string;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapMoney(m: { currency_code: string; value: string } | undefined): MoneyValue | null {
    if (!m) return null;
    return { currencyCode: m.currency_code, value: m.value };
}

function mapTransaction(item: PayPalTransactionItem): TransactionResult {
    const ti = item.transaction_info;
    return {
        transactionInfo: {
            transactionId: ti.transaction_id,
            transactionEventCode: ti.transaction_event_code,
            transactionInitiationDate: ti.transaction_initiation_date,
            transactionUpdatedDate: ti.transaction_updated_date,
            transactionAmount: { currencyCode: ti.transaction_amount.currency_code, value: ti.transaction_amount.value },
            feeAmount: mapMoney(ti.fee_amount),
            transactionStatus: ti.transaction_status,
            transactionSubject: ti.transaction_subject ?? null,
            endingBalance: mapMoney(ti.ending_balance),
        },
        payerInfo: item.payer_info
            ? {
                  emailAddress: item.payer_info.email_address ?? null,
                  payerName: item.payer_info.payer_name
                      ? [item.payer_info.payer_name.given_name, item.payer_info.payer_name.surname]
                            .filter(Boolean)
                            .join(' ') || null
                      : null,
                  countryCode: item.payer_info.country_code ?? null,
              }
            : null,
    };
}

function mapBalance(b: PayPalBalanceCurrency): BalanceItemResult {
    return {
        currency: b.currency,
        primary: b.primary,
        totalBalance: { currencyCode: b.total_balance.currency_code, value: b.total_balance.value },
        availableBalance: mapMoney(b.available_balance),
        withheldBalance: mapMoney(b.withheld_balance),
    };
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

@Resolver()
export class PayPalReportingResolver {
    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalTransactions(
        @Ctx() _ctx: RequestContext,
        @Args()
        args: { startDate: string; endDate: string; page?: number; pageSize?: number },
    ): Promise<TransactionSearchResult> {
        const { startDate, endDate, page = 1, pageSize = 100 } = args;

        Logger.info(
            `PayPal transaction report requested: ${startDate} → ${endDate} (page ${page})`,
            loggerCtx,
        );

        const result: ListTransactionsResult = await getPayPalClient().listTransactions(
            startDate,
            endDate,
            page,
            pageSize,
        );

        return {
            transactions: result.transactions.map(mapTransaction),
            totalItems: result.totalItems,
            totalPages: result.totalPages,
            page: result.page,
            startDate: result.startDate,
            endDate: result.endDate,
            lastRefreshedDatetime: result.lastRefreshedDatetime ?? null,
        };
    }

    @Query()
    @Allow(Permission.SuperAdmin)
    async paypalBalance(
        @Ctx() _ctx: RequestContext,
        @Args() args: { asOfTime?: string },
    ): Promise<BalanceResult> {
        Logger.info(
            `PayPal balance requested${args.asOfTime ? ` as of ${args.asOfTime}` : ''}`,
            loggerCtx,
        );

        const result: GetBalanceResult = await getPayPalClient().getBalance(args.asOfTime);

        return {
            balances: result.balances.map(mapBalance),
            asOfTime: result.asOfTime,
            lastRefreshTime: result.lastRefreshTime,
        };
    }
}
