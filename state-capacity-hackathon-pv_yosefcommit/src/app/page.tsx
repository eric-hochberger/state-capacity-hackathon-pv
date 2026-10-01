import { Construction, Landmark, MessagesSquare } from "lucide-react";
import { AddressForm } from "@/components/AddressForm";
import { BoroughQuickLinks } from "@/components/BoroughQuickLinks";
import { HeroBackdrop } from "@/components/HeroBackdrop";

const TRUST_ITEMS = [
  {
    icon: Construction,
    title: "DOT street projects",
    body: "Street redesigns, resurfacing, and capital reconstruction from NYC Department of Transportation.",
  },
  {
    icon: Landmark,
    title: "City Planning (ULURP)",
    body: "Zoning changes and land-use applications moving through the city's review process.",
  },
  {
    icon: MessagesSquare,
    title: "Your voice, aggregated",
    body: "Support, oppose, or stay neutral on any proposal — your community's stance is tallied in real time.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-5">
          <span className="text-base font-semibold tracking-tight text-foreground">
            NYCivy
          </span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase">
            Beta
          </span>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <HeroBackdrop />
          <div className="mx-auto max-w-2xl px-6 py-20 text-center sm:py-28">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              See what&rsquo;s being proposed in your neighborhood.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Street redesigns and zoning changes from NYC DOT and City
              Planning — search by address to find what&rsquo;s happening on
              your block.
            </p>

            <div className="mt-10 text-left">
              <AddressForm />
            </div>

            <BoroughQuickLinks />
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-3">
            {TRUST_ITEMS.map((item) => (
              <div
                key={item.title}
                className="group rounded-xl border border-transparent p-2 transition hover:border-border hover:bg-background"
              >
                <item.icon
                  className="h-5 w-5 text-accent"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <h2 className="mt-3 text-sm font-semibold text-foreground">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-muted">
          Proposal data from NYC Open Data. Not affiliated with the City of
          New York.
        </div>
      </footer>
    </div>
  );
}
