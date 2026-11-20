"use client";

import { useEffect, useState } from "react";
import type { HelpSection } from "@/lib/helpVideos";

export interface HelpVideoItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  section: HelpSection;
}

/**
 * Los videos cambian poco: se piden una vez y se reusan en todas las pantallas (el botón de ayuda
 * está en cada una). Pasados unos minutos se vuelven a pedir, por si el superadmin agregó uno.
 */
const FRESH_MS = 5 * 60 * 1000;
let cache: { at: number; videos: HelpVideoItem[] } | null = null;
let inflight: Promise<HelpVideoItem[]> | null = null;

function load(): Promise<HelpVideoItem[]> {
  if (cache && Date.now() - cache.at < FRESH_MS) return Promise.resolve(cache.videos);
  inflight ??= fetch("/api/admin/help-videos")
    .then((r) => (r.ok ? r.json() : { videos: [] }))
    .then((d: { videos?: HelpVideoItem[] }) => {
      cache = { at: Date.now(), videos: d.videos ?? [] };
      return cache.videos;
    })
    .catch(() => cache?.videos ?? [])
    .finally(() => { inflight = null; });
  return inflight;
}

/** null mientras carga. */
export function useHelpVideos(): HelpVideoItem[] | null {
  const [videos, setVideos] = useState<HelpVideoItem[] | null>(cache?.videos ?? null);
  useEffect(() => {
    let alive = true;
    void load().then((v) => { if (alive) setVideos(v); });
    return () => { alive = false; };
  }, []);
  return videos;
}
