"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page:        number;
  totalPages:  number;
  onPage:      (p: number) => void;
  pageSize:    number;
  onPageSize:  (s: number) => void;
  totalItems:  number;
  pageSizes?:  number[];
}

export default function Pagination({
  page,
  totalPages,
  onPage,
  pageSize,
  onPageSize,
  totalItems,
  pageSizes = [15, 30, 50],
}: PaginationProps) {
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);

  // Páginas a mostrar: máximo 5 botones centrados en la página actual
  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-brand-muted">
      {/* Info + page size */}
      <div className="flex items-center gap-3 text-xs text-brand-dark/50">
        <span>{from}–{to} de {totalItems}</span>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
          className="border border-brand-muted rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand-pink"
        >
          {pageSizes.map(s => (
            <option key={s} value={s}>{s} por página</option>
          ))}
        </select>
      </div>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg border border-brand-muted hover:border-brand-pink text-brand-dark/50 hover:text-brand-pink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-brand-dark/30 text-xs">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`min-w-[32px] h-8 rounded-lg text-xs font-medium border transition-all ${
                p === page
                  ? "gradient-bg text-white border-transparent"
                  : "border-brand-muted text-brand-dark/60 hover:border-brand-pink hover:text-brand-pink"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-brand-muted hover:border-brand-pink text-brand-dark/50 hover:text-brand-pink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
