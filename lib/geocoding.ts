import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
}

/**
 * Geocode a location string (e.g., "London", "Manchester, UK") to coordinates
 * Uses Google Maps Geocoding API
 */
export async function geocodeLocation(
  location: string
): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY environment variable not configured");
  }

  try {
    const response = await client.geocode({
      params: {
        address: location,
        key: apiKey,
        region: "GB", // Bias towards UK addresses
        components: "country:GB", // Restrict to UK only
      },
    });

    if (response.data.status === "OK" && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        latitude: location.lat,
        longitude: location.lng,
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
      };
    }

    // Handle different API response statuses
    if (response.data.status === "ZERO_RESULTS") {
      console.warn(`No geocoding results found for: ${location}`);
      return null;
    }

    console.error(`Geocoding API error: ${response.data.status}`);
    return null;
  } catch (error) {
    console.error("Error geocoding location:", error);
    throw error;
  }
}

