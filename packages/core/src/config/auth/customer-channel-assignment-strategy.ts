import { RequestContext } from '../../api/common/request-context';
import { ID } from '@vendure/common/lib/shared-types';
import { InjectableStrategy } from '../../common/types/injectable-strategy';
import { Customer } from '../../entity/customer/customer.entity';

/**
 * @description
 * Assigns a {@link Customer} to the active channel if they are not yet a member of it.
 * when the {@link AuthGuard} detects they are not yet a member of it.
 *
 * @docsCategory auth
 * @since 3.4.0
 */
export interface CustomerChannelAssignmentStrategy extends InjectableStrategy {
    /**
     * @description
     * Called before a customer is automatically assigned to the active channel.
     * Return `true` to allow the assignment, or `false` to prevent it.
     */
    canAssignCustomerToChannel(
        ctx: RequestContext,
        customer: Customer,
        channelId: ID,
    ): boolean | Promise<boolean>;
}
