import { Button as BaseButton, buttonVariants } from '@vendure-io/ui/components/ui/button';
import { type ComponentProps } from 'react';

/** Auto-sets nativeButton={false} when render is provided to suppress Base UI warnings. */
function Button({ render, nativeButton, ...props }: ComponentProps<typeof BaseButton>) {
    return <BaseButton render={render} nativeButton={render ? (nativeButton ?? false) : nativeButton} {...props} />;
}

export { Button, buttonVariants };
