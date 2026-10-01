const BOROUGHS = [
  { label: "Manhattan", slug: "manhattan" },
  { label: "Brooklyn", slug: "brooklyn" },
  { label: "Queens", slug: "queens" },
  { label: "The Bronx", slug: "the-bronx" },
  { label: "Staten Island", slug: "staten-island" },
];

export function BoroughQuickLinks() {
  return (
    <div className="mt-8">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        Or browse by borough
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {BOROUGHS.map((b) => (
          <a
            key={b.slug}
            href={`/map/index.html#${b.slug}`}
            className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:bg-accent-soft hover:text-accent"
          >
            {b.label}
          </a>
        ))}
      </div>
    </div>
  );
}
