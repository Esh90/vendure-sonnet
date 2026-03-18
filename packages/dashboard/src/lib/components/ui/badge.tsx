import * as React from 'react';

import { cn } from '@/vdb/lib/utils.js';

import {
    Badge as BaseBadge,
    badgeVariants as baseBadgeVariants,
} from '@vendure-io/ui/components/ui/badge';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;

/**
 * Wrapper around @vendure-io/ui Badge that adds the "success" variant
 * which is used in the dashboard but not available in the base library.
 */
function Badge({
    className,
    variant,
    ...props
}: Omit<BaseBadgeProps, 'variant'> & {
    variant?: BaseBadgeProps['variant'] | 'success';
}) {
    if (variant === 'success') {
        return (
            <BaseBadge
                className={cn(
                    'bg-success text-success-foreground [a]:hover:bg-success/80',
                    className,
                )}
                {...props}
            />
        );
    }
    return <BaseBadge className={className} variant={variant} {...props} />;
}

export { Badge, baseBadgeVariants as badgeVariants };
