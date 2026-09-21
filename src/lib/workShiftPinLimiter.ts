// Limitador de intentos de PIN para marcaje de jornada — mismo patrón en memoria que
// /api/admin/auth/login. Compartido entre start/stop: alguien podría alternar entre los dos
// endpoints para duplicar sus intentos si cada uno llevara su propio contador.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

export function isPinBlocked(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) { attempts.delete(key); return false; }
  return rec.count >= MAX_ATTEMPTS;
}

export function recordPinFailure(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else rec.count++;
}

export function clearPinAttempts(key: string) {
  attempts.delete(key);
}
