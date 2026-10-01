"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function DistrictPage() {
  const params = useParams<{ boroCd: string }>();

  useEffect(() => {
    const code = params.boroCd;
    if (code) window.location.replace(`/map/index.html#${code}`);
  }, [params.boroCd]);

  return (
    <p className="mx-auto max-w-2xl px-6 py-20 text-muted">Opening the map…</p>
  );
}
