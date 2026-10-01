"use client";

import { useRef, useState, useTransition } from "react";
import { resolveAddress } from "@/app/actions/resolve-address";

export function AddressForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await resolveAddress(address);
      if ("error" in result) {
        setError(result.error);
        inputRef.current?.focus();
        return;
      }
      window.location.assign(`/map/index.html#${result.code}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="address" className="sr-only">
            Your address
          </label>
          <input
            ref={inputRef}
            id="address"
            name="address"
            type="text"
            inputMode="text"
            autoComplete="street-address"
            placeholder="Enter your address, e.g. 123 Main St, Brooklyn"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "address-error" : undefined}
            className="w-full rounded-lg border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-base font-medium text-white shadow-sm transition hover:bg-accent-hover focus:outline-none focus:ring-4 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending && (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
          )}
          {isPending ? "Searching…" : "Find my community board"}
        </button>
      </div>

      {error ? (
        <p id="address-error" role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          We only use your address to find your community board — nothing is stored.
        </p>
      )}
    </form>
  );
}
