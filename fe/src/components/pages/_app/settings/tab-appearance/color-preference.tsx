import {
  type CSSProperties,
  type ReactNode,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  CheckIcon,
  PencilSimpleIcon,
  PlusIcon,
  StarIcon
} from '@phosphor-icons/react';
import { HexColorInput, HexColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';
import { SettingsDescriptionRow } from '@/components/pages/_app/settings/settings-row';
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent
} from '@/components/ui';
import type { AppearanceSettingsHook } from '@/hooks/pages/_app/settings';
import { cn } from '@/lib/utils';
import {
  getContrastForeground,
  type ForegroundOverride
} from '@/utils/common/apply-preferences';

const COLOR_OPTIONS = [
  { value: '#2e6acd', label: 'Blue' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#2da0cc', label: 'Sky' }
] as const;
const MAX_CUSTOM_COLORS = 10;
const FOREGROUND_OVERRIDE_ORDER: ForegroundOverride[] = [
  'auto',
  'dark',
  'light'
];

function isSameColor(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function overrideColor(override: ForegroundOverride): string | null {
  if (override === 'dark') return '#000000';
  if (override === 'light') return '#ffffff';

  return null;
}

function previewStyle(
  color: string,
  override: ForegroundOverride
): CSSProperties {
  const foreground = overrideColor(override);

  return foreground
    ? {
        background: `linear-gradient(135deg, ${color} 50%, ${foreground} 50%)`
      }
    : { backgroundColor: color };
}

function overrideStyle(override: ForegroundOverride): CSSProperties {
  const foreground = overrideColor(override);

  return foreground
    ? { backgroundColor: foreground }
    : {
        background:
          'linear-gradient(135deg, rgba(0, 0, 0, 0.85) 50%, #ffffff 50%)'
      };
}

function SwatchFrame(props: {
  color: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'group relative isolate flex items-center justify-center rounded-full',
        props.className
      )}
    >
      <span
        className="pointer-events-none absolute inset-0 scale-90 rounded-full border-2 opacity-0 shadow-[0_0_0_2px_var(--background-base)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.1] group-hover:opacity-100 group-has-[:active]:scale-[1.1] group-has-[:active]:opacity-100"
        style={{ borderColor: props.color }}
      />
      {props.children}
    </div>
  );
}

interface ColorPreferenceProps {
  settings: AppearanceSettingsHook;
}

