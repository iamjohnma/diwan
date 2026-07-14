'use client';

import * as React from 'react';
import {
  StepIndexContext,
  StepsDialogContext
} from '@/components/dialogts/common/steps-dialog/context';
import { STEPS_DIALOG_SLIDE_TRANSITION } from '@/components/dialogts/common/steps-dialog/steps-dialog-slide-variants';
import { useDirection } from '@/hooks/common/direction';
import { cn } from '@/utils/common/cn';

interface StepsDialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  measureKey?: string | number;
}

// The host height animates via a CSS transition driven by a plain `style`
// rather than motion's `animate`. React writes `style.height` synchronously
// during commit (before paint), so when content changes *within* a step (e.g.
// a summary row appearing) the host resizes in the same frame the content does
// — motion applies height a frame late, during which `overflow-hidden` clips
// the newly grown content (the "height collapse"). The curve mirrors
// STEPS_DIALOG_SLIDE_TRANSITION so the step-to-step height animation is
// unchanged.
const HOST_HEIGHT_TRANSITION = `height ${
  STEPS_DIALOG_SLIDE_TRANSITION.duration * 1000
}ms cubic-bezier(${STEPS_DIALOG_SLIDE_TRANSITION.ease.join(', ')})`;

const SLIDE_TRANSFORM_TRANSITION = `transform ${
  STEPS_DIALOG_SLIDE_TRANSITION.duration * 1000
}ms cubic-bezier(${STEPS_DIALOG_SLIDE_TRANSITION.ease.join(', ')})`;

// The panel is stretched to the host's current height by the track layout
// (grid row minmax(0,1fr) fills whatever height the host has), so the body's
// own offsetHeight/scrollHeight report the stretched size and never a smaller
// natural one — measuring them made steps grow but never shrink back. The
// step content block is a plain flow child of the scrollable body, so its
// height is the true natural content height regardless of the stretch.
function measureBodyNaturalHeight(body: HTMLElement) {
  const content = body.querySelector<HTMLElement>(
    '[data-slot="steps-dialog-step"]'
  );

  if (!content) {
    return Math.max(body.scrollHeight, body.offsetHeight);
  }

  const style = window.getComputedStyle(body);
  const verticalChrome =
    parseFloat(style.paddingTop) +
    parseFloat(style.paddingBottom) +
    parseFloat(style.borderTopWidth) +
    parseFloat(style.borderBottomWidth);

  return content.offsetHeight + verticalChrome;
}

function measureStepNaturalHeight(inner: HTMLElement) {
  const body = inner.querySelector<HTMLElement>(
    '[data-slot="steps-dialog-body"]'
  );

  if (!body) {
    return inner.offsetHeight;
  }

  let nextHeight = 0;

  for (const child of Array.from(inner.children) as HTMLElement[]) {
    const position = window.getComputedStyle(child).position;
    if (position === 'absolute' || position === 'fixed') {
      continue;
    }

    if (child === body || child.contains(body)) {
      const naturalBody = measureBodyNaturalHeight(body);
      const offset =
        child === body ? 0 : child.offsetHeight - body.offsetHeight;
      nextHeight += naturalBody + Math.max(offset, 0);
    } else {
      nextHeight += child.offsetHeight;
    }
  }

  return nextHeight;
}

