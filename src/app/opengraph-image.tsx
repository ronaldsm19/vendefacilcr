import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VendeFácil: comandas, caja, inventario y gastos en un solo lugar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#14171C";
const SQUARES = ["#FFFFFF", "#5B82F5", "#2FB37C", "#F2703D"];

/** La imagen que sale al compartir el enlace: la marca y la promesa, con los colores del landing. */
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
          background: "#EEF3FF",
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: INK,
              display: "flex",
              flexWrap: "wrap",
              alignContent: "space-between",
              justifyContent: "space-between",
              padding: 18,
            }}
          >
            {SQUARES.map((color) => (
              <div key={color} style={{ width: 17, height: 17, borderRadius: 4, background: color }} />
            ))}
          </div>
          <div style={{ fontSize: 44, letterSpacing: "-1.5px" }}>VendeFácil</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 86, lineHeight: 1.04, letterSpacing: "-2px", maxWidth: 1000, display: "flex", flexWrap: "wrap" }}>
            Que tu restaurante llegue a la meta del mes.
          </div>
          <div style={{ width: 220, height: 10, borderRadius: 5, background: "#F2703D", marginTop: 30 }} />
        </div>

        <div style={{ fontSize: 30, color: "#4B5362" }}>
          Comandas, caja, inventario y gastos en un solo lugar · Costa Rica
        </div>
      </div>
    ),
    { ...size },
  );
}
