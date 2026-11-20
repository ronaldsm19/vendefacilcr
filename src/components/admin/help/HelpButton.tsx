"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { helpSectionLabel, OPEN_HELP_SECTIONS, type HelpSection } from "@/lib/helpVideos";
import HelpVideoDialog from "./HelpVideoDialog";
import { useHelpVideos, type HelpVideoItem } from "./useHelpVideos";

/** La sección del panel donde está uno: el primer segmento después de /<negocio>/admin. */
export function currentHelpSection(pathname: string, base: string): string {
  return pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
}

/**
 * Los videos de esta pantalla. En Inicio, los de primeros pasos y las novedades; en una pantalla
 * sin videos propios, los de primeros pasos, para que el botón nunca abra vacío.
 */
export function videosForSection(videos: HelpVideoItem[], section: string): HelpVideoItem[] {
  const open = (v: HelpVideoItem) => OPEN_HELP_SECTIONS.includes(v.section);
  if (!section) return videos.filter(open);
  const own = videos.filter((v) => v.section === section);
  return own.length ? own : videos.filter((v) => v.section === ("general" as HelpSection));
}

/**
 * Botón "Ayuda" de la barra de arriba: abre los videos de la pantalla en la que está la persona.
 * No aparece mientras Ennea no haya publicado ningún video.
 */
export default function HelpButton({ base, variant = "bar" }: { base: string; variant?: "bar" | "icon" }) {
  const pathname = usePathname();
  const videos = useHelpVideos();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<HelpVideoItem | null>(null);

  const section = currentHelpSection(pathname, base);
  if (!videos?.length || section === "ayuda") return null;
  const list = videosForSection(videos, section);
  const own = section && list.some((v) => v.section === section);

  function openHelp() {
    setPlaying(list.length === 1 ? list[0] : null);
    setOpen(true);
  }

  return (
    <>
      {variant === "bar" ? (
        <button
          type="button"
          onClick={openHelp}
          className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-brand-dark/15 bg-white text-sm font-medium text-brand-dark hover:bg-brand-dark/5 transition-colors cursor-pointer"
        >
          <CircleHelp className="w-4 h-4 text-brand-dark/60" aria-hidden />
          Ayuda
        </button>
      ) : (
        <button
          type="button"
          onClick={openHelp}
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Ayuda: videos de esta pantalla"
        >
          <CircleHelp className="w-5 h-5" />
        </button>
      )}
      <HelpVideoDialog
        open={open}
        onClose={() => { setOpen(false); setPlaying(null); }}
        videos={list}
        playing={playing}
        onPlay={setPlaying}
        description={own ? `Videos cortos de ${helpSectionLabel(section)}.` : "Videos cortos para empezar."}
        allHref={`${base}/ayuda`}
      />
    </>
  );
}
