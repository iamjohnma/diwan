import { ScalesIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Form as FormWrapperForm } from '@/components/common/form-wrapper';
import { StepsDialogStep } from '@/components/dialogts/common/steps-dialog/steps-dialog-step';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { CreateCaseDialogHook } from '@/hooks/pages/_app/cases';

interface CreateCaseBasicsStepProps {
  createCaseDialog: CreateCaseDialogHook;
}

export function CreateCaseBasicsStep(props: CreateCaseBasicsStepProps) {
  const { t } = useTranslation();
  const dialog = props.createCaseDialog;
  const form = dialog.form;

  return (
    <StepsDialogStep
      title={t('cases.createDialog.title')}
      icon={ScalesIcon}
      nextLabel={t('common.next')}
      showBackButton={false}
      preventBack
      nextDisabled={dialog.isCaseTypesLoading}
      onNext={() => dialog.validateBasicsStep()}
    >
      <FormWrapperForm
        form={form}
        className="flex w-full flex-col gap-5 px-6 pt-6 pb-6"
      >
        <FormField
          control={form.control}
          name="internalNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                {t('cases.createDialog.fields.internalNumber')}
              </FormLabel>
              <FormControl>
                <Input
                  autoFocus
                  autoComplete="off"
                  placeholder={t(
                    'cases.createDialog.placeholders.internalNumber'
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="courtNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('cases.createDialog.fields.courtNumber')}
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder={t(
                    'cases.createDialog.placeholders.courtNumber'
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="caseTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                {t('cases.createDialog.fields.caseType')}
              </FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={dialog.isCaseTypesLoading}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t(
                        'cases.createDialog.placeholders.caseType'
                      )}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {dialog.caseTypes.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-text-secondary">
                      {t('cases.createDialog.errors.noCaseTypes')}
                    </div>
                  ) : (
                    dialog.caseTypes.map((caseType) => (
                      <SelectItem key={caseType._id} value={caseType._id}>
                        {caseType.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="courtName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('cases.createDialog.fields.courtName')}
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder={t('cases.createDialog.placeholders.courtName')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {dialog.isCaseTypesError ? (
          <p className="text-sm text-destructive">
            {t('cases.createDialog.errors.caseTypesUnavailable')}
          </p>
        ) : null}
      </FormWrapperForm>
    </StepsDialogStep>
  );
}
