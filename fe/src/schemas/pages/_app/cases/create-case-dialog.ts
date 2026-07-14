import type { PartyRole } from '@diwan/shared';
import { PARTY_ROLES } from '@diwan/shared';
import type { TFunction } from 'i18next';
import { z } from 'zod';

export function createCaseFormSchema(t: TFunction) {
  return z.object({
    internalNumber: z
      .string()
      .trim()
      .min(1, t('cases.createDialog.validation.internalNumberRequired')),
    courtNumber: z.string(),
    courtName: z.string(),
    caseTypeId: z
      .string()
      .min(1, t('cases.createDialog.validation.caseTypeRequired')),
    claimAmount: z.string()
  });
}

export type CreateCaseFormSchema = z.infer<
  ReturnType<typeof createCaseFormSchema>
>;

export const CREATE_CASE_FORM_DEFAULT_VALUES: CreateCaseFormSchema = {
  internalNumber: '',
  courtNumber: '',
  courtName: '',
  caseTypeId: '',
  claimAmount: ''
};

export function createCasePartyDraftSchema(t: TFunction) {
  return z.object({
    nationalId: z
      .string()
      .trim()
      .min(1, t('cases.createDialog.validation.nationalIdRequired')),
    fullName: z
      .string()
      .trim()
      .min(1, t('cases.createDialog.validation.fullNameRequired')),
    role: z.enum(PARTY_ROLES, {
      error: t('cases.createDialog.validation.roleRequired')
    })
  });
}

export type CreateCasePartyDraftSchema = z.infer<
  ReturnType<typeof createCasePartyDraftSchema>
>;

export const CREATE_CASE_PARTY_DRAFT_DEFAULT_VALUES: CreateCasePartyDraftSchema =
  {
    nationalId: '',
    fullName: '',
    role: 'plaintiff'
  };

export interface CreateCaseStagedParty {
  clientId: string;
  nationalId: string;
  fullName: string;
  role: PartyRole;
}

export function parseOptionalClaimAmount(
  value: string
): number | undefined | 'invalid' {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) {
    return 'invalid';
  }

  return amount;
}
