'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels?: { prev?: string; next?: string };
  className?: string;
}

function getPageWindow(page: number, totalPages: number): (number | 'ellipsis')[] {
  // Small lists: show all pages.
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (page > 3) pages.push('ellipsis');

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let p = start; p <= end; p++) pages.push(p);

  if (page < totalPages - 2) pages.push('ellipsis');

  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange, labels, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevLabel = labels?.prev ?? 'Anterior';
  const nextLabel = labels?.next ?? 'Siguiente';
  const pages = getPageWindow(page, totalPages);

  const handleClick = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <nav
      aria-label="Pagination"
      className={`mt-10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => handleClick(page - 1)}
        disabled={page === 1}
        className="px-3 py-2 text-xs sm:text-sm font-medium border border-zinc-300 text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
      >
        {prevLabel}
      </button>

      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span
            key={`e-${idx}`}
            className="px-2 py-2 text-xs sm:text-sm text-zinc-400 select-none"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => handleClick(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`min-w-[2.25rem] px-3 py-2 text-xs sm:text-sm font-medium border transition-colors ${
              p === page
                ? 'bg-[#C0001E] border-[#C0001E] text-white'
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => handleClick(page + 1)}
        disabled={page === totalPages}
        className="px-3 py-2 text-xs sm:text-sm font-medium border border-zinc-300 text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
      >
        {nextLabel}
      </button>
    </nav>
  );
}
