export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 40 44"
      width="36"
      height="40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 3 37 13v18L20 41 3 31V13L20 3Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="m3 13 17 10 17-10M20 23v18M3 22l17 10 17-10M11.5 8 28.5 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Brand() {
  return (
    <>
      <BrandMark />
      <span className="brand-wordmark">
        mundo<span className="brand-dimension">3D</span>
        <span className="brand-tagline">OBJETOS · IMPRESIÓN 3D</span>
      </span>
    </>
  );
}
