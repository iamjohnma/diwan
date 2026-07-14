import {
  type FormEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import type {
  FieldError,
  FieldValues,
  SubmitErrorHandler,
  SubmitHandler,
  UseFormReturn
} from 'react-hook-form';
import { useFormContext, useFormState } from 'react-hook-form';
import {
  Form as ReactHookForm,
  type RetainedSubmitErrors,
  RetainedSubmitErrorsProvider
} from '@/components/ui/form';
import { handleError } from '@/lib/errors';
import { resolveAutoFocus } from '@/utils/common/can-auto-focus';
import {
  focusFirstFormError,
  scheduleFocusFirstFormError
} from '@/utils/common/form-error-focus';
import { collectFieldErrorEntries } from '@/utils/common/form-error-tree';

function getFormErrorFocusSignature(
  entries: ReturnType<typeof collectFieldErrorEntries>
): string {
  return entries
    .map((entry) => {
      const message =
        typeof entry.error.message === 'string' ? entry.error.message : '';
      const type = typeof entry.error.type === 'string' ? entry.error.type : '';

      return `${entry.path}:${type}:${message}`;
    })
    .sort()
    .join('|');
}

function FormErrorFocus(props: {
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  const form = useFormContext();
  const formState = useFormState();
  const focusedSubmitCountRef = useRef(0);
  const previousFocusSignatureRef = useRef('');

  useEffect(() => {
    const errorEntries = collectFieldErrorEntries(formState.errors);
    if (formState.submitCount === 0 || errorEntries.length === 0) {
      previousFocusSignatureRef.current = '';

      return;
    }

    if (focusedSubmitCountRef.current === formState.submitCount) {
      return;
    }

    const focusSignature = `${formState.submitCount}:${getFormErrorFocusSignature(
      errorEntries
    )}`;
    if (focusSignature === previousFocusSignatureRef.current) {
      return;
    }

    previousFocusSignatureRef.current = focusSignature;
    focusedSubmitCountRef.current = formState.submitCount;
    const fieldNames = errorEntries.map((entry) => entry.path);
    const formElement = props.formRef.current;

    const cancelScheduled = scheduleFocusFirstFormError(
      formElement,
      fieldNames
    );
    const fallbackTimeoutId = window.setTimeout(() => {
      if (!formElement?.isConnected) {
        return;
      }

      if (focusFirstFormError(formElement, fieldNames)) {
        return;
      }

      if (!resolveAutoFocus(true)) {
        return;
      }

      try {
        const firstField = fieldNames[0];
        if (firstField) {
          form.setFocus(firstField);
        }
      } catch {
        void 0;
      }
    }, 0);

    return () => {
      cancelScheduled();
      window.clearTimeout(fallbackTimeoutId);
    };
  }, [form, formState.errors, formState.submitCount, props.formRef]);
  return null;
}

function isRetainableSubmitError(error: FieldError): boolean {
  return error.type === 'server' || error.type === 'manual';
}

function collectRetainableSubmitErrors(
  value: unknown,
  parentPath = ''
): RetainedSubmitErrors {
  return Object.fromEntries(
    collectFieldErrorEntries(value, parentPath)
      .filter((entry) => isRetainableSubmitError(entry.error))
      .map((entry) => [entry.path, entry.error])
  );
}

interface FormWrapperProps<
  TFieldValues extends FieldValues,
  TContext,
  TTransformedValues extends FieldValues
> {
  form: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  children: React.ReactNode;
  onSubmit?: SubmitHandler<TTransformedValues>;
  onInvalidSubmit?: SubmitErrorHandler<TFieldValues>;
  onNativeSubmit?: FormEventHandler<HTMLFormElement>;
  submitBehavior?: FormSubmitBehavior;
  onValidSubmitStart?: () => void;
  onFireAndForgetError?: (error: unknown) => void;
  className?: string;
  id?: string;
}

export type FormSubmitBehavior = 'await' | 'fire-and-forget';

function reportFireAndForgetError(error: unknown) {
  handleError(error, { forceToast: true });
}

export function Form<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues extends FieldValues = TFieldValues
>(props: FormWrapperProps<TFieldValues, TContext, TTransformedValues>) {
  const [retainedSubmitErrors, setRetainedSubmitErrors] =
    useState<RetainedSubmitErrors | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitTokenRef = useRef(0);
  const settleFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const form = props.form;
  const onSubmit = props.onSubmit;
  const onInvalidSubmit = props.onInvalidSubmit;
  const onNativeSubmit = props.onNativeSubmit;
  const onValidSubmitStart = props.onValidSubmitStart;
  const onFireAndForgetError = props.onFireAndForgetError;
  const submitBehavior = props.submitBehavior ?? 'await';

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (settleFrameRef.current !== null) {
        cancelAnimationFrame(settleFrameRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.requestSubmit();
      }
    },
    []
  );

  const prepareSubmitTracking = useCallback(() => {
    const submitToken = submitTokenRef.current + 1;
    submitTokenRef.current = submitToken;

    if (settleFrameRef.current !== null) {
      cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }

    const previousErrors = collectRetainableSubmitErrors(form.formState.errors);

    setRetainedSubmitErrors(
      Object.keys(previousErrors).length > 0 ? previousErrors : null
    );

    return submitToken;
  }, [form]);

  const scheduleSubmitSettlement = useCallback(
    (submitToken: number) => {
      if (!isMountedRef.current) {
        return;
      }

      settleFrameRef.current = requestAnimationFrame(() => {
        if (!isMountedRef.current || submitTokenRef.current !== submitToken) {
          settleFrameRef.current = null;

          return;
        }

        const latestErrors = collectRetainableSubmitErrors(
          form.formState.errors
        );

        setRetainedSubmitErrors(
          Object.keys(latestErrors).length > 0 ? latestErrors : null
        );

        settleFrameRef.current = requestAnimationFrame(() => {
          settleFrameRef.current = null;

          if (!isMountedRef.current || submitTokenRef.current !== submitToken) {
            return;
          }

          setRetainedSubmitErrors(null);
        });
      });
    },
    [form]
  );

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    async (event) => {
      if (onNativeSubmit) {
        await onNativeSubmit(event);

        return;
      }

      if (!onSubmit) {
        return;
      }

      if (submitBehavior === 'fire-and-forget') {
        event.preventDefault();
        event.stopPropagation();
      }

      const submitToken = prepareSubmitTracking();

      try {
        await form.handleSubmit(async (values, submitEvent) => {
          if (submitBehavior === 'fire-and-forget') {
            onValidSubmitStart?.();
          }

          await onSubmit(values, submitEvent);
        }, onInvalidSubmit)(event);
      } catch (error) {
        if (submitBehavior === 'fire-and-forget') {
          (onFireAndForgetError ?? reportFireAndForgetError)(error);

          return;
        }

        throw error;
      } finally {
        scheduleSubmitSettlement(submitToken);
      }
    },
    [
      form,
      onFireAndForgetError,
      onInvalidSubmit,
      onNativeSubmit,
      onSubmit,
      onValidSubmitStart,
      prepareSubmitTracking,
      scheduleSubmitSettlement,
      submitBehavior
    ]
  );

  return (
    <ReactHookForm {...form}>
      <RetainedSubmitErrorsProvider errors={retainedSubmitErrors}>
        <FormErrorFocus formRef={formRef} />
        <form
          ref={formRef}
          id={props.id}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          className={props.className}
          noValidate
        >
          {props.children}
        </form>
      </RetainedSubmitErrorsProvider>
    </ReactHookForm>
  );
}
