/**
 * Opens the capture sheet when the app is launched by a share.
 *
 * Kept separate from `capture.tsx` so the two concerns stay independent: this
 * component only decides *where* a share goes, the screen decides what to do with
 * it. It renders nothing and is mounted only inside `ShareIntentProvider`.
 */

import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useShareIntent } from 'expo-share-intent';

export function SharedIntentRedirect() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, isReady } = useShareIntent();

  useEffect(() => {
    if (!isReady || !hasShareIntent) return;
    // A file-only share is handled on the capture screen itself, so only text
    // and links are worth interrupting the user for.
    const hasText = Boolean((shareIntent.text ?? '').trim() || (shareIntent.webUrl ?? '').trim());
    if (!hasText) return;
    // A share means "capture this now", so go straight to the capture sheet.
    router.push('/capture');
  }, [isReady, hasShareIntent, shareIntent, router]);

  return null;
}
