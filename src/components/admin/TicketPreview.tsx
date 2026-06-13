"use client";

import type { Row } from "@/lib/ticket";

const SIZE_CLASS: Record<number, string> = {
  12: "text-[13px]",
  9: "text-[11px]",
  8: "text-[10px]",
  7: "text-[9px]",
};

/** Renderiza filas de ticket (las mismas usadas para el PDF) como un recibo HTML monoespaciado. */
export default function TicketPreview({ rows }: { rows: Row[] }) {
  return (
    <div className="mx-auto w-[280px] max-w-full bg-white text-gray-900 font-mono text-[11px] leading-snug p-3 rounded-md border border-brand-muted shadow-sm overflow-hidden">
      {rows.map((r, i) => {
        if (r.t === "divider") {
          return <hr key={i} className="my-1.5 border-t border-dashed border-gray-400" />;
        }
        if (r.t === "gap") {
          return <div key={i} className="h-2" />;
        }

        const sizeClass = SIZE_CLASS[("size" in r ? r.size : undefined) ?? 9] ?? SIZE_CLASS[9];
        const boldClass = r.bold ? "font-bold" : "";

        if (r.t === "center") {
          return (
            <div key={i} className={`text-center whitespace-pre ${sizeClass} ${boldClass}`}>
              {r.text}
            </div>
          );
        }
        if (r.t === "left") {
          return (
            <div key={i} className={`whitespace-pre ${sizeClass} ${boldClass}`}>
              {r.text}
            </div>
          );
        }
        return (
          <div key={i} className={`flex justify-between gap-2 ${sizeClass} ${boldClass}`}>
            <span>{r.left}</span>
            <span>{r.right}</span>
          </div>
        );
      })}
    </div>
  );
}
