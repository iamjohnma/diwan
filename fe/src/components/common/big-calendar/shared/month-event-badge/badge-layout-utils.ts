import type {
  BadgeHeightTier,
  BadgeLayout
} from '@/@types/common/components/big-calendar/shared/month-event-badge/badge-layout-utils';
import type { CalendarEventRenderSegment } from '@/utils/common/big-calendar-segments';

export type {
  BadgeHeightTier,
  BadgeLayout
} from '@/@types/common/components/big-calendar/shared/month-event-badge/badge-layout-utils';

export interface BadgeLayoutSize {
  height: number;
  width: number;
}

const SEGMENT_HORIZONTAL_PADDING_PX = 4;
// Height steps that drive how big the badge text and icon render. Anything up to
// `COMPACT` stays single-row compact; past it we step the type/icon up so longer
// appointments (which have the vertical room to spare) read more comfortably.
// At 200px/hour these map to roughly: â‰¤~9min compact, ~10â€“21min full,
// ~22â€“36min large, ~37â€“50min xlarge, ~51min+ xxlarge.
const COMPACT_HEIGHT_THRESHOLD_PX = 30;
const LARGE_HEIGHT_THRESHOLD_PX = 72;
const XLARGE_HEIGHT_THRESHOLD_PX = 120;
const XXLARGE_HEIGHT_THRESHOLD_PX = 168;
const FULL_TIER_MIN_WIDTH_PX = 100;
const LARGE_TIER_MIN_WIDTH_PX = 128;
const XLARGE_TIER_MIN_WIDTH_PX = 168;
const XXLARGE_TIER_MIN_WIDTH_PX = 220;
const FULL_LAYOUT_MIN_WIDTH_PX = 128;
// The two-row `full` layout stacks a title row over a time row. The title row's
// height is set by the 24px status-icon box (not the shorter title text), so the
// content needs 8 (py-1) + 24 (icon row) + 2 (gap-0.5) + 17 (time line) â‰ˆ 51px.
// Below this, the two rows overflow the badge and the content wrapper's
// overflow-hidden clips the time row's bottom, so hold out for the full height
// (+1px slack for fractional badge heights) before switching off the single-row
// compact layout.
const FULL_LAYOUT_MIN_HEIGHT_PX = 52;

const HEIGHT_TIER_RANK: Record<BadgeHeightTier, number> = {
  compact: 0,
  full: 1,
  large: 2,
  xlarge: 3,
  xxlarge: 4
};

export function resolveSegmentBadgeLayoutSize(params: {
  segment: Pick<CalendarEventRenderSegment, 'startMinutes' | 'endMinutes'>;
  totalColumns: number;
  pixelsPerHour: number;
  columnWidthPx?: number;
}): BadgeLayoutSize {
  const durationMinutes =
    params.segment.endMinutes - params.segment.startMinutes;
  const height = Math.max(0, (durationMinutes / 60) * params.pixelsPerHour);
  const laneWidthPx =
    params.columnWidthPx !== undefined
      ? params.columnWidthPx / params.totalColumns
      : 0;
  const width = Math.max(0, laneWidthPx - SEGMENT_HORIZONTAL_PADDING_PX);

  return { height, width };
}

export function resolveBadgeHeightTier(height: number): BadgeHeightTier {
  if (height <= COMPACT_HEIGHT_THRESHOLD_PX) return 'compact';
  if (height <= LARGE_HEIGHT_THRESHOLD_PX) return 'full';
  if (height <= XLARGE_HEIGHT_THRESHOLD_PX) return 'large';
  if (height <= XXLARGE_HEIGHT_THRESHOLD_PX) return 'xlarge';

  return 'xxlarge';
}

function getMaxBadgeTierForWidth(width: number): BadgeHeightTier {
  if (width < FULL_TIER_MIN_WIDTH_PX) return 'compact';
  if (width < LARGE_TIER_MIN_WIDTH_PX) return 'full';
  if (width < XLARGE_TIER_MIN_WIDTH_PX) return 'large';
  if (width < XXLARGE_TIER_MIN_WIDTH_PX) return 'xlarge';

  return 'xxlarge';
}

