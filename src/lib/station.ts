export type ProductStation = "cocina" | "bebidas" | "ninguna";
export const STATIONS: ProductStation[] = ["cocina", "bebidas", "ninguna"];
export const STATION_LABELS: Record<ProductStation, string> = {
  cocina: "Cocina", bebidas: "Bebidas", ninguna: "Ninguna",
};
export function isStation(v: unknown): v is ProductStation {
  return typeof v === "string" && (STATIONS as string[]).includes(v);
}
/** Regla del contrato para productos sin station persistido. */
export function effectiveStation(p: { station?: string | null; menuSection?: string | null }): ProductStation {
  if (isStation(p.station)) return p.station;
  return p.menuSection === "bebidas" ? "bebidas" : "cocina";
}
