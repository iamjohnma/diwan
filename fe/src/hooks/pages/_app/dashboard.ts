import { useState } from 'react';
import { convexQuery } from '@convex-dev/react-query';
import type { CaseStatus } from '@diwan/shared';
import { useQuery } from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';

export type DashboardPeriod = 'weekly' | 'monthly';

export interface DashboardKpiStats {
  revenue: { total: number; paymentsCount: number };
  outstandingBalance: number;
  activeCases: { total: number; intake: number };
}

export interface DashboardCashFlow {
  data: Array<{
    periodStart: string;
    periodEnd: string;
    label: string;
    amount: number;
  }>;
  total: number;
}

export interface DashboardHearing {
  id: string;
  caseId: string;
  caseNumber: string;
  date: number;
  court?: string;
  hall?: string;
  lawyerName: string;
}

export interface DashboardCaseRow {
  _id: string;
  internalNumber: string;
  courtNumber?: string;
  courtName?: string;
  caseTypeId: string;
  caseTypeName: string;
  claimAmount?: number;
  primaryLawyerId: string;
  primaryLawyerName: string;
  status: CaseStatus;
  createdAt: number;
}

export interface DashboardCasesResponse {
  rows: DashboardCaseRow[];
  totalRows: number;
  page: number;
  pageSize: number;
  statusCounts: Record<CaseStatus, number>;
}

const getKpiStats = makeFunctionReference<
  'query',
  Record<string, never>,
  DashboardKpiStats
>('dashboard:getKpiStats');
const getCashFlow = makeFunctionReference<
  'query',
  { period: DashboardPeriod; referenceTimestamp: number },
  DashboardCashFlow
>('dashboard:getCashFlow');
const getTodayHearings = makeFunctionReference<
  'query',
  {
    timezoneOffsetMinutes: number;
    referenceTimestamp: number;
    currentTimestamp: number;
  },
  DashboardHearing[]
>('dashboard:getTodayHearings');
const listCases = makeFunctionReference<
  'query',
  {
    status?: CaseStatus;
    searchText?: string;
    page: number;
    pageSize: number;
  },
  DashboardCasesResponse
>('cases:listTablePage');

export function useDashboardKpis() {
  return useQuery(convexQuery(getKpiStats, {}));
}

export function useDashboardCashFlow(period: DashboardPeriod) {
  const [referenceTimestamp] = useState(Date.now);
  return useQuery({
    ...convexQuery(getCashFlow, { period, referenceTimestamp }),
    placeholderData: (previous) => previous
  });
}

export function useDashboardTodayHearings() {
  const [referenceTimestamp] = useState(Date.now);
  const [currentTimestamp] = useState(Date.now);
  return useQuery(
    convexQuery(getTodayHearings, {
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      referenceTimestamp,
      currentTimestamp
    })
  );
}

export function useDashboardCases(params: {
  status?: CaseStatus;
  searchText?: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    ...convexQuery(listCases, params),
    placeholderData: (previous) => previous
  });
}
