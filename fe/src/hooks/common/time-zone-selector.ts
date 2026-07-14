import { useCallback, useMemo, useState } from 'react';
import { searchTextIncludes } from '@diwan/shared/search-text';
import { useTranslation } from 'react-i18next';
import { getTimeZoneOptions } from '@/utils/common/time-zone';

interface TimeZoneSelectorPropsHook {
  value: string;
  onChange: (timeZone: string) => void;
}

export function useTimeZoneSelector(props: TimeZoneSelectorPropsHook) {
  const translation = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isArabic = translation.i18n.language.startsWith('ar');
  const locale = isArabic ? 'ar-EG' : 'en-US';

  const allOptions = useMemo(() => getTimeZoneOptions({ locale }), [locale]);

  const selectedOption = useMemo(
    () => allOptions.find((o) => o.value === props.value),
    [allOptions, props.value]
  );

  // Keep the list in its natural, stable order. The selected value stays
  // wherever it naturally sits — opening just scrolls to it (centered) rather
  // than reshuffling it to the top.
  const options = useMemo(() => {
    if (!query.trim()) return allOptions;

    return allOptions.filter((o) => searchTextIncludes(o.searchLabel, query));
  }, [allOptions, query]);

  const handleSelect = useCallback(
    (timeZone: string) => {
      props.onChange(timeZone);
      setIsOpen(false);
      setQuery('');
    },
    [props]
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setQuery('');
  }, []);

  return {
    isOpen,
    isArabic,
    query,
    options,
    triggerLabel: selectedOption?.compactOffsetLabel ?? props.value,
    setQuery,
    handleSelect,
    handleOpenChange
  };
}
