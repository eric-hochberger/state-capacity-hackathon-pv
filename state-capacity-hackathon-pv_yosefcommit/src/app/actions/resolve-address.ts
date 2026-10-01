"use server";

import { locateCommunityDistrict } from "@/lib/geo/community-district";
import { geocodeAddress, GeocodeError } from "@/lib/geo/geocode";

export interface ResolveAddressResult {
  code: string;
  displayName: string;
}

export interface ResolveAddressError {
  error: string;
}

export async function resolveAddress(
  address: string
): Promise<ResolveAddressResult | ResolveAddressError> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { error: "Please enter an address." };
  }

  try {
    const result = await geocodeAddress(trimmed);
    const district = locateCommunityDistrict(result.lng, result.lat);
    if (district) return district;

    if (!result.borough) {
      return {
        error: "That address doesn't look like it's in New York City.",
      };
    }
    return {
      error: "We found that address, but it doesn't fall inside a community district.",
    };
  } catch (err) {
    if (err instanceof GeocodeError) {
      return { error: err.message };
    }
    return {
      error: "Something went wrong looking up that address. Please try again.",
    };
  }
}
