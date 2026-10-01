export function HeroBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-full text-border/70"
      viewBox="0 0 1200 520"
      preserveAspectRatio="xMidYMin slice"
    >
      <defs>
        <pattern
          id="grid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
        <radialGradient id="fade" cx="50%" cy="0%" r="75%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="fade-mask">
          <rect width="1200" height="520" fill="url(#fade)" />
        </mask>
      </defs>
      <rect width="1200" height="520" fill="url(#grid)" mask="url(#fade-mask)" />
    </svg>
  );
}
