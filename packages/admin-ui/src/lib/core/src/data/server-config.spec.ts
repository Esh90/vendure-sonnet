import { Injector } from '@angular/core';
import { DEFAULT_CHANNEL_CODE } from '@vendure/common/lib/shared-constants';
import { of, throwError } from 'rxjs';

import { LocalStorageService } from '../providers/local-storage/local-storage.service';

import { GET_CURRENT_USER } from './definitions/auth-definitions';
import { GET_SERVER_CONFIG } from './definitions/settings-definitions';
import { BaseDataService } from './providers/base-data.service';
import { ServerConfigService } from './server-config';

describe('ServerConfigService', () => {
    const serverConfigResult = {
        globalSettings: {
            serverConfig: {
                entityCustomFields: [],
            },
        },
    };

    function createService(
        query: jasmine.Spy,
        storedValues: Record<string, any> = {},
    ): {
        service: ServerConfigService;
        localStorageService: jasmine.SpyObj<LocalStorageService>;
    } {
        const localStorageService = jasmine.createSpyObj<LocalStorageService>('LocalStorageService', [
            'get',
            'set',
        ]);
        localStorageService.get.and.callFake((key: string) => storedValues[key] ?? null);
        localStorageService.set.and.callFake((key: string, value: any) => {
            storedValues[key] = value;
        });

        const injector = jasmine.createSpyObj<Injector>('Injector', ['get']);
        injector.get.withArgs(BaseDataService).and.returnValue({ query });

        return {
            service: new ServerConfigService(injector, localStorageService),
            localStorageService,
        };
    }

    it('sets the active channel token before fetching the server config', async () => {
        const query = jasmine.createSpy('query').and.callFake(document => {
            if (document === GET_CURRENT_USER) {
                return {
                    single$: of({
                        me: {
                            channels: [
                                { code: 'secondary', token: 'secondary-token' },
                                { code: DEFAULT_CHANNEL_CODE, token: 'default-token' },
                            ],
                        },
                    }),
                };
            }
            if (document === GET_SERVER_CONFIG) {
                return { single$: of(serverConfigResult) };
            }
        });
        const { service, localStorageService } = createService(query);

        await service.getServerConfig();

        expect(query.calls.allArgs().map(args => args[0])).toEqual([GET_CURRENT_USER, GET_SERVER_CONFIG]);
        expect(localStorageService.set).toHaveBeenCalledWith('activeChannelToken', 'default-token');
    });

    it('does not fetch the current user when an active channel token already exists', async () => {
        const query = jasmine.createSpy('query').and.returnValue({ single$: of(serverConfigResult) });
        const { service } = createService(query, { activeChannelToken: 'stored-token' });

        await service.getServerConfig();

        expect(query.calls.allArgs().map(args => args[0])).toEqual([GET_SERVER_CONFIG]);
    });

    it('still fetches the server config when current user lookup fails', async () => {
        const query = jasmine.createSpy('query').and.callFake(document => {
            if (document === GET_CURRENT_USER) {
                return { single$: throwError(() => new Error('Not authenticated')) };
            }
            if (document === GET_SERVER_CONFIG) {
                return { single$: of(serverConfigResult) };
            }
        });
        const { service } = createService(query);

        await service.getServerConfig();

        expect(query.calls.allArgs().map(args => args[0])).toEqual([GET_CURRENT_USER, GET_SERVER_CONFIG]);
    });
});
