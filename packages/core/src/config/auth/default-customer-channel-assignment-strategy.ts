import { ID } from '@vendure/common/lib/shared-types';

import { RequestContext } from '../../api/common/request-context';
import { Customer } from '../../entity/customer/customer.entity';

import { CustomerChannelAssignmentStrategy } from './customer-channel-assignment-strategy';

/**
 * @description
 * The default {@link CustomerChannelAssignmentStrategy}, preserves the existing behavior
 * it automatically assigns any authenticated customer to an active channel.
 *
 * @docsCategory auth
 * @since 3.4.0
 */
export class DefaultCustomerChannelAssignmentStrategy implements CustomerChannelAssignmentStrategy {
    canAssignCustomerToChannel(_ctx: RequestContext, _customer: Customer, _channelId: ID): boolean {
        return true;
    }
}
