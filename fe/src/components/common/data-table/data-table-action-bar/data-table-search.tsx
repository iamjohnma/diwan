import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter } from '@/components/ui/drawer';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { SearchField } from '@/components/ui/search-field';

const SEARCH_DEBOUNCE_MS = 300;

export function DataTableSearch(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const translation = useTranslation();
  const { t } = translation;
  const [inputValue, setInputValue] = useState(props.value);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setInputValue(props.value), [props.value]);
  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const queueChange = (value: string) => {
    setInputValue(value);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(
      () => props.onChange(value),
      SEARCH_DEBOUNCE_MS
    );
  };

  return (
    <>
      <Input
        aria-label={props.placeholder}
        value={inputValue}
        onChange={(event) => queueChange(event.target.value)}
        prefixIcon={
          <MagnifyingGlassIcon className="size-4 text-text-secondary" />
        }
        placeholder={props.placeholder}
        className="hidden w-64 shrink-0 md:flex"
      />
      <IconButton
        aria-label={t('common.dataTable.search')}
        className="relative size-10 md:hidden"
        variant="outline"
        size="equal"
        icon={MagnifyingGlassIcon}
        iconProps={{ className: 'size-4.5', weight: 'regular' }}
        tooltip={t('common.dataTable.search')}
        onClick={() => setDrawerOpen(true)}
      />
      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (open) setInputValue(props.value);
        }}
      >
        <DrawerContent
          side="bottom"
          className="gap-0 p-0"
          accessibilityTitle={t('common.dataTable.search')}
          accessibilityDescription={t('common.dataTable.searchPlaceholder')}
        >
          <form
            className="grid grid-cols-1"
            onSubmit={(event) => {
              event.preventDefault();
              if (timeoutRef.current !== null)
                window.clearTimeout(timeoutRef.current);
              props.onChange(inputValue);
              setDrawerOpen(false);
            }}
          >
            <SearchField
              value={inputValue}
              onValueChange={setInputValue}
              inputRef={inputRef}
              placeholder={props.placeholder}
              icon={<MagnifyingGlassIcon weight="regular" />}
              flush
            />
            <DrawerFooter>
              <Button type="submit" size="lg" layout="full">
                <TruncateText>{t('common.dataTable.search')}</TruncateText>
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
