export function Pagination({ page, pages, busy, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="filters" aria-label="Paginación">
      <button
        disabled={busy || page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
        const isActive = n === page;
        return (
          <button
            key={n}
            disabled={busy}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onPage(n)}
            style={
              isActive
                ? { backgroundColor: '#e5e7eb', borderRadius: '6px' }
                : undefined
            }
          >
            {n}
          </button>
        );
      })}
      <button
        disabled={busy || page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
