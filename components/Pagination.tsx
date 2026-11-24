'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  labels?: { prev?: string; next?: string };
  className?: string;
  scrollToTop?: boolean;
  variant?: 'light' | 'dark';
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

export function Pagination({ page, totalPages, onPageChange, labels, className, scrollToTop = true, variant = 'light' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const prevLabel = labels?.prev ?? 'Anterior';
  const nextLabel = labels?.next ?? 'Siguiente';
  const pages = getPageWindow(page, totalPages);

  const handleClick = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    onPageChange(p);
    if (scrollToTop && typeof window !== 'undefined') {
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
        className={`border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${variant === 'dark'
          ? 'border-white/15 bg-zinc-900 text-zinc-300 hover:border-[#C0001E] hover:text-white'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
      >
        {prevLabel}
      </button>

      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span
            key={`e-${idx}`}
            className={`select-none px-2 py-2 text-xs sm:text-sm ${variant === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}
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
                : variant === 'dark'
                  ? 'border-white/15 bg-zinc-900 text-zinc-300 hover:border-[#C0001E] hover:text-white'
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
        className={`border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${variant === 'dark'
          ? 'border-white/15 bg-zinc-900 text-zinc-300 hover:border-[#C0001E] hover:text-white'
          : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
      >
        {nextLabel}
      </button>
    </nav>
  );
}
