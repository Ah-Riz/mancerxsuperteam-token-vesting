export function isMilestoneTriggered(bitmap: Uint8Array, idx: number): boolean {
  if (idx < 0 || idx > 255) return false;
  const byteIndex = Math.floor(idx / 8);
  const bitIndex = idx % 8;
  if (byteIndex >= bitmap.length) return false;
  return (bitmap[byteIndex] & (1 << bitIndex)) !== 0;
}
