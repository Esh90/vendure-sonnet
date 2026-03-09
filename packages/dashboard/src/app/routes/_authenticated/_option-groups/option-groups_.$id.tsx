import { SlugInput } from '@/vdb/components/data-input/index.js';
import { ErrorPage } from '@/vdb/components/shared/error-page.js';
import { FormFieldWrapper } from '@/vdb/components/shared/form-field-wrapper.js';
import { TranslatableFormFieldWrapper } from '@/vdb/components/shared/translatable-form-field.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Input } from '@/vdb/components/ui/input.js';
import { NEW_ENTITY_PATH } from '@/vdb/constants.js';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import {
    CustomFieldsPageBlock,
    DetailFormGrid,
    Page,
    PageActionBar,
    PageBlock,
    PageLayout,
    PageTitle,
} from '@/vdb/framework/layout-engine/page-layout.js';
import { ActionBarItem } from '@/vdb/framework/layout-engine/action-bar-item-wrapper.js';
import { detailPageRouteLoader } from '@/vdb/framework/page/detail-page-route-loader.js';
import { useDetailPage } from '@/vdb/framework/page/use-detail-page.js';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AssignedChannels } from '@/vdb/components/shared/assigned-channels.js';
import { api } from '@/vdb/graphql/api.js';
import { AssignToProductsDialog } from './components/assign-to-products-dialog.js';
import { ProductOptionsTable } from '../_products/components/product-options-table.js';
import { SharedOptionGroupWarning } from '../_products/components/shared-option-group-warning.js';
import {
    assignOptionGroupsToChannelDocument,
    removeOptionGroupsFromChannelDocument,
} from './option-groups.graphql.js';
import {
    createProductOptionGroupDocument,
    productOptionGroupDetailDocument,
    updateProductOptionGroupDocument,
} from '../_products/product-option-groups.graphql.js';

const pageId = 'option-group-detail';

export const Route = createFileRoute('/_authenticated/_option-groups/option-groups_/$id')({
    component: OptionGroupDetailPage,
    loader: detailPageRouteLoader({
        pageId,
        queryDocument: productOptionGroupDetailDocument,
        breadcrumb(isNew, entity) {
            return [
                { path: '/option-groups', label: <Trans>Option Groups</Trans> },
                isNew ? <Trans>New option group</Trans> : entity?.name,
            ];
        },
    }),
    errorComponent: ({ error }) => <ErrorPage message={error.message} />,
});

function OptionGroupDetailPage() {
    const params = Route.useParams();
    const navigate = useNavigate();
    const creatingNewEntity = params.id === NEW_ENTITY_PATH;
    const { t } = useLingui();
    const { channels } = useChannel();
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    const { form, submitHandler, entity, isPending, resetForm } = useDetailPage({
        pageId,
        queryDocument: productOptionGroupDetailDocument,
        createDocument: createProductOptionGroupDocument,
        updateDocument: updateProductOptionGroupDocument,
        setValuesForUpdate: entity => {
            return {
                id: entity.id,
                code: entity.code,
                translations: entity.translations.map(translation => ({
                    id: translation.id,
                    languageCode: translation.languageCode,
                    name: translation.name,
                    customFields: (translation as any).customFields,
                })),
                customFields: entity.customFields,
            };
        },
        transformCreateInput: values => {
            return {
                ...values,
                options: [],
            };
        },
        params: { id: params.id },
        onSuccess: async data => {
            toast(
                creatingNewEntity
                    ? t`Successfully created option group`
                    : t`Successfully updated option group`,
            );
            resetForm();
            if (creatingNewEntity) {
                await navigate({ to: `../$id`, params: { id: data.id } });
            }
        },
        onError: err => {
            toast(
                creatingNewEntity
                    ? t`Failed to create option group`
                    : t`Failed to update option group`,
                {
                    description: err instanceof Error ? err.message : 'Unknown error',
                },
            );
        },
    });

    return (
        <Page pageId={pageId} form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>
                {creatingNewEntity ? <Trans>New option group</Trans> : (entity?.name ?? '')}
            </PageTitle>
            <PageActionBar>
                <ActionBarItem
                    itemId="save-button"
                    requiresPermission={['UpdateProduct', 'UpdateCatalog']}
                >
                    <Button
                        type="submit"
                        disabled={!form.formState.isDirty || !form.formState.isValid || isPending}
                    >
                        {creatingNewEntity ? <Trans>Create</Trans> : <Trans>Update</Trans>}
                    </Button>
                </ActionBarItem>
            </PageActionBar>
            <PageLayout>
                {entity && <SharedOptionGroupWarning productCount={entity.productCount} />}
                <PageBlock column="main" blockId="main-form">
                    <DetailFormGrid>
                        <TranslatableFormFieldWrapper
                            control={form.control}
                            name="name"
                            label={<Trans>Name</Trans>}
                            render={({ field }) => <Input {...field} />}
                        />
                        <FormFieldWrapper
                            control={form.control}
                            name="code"
                            label={<Trans>Code</Trans>}
                            render={({ field }) => (
                                <SlugInput
                                    fieldName="code"
                                    watchFieldName="name"
                                    entityName="ProductOptionGroup"
                                    entityId={entity?.id}
                                    {...field}
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <CustomFieldsPageBlock
                    column="main"
                    entityType="ProductOptionGroup"
                    control={form.control}
                />
                {entity && (
                    <PageBlock
                        column="main"
                        blockId="product-options"
                        title={<Trans>Product Options</Trans>}
                    >
                        <ProductOptionsTable
                            productOptionGroupId={entity.id}
                            getOptionHref={optionId =>
                                `/option-groups/${entity.id}/options/${optionId}`
                            }
                            newOptionHref={`/option-groups/${entity.id}/options/new`}
                        />
                    </PageBlock>
                )}
                {entity && (
                    <PageBlock column="side" blockId="products" title={<Trans>Products</Trans>}>
                        <p className="text-sm text-muted-foreground mb-3">
                            <Plural
                                value={entity.productCount}
                                _0="Not assigned to any products"
                                one="Assigned to # product"
                                other="Assigned to # products"
                            />
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignDialogOpen(true)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            <Trans>Assign to products</Trans>
                        </Button>
                        <AssignToProductsDialog
                            optionGroupId={entity.id}
                            open={assignDialogOpen}
                            onOpenChange={setAssignDialogOpen}
                        />
                    </PageBlock>
                )}
                {channels.length > 1 && entity && (
                    <PageBlock column="side" blockId="channels" title={<Trans>Channels</Trans>}>
                        <AssignedChannels
                            channels={entity.channels}
                            entityId={entity.id}
                            entityType="option group"
                            canUpdate={!creatingNewEntity}
                            assignMutationFn={api.mutate(assignOptionGroupsToChannelDocument)}
                            removeMutationFn={api.mutate(removeOptionGroupsFromChannelDocument)}
                            buildRemoveInput={(eid, channelId) => ({
                                productOptionGroupIds: [eid],
                                channelId,
                            })}
                            buildAssignInput={(eid, channelId) => ({
                                productOptionGroupIds: [eid],
                                channelId,
                            })}
                            queryKeyScope={['DetailPage', 'ProductOptionGroupDetail']}
                        />
                    </PageBlock>
                )}
            </PageLayout>
        </Page>
    );
}
