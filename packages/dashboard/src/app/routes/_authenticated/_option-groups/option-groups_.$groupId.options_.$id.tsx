import { SlugInput } from '@/vdb/components/data-input/index.js';
import { PageBreadcrumb } from '@/vdb/components/layout/generated-breadcrumbs.js';
import { ErrorPage } from '@/vdb/components/shared/error-page.js';
import { FormFieldWrapper } from '@/vdb/components/shared/form-field-wrapper.js';
import { TranslatableFormFieldWrapper } from '@/vdb/components/shared/translatable-form-field.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Input } from '@/vdb/components/ui/input.js';
import { NEW_ENTITY_PATH } from '@/vdb/constants.js';
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
import { Trans, useLingui } from '@lingui/react/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
    createProductOptionDocument,
    productOptionDetailDocument,
    updateProductOptionDocument,
} from '../_products/product-option-groups.graphql.js';

const pageId = 'option-group-option-detail';

export const Route = createFileRoute(
    '/_authenticated/_option-groups/option-groups_/$groupId/options_/$id',
)({
    component: OptionGroupOptionDetailPage,
    loader: detailPageRouteLoader({
        pageId,
        queryDocument: productOptionDetailDocument,
        breadcrumb(isNew, entity) {
            const groupName = entity?.group?.name ?? 'Option Group';
            const breadcrumb: PageBreadcrumb[] = [
                { path: '/option-groups', label: <Trans>Option Groups</Trans> },
            ];
            if (isNew) {
                breadcrumb.push(<Trans>New option</Trans>);
            } else if (entity) {
                breadcrumb.push(
                    { path: `/option-groups/${entity.group.id}`, label: groupName },
                    entity.name,
                );
            }
            return breadcrumb;
        },
    }),
    errorComponent: ({ error }) => <ErrorPage message={error.message} />,
});

function OptionGroupOptionDetailPage() {
    const params = Route.useParams();
    const navigate = useNavigate();
    const creatingNewEntity = params.id === NEW_ENTITY_PATH;
    const { t } = useLingui();

    const { form, submitHandler, entity, isPending, resetForm } = useDetailPage({
        pageId,
        queryDocument: productOptionDetailDocument,
        createDocument: createProductOptionDocument,
        updateDocument: updateProductOptionDocument,
        setValuesForUpdate: entity => {
            return {
                id: entity.id,
                code: entity.code,
                name: entity.name,
                translations: entity.translations.map(translation => ({
                    id: translation.id,
                    languageCode: translation.languageCode,
                    name: translation.name,
                    customFields: (translation as any).customFields,
                })),
                customFields: entity.customFields as any,
            };
        },
        transformCreateInput: (value): any => {
            return {
                ...value,
                productOptionGroupId: params.groupId,
            };
        },
        params: { id: params.id },
        onSuccess: async data => {
            toast(
                creatingNewEntity
                    ? t`Successfully created product option`
                    : t`Successfully updated product option`,
            );
            resetForm();
            const created = Array.isArray(data) ? data[0] : data;
            if (creatingNewEntity && created) {
                await navigate({ to: `../$id`, params: { id: (created as any).id } });
            }
        },
        onError: err => {
            toast(
                creatingNewEntity
                    ? t`Failed to create product option`
                    : t`Failed to update product option`,
                {
                    description: err instanceof Error ? err.message : 'Unknown error',
                },
            );
        },
    });

    return (
        <Page pageId={pageId} form={form} submitHandler={submitHandler} entity={entity}>
            <PageTitle>
                {creatingNewEntity ? (
                    <Trans>New product option</Trans>
                ) : (
                    (entity as any)?.name ?? ''
                )}
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
                {entity?.group && (
                    <PageBlock column="side" blockId="option-group-info">
                        <div className="space-y-2">
                            <div className="text-sm font-medium">
                                <Trans>Option Group</Trans>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {entity?.group.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {entity?.group.code}
                            </div>
                        </div>
                    </PageBlock>
                )}
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
                                    entityName="ProductOption"
                                    entityId={entity?.id}
                                    {...field}
                                />
                            )}
                        />
                    </DetailFormGrid>
                </PageBlock>
                <CustomFieldsPageBlock
                    column="main"
                    entityType="ProductOption"
                    control={form.control}
                />
            </PageLayout>
        </Page>
    );
}
