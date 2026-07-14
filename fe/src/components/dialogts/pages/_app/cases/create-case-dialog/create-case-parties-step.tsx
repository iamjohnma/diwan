import { PlusIcon, TrashIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { PARTY_ROLES } from '@diwan/shared';
import { Form as FormWrapperForm } from '@/components/common/form-wrapper';
import { StepsDialogStep } from '@/components/dialogts/common/steps-dialog/steps-dialog-step';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { CreateCaseDialogHook } from '@/hooks/pages/_app/cases';

interface CreateCasePartiesStepProps {
  createCaseDialog: CreateCaseDialogHook;
}

export function CreateCasePartiesStep(props: CreateCasePartiesStepProps) {
  const { t } = useTranslation();
  const dialog = props.createCaseDialog;
  const form = dialog.partyDraftForm;

  return (
    <StepsDialogStep
      title={t('cases.createDialog.partiesTitle')}
      icon={UsersThreeIcon}
      backLabel={t('common.back')}
      nextLabel={t('common.next')}
      onNext={() => dialog.validatePartiesStep()}
    >
      <div className="flex w-full flex-col gap-5 px-6 pt-6 pb-6">
        <FormWrapperForm form={form} className="grid gap-5">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  {t('cases.createDialog.fields.partyFullName')}
                </FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    autoComplete="off"
                    placeholder={t(
                      'cases.createDialog.placeholders.partyFullName'
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
            name="nationalId"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  {t('cases.createDialog.fields.partyNationalId')}
                </FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder={t(
                      'cases.createDialog.placeholders.partyNationalId'
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
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>
                  {t('cases.createDialog.fields.partyRole')}
                </FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={t(
                          'cases.createDialog.placeholders.partyRole'
                        )}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PARTY_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`cases.createDialog.roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            prefixIcon={PlusIcon}
            onClick={() => {
              void dialog.addStagedParty();
            }}
          >
            {t('cases.createDialog.addParty')}
          </Button>
        </FormWrapperForm>
        <div className="flex flex-col gap-3">
          {dialog.stagedParties.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {t('cases.createDialog.partiesEmpty')}
            </p>
          ) : (
            dialog.stagedParties.map((party) => (
              <div
                key={party.clientId}
                className="flex items-center gap-3 rounded-lg border border-border-default bg-background-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {party.fullName}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {t(`cases.createDialog.roles.${party.role}`)} ·{' '}
                    {party.nationalId}
                  </p>
                </div>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="iconSm"
                  icon={TrashIcon}
                  onClick={() => dialog.removeStagedParty(party.clientId)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </StepsDialogStep>
  );
}
