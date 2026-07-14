import * as React from 'react';
import { Slot as SlotPrimitive } from 'radix-ui';
import {
  Controller,
  type ControllerProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
  FormProvider,
  type FormProviderProps,
  useFormContext,
  useFormState
} from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Slot = SlotPrimitive.Root;

export type RetainedSubmitErrors = Readonly<Record<string, FieldError>>;

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  name: TName;
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
);
const RetainedSubmitErrorsContext =
  React.createContext<RetainedSubmitErrors | null>(null);

function Form<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues
>(props: FormProviderProps<TFieldValues, TContext, TTransformedValues>) {
  return <FormProvider {...props} />;
}

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: ControllerProps<TFieldValues, TName>
) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const retainedSubmitErrors = React.useContext(RetainedSubmitErrorsContext);
  const formContext = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = formContext.getFieldState(fieldContext.name, formState);
  const retainedError = retainedSubmitErrors?.[String(fieldContext.name)];
  const visibleError = fieldState.error ?? retainedError;

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  return {
    id: itemContext.id,
    name: fieldContext.name,
    formItemId: `${itemContext.id}-form-item`,
    formDescriptionId: `${itemContext.id}-form-item-description`,
    formMessageId: `${itemContext.id}-form-item-message`,
    ...fieldState,
    error: visibleError,
    invalid: fieldState.invalid || !!visibleError
  };
};

interface FormItemContextValue {
  id: string;
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
);

function FormItem(props: React.ComponentProps<'div'>) {
  const { className, ...itemProps } = props;
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn('grid gap-1.5 flex flex-col overflow-hidden', className)}
        {...itemProps}
      />
    </FormItemContext.Provider>
  );
}

function FormLabel(
  props: React.ComponentProps<'label'> & {
    required?: boolean;
  }
) {
  const { className, required, children, ...labelProps } = props;
  const formField = useFormField();

  return (
    <Label
      data-slot="form-label"
      data-error={!!formField.error}
      className={cn('data-[error=true]:text-destructive', className)}
      htmlFor={formField.formItemId}
      {...labelProps}
    >
      {children}
      {required && <span className="-ms-1 text-destructive">*</span>}
    </Label>
  );
}

function FormControl(props: React.ComponentProps<typeof Slot>) {
  const { ...controlProps } = props;
  const formField = useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formField.formItemId}
      data-field-name={String(formField.name)}
      data-invalid={!!formField.error}
      {...controlProps}
    />
  );
}

function FormMessage(props: React.ComponentProps<'p'>) {
  const { className, ...messageProps } = props;
  const formField = useFormField();
  const body = formField.error
    ? String(formField.error.message ?? '')
    : messageProps.children;

  if (!body) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formField.formMessageId}
      className={cn('text-destructive text-sm', className)}
      {...messageProps}
    >
      {body}
    </p>
  );
}

interface RetainedSubmitErrorsProviderProps {
  errors: RetainedSubmitErrors | null;
  children: React.ReactNode;
}

function RetainedSubmitErrorsProvider(
  props: RetainedSubmitErrorsProviderProps
) {
  return (
    <RetainedSubmitErrorsContext.Provider value={props.errors}>
      {props.children}
    </RetainedSubmitErrorsContext.Provider>
  );
}

export {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
  RetainedSubmitErrorsProvider,
  useFormField
};
