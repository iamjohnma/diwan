type HapticTapIntensity = 'light' | 'medium' | 'selection';

const TAP_PULSE_MS: Record<HapticTapIntensity, number> = {
  light: 25,
  medium: 40,
  selection: 20
};

const IOS_SWITCH_ID = 'diwan-haptic-switch';

let iosHapticLabel: HTMLLabelElement | null = null;

function vibrateSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  );
}

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;

  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function ensureIosSwitchHapticControl(): HTMLLabelElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (iosHapticLabel) {
    return iosHapticLabel;
  }

  const existing = document.getElementById(IOS_SWITCH_ID);
  if (existing instanceof HTMLLabelElement) {
    iosHapticLabel = existing;

    return iosHapticLabel;
  }

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `${IOS_SWITCH_ID}-input`;
  checkbox.style.display = 'none';

  const label = document.createElement('label');
  label.id = IOS_SWITCH_ID;
  label.htmlFor = checkbox.id;
  label.style.display = 'none';
  label.append(checkbox);
  document.body.append(label);
  iosHapticLabel = label;

  return iosHapticLabel;
}

function triggerIosSwitchHaptic(): void {
  const label = ensureIosSwitchHapticControl();
  label?.click();
}

function vibrate(pattern: number | number[]): void {
  if (isIOSDevice()) {
    triggerIosSwitchHaptic();

    return;
  }

  if (vibrateSupported()) {
    navigator.vibrate(pattern);
  }
}

export function hapticTap(intensity: HapticTapIntensity = 'light'): void {
  vibrate(TAP_PULSE_MS[intensity]);
}

export function hapticDragPick(): void {
  vibrate(30);
}

let lastSnapTickAt = 0;

export function hapticSnapTick(): void {
  const now = Date.now();
  if (now - lastSnapTickAt < 80) return;
  lastSnapTickAt = now;
  hapticTap('selection');
}

export function hapticCommit(): void {
  vibrate([30, 35, 35]);
}

export function hapticVoiceRecordingStart(): void {
  vibrate(65);
}

export function hapticVoiceRecordingEnd(): void {
  vibrate([42, 48, 100]);
}

export function hapticFromPointerEvent(
  event: Readonly<
    Pick<PointerEvent, 'pointerType' | 'button' | 'defaultPrevented'>
  >
): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    (event.pointerType !== 'touch' && event.pointerType !== 'pen')
  ) {
    return;
  }

  hapticTap('light');
}
