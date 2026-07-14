import type {
  GetPressPreviewIndicatorPositionParams,
  IndicatorPreviewPosition,
  IndicatorPreviewRect
} from '@/@types/common/utils/tab-indicator-preview';

const DEFAULT_MAX_STRETCH_PX = 14;
const DEFAULT_MIN_STRETCH_PX = 6;
const DEFAULT_STRETCH_RATIO = 0.1;

export function getPressPreviewIndicatorPosition(
  params: GetPressPreviewIndicatorPositionParams
): IndicatorPreviewPosition {
  const activeCenter =
    params.activePosition.left + params.activePosition.width / 2;
  const targetCenter =
    params.targetPosition.left + params.targetPosition.width / 2;
  const direction = Math.sign(targetCenter - activeCenter);

  if (direction === 0) {
    return params.activePosition;
  }

  const extension = Math.min(
    params.maxStretchPx ?? DEFAULT_MAX_STRETCH_PX,
    Math.max(
      params.minStretchPx ?? DEFAULT_MIN_STRETCH_PX,
      Math.abs(targetCenter - activeCenter) *
        (params.stretchRatio ?? DEFAULT_STRETCH_RATIO)
    )
  );

  if (direction > 0) {
    return {
      left: params.activePosition.left,
      width: params.activePosition.width + extension
    };
  }

  return {
    left: params.activePosition.left - extension,
    width: params.activePosition.width + extension
  };
}

export function isPointWithinRect(
  rect: IndicatorPreviewRect,
  x: number,
  y: number
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
