"use client";

import { useMemo, useState } from "react";
import { CircleHelp, MessageCircle, Search } from "lucide-react";
import { helpSearchKey, helpSectionLabel } from "@/lib/helpVideos";
import { waLink } from "@/lib/contacto";
import HelpVideoDialog, { HelpThumb } from "@/components/admin/help/HelpVideoDialog";
import { useHelpVideos, type HelpVideoItem } from "@/components/admin/help/useHelpVideos";

/** Todos los videos de ayuda, por sección y con buscador. Cada uno se ve en un modal. */
export default function AyudaPage() {
  const videos = useHelpVideos();
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<HelpVideoItem | null>(null);

  const groups = useMemo(() => {
    const q = helpSearchKey(query.trim());
    const found = (videos ?? []).filter((v) => !q || helpSearchKey(`${v.title} ${v.description} ${helpSectionLabel(v.section)}`).includes(q));
    const bySection = new Map<string, HelpVideoItem[]>();
    for (const v of found) bySection.set(v.section, [...(bySection.get(v.section) ?? []), v]);
    return [...bySection.entries()];
  }, [videos, query]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-brand text-2xl font-bold text-brand-dark">Ayuda</h1>
        <p className="text-brand-dark/60 text-sm mt-1">
          Videos cortos que muestran cómo se hace cada cosa. También los encontrás en el botón Ayuda de cada pantalla.
        </p>
      </div>

      {videos === null ? (
        <p className="text-sm text-brand-dark/50">Cargando...</p>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-brand-dark/10 bg-white p-8 text-center">
          <CircleHelp className="mx-auto h-8 w-8 text-brand-dark/40" aria-hidden />
          <p className="mt-3 font-semibold text-brand-dark">Muy pronto vas a encontrar aquí videos de cada sección.</p>
          <p className="mt-1 text-sm text-brand-dark/60">Mientras tanto, si tenés una duda, escribinos.</p>
          <a href={waLink("Hola, necesito ayuda con el panel de Ennea.")} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-[var(--admin-fill)] text-[var(--admin-on-fill)]">
            <MessageCircle className="h-4 w-4" aria-hidden />
            Escribir por WhatsApp
          </a>
        </div>
      ) : (
        <>
          <label className="relative block max-w-md mb-6">
            <span className="sr-only">Buscar un video</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-dark/40" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="¿Qué querés hacer? Por ejemplo: cobrar, caja, factura"
              className="w-full h-11 rounded-xl border border-brand-dark/15 bg-white pl-9 pr-3 text-sm text-brand-dark placeholder:text-brand-dark/45 focus:outline-none focus:border-brand-dark/40"
            />
          </label>

          {groups.length === 0 && (
            <p className="text-sm text-brand-dark/60">No hay videos que digan “{query}”. Probá con otra palabra.</p>
          )}

          <div className="flex flex-col gap-8">
            {groups.map(([section, list]) => (
              <section key={section} aria-labelledby={`ayuda-${section}`}>
                <h2 id={`ayuda-${section}`} className="font-semibold text-brand-dark mb-3">{helpSectionLabel(section)}</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setPlaying(v)}
                        className="w-full h-full flex flex-col gap-2 rounded-2xl border border-brand-dark/10 bg-white p-3 text-left hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <HelpThumb video={v} />
                        <span className="text-sm font-medium text-brand-dark">{v.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <HelpVideoDialog
        open={!!playing}
        onClose={() => setPlaying(null)}
        videos={playing ? [playing] : []}
        playing={playing}
        onPlay={setPlaying}
      />
    </div>
  );
}
