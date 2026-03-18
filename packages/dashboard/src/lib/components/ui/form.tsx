import * as React from 'react';
import {
    Controller,
    type ControllerProps,
    type FieldPath,
    type FieldValues,
    FormProvider,
    useFormContext,
    useFormState,
} from 'react-hook-form';

import { Field, FieldDescription, FieldError, FieldLabel } from '@/vdb/components/ui/field.js';
import { cn } from '@/vdb/lib/utils.js';

const Form = FormProvider;

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
    name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

const FormField = <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
    ...props
}: ControllerProps<TFieldValues, TName>) => {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    );
};

const useFormField = () => {
    const fieldContext = React.useContext(FormFieldContext);
    const itemContext = React.useContext(FormItemContext);
    const { getFieldState } = useFormContext();

    // When used outside <FormField>, fieldContext.name is undefined — return safe defaults.
    const formState = useFormState({ name: fieldContext.name });
    const fieldState = fieldContext.name
        ? getFieldState(fieldContext.name, formState)
        : ({ invalid: false, isDirty: false, isTouched: false, isValidating: false, error: undefined } as const);

    const { id } = itemContext;

    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    };
};

type FormItemContextValue = {
    id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

function FormItem({ className, ...props }: React.ComponentProps<typeof Field>) {
    const id = React.useId();

    return (
        <FormItemContext.Provider value={{ id }}>
            <Field className={cn('gap-2', className)} {...props} />
        </FormItemContext.Provider>
    );
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof FieldLabel>) {
    const { error, formItemId } = useFormField();

    return (
        <FieldLabel
            data-error={!!error}
            className={cn('data-[error=true]:text-destructive', className)}
            htmlFor={formItemId}
            {...props}
        />
    );
}

function FormControl({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

    if (!React.isValidElement(children)) {
        return children;
    }

    return React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        'data-slot': 'form-control',
        id: formItemId,
        'aria-describedby': !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`,
        'aria-invalid': !!error,
        ...props,
    });
}

function FormDescription({ className, ...props }: React.ComponentProps<typeof FieldDescription>) {
    const { formDescriptionId } = useFormField();

    return (
        <FieldDescription
            id={formDescriptionId}
            className={cn('text-xs', className)}
            {...props}
        />
    );
}

function FormMessage({ className, children, ...props }: React.ComponentProps<typeof FieldError>) {
    const { error, formMessageId } = useFormField();

    return (
        <FieldError
            id={formMessageId}
            className={className}
            errors={error ? [{ message: String(error.message ?? '') }] : undefined}
            {...props}
        >
            {!error ? children : undefined}
        </FieldError>
    );
}

export { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField };
