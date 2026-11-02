export function BackLink({ onBack, disabled = false }) {
  return (
    <div className="page-back">
      <a
        href="/"
        aria-label="Volver a la página anterior"
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          event.preventDefault();
          if (!disabled) onBack();
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 5-7 7 7 7M5 12h14" />
        </svg>
        <span>Volver</span>
      </a>
    </div>
  );
}
