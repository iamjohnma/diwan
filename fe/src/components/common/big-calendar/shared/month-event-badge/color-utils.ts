const HEX_CHANNELS = [1, 3, 5] as const;
const LIGHT_HEX_TARGET = [255, 255, 255] as const;

function mixHex(
  hex: string,
  target: readonly [number, number, number],
  amount: number
): string {
  const channels = HEX_CHANNELS.map((start, index) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    const mixed = Math.round(
      value + ((target[index] ?? value) - value) * amount
    );

    return mixed.toString(16).padStart(2, '0');
  });

  return `#${channels.join('')}`;
}

function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, LIGHT_HEX_TARGET, amount);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const [red, green, blue] = HEX_CHANNELS.map((start) =>
    parseInt(hex.slice(start, start + 2), 16)
  );

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getDoctorColorStyles(
  doctorColor: string | null
): React.CSSProperties | undefined {
  if (!doctorColor) return undefined;

  return {
    color: doctorColor,
    backgroundColor: lightenHex(doctorColor, 0.88),
    borderColor: lightenHex(doctorColor, 0.7)
  };
}

// Inline glow styles for a deep-link/notification highlight. The dentist's own
// color must win over every badge surface â€” the doctor-view inline background,
// the month-view primary tint, and the late-visit gray â€” so the ring color and
// fill are set as inline styles instead of currentColor-based classes.
export function getHighlightColorStyles(
  highlightColor: string
): React.CSSProperties {
  return {
    backgroundColor: hexWithAlpha(highlightColor, 0.15),
    '--tw-ring-color': hexWithAlpha(highlightColor, 0.35)
  } as React.CSSProperties;
}

export function getIconContainerStyle(
  doctorColor: string | null
): React.CSSProperties | undefined {
  if (!doctorColor) return undefined;

  return {
    backgroundColor: lightenHex(doctorColor, 0.2)
  };
}

interface EventBadgeSurfaceInput {
  showLateGray: boolean;

  showDoctorColor: boolean;
  isSelected: boolean;
  enableHoverState: boolean;
  // When set, the hover background is applied unconditionally instead of via
  // the CSS `:hover` pseudo-class. The draggable badge uses this so it paints
  // hovered on its first frame after replacing its static placeholder, before
  // the browser re-evaluates `:hover` under the (now stationary) cursor.
  forceHover?: boolean;
}

export interface EventBadgeSurfaceClasses {
  tone: string;

  fill: string | false;

  hover: string | false;
}

export function getEventBadgeSurfaceClasses({
  showLateGray,
  showDoctorColor,
  isSelected,
  enableHoverState,
  forceHover = false
}: EventBadgeSurfaceInput): EventBadgeSurfaceClasses {
  const tone = showLateGray
    ? 'border border-neutral-200 text-neutral-700'
    : showDoctorColor
      ? 'border'
      : 'text-primary border border-primary/15';

  const fill = showLateGray
    ? isSelected
      ? 'bg-neutral-100'
      : 'bg-neutral-50'
    : !showDoctorColor &&
      (isSelected ? 'bg-primary-light-active' : 'bg-primary-light');

  const hover =
    enableHoverState &&
    (showLateGray
      ? forceHover
        ? 'bg-neutral-100'
        : 'hover:bg-neutral-100 group-hover/badge:bg-neutral-100'
      : !showDoctorColor &&
        (forceHover
          ? 'bg-primary-light-active/80'
          : 'hover:bg-primary-light-active/80 group-hover/badge:bg-primary-light-active/80'));

  return { tone, fill, hover };
}

export function getEventBadgeIconContainerClass({
  showLateGray,
  showDoctorColor
}: Pick<EventBadgeSurfaceInput, 'showLateGray' | 'showDoctorColor'>):
  string | false {
  if (showLateGray) {
    return 'bg-neutral-500/80';
  }

  return !showDoctorColor && 'bg-primary/80';
}
