import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ennea: comandas, caja, inventario y gastos en un solo lugar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#15223B";
const BRASS = "#B8902F";
const IVORY = "#F6F1E6";

/** La imagen que sale al compartir el enlace: la campana de Ennea y la promesa, en azul noche y latón. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: NAVY,
          color: IVORY,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="84" height="84" viewBox="0 0 100 100">
            <path d="M17 67 A33 33 0 0 1 83 67 Z" fill={BRASS} />
            <rect x="10" y="71" width="80" height="8" rx="4" fill={BRASS} />
            <circle cx="50" cy="28" r="5.5" fill={IVORY} />
            <path d="M29 58 A22 22 0 0 1 41 42" fill="none" stroke={NAVY} strokeWidth="4.5" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: 52, letterSpacing: "-1px" }}>Ennea</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 86, lineHeight: 1.04, letterSpacing: "-2px", maxWidth: 1000, display: "flex", flexWrap: "wrap" }}>
            Que tu restaurante llegue a la meta del mes.
          </div>
          <div style={{ width: 220, height: 10, borderRadius: 5, background: BRASS, marginTop: 30 }} />
        </div>

        <div style={{ fontSize: 30, color: "#CBD2DE" }}>
          Comandas, caja, inventario y gastos en un solo lugar · Costa Rica
        </div>
      </div>
    ),
    { ...size },
  );
}
