import { useCallback, useMemo, useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { PartyRole } from '@diwan/shared';
import { useDialogOpenState } from '@/hooks/common/dialog-open-state';
import { convexClient } from '@/lib/convex/client';
import { handleError } from '@/lib/errors';
import {
  CREATE_CASE_FORM_DEFAULT_VALUES,
  CREATE_CASE_PARTY_DRAFT_DEFAULT_VALUES,
  type CreateCaseFormSchema,
  type CreateCasePartyDraftSchema,
  type CreateCaseStagedParty,
  createCaseFormSchema,
  createCasePartyDraftSchema,
  parseOptionalClaimAmount
} from '@/schemas/pages/_app/cases/create-case-dialog';

interface CaseTypeSummary {
  _id: string;
  key: string;
  label: string;
  requiredPartyRoles: PartyRole[];
  requiredDocumentChecklist: string[];
}

interface CaseTypesPage {
  page: CaseTypeSummary[];
  isDone: boolean;
  continueCursor: string;
}

interface CurrentProfile {
  id: string;
  createdAt: number;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

type CreateCaseArgs = {
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: string;
  claimAmount?: number;
  primaryLawyerId: string;
};

type CreatePartyArgs = {
  nationalId: string;
  fullName: string;
};

type AddCasePartyArgs = {
  caseId: string;
  partyId: string;
  role: PartyRole;
};

const listCaseTypes = makeFunctionReference<
  'query',
  { paginationOpts: { numItems: number; cursor: string | null } },
  CaseTypesPage
>('caseTypes:list');

const currentProfile = makeFunctionReference<'query', {}, CurrentProfile>(
  'profile:current'
);

const createCase = makeFunctionReference<'mutation', CreateCaseArgs, string>(
  'cases:create'
);

const createParty = makeFunctionReference<'mutation', CreatePartyArgs, string>(
  'parties:create'
);

const addCaseParty = makeFunctionReference<'mutation', AddCasePartyArgs, string>(
  'caseParties:add'
);

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export type CreateCaseDialogHook = ReturnType<typeof useCreateCaseDialog>;

export function useCreateCaseDialog() {
  const { t } = useTranslation();
  const { isOpen, openDialog, closeDialog } = useDialogOpenState();
  const [stagedParties, setStagedParties] = useState<CreateCaseStagedParty[]>(
    []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = useMemo(() => createCaseFormSchema(t), [t]);
  const partyDraftSchema = useMemo(() => createCasePartyDraftSchema(t), [t]);

  const form = useForm<CreateCaseFormSchema>({
    defaultValues: CREATE_CASE_FORM_DEFAULT_VALUES,
    resolver: zodResolver(formSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const partyDraftForm = useForm<CreateCasePartyDraftSchema>({
    defaultValues: CREATE_CASE_PARTY_DRAFT_DEFAULT_VALUES,
    resolver: zodResolver(partyDraftSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });

  const caseTypesQuery = useQuery({
    ...convexQuery(listCaseTypes, {
      paginationOpts: { numItems: 100, cursor: null }
    }),
    enabled: isOpen
  });

  const profileQuery = useQuery({
    ...convexQuery(currentProfile, {}),
    enabled: isOpen
  });

  const createCaseMutation = useMutation({
    mutationFn: (args: CreateCaseArgs) => convexClient.mutation(createCase, args)
  });
  const createPartyMutation = useMutation({
    mutationFn: (args: CreatePartyArgs) =>
      convexClient.mutation(createParty, args)
  });
  const addCasePartyMutation = useMutation({
    mutationFn: (args: AddCasePartyArgs) =>
      convexClient.mutation(addCaseParty, args)
  });

  const caseTypes = caseTypesQuery.data?.page ?? [];
  const selectedCaseTypeId = form.watch('caseTypeId');
  const selectedCaseType = useMemo(
    () => caseTypes.find((caseType) => caseType._id === selectedCaseTypeId),
    [caseTypes, selectedCaseTypeId]
  );

  const resetDialogState = useCallback(() => {
    form.reset(CREATE_CASE_FORM_DEFAULT_VALUES);
    partyDraftForm.reset(CREATE_CASE_PARTY_DRAFT_DEFAULT_VALUES);
    setStagedParties([]);
    setIsSubmitting(false);
  }, [form, partyDraftForm]);

  const handleOpenDialog = useCallback(() => {
    resetDialogState();
    openDialog();
  }, [openDialog, resetDialogState]);

  const handleCloseDialog = useCallback(() => {
    closeDialog();
    resetDialogState();
  }, [closeDialog, resetDialogState]);

  const validateBasicsStep = useCallback(() => {
    const values = form.getValues();
    const result = createCaseFormSchema(t)
      .pick({
        internalNumber: true,
        courtNumber: true,
        courtName: true,
        caseTypeId: true
      })
      .safeParse(values);

    if (result.success) {
      for (const field of [
        'internalNumber',
        'courtNumber',
        'courtName',
        'caseTypeId'
      ] as const) {
        form.clearErrors(field);
      }

      return true;
    }

    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (
        field === 'internalNumber' ||
        field === 'courtNumber' ||
        field === 'courtName' ||
        field === 'caseTypeId'
      ) {
        form.setError(field, { type: 'manual', message: issue.message });
      }
    }

    return false;
  }, [form, t]);

  const validatePartiesStep = useCallback(() => {
    const requiredRoles = selectedCaseType?.requiredPartyRoles ?? [];
    if (requiredRoles.length === 0) {
      return true;
    }

    const missingRole = requiredRoles.find(
      (role) => !stagedParties.some((party) => party.role === role)
    );
    if (!missingRole) {
      return true;
    }

    toast.error(
      t('cases.createDialog.validation.requiredRoleMissing', {
        role: t(`cases.createDialog.roles.${missingRole}`)
      })
    );

    return false;
  }, [selectedCaseType?.requiredPartyRoles, stagedParties, t]);

  const addStagedParty = useCallback(async () => {
    const valid = await partyDraftForm.trigger();
    if (!valid) {
      return false;
    }

    const values = partyDraftForm.getValues();
    setStagedParties((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        nationalId: values.nationalId.trim(),
        fullName: values.fullName.trim(),
        role: values.role
      }
    ]);
    partyDraftForm.reset(CREATE_CASE_PARTY_DRAFT_DEFAULT_VALUES);

    return true;
  }, [partyDraftForm]);

  const removeStagedParty = useCallback((clientId: string) => {
    setStagedParties((current) =>
      current.filter((party) => party.clientId !== clientId)
    );
  }, []);

  const submitCreateCase = useCallback(async () => {
    const basicsValid = await form.trigger();
    if (!basicsValid) {
      return false;
    }

    if (!validatePartiesStep()) {
      return false;
    }

    const profile = profileQuery.data;
    if (!profile) {
      toast.error(t('cases.createDialog.errors.profileUnavailable'));

      return false;
    }

    const values = form.getValues();
    const claimAmount = parseOptionalClaimAmount(values.claimAmount);
    if (claimAmount === 'invalid') {
      form.setError('claimAmount', {
        type: 'manual',
        message: t('cases.createDialog.validation.claimAmountInvalid')
      });

      return false;
    }

    setIsSubmitting(true);

    try {
      const caseId = await createCaseMutation.mutateAsync({
        internalNumber: values.internalNumber.trim(),
        courtNumber: optionalTrimmed(values.courtNumber),
        courtName: optionalTrimmed(values.courtName),
        caseTypeId: values.caseTypeId,
        claimAmount,
        primaryLawyerId: profile.id
      });

      for (const party of stagedParties) {
        const partyId = await createPartyMutation.mutateAsync({
          nationalId: party.nationalId,
          fullName: party.fullName
        });
        await addCasePartyMutation.mutateAsync({
          caseId,
          partyId,
          role: party.role
        });
      }

      toast.success(t('cases.createDialog.success'));
      handleCloseDialog();

      return true;
    } catch (error) {
      handleError(error, { forceToast: true });

      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addCasePartyMutation,
    createCaseMutation,
    createPartyMutation,
    form,
    handleCloseDialog,
    profileQuery.data,
    stagedParties,
    t,
    validatePartiesStep
  ]);

  return {
    isOpen,
    isSubmitting,
    form,
    partyDraftForm,
    caseTypes,
    isCaseTypesLoading: caseTypesQuery.isPending,
    isCaseTypesError: caseTypesQuery.isError,
    selectedCaseType,
    stagedParties,
    primaryLawyerName: profileQuery.data?.name ?? '',
    isProfileLoading: profileQuery.isPending,
    openDialog: handleOpenDialog,
    closeDialog: handleCloseDialog,
    validateBasicsStep,
    validatePartiesStep,
    addStagedParty,
    removeStagedParty,
    submitCreateCase
  };
}
