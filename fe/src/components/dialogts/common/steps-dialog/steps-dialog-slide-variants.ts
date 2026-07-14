export const STEPS_DIALOG_SLIDE_TRANSITION = {
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1] as const
};

export function createStepsDialogSlideVariants(isRtl: boolean) {
  const forward = isRtl ? '-100%' : '100%';
  const backward = isRtl ? '100%' : '-100%';

  return {
    enter: (direction: number) => ({
      x: direction > 0 ? forward : backward,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction > 0 ? backward : forward,
      opacity: 0
    })
  };
}
