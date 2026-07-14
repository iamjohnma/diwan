export interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isScrolling: boolean;
  lastX: number;
  lastY: number;
  gestureTarget: EventTarget | null;
}