export function resolveBadgeVisualHeightTier(params: {
  heightTier: BadgeHeightTier;
  width: number;
}): BadgeHeightTier {
  if (params.width <= 0) return params.heightTier;

  const maxWidthTier = getMaxBadgeTierForWidth(params.width);

  return HEIGHT_TIER_RANK[params.heightTier] <= HEIGHT_TIER_RANK[maxWidthTier]
    ? params.heightTier
    : maxWidthTier;
}

export function resolveBadgeLayout(params: {
  height: number;
  width: number;
  heightTier: BadgeHeightTier;
}): BadgeLayout {
  if (params.height <= 0 || params.width <= 0) {
    return params.heightTier === 'compact' ? 'compact' : 'full';
  }

  if (params.heightTier === 'compact') {
    return 'compact';
  }

  return params.height >= FULL_LAYOUT_MIN_HEIGHT_PX &&
    params.width >= FULL_LAYOUT_MIN_WIDTH_PX
    ? 'full'
    : 'compact';
}

export interface BadgeSizeClasses {
  rootSpacing: string;
  rootText: string;
  contentGap: string;
  condensedRowGap: string;
  titleText: string;
  metaText: string;
  iconContainer: string;
  icon: string;
}

// `compact` stays the tight floor for cramped slots; every tier with a bit of
// room to spare (`full` and up) steps typography and icons up so the content
// uses the appointment area instead of feeling undersized in taller badges.
const BADGE_SIZE_CLASSES: Record<BadgeHeightTier, BadgeSizeClasses> = {
  compact: {
    // The suffix status-icon box drives the single row's height, so it must fit
    // inside the compact floor: at MIN_BADGE_HEIGHT_PX (22px, border-box) the
    // 1px border (2px) plus this padding leaves the content wrapper, and the
    // wrapper's overflow-hidden clips anything taller. py-0.5 (4px) â†’ 16px of
    // content, exactly holding the size-4 (16px) icon box so it never gets cut.
    rootSpacing: 'px-1.25 py-0.5',
    rootText: 'text-xs',
    contentGap: 'gap-0.25',
    condensedRowGap: 'gap-1',
    titleText: 'text-[11px] leading-[14px] font-semibold',
    metaText: 'text-[10px] leading-[13px]',
    iconContainer: 'size-4 rounded-lg',
    icon: 'size-3.5'
  },
  full: {
    rootSpacing: 'px-1.5 py-1',
    rootText: 'text-base',
    contentGap: 'gap-0.5',
    condensedRowGap: 'gap-1',
    titleText: 'text-base leading-[20px] font-semibold',
    metaText: 'text-[13px] leading-[17px]',
    iconContainer: 'size-6 rounded-lg',
    icon: 'size-4.5'
  },
  large: {
    rootSpacing: 'px-2 py-1.5',
    rootText: 'text-lg',
    contentGap: 'gap-1',
    condensedRowGap: 'gap-1.5',
    titleText: 'text-lg leading-[24px] font-semibold',
    metaText: 'text-[15px] leading-[20px]',
    iconContainer: 'size-7 rounded-lg',
    icon: 'size-5'
  },
  xlarge: {
    rootSpacing: 'px-3 py-2',
    rootText: 'text-xl',
    contentGap: 'gap-2',
    condensedRowGap: 'gap-2',
    titleText: 'text-xl leading-[28px] font-semibold',
    metaText: 'text-[17px] leading-[23px]',
    iconContainer: 'size-8 rounded-xl',
    icon: 'size-6'
  },
  xxlarge: {
    rootSpacing: 'px-3 py-2.5',
    rootText: 'text-[22px]',
    contentGap: 'gap-2',
    condensedRowGap: 'gap-2',
    titleText: 'text-[22px] leading-[30px] font-semibold',
    metaText: 'text-lg leading-[24px]',
    iconContainer: 'size-8 rounded-xl',
    icon: 'size-6'
  }
};

export function getBadgeSizeClasses(
  heightTier: BadgeHeightTier
): BadgeSizeClasses {
  return BADGE_SIZE_CLASSES[heightTier];
}
