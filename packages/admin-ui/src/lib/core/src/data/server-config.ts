import { Injectable, Injector } from '@angular/core';
import { DEFAULT_CHANNEL_CODE } from '@vendure/common/lib/shared-constants';
import { lastValueFrom } from 'rxjs';

import {
    CurrentUserFragment,
    CustomFieldConfig,
    CustomFields,
    GetCurrentUserQuery,
    GetGlobalSettingsQuery,
    GetServerConfigQuery,
    OrderProcessState,
    PermissionDefinition,
} from '../common/generated-types';
import { LocalStorageService } from '../providers/local-storage/local-storage.service';

import { GET_CURRENT_USER } from './definitions/auth-definitions';
import { GET_GLOBAL_SETTINGS, GET_SERVER_CONFIG } from './definitions/settings-definitions';
import { BaseDataService } from './providers/base-data.service';

export function initializeServerConfigService(serverConfigService: ServerConfigService): () => Promise<any> {
    return serverConfigService.init();
}

/**
 * A service which fetches the config from the server upon initialization, and then provides that config
 * to the components which require it.
 */
@Injectable()
export class ServerConfigService {
    private _serverConfig: GetServerConfigQuery['globalSettings']['serverConfig'] = {} as any;
    customFieldsMap: Map<string, CustomFieldConfig[]> = new Map();
    private get baseDataService() {
        return this.injector.get<BaseDataService>(BaseDataService);
    }

    constructor(
        private injector: Injector,
        private localStorageService: LocalStorageService,
    ) {}

    /**
     * Fetches the ServerConfig. Should be run as part of the app bootstrap process by attaching
     * to the Angular APP_INITIALIZER token.
     */
    init(): () => Promise<any> {
        return () => this.getServerConfig();
    }

    /**
     * Fetch the ServerConfig. Should be run on app init (in case user is already logged in) and on successful login.
     */
    getServerConfig() {
        return this.ensureActiveChannelToken().then(() =>
            lastValueFrom(this.baseDataService.query<GetServerConfigQuery>(GET_SERVER_CONFIG).single$).then(
                result => {
                    this._serverConfig = result.globalSettings.serverConfig;
                    for (const entityCustomFields of this._serverConfig.entityCustomFields) {
                        this.customFieldsMap.set(
                            entityCustomFields.entityName,
                            entityCustomFields.customFields,
                        );
                    }
                },
                err => {
                    // Let the error fall through to be caught by the http interceptor.
                },
            ),
        );
    }

    private ensureActiveChannelToken(): Promise<void> {
        if (this.localStorageService.get('activeChannelToken')) {
            return Promise.resolve();
        }
        return lastValueFrom(this.baseDataService.query<GetCurrentUserQuery>(GET_CURRENT_USER).single$).then(
            ({ me }) => {
                if (me?.channels.length) {
                    this.localStorageService.set(
                        'activeChannelToken',
                        this.getActiveChannel(me.channels).token,
                    );
                }
            },
            () => {
                // Ignore unauthenticated app initialization; the main server config request handles errors.
            },
        );
    }

    private getActiveChannel(userChannels: CurrentUserFragment['channels']) {
        const lastActiveChannelToken = this.localStorageService.get('activeChannelToken');
        if (lastActiveChannelToken) {
            const lastActiveChannel = userChannels.find(c => c.token === lastActiveChannelToken);
            if (lastActiveChannel) {
                return lastActiveChannel;
            }
        }
        const defaultChannel = userChannels.find(c => c.code === DEFAULT_CHANNEL_CODE);
        return defaultChannel || userChannels[0];
    }

    getAvailableLanguages() {
        return this.baseDataService
            .query<GetGlobalSettingsQuery>(GET_GLOBAL_SETTINGS, {}, 'cache-first')
            .mapSingle(res => res.globalSettings.availableLanguages);
    }

    /**
     * When any of the GlobalSettings are modified, this method should be called to update the Apollo cache.
     */
    refreshGlobalSettings() {
        return this.baseDataService.query<GetGlobalSettingsQuery>(GET_GLOBAL_SETTINGS, {}, 'network-only')
            .single$;
    }

    /**
     * Retrieves the custom field configs for the given entity type.
     */
    getCustomFieldsFor(type: Exclude<keyof CustomFields, '__typename'> | string): CustomFieldConfig[] {
        return this.customFieldsMap.get(type) || [];
    }

    getOrderProcessStates(): OrderProcessState[] {
        return this.serverConfig.orderProcess;
    }

    getPermittedAssetTypes(): string[] {
        return this.serverConfig.permittedAssetTypes;
    }

    getPermissionDefinitions(): PermissionDefinition[] {
        return this.serverConfig.permissions;
    }

    get serverConfig(): GetServerConfigQuery['globalSettings']['serverConfig'] {
        return this._serverConfig;
    }
}
