import { useTranslation } from 'react-i18next';
import {
  AllCasesSection,
  CashFlowSection,
  DashboardFastAccessCards,
  DashboardKpiCards,
  TodayHearingsSection
} from '@/components/pages/_app/dashboard';
import { useDocumentTitle } from '@/hooks/core';
import { useUserPreferencesStore } from '@/stores/user-preferences';

export function DashboardPage() {
  const translation = useTranslation();
  const showFastAccessButtons = useUserPreferencesStore(
    (state) => state.appearance.showFastAccessButtons
  );
  useDocumentTitle(translation.t('dashboard.title'));

  return (
    <div className="flex flex-col gap-y-2.5 p-2.5 md:gap-4 md:p-6 xl:flex-row xl:items-start xl:gap-x-4">
      <div className="contents xl:flex xl:min-w-0 xl:flex-1 xl:self-stretch xl:flex-col xl:gap-y-6">
        <div className="order-1 -mx-2.5 md:-mx-6 lg:mx-0 xl:order-none xl:!-mb-1">
          {showFastAccessButtons ? (
            <DashboardFastAccessCards />
          ) : (
            <DashboardKpiCards />
          )}
        </div>
        <div className="order-2 min-w-0 xl:order-none">
          <CashFlowSection />
        </div>
        <div className="order-4 xl:order-none xl:flex xl:grow xl:flex-col">
          <AllCasesSection />
        </div>
      </div>
      <div className="order-3 flex min-h-0 w-full flex-col gap-2.5 md:gap-4 xl:order-none xl:min-w-80 xl:max-w-100 xl:shrink-0 xl:self-stretch">
        <div className="flex min-h-0 flex-col gap-2.5 sm:flex-row sm:items-stretch md:gap-4 xl:flex-col xl:items-stretch">
          <TodayHearingsSection />
        </div>
      </div>
    </div>
  );
}
