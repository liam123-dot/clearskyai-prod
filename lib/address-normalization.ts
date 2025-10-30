/**
 * Normalize UK addresses using Google Geocoding API + GPT-5-mini
 * First geocodes the address to get structured components, then uses AI to refine them
 */

interface NormalizedAddress {
  street_address: string | null
  city: string | null
  district: string | null
  postcode: string | null
  county: string | null
}

interface GoogleAddressComponents {
  formatted_address: string
  components: Array<{
    types: string[]
    long_name: string
    short_name: string
  }>
  place_id?: string
}

/**
 * Normalize an address string using Google Geocoding API + GPT-5-mini
 * Falls back to simple parsing if APIs are unavailable
 */
export async function normalizeAddress(
  address: string
): Promise<NormalizedAddress> {
  // Step 1: Geocode with Google to get structured components
  let googleData: GoogleAddressComponents | null = null
  
  try {
    googleData = await geocodeAddressWithGoogle(address)
  } catch (error) {
    console.warn('Google Geocoding failed, attempting direct normalization:', error)
  }

  // Step 2: Use GPT-5-mini to normalize/refine the address
  if (process.env.OPENAI_API_KEY && googleData) {
    try {
      return await normalizeAddressWithGPT5Mini(address, googleData)
    } catch (error) {
      console.warn('GPT-5-mini normalization failed, using Google components directly:', error)
      // Fall back to using Google components directly
      return parseGoogleComponents(googleData)
    }
  }

  // Step 3: If we have Google data but no OpenAI, use Google components directly
  if (googleData) {
    return parseGoogleComponents(googleData)
  }

  // Step 4: Final fallback to simple parsing
  return parseAddressComponents(address)
}

/**
 * Geocode address using Google Geocoding API
 */
async function geocodeAddressWithGoogle(
  address: string
): Promise<GoogleAddressComponents> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY not configured')
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&region=GB&key=${apiKey}`
  )

  if (!response.ok) {
    throw new Error(`Google Geocoding API error: ${response.status}`)
  }

  const data = await response.json()

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(`Google Geocoding returned: ${data.status}`)
  }

  const result = data.results[0]
  
  return {
    formatted_address: result.formatted_address,
    components: result.address_components,
    place_id: result.place_id,
  }
}

/**
 * Normalize address using GPT-5-mini with Google Geocoding data as context
 */
async function normalizeAddressWithGPT5Mini(
  originalAddress: string,
  googleData: GoogleAddressComponents
): Promise<NormalizedAddress> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // Prepare Google components in a readable format
  const googleComponents = googleData.components.map(c => ({
    types: c.types.join(', '),
    name: c.long_name,
  }))

  const prompt = `You are an expert at parsing and normalizing UK addresses. You have been given:
1. The original address string from Rightmove
2. Google Geocoding API structured components

Your task is to extract and normalize the address components correctly, fixing any inconsistencies.

Original Address: "${originalAddress}"

Google Geocoding Result:
Formatted Address: "${googleData.formatted_address}"
Components:
${JSON.stringify(googleComponents, null, 2)}

Return ONLY valid JSON in this exact format (use null for missing fields):
{
  "street_address": "house/flat number and street name (e.g., '123 High Street' or 'Flat 5, 45 Main Road')",
  "city": "main city/town name (e.g., 'London', 'Manchester')",
  "district": "district/area/neighborhood name (e.g., 'Kensington', 'Westminster', 'Salford')",
  "postcode": "full UK postcode (e.g., 'SW1A 1AA', 'M1 1AA')",
  "county": "county name if available (e.g., 'Greater London', 'Greater Manchester')"
}

Critical rules:
- street_address: Must include the building number/flat number if present. If Google has street_number and route separately, combine them properly (e.g., "123 High Street")
- city: Use the main city/town name. Prefer "locality" or "postal_town" from Google, but validate against UK city naming conventions
- district: Use sublocality, neighborhood, or administrative_area_level_3 from Google. This is the area within a city (e.g., "Kensington", "Camden", "Salford")
- postcode: Must be in UK format with space (e.g., "SW1A 1AA"). Extract from postal_code component
- county: Use administrative_area_level_2 or administrative_area_level_1 from Google
- IMPORTANT: If the original address seems to have components in wrong places (e.g., city name where street should be), use Google's structured data as the source of truth but validate intelligently
- If Google components are missing or unclear, infer from the original address intelligently

Return ONLY the JSON object, no other text or markdown.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that returns only valid JSON. Never include explanations, markdown formatting, or code blocks. Return pure JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const parsed = JSON.parse(content)
    return {
      street_address: parsed.street_address || null,
      city: parsed.city || null,
      district: parsed.district || null,
      postcode: parsed.postcode || null,
      county: parsed.county || null,
    }
  } catch (error) {
    console.error('Error normalizing address with GPT-5-mini:', error)
    throw error
  }
}

/**
 * Parse Google Geocoding components directly (fallback when GPT is unavailable)
 */
function parseGoogleComponents(googleData: GoogleAddressComponents): NormalizedAddress {
  const components = googleData.components

  let streetAddress: string | null = null
  let city: string | null = null
  let district: string | null = null
  let postcode: string | null = null
  let county: string | null = null

  // Extract street address (street_number + route)
  const streetNumber = components.find(c => c.types.includes('street_number'))
  const route = components.find(c => c.types.includes('route'))
  
  if (streetNumber && route) {
    streetAddress = `${streetNumber.long_name} ${route.long_name}`
  } else if (route) {
    streetAddress = route.long_name
  } else if (streetNumber) {
    streetAddress = streetNumber.long_name
  }

  // Extract city (prefer locality, then postal_town)
  const locality = components.find(c => c.types.includes('locality'))
  const postalTown = components.find(c => c.types.includes('postal_town'))
  city = locality?.long_name || postalTown?.long_name || null

  // Extract district (sublocality or neighborhood)
  const sublocality = components.find(c => 
    c.types.includes('sublocality') || c.types.includes('sublocality_level_1')
  )
  const neighborhood = components.find(c => c.types.includes('neighborhood'))
  district = sublocality?.long_name || neighborhood?.long_name || null

  // Extract postcode
  const postalCode = components.find(c => c.types.includes('postal_code'))
  postcode = postalCode?.long_name || null

  // Extract county (administrative_area_level_2 or administrative_area_level_1)
  const adminArea2 = components.find(c => c.types.includes('administrative_area_level_2'))
  const adminArea1 = components.find(c => c.types.includes('administrative_area_level_1'))
  county = adminArea2?.long_name || adminArea1?.long_name || null

  return {
    street_address: streetAddress,
    city: city,
    district: district,
    postcode: postcode,
    county: county,
  }
}

/**
 * Simple fallback address parsing
 * This is the original logic - splits by comma
 */
function parseAddressComponents(address: string): NormalizedAddress {
  const addressParts = address.split(', ').map((part) => part.trim())
  const postcode = addressParts[addressParts.length - 1] || null
  const city = addressParts[addressParts.length - 2] || null
  const district = addressParts[addressParts.length - 3] || null
  const streetAddress = addressParts.slice(0, -2).join(', ') || null

  return {
    street_address: streetAddress,
    city: city,
    district: district,
    postcode: postcode,
    county: null,
  }
}

