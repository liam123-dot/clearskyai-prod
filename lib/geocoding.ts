import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client({});

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  placeId?: string;
}

export interface LocationComponents {
  city: string | null;
  district: string | null;
  subDistrict: string | null; // More specific than district (e.g., sublocality_level_2)
  street: string | null;
  postcodeDistrict: string | null;
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

/**
 * Reverse geocode coordinates to extract standardized location components
 * Uses Google Maps Geocoding API
 */
export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number
): Promise<LocationComponents | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY environment variable not configured");
  }

  try {
    // Use direct fetch for reverse geocoding to avoid type issues
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&region=GB&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const result = data.results[0];
      const addressComponents = result.address_components || [];

      // Extract components
      let city: string | null = null;
      let district: string | null = null;
      let subDistrict: string | null = null;
      let street: string | null = null;
      let postcodeDistrict: string | null = null;

      // First pass: collect all potential values
      let locality: string | null = null;
      let postalTown: string | null = null;
      let sublocalityLevel1: string | null = null;
      let sublocalityLevel2: string | null = null;
      let neighborhood: string | null = null;
      let adminAreaLevel2: string | null = null;

      for (const component of addressComponents) {
        const types = component.types || [];

        if (types.includes("locality")) {
          locality = component.long_name;
        } else if (types.includes("postal_town")) {
          postalTown = component.long_name;
        } else if (types.includes("sublocality_level_1")) {
          sublocalityLevel1 = component.long_name;
        } else if (types.includes("sublocality_level_2")) {
          sublocalityLevel2 = component.long_name;
        } else if (types.includes("neighborhood")) {
          neighborhood = component.long_name;
        } else if (types.includes("administrative_area_level_2")) {
          adminAreaLevel2 = component.long_name;
        } else if (types.includes("route")) {
          street = component.long_name;
        } else if (types.includes("postal_code")) {
          const postcode = component.long_name;
          const match = postcode.match(/^([A-Z0-9]+)/);
          if (match) {
            postcodeDistrict = match[1];
          }
        }
      }

      // City - prefer locality, fallback to postal_town
      city = locality || postalTown;

      // District hierarchy: sublocality_level_1 > neighborhood > sublocality > administrative_area_level_2
      district = sublocalityLevel1 || neighborhood || sublocalityLevel2 || adminAreaLevel2;

      // Sub-district: sublocality_level_2 if district was level 1, or sublocality_level_1 if district was admin_area
      if (sublocalityLevel2) {
        subDistrict = sublocalityLevel2;
      } else if (sublocalityLevel1 && adminAreaLevel2 && district === adminAreaLevel2) {
        // If district used admin_area_level_2, use sublocality_level_1 as sub-district
        subDistrict = sublocalityLevel1;
      }

      return {
        city,
        district,
        subDistrict,
        street,
        postcodeDistrict,
      };
    }

    // Handle different API response statuses
    if (data.status === "ZERO_RESULTS") {
      console.warn(`No reverse geocoding results found for: ${latitude}, ${longitude}`);
      return null;
    }

    console.error(`Reverse geocoding API error: ${data.status}`);
    return null;
  } catch (error) {
    console.error("Error reverse geocoding location:", error);
    throw error;
  }
}

