import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VendeFácil | Tu tienda online lista para vender";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #06060A 0%, #0D0D20 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Glow background */}
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Logo icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 22,
            background: "linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {/* Lightning bolt SVG */}
          <svg viewBox="0 0 64 64" width="52" height="52">
            <path d="M36 8L18 36h14l-4 20 18-24H32l4-24z" fill="white" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            background: "linear-gradient(135deg, #60a5fa 0%, #c084fc 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 16,
            letterSpacing: "-1px",
          }}
        >
          VendeFácil
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "rgba(255,255,255,0.55)",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          Tu tienda online lista para vender.{"\n"}Para emprendedores costarricenses.
        </div>

        {/* Domain tag */}
        <div
          style={{
            marginTop: 36,
            fontSize: 18,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.05em",
          }}
        >
          vendefacilcr.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
