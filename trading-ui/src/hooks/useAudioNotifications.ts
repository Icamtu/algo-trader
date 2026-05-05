import { useCallback } from 'react';
import { audioService } from '@/services/audioService';

/**
 * useAudioNotifications
 * Thin hook wrapper over audioService — delegates all synthesis to the singleton.
 * Keeps component APIs stable while audioService owns the AudioContext lifecycle.
 */
export function useAudioNotifications() {
  const playConfirm = useCallback(() => audioService.playConfirm(), []);
  const playExecute = useCallback(() => audioService.playExecute(), []);
  const playSnap    = useCallback(() => audioService.playSnap(), []);
  const playWarning = useCallback(() => audioService.playWarning(), []);

  return { playConfirm, playExecute, playSnap, playWarning };
}