export function StepsDialogBodyWithIndexProvider(props: StepsDialogBodyProps) {
  const context = React.useContext(StepsDialogContext);
  const childrenArray = React.Children.toArray(props.children);
  const stepCount = Math.max(childrenArray.length, 1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const panelRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [height, setHeight] = React.useState<number | 'auto'>('auto');
  const [animated, setAnimated] = React.useState(false);
  const [slideEnabled, setSlideEnabled] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const lastHeightRef = React.useRef(0);
  const direction = useDirection();
  const isRtl = direction === 'rtl';

  const setTotalSteps = context?.setTotalSteps;
  React.useEffect(() => {
    setTotalSteps?.(childrenArray.length);
  }, [childrenArray.length, setTotalSteps]);

  const activeStep = context?.activeStep ?? 0;
  const presentation = context?.presentation ?? 'dialog';
  const open = context?.open ?? false;
  const setStepTransitioning = context?.setStepTransitioning;
  const isStepTransitioning = context?.isStepTransitioning ?? false;

  // Deep cause of 1→2-only failures with Motion/AnimatePresence: the first
  // step change remounts panel 0 into an exit layer whose first Presence/Motion
  // lifecycle often completes with no visible translate, while later swaps are
  // "warm" and slide. A stable track + CSS transform makes every index change
  // — including 0→1 — use the same animation path (no mount/exit lifecycle).
  React.useLayoutEffect(() => {
    setSlideEnabled(true);
  }, []);

  const prevActiveStepRef = React.useRef(activeStep);
  React.useLayoutEffect(() => {
    if (prevActiveStepRef.current === activeStep) {
      return;
    }
    prevActiveStepRef.current = activeStep;
    if (!slideEnabled) {
      return;
    }
    setStepTransitioning?.(true);
  }, [activeStep, setStepTransitioning, slideEnabled]);

  React.useEffect(() => {
    if (!isStepTransitioning) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        setStepTransitioning?.(false);
      },
      STEPS_DIALOG_SLIDE_TRANSITION.duration * 1000 + 32
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeStep, isStepTransitioning, setStepTransitioning]);

  const updateViewportWidth = React.useCallback(() => {
    const width = containerRef.current?.offsetWidth ?? 0;
    if (width > 0) {
      setViewportWidth(width);
    }
  }, []);

  React.useLayoutEffect(() => {
    updateViewportWidth();
  }, [open, presentation, props.measureKey, updateViewportWidth]);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateViewportWidth();
    });
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [open, presentation, updateViewportWidth]);

  // The overflow-hidden host is still a programmatic scroll container, so the
  // browser may scroll it to reveal a focused element inside an off-screen
  // panel (focus traps restoring focus mid-transition). That offset makes the
  // step swap look like an instant jump and, since nothing else resets it,
  // permanently misaligns the track against its translate. Panels are only
  // ever positioned via the track transform, so any host scroll is spurious —
  // zero it the moment it appears.
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const resetScroll = () => {
      if (node.scrollLeft !== 0) {
        node.scrollLeft = 0;
      }
      if (node.scrollTop !== 0) {
        node.scrollTop = 0;
      }
    };

    resetScroll();
    node.addEventListener('scroll', resetScroll);

    return () => {
      node.removeEventListener('scroll', resetScroll);
    };
  }, [open, presentation]);

  const measureHeight = React.useCallback(
    (animate = false) => {
      const panel = panelRefs.current[activeStep];
      if (!panel) {
        return;
      }

      const nextHeight = measureStepNaturalHeight(panel);
      if (nextHeight > 0 && nextHeight !== lastHeightRef.current) {
        lastHeightRef.current = nextHeight;
        setAnimated(animate);
        setHeight(nextHeight);
      }
    },
    [activeStep]
  );

  // Start as "was closed" even when we mount already-open. StepsDialogContent
  // only renders this subtree while visualOpen is true, so the provider
  // remounts fresh on every open with `open` already true. Seeding this ref
  // with `open` would make `didOpen` below never fire, dropping the open into
  // the animated step-transition branch (measureHeight(true)) and animating the
  // first auto→measured height correction over 280ms. Seeding `false` lets the
  // very first open be detected as `didOpen` so it sizes instantly.
  const prevOpenRef = React.useRef(false);
  const prevMeasureKeyRef = React.useRef(props.measureKey);

  React.useLayoutEffect(() => {
    const didOpen = open && !prevOpenRef.current;
    const didContentChange =
      open &&
      props.measureKey !== undefined &&
      props.measureKey !== prevMeasureKeyRef.current;

    prevOpenRef.current = open;
    prevMeasureKeyRef.current = props.measureKey;

    if (!open || presentation !== 'dialog') {
      return;
    }

    if (didOpen || didContentChange) {
      lastHeightRef.current = 0;
      setAnimated(false);
      setHeight('auto');

      return;
    }

    if (activeStep < 0) {
      return;
    }

    measureHeight(true);
  }, [activeStep, measureHeight, open, presentation, props.measureKey]);

  React.useLayoutEffect(() => {
    if (!open || presentation !== 'dialog' || height !== 'auto') {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      measureHeight();
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [activeStep, height, measureHeight, open, presentation, props.measureKey]);

  React.useLayoutEffect(() => {
    if (!open || presentation !== 'dialog') {
      return;
    }
    if (height === 'auto' || isStepTransitioning) {
      return;
    }

    measureHeight();
  });

  React.useEffect(() => {
    if (presentation !== 'dialog' || !open) {
      return;
    }

    const panel = panelRefs.current[activeStep];
    if (!panel) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => measureHeight());
    resizeObserver.observe(panel);

    const stepContent = panel.querySelector<HTMLElement>(
      '[data-slot="steps-dialog-step"]'
    );

    let mutationFrameId = 0;
    let mutationObserver: MutationObserver | null = null;
    if (stepContent) {
      resizeObserver.observe(stepContent);

      mutationObserver = new MutationObserver(() => {
        cancelAnimationFrame(mutationFrameId);
        mutationFrameId = requestAnimationFrame(() => {
          lastHeightRef.current = 0;
          measureHeight();
        });
      });
      mutationObserver.observe(stepContent, {
        childList: true,
        subtree: true
      });
    }

    return () => {
      cancelAnimationFrame(mutationFrameId);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  }, [activeStep, measureHeight, open, presentation, props.measureKey]);

  const hostStyle: React.CSSProperties = {
    height,
    transition: animated ? HOST_HEIGHT_TRANSITION : undefined
  };

  const offsetPx =
    viewportWidth > 0
      ? (isRtl ? activeStep : -activeStep) * viewportWidth
      : 0;

  const trackStyle: React.CSSProperties = {
    width: viewportWidth > 0 ? viewportWidth * stepCount : `${stepCount * 100}%`,
    transform: `translate3d(${offsetPx}px, 0, 0)`,
    transition: slideEnabled ? SLIDE_TRANSFORM_TRANSITION : undefined
  };

  const panelStyle: React.CSSProperties = {
    width: viewportWidth > 0 ? viewportWidth : `${100 / stepCount}%`,
    flex: '0 0 auto'
  };

  const stepHostClassName = cn(
    'relative w-full',
    presentation === 'dialog' &&
      'overflow-hidden max-h-[95svh] md:max-h-[85svh]',
    props.className
  );
  const stepSurfaceClassName = cn(
    'grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]',
    presentation === 'dialog' && 'max-h-[95svh] md:max-h-[85svh]'
  );

  const stepTransition = (
    <div
      data-slot="steps-dialog-step-track"
      className="relative flex"
      style={trackStyle}
    >
      {childrenArray.map((child, index) => (
        <div
          key={index}
          ref={(node) => {
            panelRefs.current[index] = node;
          }}
          data-slot="steps-dialog-step-panel"
          data-active={index === activeStep ? 'true' : 'false'}
          className={stepSurfaceClassName}
          style={{
            ...panelStyle,
            pointerEvents: index === activeStep ? 'auto' : 'none'
          }}
          {...(index === activeStep ? {} : { inert: true })}
        >
          <StepIndexContext.Provider value={index}>
            {child}
          </StepIndexContext.Provider>
        </div>
      ))}
    </div>
  );

  if (presentation === 'drawer') {
    return (
      <div
        ref={containerRef}
        data-slot="steps-dialog-step-host"
        className={stepHostClassName}
      >
        {stepTransition}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-slot="steps-dialog-step-host"
      className={stepHostClassName}
      style={hostStyle}
    >
      {stepTransition}
    </div>
  );
}
