const CR_OFFSET = 6 * 60 * 60 * 1000; // Costa Rica = UTC-6 sin DST
export function startOfTodayCR(now = new Date()): Date {
  const nowCR = new Date(now.getTime() - CR_OFFSET);
  return new Date(Date.UTC(nowCR.getUTCFullYear(), nowCR.getUTCMonth(), nowCR.getUTCDate()) + CR_OFFSET);
}
