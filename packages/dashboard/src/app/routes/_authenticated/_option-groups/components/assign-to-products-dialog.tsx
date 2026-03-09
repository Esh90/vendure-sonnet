import { ProductMultiSelectorDialog } from '@/vdb/components/data-input/product-multi-selector-input.js';
import { api } from '@/vdb/graphql/api.js';
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addOptionGroupToProductDocument } from '../../_products/products.graphql.js';

export function AssignToProductsDialog({
    optionGroupId,
    open,
    onOpenChange,
}: Readonly<{
    optionGroupId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}>) {
    const { t } = useLingui();
    const queryClient = useQueryClient();

    const addOptionGroupMutation = useMutation({
        mutationFn: api.mutate(addOptionGroupToProductDocument),
    });

    const handleSelectionChange = async (productIds: string[]) => {
        if (productIds.length === 0) return;

        const results = await Promise.allSettled(
            productIds.map(productId =>
                addOptionGroupMutation.mutateAsync({
                    productId,
                    optionGroupId,
                }),
            ),
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (failed === 0) {
            toast.success(t`Successfully assigned option group to ${succeeded} products`);
        } else {
            toast.warning(
                t`Assigned to ${succeeded} products, but ${failed} failed`,
            );
        }

        queryClient.invalidateQueries({ queryKey: ['DetailPage', 'productOptionGroup'] });
        queryClient.invalidateQueries({ queryKey: ['optionGroupProducts', optionGroupId] });
    };

    return (
        <ProductMultiSelectorDialog
            mode="product"
            onSelectionChange={handleSelectionChange}
            open={open}
            onOpenChange={onOpenChange}
        />
    );
}
