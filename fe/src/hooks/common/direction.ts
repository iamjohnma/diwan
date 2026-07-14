import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TextDirection = 'ltr' | 'rtl';

function resolveDirection(fallback: () => TextDirection): TextDirection {
  if (typeof document !== 'undefined') {
    const dir = document.documentElement.dir || document.body?.dir;
    if (dir === 'rtl' || dir === 'ltr') {
      return dir;
    }
  }

  return fallback();
}

export function useDirection(): TextDirection {
  const { i18n } = useTranslation();
  const fallback = () => i18n.dir() as TextDirection;
  const [direction, setDirection] = useState<TextDirection>(() =>
    resolveDirection(fallback)
  );

  useEffect(() => {
    const updateDirection = () => setDirection(resolveDirection(fallback));
    updateDirection();
    i18n.on('languageChanged', updateDirection);

    let observer: MutationObserver | undefined;
    if (typeof document !== 'undefined') {
      observer = new MutationObserver(updateDirection);
      const opts = { attributes: true, attributeFilter: ['dir'] };
      observer.observe(document.documentElement, opts);
      if (document.body) {
        observer.observe(document.body, opts);
      }
    }

    return () => {
      i18n.off('languageChanged', updateDirection);
      observer?.disconnect();
    };
  }, [i18n]);

  return direction;
}
