import { Alert, AlertDescription } from '@/vdb/components/ui/alert.js';
import { Button } from '@/vdb/components/ui/button.js';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/vdb/components/ui/dialog.js';
import { api } from '@/vdb/graphql/api.js';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { Trans, useLingui } from '@lingui/react/macro';
import { normalizeString } from '@/vdb/lib/utils.js';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCallback, useMemo, useState } from 'react';
import {
    addOptionGroupToProductDocument,
    createProductOptionGroupDocument,
    createProductVariantsDocument,
} from '../products.graphql.js';
import { CreateProductVariants, VariantConfiguration } from './create-product-variants.js';
import { OptionGroupConfiguration } from './option-groups-editor.js';

interface ExistingOptionGroup {
    id: string;
    code: string;
    name: string;
    options: Array<{
        id: string;
        code: string;
        name: string;
    }>;
}

export function CreateProductVariantsDialog({
    productId,
    productName,
    existingOptionGroups = [],
    onSuccess,
}: {
    productId: string;
    productName: string;
    existingOptionGroups?: ExistingOptionGroup[];
    onSuccess?: () => void;
}) {
    const { t } = useLingui();
    const { activeChannel } = useChannel();
    const [variantData, setVariantData] = useState<VariantConfiguration | null>(null);
    const [open, setOpen] = useState(false);

    const createOptionGroupMutation = useMutation({
        mutationFn: api.mutate(createProductOptionGroupDocument),
    });

    const addOptionGroupToProductMutation = useMutation({
        mutationFn: api.mutate(addOptionGroupToProductDocument),
    });

    const createProductVariantsMutation = useMutation({
        mutationFn: api.mutate(createProductVariantsDocument),
    });

    // Map existing option groups to the format expected by the editor.
    // Crucially, the values[].id here are real server option IDs.
    const initialGroups: OptionGroupConfiguration['optionGroups'] = useMemo(
        () =>
            existingOptionGroups
                .filter(g => g.name.trim() && g.options.length > 0)
                .map(g => ({
                    name: g.name,
                    values: g.options.map(o => ({
                        value: o.name,
                        id: o.id,
                    })),
                })),
        [existingOptionGroups],
    );

    // Set of existing option group names for quick lookup
    const existingGroupNames = useMemo(
        () => new Set(existingOptionGroups.filter(g => g.name.trim()).map(g => g.name)),
        [existingOptionGroups],
    );

    async function handleCreateVariants() {
        if (!variantData || !activeChannel?.defaultLanguageCode) return;

        try {
            const validOptionGroups = variantData.optionGroups.filter(
                g => g.name.trim() && g.values.length > 0,
            );

            // Split into existing and new groups
            const newOptionGroups = validOptionGroups.filter(g => !existingGroupNames.has(g.name));

            // 1. Create only NEW option groups
            const createdOptionGroups = await Promise.all(
                newOptionGroups.map(async optionGroup => {
                    const result = await createOptionGroupMutation.mutateAsync({
                        input: {
                            code: normalizeString(optionGroup.name, '-'),
                            translations: [
                                {
                                    languageCode: activeChannel.defaultLanguageCode,
                                    name: optionGroup.name,
                                },
                            ],
                            options: optionGroup.values.map(value => ({
                                code: normalizeString(value.value, '-'),
                                translations: [
                                    {
                                        languageCode: activeChannel.defaultLanguageCode,
                                        name: value.value,
                                    },
                                ],
                            })),
                        },
                    });
                    return result.createProductOptionGroup;
                }),
            );

            // 2. Add only NEW option groups to product
            await Promise.all(
                createdOptionGroups.map(group =>
                    addOptionGroupToProductMutation.mutateAsync({
                        productId,
                        optionGroupId: group.id,
                    }),
                ),
            );

            // 3. Create variants
            const variantsToCreate = variantData.variants
                .filter(variant => variant.enabled)
                .map(variant => {
                    const name = variant.options.length
                        ? `${productName} ${variant.options.map(option => option.value).join(' ')}`
                        : productName;

                    return {
                        productId,
                        sku: variant.sku,
                        price: Number(variant.price),
                        stockOnHand: Number(variant.stock),
                        optionIds: variant.options.map(option => {
                            // For existing groups, the option.id is already the real server ID
                            if (existingGroupNames.has(option.name)) {
                                return option.id;
                            }
                            // For new groups, look up the created option by name
                            const optionGroup = createdOptionGroups.find(
                                g => g.name === option.name,
                            );
                            if (!optionGroup) {
                                throw new Error(
                                    `Could not find option group ${option.name}`,
                                );
                            }
                            const createdOption = optionGroup.options.find(
                                o => o.name === option.value,
                            );
                            if (!createdOption) {
                                throw new Error(
                                    `Could not find option ${option.value} in group ${option.name}`,
                                );
                            }
                            return createdOption.id;
                        }),
                        translations: [
                            {
                                languageCode: activeChannel.defaultLanguageCode,
                                name: name,
                            },
                        ],
                    };
                });

            await createProductVariantsMutation.mutateAsync({ input: variantsToCreate });
            setOpen(false);
            onSuccess?.();
        } catch (error) {
            console.error('Error creating variants:', error);
            toast.error(t`Failed to create variants`);
        }
    }

    const handleOnChange = useCallback(
        ({ data }: { data: VariantConfiguration }) => setVariantData(data),
        [],
    );
    const createCount = Object.values(variantData?.variants ?? {}).filter(v => v.enabled).length;
    const hasInvalidOptionGroups =
        variantData?.optionGroups.some(g => !g.name || g.values.length === 0) ?? false;
    const hasInvalidExistingGroups = existingOptionGroups.some(
        g => !g.name.trim() || g.options.length === 0,
    );

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button type="button">
                        <Plus className="mr-2 h-4 w-4" /> Create Variants
                    </Button>
                </DialogTrigger>

                <DialogContent className="max-w-90vw">
                    <DialogHeader>
                        <DialogTitle>
                            <Trans>Create Variants</Trans>
                        </DialogTitle>
                        <DialogDescription>
                            <Trans>Create variants for your product</Trans>
                        </DialogDescription>
                    </DialogHeader>
                    {hasInvalidExistingGroups && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>
                                <Trans>
                                    This product has invalid option groups (empty name or no
                                    options). Please remove them from the Manage Variants page
                                    before creating variants.
                                </Trans>
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="mt-4">
                        <CreateProductVariants
                            onChange={handleOnChange}
                            currencyCode={activeChannel?.defaultCurrencyCode}
                            initialGroups={initialGroups}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            onClick={handleCreateVariants}
                            disabled={
                                !variantData ||
                                createOptionGroupMutation.isPending ||
                                addOptionGroupToProductMutation.isPending ||
                                createProductVariantsMutation.isPending ||
                                createCount === 0 ||
                                hasInvalidOptionGroups ||
                                hasInvalidExistingGroups
                            }
                        >
                            {createOptionGroupMutation.isPending ||
                            addOptionGroupToProductMutation.isPending ||
                            createProductVariantsMutation.isPending ? (
                                <Trans>Creating...</Trans>
                            ) : (
                                <Trans>Create {createCount} variants</Trans>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
