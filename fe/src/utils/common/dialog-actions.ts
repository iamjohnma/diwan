import { handleError } from '@/lib/errors';

/**
 * Shared "fire-and-forget" submit behavior for dialog confirm/next actions:
 * close the dialog immediately (optimistic UX), run the action in the
 * background, and surface any failure as a toast. Used by DialogWrapper and
 * StepsDialogStep so the semantics never drift.
 */
export function fireAndForgetDialogAction(
  close: () => void,
  action: (() => unknown) | undefined
): void {
  close();
  void Promise.resolve(action?.()).catch((error: unknown) => {
    handleError(error, { forceToast: true });
  });
}
