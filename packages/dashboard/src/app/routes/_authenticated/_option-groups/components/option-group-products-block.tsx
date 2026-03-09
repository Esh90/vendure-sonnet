import { Button } from '@/vdb/components/ui/button.js';
import { Plural, Trans } from '@lingui/react/macro';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AssignToProductsDialog } from './assign-to-products-dialog.js';

export function OptionGroupProductsBlock({
    optionGroupId,
    productCount,
}: Readonly<{
    optionGroupId: string;
    productCount: number;
}>) {
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    return (
        <>
            <p className="text-sm text-muted-foreground mb-3">
                <Plural
                    value={productCount}
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
                optionGroupId={optionGroupId}
                open={assignDialogOpen}
                onOpenChange={setAssignDialogOpen}
            />
        </>
    );
}
