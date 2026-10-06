/**
 * Bridges the OS share sheet into the capture screen.
 *
 * Sharing *into* Blink has to be one tap and zero decisions: the share arrives,
 * the capture sheet opens with the title and date already filled in, and the
 * user confirms. Nothing is ever saved without them seeing it, because the
 * parser is good but not infallible.
 *
 * This module is deliberately thin — it only adapts the shape of the OS payload
 * into `taskInputFromShare`, so all the parsing rules stay in one testable place
 * with no native dependency.
 */

import { useShareIntent } from 'expo-share-intent';
import { useCallback, useMemo, useState } from 'react';

import type { NewTaskInput } from '@/lib/types';

import { taskInputFromShare, type SharedPayload, type ShareCaptureResult } from './share';

export interface SharedDraft {
  input: NewTaskInput;
  source: string;
}

/**
 * A fingerprint for one particular share.
 *
 * The OS module keeps the last intent around, so we need to tell "the share I
 * already handled" apart from "a new share of the same kind". Content plus file
 * count is enough to distinguish them in practice, and a repeat share of
 * identical text is harmless to handle twice.
 */
function shareKeyOf(payload: SharedPayload, hasShareIntent: boolean): string | null {
  if (!hasShareIntent) return null;
  return [
    payload.text ?? '',
    payload.webUrl ?? '',
    (payload.files ?? []).length,
  ].join('\u0000');
}

function toPayload(shareIntent: {
  text?: string | null;
  webUrl?: string | null;
  files?: { fileName?: string | null }[] | null;
}): SharedPayload {
  return {
    text: shareIntent.text ?? null,
    webUrl: shareIntent.webUrl ?? null,
    files: (shareIntent.files ?? []).map((file) => ({ fileName: file.fileName ?? null })),
  };
}

function safeParse(payload: SharedPayload, now: number): ShareCaptureResult | null {
  try {
    return taskInputFromShare(payload, now);
  } catch {
    // A malformed share must not break capture; the user can just type.
    return null;
  }
}

/**
 * Reads the pending share, if any.
 *
 * `consume` clears the OS-side intent so that reopening the app later does not
 * silently resurrect a share the user already dealt with.
 */
export function useSharedDraft(now: number): {
  draft: SharedDraft | null;
  consume: () => void;
} {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [handledKey, setHandledKey] = useState<string | null>(null);

  const payload = useMemo(() => toPayload(shareIntent), [shareIntent]);
  const shareKey = shareKeyOf(payload, hasShareIntent);

  // Derived, not stored: a new share produces a new key, which immediately
  // differs from the handled one and surfaces a fresh draft.
  const draft = useMemo<SharedDraft | null>(() => {
    if (shareKey === null || shareKey === handledKey) return null;
    const parsed = safeParse(payload, now);
    return parsed ? { input: parsed.input, source: parsed.source } : null;
  }, [shareKey, handledKey, payload, now]);

  const consume = useCallback(() => {
    setHandledKey(shareKey);
    resetShareIntent();
  }, [shareKey, resetShareIntent]);

  return { draft, consume };
}
