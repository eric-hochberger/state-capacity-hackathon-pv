const GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/search";

export interface GeocodeResult {
  lng: number;
  lat: number;
  borough: string | null;
  label: string;
}

export class GeocodeError extends Error {}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const url = new URL(GEOSEARCH_URL);
  url.searchParams.set("text", address);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GeocodeError(`Geocoding service returned ${response.status}`);
  }

  const data = await response.json();
  const feature = data?.features?.[0];

  if (!feature) {
    throw new GeocodeError("We couldn't find that address in New York City.");
  }

  const [lng, lat] = feature.geometry.coordinates as [number, number];
  const borough = feature.properties?.borough ?? null;
  const label = feature.properties?.label ?? address;

  return { lng, lat, borough, label };
}
