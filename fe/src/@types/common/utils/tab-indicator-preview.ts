export interface IndicatorPreviewPosition {
  left: number;
  width: number;
}

export interface IndicatorPreviewRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GetPressPreviewIndicatorPositionParams {
  activePosition: IndicatorPreviewPosition;
  targetPosition: IndicatorPreviewPosition;
  maxStretchPx?: number;
  minStretchPx?: number;
  stretchRatio?: number;
}
