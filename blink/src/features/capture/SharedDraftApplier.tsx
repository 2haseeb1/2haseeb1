/**
 * Hands a pending share to the capture screen.
 *
 * Split out from `capture.tsx` purely so that the share-intent hook is only ever
 * mounted on native platforms, where its module actually exists. `capture.tsx`
 * renders this conditionally, which is safe — unlike calling the hook
 * conditionally, which is not.
 */

import { useEffect } from 'react';

import { useSharedDraft, type SharedDraft } from './useSharedDraft';

export function SharedDraftApplier({
  now,
  onDraft,
}: {
  now: number;
  onDraft: (draft: SharedDraft) => void;
}) {
  const { draft, consume } = useSharedDraft(now);

  // `draft`, `onDraft` and `consume` are all stable, so this fires once per
  // distinct share. After `consume` the draft becomes null and the effect
  // re-runs into an early return.
  useEffect(() => {
    if (!draft) return;
    onDraft(draft);
    consume();
  }, [draft, onDraft, consume]);

  return null;
}
