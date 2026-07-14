import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { useReducedMotion } from 'motion/react';
import {
  VOICE_ORB_COLOR_TRANSITION_DURATION_S,
  VOICE_ORB_FIXED_TIMESTEP_S,
  VOICE_ORB_POINTER_REPEL_RADIUS_FRACTION,
  type VoiceOrbColors,
  type VoiceOrbMode,
  type VoiceOrbParticle,
  type VoiceOrbPointerRepulsion,
  type VoiceOrbRenderBuffer,
  type VoiceOrbRgbColor,
  computeVoiceOrbParticleRadius,
  createVoiceOrbParticles,
  createVoiceOrbRenderBuffer,
  drawVoiceOrbBuffer,
  easeVoiceOrbColorTransition,
  formatVoiceOrbParticleShades,
  getVoiceOrbColorForMode,
  getVoiceOrbRingSpinSpeed,
  interpolateVoiceOrbRgbColor,
  isVoiceOrbRingLayoutMode,
  isVoiceOrbSphereLayoutMode,
  parseVoiceOrbColor,
  projectVoiceOrbParticlesInto,
  readVoiceOrbColorsFromDocument,
  resizeVoiceOrbParticles,
  setVoiceOrbParticleTargets,
  settleVoiceOrbParticles
} from '@/lib/ai/voice-orb';
import {
  type VoiceOrbPerformanceController,
  createVoiceOrbPerformanceController,
  estimateVoiceOrbDeviceScalar,
  getVoiceOrbMaxDevicePixelRatio,
  updateVoiceOrbPerformanceController
} from '@/lib/ai/voice-orb-performance';

interface UseAiAssistantVoiceOrbOptions {
  mode: VoiceOrbMode;
  active?: boolean;
  isMobile?: boolean;
  particleCount?: number;
  particleSizeScale?: number;
  getAudioLevel?: () => number;
  disablePointerInteraction?: boolean;
}

export interface UseAiAssistantVoiceOrbResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

interface VoiceOrbPointerRepulsionState {
  x: number;
  y: number;
  strength: number;
  targetStrength: number;
}

const VOICE_ORB_AUDIO_ATTACK_PER_S = 26;
const VOICE_ORB_AUDIO_RELEASE_PER_S = 9;
const VOICE_ORB_RING_SPIN_SPEED_EASE_PER_S = 4.2;

const VOICE_ORB_STATIC_FRAME_TIME_S = 0;
const VOICE_ORB_STATIC_FRAME_ELAPSED_S = 1000;

