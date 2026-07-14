import { useEffect, useLayoutEffect, useState } from 'react';
import { normalizeRemoteAssetUrl } from '@/utils/common/remote-assets';

interface CachedImageSrcPropsHook {
  keepPreviousWhileLoading?: boolean;
}

const loadedImageSrcs = new Set<string>();
const inFlightImageLoads = new Map<string, Promise<void>>();

function normalizeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;

  return normalizeRemoteAssetUrl(src) || null;
}

function isEphemeralImageSrc(src: string): boolean {
  return src.startsWith('blob:') || src.startsWith('data:');
}

function shouldKeepPreviousImage(
  normalizedSrc: string | null,
  resolvedSrc: string | null,
  keepPreviousWhileLoading: boolean
): normalizedSrc is string {
  return !!(
    normalizedSrc &&
    keepPreviousWhileLoading &&
    resolvedSrc &&
    resolvedSrc !== normalizedSrc &&
    !isImageSrcCached(normalizedSrc)
  );
}

export function markImageSrcLoaded(src: string | null | undefined): void {
  const normalizedSrc = normalizeImageSrc(src);
  if (normalizedSrc && !isEphemeralImageSrc(normalizedSrc)) {
    loadedImageSrcs.add(normalizedSrc);
  }
}

function decodeImageSrc(
  src: string,
  loadedSrc: string | null | undefined = src
): Promise<void> {
  if (typeof window === 'undefined') {
    markImageSrcLoaded(loadedSrc);

    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const image = new window.Image();
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    const handleLoad = () => {
      markImageSrcLoaded(loadedSrc);
      if (typeof image.decode === 'function') {
        void image
          .decode()
          .catch(() => undefined)
          .finally(settle);

        return;
      }
      settle();
    };

    image.onload = handleLoad;
    image.onerror = settle;
    image.decoding = 'async';
    image.src = src;
    if (image.complete && image.naturalWidth > 0) handleLoad();
  });
}

function loadImageSrc(src: string | null | undefined): Promise<void> {
  const normalizedSrc = normalizeImageSrc(src);
  if (
    !normalizedSrc ||
    isEphemeralImageSrc(normalizedSrc) ||
    isImageSrcCached(normalizedSrc)
  ) {
    return Promise.resolve();
  }

  const existingLoad = inFlightImageLoads.get(normalizedSrc);
  if (existingLoad) return existingLoad;

  const loadPromise = decodeImageSrc(normalizedSrc).finally(() => {
    inFlightImageLoads.delete(normalizedSrc);
  });
  inFlightImageLoads.set(normalizedSrc, loadPromise);

  return loadPromise;
}

export function isImageSrcCached(src: string | null | undefined): boolean {
  const normalizedSrc = normalizeImageSrc(src);

  return (
    !!normalizedSrc &&
    (isEphemeralImageSrc(normalizedSrc) || loadedImageSrcs.has(normalizedSrc))
  );
}

export function useCachedImageSrc(
  src: string | null | undefined,
  props?: CachedImageSrcPropsHook
): string | null {
  const keepPreviousWhileLoading = props?.keepPreviousWhileLoading ?? true;
  const normalizedSrc = normalizeImageSrc(src);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    () => normalizedSrc
  );
  const keepPrevious = shouldKeepPreviousImage(
    normalizedSrc,
    resolvedSrc,
    keepPreviousWhileLoading
  );

  useLayoutEffect(() => {
    if (!keepPrevious) setResolvedSrc(normalizedSrc);
  }, [keepPrevious, normalizedSrc]);

  useEffect(() => {
    if (!keepPrevious) return;
    if (typeof window === 'undefined') {
      setResolvedSrc(normalizedSrc);

      return;
    }

    let isCancelled = false;
    void loadImageSrc(normalizedSrc).finally(() => {
      if (!isCancelled) setResolvedSrc(normalizedSrc);
    });

    return () => {
      isCancelled = true;
    };
  }, [keepPrevious, normalizedSrc]);

  return resolvedSrc;
}
