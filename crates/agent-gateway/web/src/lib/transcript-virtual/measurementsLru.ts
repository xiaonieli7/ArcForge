import type { VirtualItem } from "@tanstack/react-virtual";

// Per-conversation snapshots of the transcript virtualizer's measured rows,
// taken on unmount (virtualizer.takeSnapshot()) and fed back through
// initialMeasurementsCache when the conversation reopens — switching back to
// a conversation then lays out with exact row heights instead of estimates.
// In-memory only and width-gated: measured heights depend on the viewport
// width (and zoom/font scale, which width changes track in practice), so a
// snapshot is only restored at the width it was taken and never persisted.

export type TranscriptMeasurementsLru = {
  save: (conversationId: string, viewportWidth: number, measurements: VirtualItem[]) => void;
  restore: (conversationId: string, viewportWidth: number) => VirtualItem[] | null;
};

const DEFAULT_CAPACITY = 12;

export function createTranscriptMeasurementsLru(
  capacity = DEFAULT_CAPACITY,
): TranscriptMeasurementsLru {
  const entries = new Map<string, { viewportWidth: number; measurements: VirtualItem[] }>();

  return {
    save: (conversationId, viewportWidth, measurements) => {
      if (!conversationId || viewportWidth <= 0 || measurements.length === 0) {
        return;
      }
      entries.delete(conversationId);
      entries.set(conversationId, { viewportWidth, measurements });
      while (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    restore: (conversationId, viewportWidth) => {
      const hit = entries.get(conversationId);
      if (!hit || hit.viewportWidth !== viewportWidth) {
        return null;
      }
      entries.delete(conversationId);
      entries.set(conversationId, hit);
      return hit.measurements;
    },
  };
}
