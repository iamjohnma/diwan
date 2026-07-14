import { CheckCircleIcon } from '@phosphor-icons/react';
import { useWatch } from 'react-hook-form';
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
import type { CreateCaseDialogHook } from '@/hooks/pages/_app/cases';

interface CreateCaseReviewStepProps {
  createCaseDialog: CreateCaseDialogHook;
}

export function CreateCaseReviewStep(props: CreateCaseReviewStepProps) {
  const { t } = useTranslation();
  const dialog = props.createCaseDialog;
  const form = dialog.form;
  const values = useWatch({ control: form.control });
  const caseTypeId = values.caseTypeId ?? '';
  const caseTypeLabel =
    dialog.selectedCaseType?.label ??
    dialog.caseTypes.find((caseType) => caseType._id === caseTypeId)?.label ??
    '—';

  return (
    <StepsDialogStep
      title={t('cases.createDialog.reviewTitle')}
      icon={CheckCircleIcon}
      backLabel={t('common.back')}
      nextLabel={t('common.create')}
      isLoading={dialog.isSubmitting}
      nextDisabled={dialog.isSubmitting || dialog.isProfileLoading}
      onNext={async () => {
        await dialog.submitCreateCase();

        return false;
      }}
    >
      <FormWrapperForm
        form={form}
        className="flex w-full flex-col gap-5 px-6 pt-6 pb-6"
      >
        <div className="grid gap-3 rounded-xl border border-border-default bg-background-surface p-4">
          <ReviewRow
            label={t('cases.createDialog.fields.internalNumber')}
            value={values.internalNumber?.trim() || '—'}
          />
          <ReviewRow
            label={t('cases.createDialog.fields.courtNumber')}
            value={values.courtNumber?.trim() || '—'}
          />
          <ReviewRow
            label={t('cases.createDialog.fields.caseType')}
            value={caseTypeLabel}
          />
          <ReviewRow
            label={t('cases.createDialog.fields.courtName')}
            value={values.courtName?.trim() || '—'}
          />
          <ReviewRow
            label={t('cases.createDialog.fields.primaryLawyer')}
            value={
              dialog.primaryLawyerName ||
              t('cases.createDialog.primaryLawyerFallback')
            }
          />
          <ReviewRow
            label={t('cases.createDialog.fields.parties')}
            value={
              dialog.stagedParties.length === 0
                ? t('cases.createDialog.partiesNone')
                : dialog.stagedParties
                    .map(
                      (party) =>
                        `${party.fullName} (${t(`cases.createDialog.roles.${party.role}`)})`
                    )
                    .join(' · ')
            }
          />
        </div>
        <FormField
          control={form.control}
          name="claimAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('cases.createDialog.fields.claimAmount')}
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  inputMode="decimal"
                  placeholder={t(
                    'cases.createDialog.placeholders.claimAmount'
                  )}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormWrapperForm>
    </StepsDialogStep>
  );
}

function ReviewRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-text-secondary">{props.label}</span>
      <span className="text-end text-sm font-medium text-text-primary">
        {props.value}
      </span>
    </div>
  );
}
