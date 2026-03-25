import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/config.service';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { ApiKey } from '../../entity/api-key/api-key.entity';
import { Channel } from '../../entity/channel/channel.entity';
import { Seller } from '../../entity/seller/seller.entity';
import { StockLocation } from '../../entity/stock-location/stock-location.entity';
import { getStrategyName } from '../helpers/strategy-name.helper';
import { TelemetryFeatures } from '../telemetry.types';

/**
 * Collects feature adoption flags for telemetry.
 * Each flag is derived independently so a single failure does not affect the others.
 */
@Injectable()
export class FeaturesCollector {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly configService: ConfigService,
    ) {}

    async collect(): Promise<TelemetryFeatures> {
        const rawConnection = this.connection.rawConnection;
        const dbReady = rawConnection?.isInitialized;

        const features: TelemetryFeatures = {};

        features.multiChannel = await this.detectMultiChannel(dbReady);
        features.multiVendor = await this.detectMultiVendor(dbReady);
        features.multiStockLocation = await this.detectMultiStockLocation(dbReady);
        features.apiKeysEnabled = await this.detectApiKeysEnabled(dbReady);
        features.customFieldsInUse = this.detectCustomFieldsInUse();
        features.scheduledTasks = this.detectScheduledTasks();

        return features;
    }

    private async detectMultiChannel(dbReady: boolean | undefined): Promise<boolean | undefined> {
        try {
            if (!dbReady) return undefined;
            const count = await this.connection.rawConnection.getRepository(Channel).count();
            return count > 1;
        } catch {
            return undefined;
        }
    }

    private async detectMultiVendor(dbReady: boolean | undefined): Promise<boolean | undefined> {
        try {
            let multipleSellers = false;
            if (dbReady) {
                const count = await this.connection.rawConnection.getRepository(Seller).count();
                multipleSellers = count > 1;
            }

            const strategyName = getStrategyName(this.configService.orderOptions.orderSellerStrategy);
            const customStrategy =
                strategyName !== 'DefaultOrderSellerStrategy' && strategyName !== 'unknown';

            return multipleSellers || customStrategy;
        } catch {
            return undefined;
        }
    }

    private async detectMultiStockLocation(dbReady: boolean | undefined): Promise<boolean | undefined> {
        try {
            if (!dbReady) return undefined;
            const count = await this.connection.rawConnection.getRepository(StockLocation).count();
            return count > 1;
        } catch {
            return undefined;
        }
    }

    private async detectApiKeysEnabled(dbReady: boolean | undefined): Promise<boolean | undefined> {
        try {
            if (!dbReady) return undefined;
            const count = await this.connection.rawConnection.getRepository(ApiKey).count();
            return count > 0;
        } catch {
            return undefined;
        }
    }

    private detectCustomFieldsInUse(): boolean | undefined {
        try {
            const customFields = this.configService.customFields;
            let total = 0;
            for (const key of Object.keys(customFields)) {
                const fields = customFields[key as keyof typeof customFields];
                if (Array.isArray(fields)) {
                    total += fields.length;
                }
            }
            return total > 0;
        } catch {
            return undefined;
        }
    }

    private detectScheduledTasks(): boolean | undefined {
        try {
            return (this.configService.schedulerOptions.tasks?.length ?? 0) > 0;
        } catch {
            return undefined;
        }
    }
}
