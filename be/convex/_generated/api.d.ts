/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountSetup from "../accountSetup.js";
import type * as aiAssistant from "../aiAssistant.js";
import type * as aiAssistantActions from "../aiAssistantActions.js";
import type * as auth from "../auth.js";
import type * as caseParties from "../caseParties.js";
import type * as caseTypes from "../caseTypes.js";
import type * as cases from "../cases.js";
import type * as checks from "../checks.js";
import type * as commandPalette from "../commandPalette.js";
import type * as dashboard from "../dashboard.js";
import type * as documents from "../documents.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as installments from "../installments.js";
import type * as internal_aiAssistant from "../internal/aiAssistant.js";
import type * as internal_auth from "../internal/auth.js";
import type * as internal_caseTypes from "../internal/caseTypes.js";
import type * as internal_provisioning from "../internal/provisioning.js";
import type * as internal_rbac from "../internal/rbac.js";
import type * as internal_seedDemo from "../internal/seedDemo.js";
import type * as lib_email_ses from "../lib/email/ses.js";
import type * as lib_email_templates from "../lib/email/templates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_search_normalizeSearchText from "../lib/search/normalizeSearchText.js";
import type * as lib_validators from "../lib/validators.js";
import type * as model_aiAssistant_casesTool from "../model/aiAssistant/casesTool.js";
import type * as model_audit_recordAuditEvent from "../model/audit/recordAuditEvent.js";
import type * as model_auth_google from "../model/auth/google.js";
import type * as model_auth_password from "../model/auth/password.js";
import type * as model_auth_sesOtp from "../model/auth/sesOtp.js";
import type * as model_authz_memberContext from "../model/authz/memberContext.js";
import type * as model_authz_owned from "../model/authz/owned.js";
import type * as model_authz_rbacSeed from "../model/authz/rbacSeed.js";
import type * as model_billing_aggregates from "../model/billing/aggregates.js";
import type * as model_billing_checks from "../model/billing/checks.js";
import type * as model_billing_disbursement from "../model/billing/disbursement.js";
import type * as model_billing_dto from "../model/billing/dto.js";
import type * as model_billing_ledger from "../model/billing/ledger.js";
import type * as model_billing_paymentFlows from "../model/billing/paymentFlows.js";
import type * as model_caseParties_caseParties from "../model/caseParties/caseParties.js";
import type * as model_caseTypes_caseTypes from "../model/caseTypes/caseTypes.js";
import type * as model_cases_cases from "../model/cases/cases.js";
import type * as model_documents_documents from "../model/documents/documents.js";
import type * as model_documents_versions from "../model/documents/versions.js";
import type * as model_geminiLive from "../model/geminiLive.js";
import type * as model_installments_installments from "../model/installments/installments.js";
import type * as model_missions_createFromEvent from "../model/missions/createFromEvent.js";
import type * as model_parties_parties from "../model/parties/parties.js";
import type * as parties from "../parties.js";
import type * as payments from "../payments.js";
import type * as profile from "../profile.js";
import type * as testHelpers from "../testHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountSetup: typeof accountSetup;
  aiAssistant: typeof aiAssistant;
  aiAssistantActions: typeof aiAssistantActions;
  auth: typeof auth;
  caseParties: typeof caseParties;
  caseTypes: typeof caseTypes;
  cases: typeof cases;
  checks: typeof checks;
  commandPalette: typeof commandPalette;
  dashboard: typeof dashboard;
  documents: typeof documents;
  functions: typeof functions;
  http: typeof http;
  installments: typeof installments;
  "internal/aiAssistant": typeof internal_aiAssistant;
  "internal/auth": typeof internal_auth;
  "internal/caseTypes": typeof internal_caseTypes;
  "internal/provisioning": typeof internal_provisioning;
  "internal/rbac": typeof internal_rbac;
  "internal/seedDemo": typeof internal_seedDemo;
  "lib/email/ses": typeof lib_email_ses;
  "lib/email/templates": typeof lib_email_templates;
  "lib/errors": typeof lib_errors;
  "lib/pagination": typeof lib_pagination;
  "lib/search/normalizeSearchText": typeof lib_search_normalizeSearchText;
  "lib/validators": typeof lib_validators;
  "model/aiAssistant/casesTool": typeof model_aiAssistant_casesTool;
  "model/audit/recordAuditEvent": typeof model_audit_recordAuditEvent;
  "model/auth/google": typeof model_auth_google;
  "model/auth/password": typeof model_auth_password;
  "model/auth/sesOtp": typeof model_auth_sesOtp;
  "model/authz/memberContext": typeof model_authz_memberContext;
  "model/authz/owned": typeof model_authz_owned;
  "model/authz/rbacSeed": typeof model_authz_rbacSeed;
  "model/billing/aggregates": typeof model_billing_aggregates;
  "model/billing/checks": typeof model_billing_checks;
  "model/billing/disbursement": typeof model_billing_disbursement;
  "model/billing/dto": typeof model_billing_dto;
  "model/billing/ledger": typeof model_billing_ledger;
  "model/billing/paymentFlows": typeof model_billing_paymentFlows;
  "model/caseParties/caseParties": typeof model_caseParties_caseParties;
  "model/caseTypes/caseTypes": typeof model_caseTypes_caseTypes;
  "model/cases/cases": typeof model_cases_cases;
  "model/documents/documents": typeof model_documents_documents;
  "model/documents/versions": typeof model_documents_versions;
  "model/geminiLive": typeof model_geminiLive;
  "model/installments/installments": typeof model_installments_installments;
  "model/missions/createFromEvent": typeof model_missions_createFromEvent;
  "model/parties/parties": typeof model_parties_parties;
  parties: typeof parties;
  payments: typeof payments;
  profile: typeof profile;
  testHelpers: typeof testHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
