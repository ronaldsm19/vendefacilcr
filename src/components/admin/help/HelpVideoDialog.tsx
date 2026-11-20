"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, CirclePlay } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { youtubeEmbedUrl, youtubeThumbUrl } from "@/lib/helpVideos";
import type { HelpVideoItem } from "./useHelpVideos";

/** Miniatura del video con el botón de play encima. */
export function HelpThumb({ video, className = "" }: { video: HelpVideoItem; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-brand-dark/10 aspect-video ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={youtubeThumbUrl(video.youtubeId)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/15">
        <CirclePlay className="h-8 w-8 text-white drop-shadow" aria-hidden />
      </span>
    </span>
  );
}

/** El video que se está viendo, dentro del modal. */
export function HelpPlayer({ video }: { video: HelpVideoItem }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe
        key={video.id}
        src={youtubeEmbedUrl(video.youtubeId)}
        title={video.title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Los videos para elegir. Con uno solo y `playing` ya puesto, el modal abre directo en el video. */
  videos: HelpVideoItem[];
  playing: HelpVideoItem | null;
  onPlay: (video: HelpVideoItem | null) => void;
  title?: string;
  description?: string;
  /** Enlace a la página con todos los videos ("" = no se muestra). */
  allHref?: string;
}

/**
 * El modal de ayuda: la lista de "¿Qué querés hacer?" y, al tocar una, el video ahí mismo. Si se
 * llegó a la lista, se puede volver a ella sin cerrar.
 */
export default function HelpVideoDialog({ open, onClose, videos, playing, onPlay, title = "¿Qué querés hacer?", description, allHref = "" }: Props) {
  const fromList = videos.length > 1;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={playing ? "max-w-3xl" : "max-w-lg"}>
        <DialogHeader className="pr-12">
          <DialogTitle>{playing ? playing.title : title}</DialogTitle>
          {!playing && description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="px-6 pb-6 pt-3 flex flex-col gap-4">
          {playing ? (
            <>
              <HelpPlayer video={playing} />
              {playing.description && <p className="text-sm text-brand-dark/70">{playing.description}</p>}
              {fromList && (
                <button
                  type="button"
                  onClick={() => onPlay(null)}
                  className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark/70 hover:text-brand-dark cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Ver los otros videos
                </button>
              )}
            </>
          ) : videos.length ? (
            <ul className="flex flex-col gap-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onPlay(v)}
                    className="w-full flex items-center gap-3 rounded-xl border border-brand-dark/10 p-2 text-left hover:bg-brand-dark/5 transition-colors cursor-pointer"
                  >
                    <HelpThumb video={v} className="w-28 shrink-0" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-brand-dark">{v.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-brand-dark/35" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-brand-dark/70">Todavía no hay videos para esta pantalla.</p>
          )}

          {allHref && (
            <Link href={allHref} onClick={onClose} className="self-start text-sm font-semibold text-[var(--admin-ink)] underline-offset-4 hover:underline">
              Ver toda la ayuda
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
