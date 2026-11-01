export function Pagination({ page, pages, busy, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="filters" aria-label="Paginación">
      <button disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <span role="status">
        Página {page} de {pages}
      </span>
      <button disabled={busy || page >= pages} onClick={() => onPage(page + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