export function ColorPreference(props: ColorPreferenceProps) {
  const translation = useTranslation();
  const t = translation.t;
  const [isOpen, setIsOpen] = useState(false);
  const [anchorLeft, setAnchorLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const currentColor = props.settings.draft.primaryColor;
  const foregroundOverride = props.settings.draft.foregroundOverride;
  const starredColors = props.settings.draft.starredColors;
  const visibleCustomColors = useMemo(() => {
    const colors = [...starredColors];
    const isPreset = COLOR_OPTIONS.some((preset) =>
      isSameColor(preset.value, currentColor)
    );
    const isStarred = colors.some((color) => isSameColor(color, currentColor));

    if (!isPreset && !isStarred) colors.push(currentColor);

    return colors.filter(
      (color, index) =>
        colors.findIndex((candidate) => isSameColor(candidate, color)) === index
    );
  }, [currentColor, starredColors]);
  const isCurrentColorStarred = starredColors.some((color) =>
    isSameColor(color, currentColor)
  );

  const openAt = (element: HTMLElement) => {
    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      setAnchorLeft(
        elementRect.left - containerRect.left + elementRect.width / 2
      );
    }
    setIsOpen(true);
  };

  const toggleStarredColor = () => {
    if (isCurrentColorStarred) {
      props.settings.update({
        starredColors: starredColors.filter(
          (color) => !isSameColor(color, currentColor)
        )
      });

      return;
    }

    if (starredColors.length < MAX_CUSTOM_COLORS) {
      props.settings.update({ starredColors: [...starredColors, currentColor] });
    }
  };

  const toggleForegroundOverride = () => {
    const index = FOREGROUND_OVERRIDE_ORDER.indexOf(foregroundOverride);
    props.settings.update({
      foregroundOverride:
        FOREGROUND_OVERRIDE_ORDER[
          (index + 1) % FOREGROUND_OVERRIDE_ORDER.length
        ] ?? 'auto'
    });
  };

  const foregroundLabel = t(
    `settings.appearance.systemColor.foregroundOverride.${foregroundOverride}`
  );

  return (
    <SettingsDescriptionRow
      title={t('settings.appearance.systemColor.title')}
      description={t('settings.appearance.systemColor.description')}
      compact
      onActivate={() => {
        if (addButtonRef.current) openAt(addButtonRef.current);
      }}
    >
      <div ref={containerRef} className="relative flex items-center gap-x-2">
        {COLOR_OPTIONS.map((preset) => {
          const selected = isSameColor(currentColor, preset.value);

          return (
            <SwatchFrame key={preset.value} color={preset.value}>
              <button
                type="button"
                aria-label={`${t('settings.appearance.systemColor.selectColor', { color: preset.label })}`}
                className="relative z-10 flex size-8 items-center justify-center rounded-full border-0 p-0 ring-0 focus-visible:ring-2 focus-visible:ring-border-dark/45"
                style={{ backgroundColor: preset.value }}
                onClick={() => {
                  props.settings.update({ primaryColor: preset.value });
                  setIsOpen(false);
                }}
              >
                {selected ? (
                  <CheckIcon
                    className="size-4"
                    weight="bold"
                    style={{ color: getContrastForeground(preset.value) }}
                  />
                ) : null}
              </button>
            </SwatchFrame>
          );
        })}

        {visibleCustomColors.map((color) => {
          const selected = isSameColor(currentColor, color);
          const starred = starredColors.some((saved) =>
            isSameColor(saved, color)
          );
          const foreground = getContrastForeground(color);

          return (
            <SwatchFrame key={color.toLowerCase()} color={color}>
              <button
                type="button"
                aria-label={t('settings.appearance.systemColor.selectColor', {
                  color
                })}
                className={cn(
                  'relative z-10 flex size-8 items-center justify-center rounded-full p-0 ring-0 focus-visible:ring-2 focus-visible:ring-border-dark/45',
                  starred
                    ? 'border-0'
                    : cn(
                        'border-2 border-dashed',
                        foreground === '#ffffff'
                          ? 'border-white/50'
                          : 'border-black/20'
                      )
                )}
                style={{ backgroundColor: color }}
                onClick={(event) => {
                  props.settings.update({ primaryColor: color });
                  openAt(event.currentTarget);
                }}
              >
                {selected ? (
                  <CheckIcon
                    className="size-4"
                    weight="bold"
                    style={{ color: foreground }}
                  />
                ) : starred ? (
                  <PencilSimpleIcon
                    className="size-3.5 opacity-0 transition-opacity group-hover:opacity-70"
                    weight="bold"
                    style={{ color: foreground }}
                  />
                ) : null}
              </button>
            </SwatchFrame>
          );
        })}

        <button
          ref={addButtonRef}
          type="button"
          aria-label={t('settings.appearance.systemColor.custom')}
          title={
            starredColors.length >= MAX_CUSTOM_COLORS
              ? t('settings.appearance.systemColor.maxColorsReached', {
                  count: MAX_CUSTOM_COLORS
                })
              : undefined
          }
          disabled={starredColors.length >= MAX_CUSTOM_COLORS}
          className="relative z-10 flex size-8 items-center justify-center rounded-full border-2 border-dashed border-border-default p-0 text-text-tertiary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-text-secondary focus-visible:ring-2 focus-visible:ring-border-dark/45 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={(event) => openAt(event.currentTarget)}
        >
          <PlusIcon className="size-4" weight="bold" />
        </button>

        <Popover open={isOpen} onOpenChange={setIsOpen} openOnClick>
          <PopoverAnchor
            className="pointer-events-none absolute top-0 h-8 w-0 transition-[left] duration-300 ease-out"
            style={{ left: anchorLeft }}
          />
          <PopoverContent className="w-72 p-0" align="center">
            <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain">
              <div className="touch-none p-3" data-vaul-no-drag>
                <HexColorPicker
                  color={currentColor}
                  onChange={(color) =>
                    props.settings.update({ primaryColor: color })
                  }
                  className="w-full!"
                />
              </div>
              <div className="flex items-center gap-x-3 px-3 pb-3">
                <div className="flex items-center gap-x-2">
                  <div
                    className="size-10 shrink-0 rounded-lg border border-border-default shadow-sm transition-colors duration-300"
                    style={previewStyle(currentColor, foregroundOverride)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title={t(
                      'settings.appearance.systemColor.foregroundOverride.description',
                      { mode: foregroundLabel }
                    )}
                    aria-label={foregroundLabel}
                    onClick={toggleForegroundOverride}
                    className={cn(
                      'size-10 shrink-0 transition-all duration-200 hover:scale-105',
                      foregroundOverride !== 'auto' &&
                        'border-primary bg-primary-light'
                    )}
                  >
                    <span
                      className={cn(
                        'size-5 rounded-md border border-border-default shadow-sm',
                        foregroundOverride === 'dark' && 'border-white/40',
                        foregroundOverride === 'light' && 'border-black/15'
                      )}
                      style={overrideStyle(foregroundOverride)}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t('settings.appearance.systemColor.saveColor')}
                    onClick={toggleStarredColor}
                    className={cn(
                      'size-10 shrink-0 transition-all duration-200 hover:scale-105',
                      isCurrentColorStarred &&
                        'border-amber-400 bg-amber-50'
                    )}
                  >
                    <StarIcon
                      className={cn(
                        'size-5 transition-colors',
                        isCurrentColorStarred
                          ? 'text-amber-500'
                          : 'text-text-tertiary'
                      )}
                      weight={isCurrentColorStarred ? 'fill' : 'regular'}
                    />
                  </Button>
                </div>
                <div className="flex h-10 flex-1 items-center overflow-hidden rounded-lg border border-border-default bg-background-base transition-colors focus-within:border-primary">
                  <HexColorInput
                    color={currentColor}
                    onChange={(color) =>
                      props.settings.update({ primaryColor: color })
                    }
                    prefixed
                    className="h-full w-full flex-1 bg-transparent px-3 font-mono text-sm uppercase text-text-primary outline-none"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </SettingsDescriptionRow>
  );
}
