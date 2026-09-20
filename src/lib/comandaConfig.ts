export interface ComandaConfigData {
  warnMinutes: number;
  alertMinutes: number;
}

export const DEFAULT_COMANDA_CONFIG: ComandaConfigData = { warnMinutes: 15, alertMinutes: 30 };

export const COMANDA_MINUTES_MIN = 1;
export const COMANDA_MINUTES_MAX = 600;

/** Normaliza lo que venga del subdoc del Tenant (puede faltar en tenants viejos). */
export function readComandaConfig(raw: Partial<ComandaConfigData> | null | undefined): ComandaConfigData {
  return {
    warnMinutes:  typeof raw?.warnMinutes  === "number" ? raw.warnMinutes  : DEFAULT_COMANDA_CONFIG.warnMinutes,
    alertMinutes: typeof raw?.alertMinutes === "number" ? raw.alertMinutes : DEFAULT_COMANDA_CONFIG.alertMinutes,
  };
}