export function useAiAssistantVoiceOrb(
  options: UseAiAssistantVoiceOrbOptions
): UseAiAssistantVoiceOrbResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<VoiceOrbParticle[]>([]);
  const renderBufferRef = useRef<VoiceOrbRenderBuffer | null>(null);
  const performanceControllerRef = useRef<VoiceOrbPerformanceController | null>(
    null
  );
  const timeRef = useRef(0);
  const ringSpinRef = useRef(0);
  const ringSpinSpeedRef = useRef(getVoiceOrbRingSpinSpeed(options.mode));
  const startTimeRef = useRef(0);
  const modeTransitionStartRef = useRef(0);
  const transitionFromSphereLayoutRef = useRef(false);
  const transitionFromRingLayoutRef = useRef(false);
  const lastRadiusRef = useRef(0);
  const lastCanvasWidthRef = useRef(0);
  const lastCanvasHeightRef = useRef(0);
  const pointerRepulsionRef = useRef<VoiceOrbPointerRepulsionState>({
    x: 0,
    y: 0,
    strength: 0,
    targetStrength: 0
  });
  const initialColors = readVoiceOrbColorsFromDocument();
  const colorsRef = useRef<VoiceOrbColors>(initialColors);
  const displayColorRef = useRef<VoiceOrbRgbColor>(
    parseVoiceOrbColor(getVoiceOrbColorForMode(options.mode, initialColors))
  );
  const colorTransitionFromRef = useRef<VoiceOrbRgbColor>(
    displayColorRef.current
  );
  const colorTransitionStartRef = useRef(0);
  const targetColorRef = useRef<VoiceOrbRgbColor>(displayColorRef.current);
  const previousModeRef = useRef(options.mode);
  const modeRef = useRef(options.mode);
  const activeRef = useRef(options.active ?? true);
  const disablePointerInteractionRef = useRef(
    options.disablePointerInteraction ?? false
  );
  const isMobileRef = useRef(options.isMobile ?? false);
  const particleCountRef = useRef(options.particleCount);
  const particleSizeScaleRef = useRef(options.particleSizeScale ?? 1);
  const getAudioLevelRef = useRef(options.getAudioLevel);
  const audioLevelRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [colorSyncVersion, setColorSyncVersion] = useState(0);

  modeRef.current = options.mode;
  activeRef.current = options.active ?? true;
  disablePointerInteractionRef.current =
    options.disablePointerInteraction ?? false;
  isMobileRef.current = options.isMobile ?? false;
  particleCountRef.current = options.particleCount;
  particleSizeScaleRef.current = options.particleSizeScale ?? 1;
  getAudioLevelRef.current = options.getAudioLevel;

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') {
      return;
    }

    const root = document.documentElement;
    let animationFrameId = 0;
    const scheduleColorSync = () => {
      if (animationFrameId !== 0) {
        return;
      }

      animationFrameId = requestAnimationFrame(() => {
        animationFrameId = 0;
        setColorSyncVersion((version) => version + 1);
      });
    };

    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'attributes' &&
            (mutation.attributeName === 'style' ||
              mutation.attributeName === 'class')
        )
      ) {
        scheduleColorSync();
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      observer.disconnect();
      if (animationFrameId !== 0) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const previousMode = previousModeRef.current;
    const previousColors = colorsRef.current;
    const newColors = readVoiceOrbColorsFromDocument();
    const previousTargetColor = getVoiceOrbColorForMode(
      previousMode,
      previousColors
    );
    const nextTargetColor = getVoiceOrbColorForMode(options.mode, newColors);

    colorsRef.current = newColors;
    previousModeRef.current = options.mode;
    targetColorRef.current = parseVoiceOrbColor(nextTargetColor);

    if (previousTargetColor !== nextTargetColor) {
      colorTransitionFromRef.current = { ...displayColorRef.current };
      colorTransitionStartRef.current = performance.now();
    }

    const isLayoutTransition =
      isVoiceOrbSphereLayoutMode(options.mode) !==
        isVoiceOrbSphereLayoutMode(previousMode) ||
      isVoiceOrbRingLayoutMode(options.mode) !==
        isVoiceOrbRingLayoutMode(previousMode);
    if (isLayoutTransition) {
      modeTransitionStartRef.current = performance.now();
      transitionFromSphereLayoutRef.current =
        isVoiceOrbSphereLayoutMode(previousMode);
      transitionFromRingLayoutRef.current =
        isVoiceOrbRingLayoutMode(previousMode);
    }

    const applyTargets = () => {
      setVoiceOrbParticleTargets(particlesRef.current, options.mode);
    };

    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) {
      applyTargets();

      return;
    }

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width <= 0 || height <= 0) {
      applyTargets();

      return;
    }

    const radius = computeVoiceOrbParticleRadius(
      width,
      height,
      options.mode,
      options.isMobile ?? false
    );
    if (particlesRef.current.length === 0) {
      lastRadiusRef.current = radius;
      particlesRef.current = createVoiceOrbParticles(
        radius,
        options.particleCount
      );
    } else if (Math.abs(radius - lastRadiusRef.current) > 1) {
      lastRadiusRef.current = radius;
      resizeVoiceOrbParticles(particlesRef.current, radius);
    }

    applyTargets();
  }, [colorSyncVersion, options.isMobile, options.mode, options.particleCount]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const deviceScalar = estimateVoiceOrbDeviceScalar();
    const maxDpr = getVoiceOrbMaxDevicePixelRatio(deviceScalar);

    let animationId = 0;
    let isVisible = true;
    let lastFrameTime = 0;
    let pointerClientX = 0;
    let pointerClientY = 0;
    let hasPointerSample = false;
    let pointerSampleDirty = false;
    let activePointerId: number | null = null;

    const syncParticlesForRadius = (
      radius: number,
      resetFormation: boolean
    ) => {
      if (particlesRef.current.length === 0) {
        lastRadiusRef.current = radius;
        particlesRef.current = createVoiceOrbParticles(
          radius,
          particleCountRef.current
        );
        setVoiceOrbParticleTargets(particlesRef.current, modeRef.current);

        if (resetFormation) {
          startTimeRef.current = performance.now();
          timeRef.current = 0;
        }

        return;
      }

      if (Math.abs(radius - lastRadiusRef.current) > 1) {
        lastRadiusRef.current = radius;
        resizeVoiceOrbParticles(particlesRef.current, radius);
        setVoiceOrbParticleTargets(particlesRef.current, modeRef.current);
      }
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }

      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (
        width === lastCanvasWidthRef.current &&
        height === lastCanvasHeightRef.current
      ) {
        return;
      }

      lastCanvasWidthRef.current = width;
      lastCanvasHeightRef.current = height;

      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const radius = computeVoiceOrbParticleRadius(
        width,
        height,
        modeRef.current,
        isMobileRef.current
      );
      const isInitial = particlesRef.current.length === 0;
      syncParticlesForRadius(radius, isInitial);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    resize();

    const isPointerInsideCanvas = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const updatePointerRepulsion = (event: PointerEvent) => {
      if (activePointerId !== null && event.pointerId !== activePointerId) {
        return;
      }

      pointerClientX = event.clientX;
      pointerClientY = event.clientY;
      hasPointerSample = true;
      pointerSampleDirty = true;
    };

    const clearPointerRepulsion = () => {
      activePointerId = null;
      hasPointerSample = false;
      pointerSampleDirty = false;
      pointerRepulsionRef.current.targetStrength = 0;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (disablePointerInteractionRef.current || event.button !== 0) {
        return;
      }

      if (!isPointerInsideCanvas(event.clientX, event.clientY)) {
        return;
      }

      activePointerId = event.pointerId;
      if (!canvas.hasPointerCapture(event.pointerId)) {
        canvas.setPointerCapture(event.pointerId);
      }
      updatePointerRepulsion(event);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) {
        return;
      }

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      clearPointerRepulsion();
    };

    const resolvePointerTarget = () => {
      const pointerState = pointerRepulsionRef.current;

      if (disablePointerInteractionRef.current || !hasPointerSample) {
        pointerState.targetStrength = 0;

        return;
      }

      if (
        !pointerSampleDirty &&
        pointerState.targetStrength <= 0.01 &&
        pointerState.strength <= 0.01
      ) {
        return;
      }

      pointerSampleDirty = false;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        pointerState.targetStrength = 0;

        return;
      }

      const isInsideCanvas =
        pointerClientX >= rect.left &&
        pointerClientX <= rect.right &&
        pointerClientY >= rect.top &&
        pointerClientY <= rect.bottom;

      if (!isInsideCanvas && activePointerId === null) {
        pointerState.targetStrength = 0;

        return;
      }

      const scaleX = canvas.clientWidth / rect.width;
      const scaleY = canvas.clientHeight / rect.height;

      pointerState.x =
        (pointerClientX - rect.left) * scaleX - canvas.clientWidth / 2;
      pointerState.y =
        (pointerClientY - rect.top) * scaleY - canvas.clientHeight / 2;
      pointerState.targetStrength = 1;
    };

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', updatePointerRepulsion);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('pointerleave', clearPointerRepulsion);
    window.addEventListener('blur', clearPointerRepulsion);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? true;
      },
      { threshold: 0.01 }
    );
    visibilityObserver.observe(canvas);

    const animate = (currentTime: number) => {
      animationId = requestAnimationFrame(animate);

      if (!activeRef.current || !isVisible || document.hidden) {
        lastFrameTime = currentTime;

        return;
      }

      const particles = particlesRef.current;
      if (particles.length === 0) {
        lastFrameTime = currentTime;

        return;
      }

      let renderBuffer = renderBufferRef.current;
      if (!renderBuffer || renderBuffer.capacity !== particles.length) {
        renderBuffer = createVoiceOrbRenderBuffer(particles.length);
        renderBufferRef.current = renderBuffer;
      }

      let performanceController = performanceControllerRef.current;
      if (
        !performanceController ||
        performanceController.capacity !== particles.length
      ) {
        performanceController = createVoiceOrbPerformanceController(
          particles.length,
          deviceScalar
        );
        performanceControllerRef.current = performanceController;
      }

      const deltaSeconds =
        lastFrameTime > 0
          ? Math.min((currentTime - lastFrameTime) / 1000, 0.05)
          : VOICE_ORB_FIXED_TIMESTEP_S;

      if (lastFrameTime > 0) {
        timeRef.current += deltaSeconds;
        const targetRingSpinSpeed = getVoiceOrbRingSpinSpeed(modeRef.current);
        const ringSpinSpeedEase =
          1 - Math.exp(-deltaSeconds * VOICE_ORB_RING_SPIN_SPEED_EASE_PER_S);
        ringSpinSpeedRef.current +=
          (targetRingSpinSpeed - ringSpinSpeedRef.current) * ringSpinSpeedEase;
        ringSpinRef.current += deltaSeconds * ringSpinSpeedRef.current;
      }
      lastFrameTime = currentTime;

      const activeCount = updateVoiceOrbPerformanceController(
        performanceController,
        deltaSeconds
      );

      resolvePointerTarget();
      const pointerState = pointerRepulsionRef.current;
      const pointerEase = 1 - Math.exp(-deltaSeconds * 12);
      pointerState.strength +=
        (pointerState.targetStrength - pointerState.strength) * pointerEase;

      const pointerRepulsion: VoiceOrbPointerRepulsion | null =
        !disablePointerInteractionRef.current && pointerState.strength > 0.01
          ? {
              x: pointerState.x,
              y: pointerState.y,
              radius:
                Math.min(canvas.clientWidth, canvas.clientHeight) *
                VOICE_ORB_POINTER_REPEL_RADIUS_FRACTION,
              strength: pointerState.strength
            }
          : null;

      const elapsed = (currentTime - startTimeRef.current) / 1000;
      const modeTransitionElapsed =
        (currentTime - modeTransitionStartRef.current) / 1000;

      const isAudioReactiveMode =
        modeRef.current === 'listening' ||
        modeRef.current === 'speaking' ||
        modeRef.current === 'speaking-progress';
      const rawAudioLevel = isAudioReactiveMode
        ? Math.min(1, Math.max(0, getAudioLevelRef.current?.() ?? 0))
        : 0;
      const audioEasePerSecond =
        rawAudioLevel > audioLevelRef.current
          ? VOICE_ORB_AUDIO_ATTACK_PER_S
          : VOICE_ORB_AUDIO_RELEASE_PER_S;
      const audioEase = 1 - Math.exp(-deltaSeconds * audioEasePerSecond);
      audioLevelRef.current +=
        (rawAudioLevel - audioLevelRef.current) * audioEase;
      const audioLevel = audioLevelRef.current;

      projectVoiceOrbParticlesInto(renderBuffer, {
        particles,
        mode: modeRef.current,
        time: timeRef.current,
        elapsed,
        modeTransitionElapsed,
        transitionFromSphereLayout: transitionFromSphereLayoutRef.current,
        transitionFromRingLayout: transitionFromRingLayoutRef.current,
        pointerRepulsion,
        audioLevel,
        ringSpin: ringSpinRef.current,
        activeCount
      });

      const colorTransitionElapsed =
        (currentTime - colorTransitionStartRef.current) / 1000;
      const colorTransitionProgress =
        colorTransitionStartRef.current <= 0
          ? 1
          : Math.min(
              1,
              colorTransitionElapsed / VOICE_ORB_COLOR_TRANSITION_DURATION_S
            );
      const easedColorProgress = easeVoiceOrbColorTransition(
        colorTransitionProgress
      );
      const displayColor =
        colorTransitionProgress >= 1
          ? targetColorRef.current
          : interpolateVoiceOrbRgbColor(
              colorTransitionFromRef.current,
              targetColorRef.current,
              easedColorProgress
            );

      displayColorRef.current = displayColor;

      drawVoiceOrbBuffer({
        ctx,
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        buffer: renderBuffer,
        mode: modeRef.current,
        isMobile: isMobileRef.current,
        shades: formatVoiceOrbParticleShades(displayColor),
        particleSizeScale: particleSizeScaleRef.current,
        audioLevel
      });
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', updatePointerRepulsion);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('pointerleave', clearPointerRepulsion);
      window.removeEventListener('blur', clearPointerRepulsion);
      if (
        activePointerId !== null &&
        canvas.hasPointerCapture(activePointerId)
      ) {
        canvas.releasePointerCapture(activePointerId);
      }
      cancelAnimationFrame(animationId);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const maxDpr = getVoiceOrbMaxDevicePixelRatio(
      estimateVoiceOrbDeviceScalar()
    );

    const drawStaticFrame = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }

      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width <= 0 || height <= 0) {
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const radius = computeVoiceOrbParticleRadius(
        width,
        height,
        modeRef.current,
        isMobileRef.current
      );
      if (particlesRef.current.length === 0) {
        particlesRef.current = createVoiceOrbParticles(
          radius,
          particleCountRef.current
        );
      } else {
        resizeVoiceOrbParticles(particlesRef.current, radius);
      }
      lastRadiusRef.current = radius;

      setVoiceOrbParticleTargets(particlesRef.current, modeRef.current);
      settleVoiceOrbParticles(particlesRef.current);

      const particles = particlesRef.current;
      let renderBuffer = renderBufferRef.current;
      if (!renderBuffer || renderBuffer.capacity !== particles.length) {
        renderBuffer = createVoiceOrbRenderBuffer(particles.length);
        renderBufferRef.current = renderBuffer;
      }

      const colors = readVoiceOrbColorsFromDocument();
      const displayColor = parseVoiceOrbColor(
        getVoiceOrbColorForMode(modeRef.current, colors)
      );

      projectVoiceOrbParticlesInto(renderBuffer, {
        particles,
        mode: modeRef.current,
        time: VOICE_ORB_STATIC_FRAME_TIME_S,
        elapsed: VOICE_ORB_STATIC_FRAME_ELAPSED_S,
        modeTransitionElapsed: VOICE_ORB_STATIC_FRAME_ELAPSED_S,
        pointerRepulsion: null,
        audioLevel: 0
      });

      drawVoiceOrbBuffer({
        ctx,
        width,
        height,
        buffer: renderBuffer,
        mode: modeRef.current,
        isMobile: isMobileRef.current,
        shades: formatVoiceOrbParticleShades(displayColor),
        particleSizeScale: particleSizeScaleRef.current,
        audioLevel: 0
      });
    };

    const observer = new ResizeObserver(drawStaticFrame);
    observer.observe(canvas.parentElement ?? canvas);
    drawStaticFrame();

    return () => {
      observer.disconnect();
    };
  }, [
    reducedMotion,
    colorSyncVersion,
    options.isMobile,
    options.mode,
    options.particleCount,
    options.particleSizeScale
  ]);

  return { canvasRef };
}
