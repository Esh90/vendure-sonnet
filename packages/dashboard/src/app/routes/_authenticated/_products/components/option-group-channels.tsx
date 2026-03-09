import { AssignToChannelDialog } from '@/vdb/components/shared/assign-to-channel-dialog.js';
import { ChannelChip } from '@/vdb/components/shared/channel-chip.js';
import { Button } from '@/vdb/components/ui/button.js';
import { api } from '@/vdb/graphql/api.js';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    assignOptionGroupsToChannelDocument,
    removeOptionGroupsFromChannelDocument,
} from '../../_option-groups/option-groups.graphql.js';
import type { SimpleChannel } from '@/vdb/providers/channel-provider.js';

export function OptionGroupChannels({
    channels,
    entityId,
    canUpdate = true,
}: Readonly<{
    channels: SimpleChannel[];
    entityId: string;
    canUpdate?: boolean;
}>) {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const { activeChannel, channels: allChannels } = useChannel();
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    const { mutate: removeFromChannel, isPending: isRemoving } = useMutation({
        mutationFn: api.mutate(removeOptionGroupsFromChannelDocument),
        onSuccess: () => {
            toast.success(t`Successfully removed option group from channel`);
            queryClient.invalidateQueries({ queryKey: ['DetailPage'] });
        },
        onError: () => {
            toast.error(t`Failed to remove option group from channel`);
        },
    });

    function onRemoveHandler(channelId: string) {
        if (channelId === activeChannel?.id) {
            toast.error(t`Cannot remove from active channel`);
            return;
        }
        removeFromChannel({
            input: {
                productOptionGroupIds: [entityId],
                channelId,
            },
        });
    }

    const handleAssignSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['DetailPage'] });
        setAssignDialogOpen(false);
    };

    const availableChannels = allChannels.filter(ch => !channels.map(c => c.id).includes(ch.id));
    const showAddButton = canUpdate && availableChannels.length > 0;

    return (
        <>
            <div className="flex flex-wrap gap-1 mb-2">
                {channels.map(channel => (
                    <ChannelChip
                        key={channel.id}
                        channel={channel}
                        removable={canUpdate && channel.id !== activeChannel?.id}
                        onRemove={onRemoveHandler}
                    />
                ))}
            </div>
            {showAddButton && (
                <>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAssignDialogOpen(true)}
                        disabled={isRemoving}
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        <Trans>Assign to channel</Trans>
                    </Button>
                    <AssignToChannelDialog
                        entityType="option group"
                        open={assignDialogOpen}
                        onOpenChange={setAssignDialogOpen}
                        entityIds={[entityId]}
                        mutationFn={api.mutate(assignOptionGroupsToChannelDocument)}
                        onSuccess={handleAssignSuccess}
                        buildInput={(channelId: string) => ({
                            productOptionGroupIds: [entityId],
                            channelId,
                        })}
                    />
                </>
            )}
        </>
    );
}
