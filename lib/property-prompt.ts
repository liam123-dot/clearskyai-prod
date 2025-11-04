import { createClient } from '@/lib/supabase/server'
import { getKnowledgeBase, type Property } from '@/lib/knowledge-bases'
import { reverseGeocodeLocation, type LocationComponents } from '@/lib/geocoding'

export interface LocationKeywords {
  cities: string[]
  districts: string[]
  subDistricts: string[]
  postcodeDistricts: string[]
  streets: string[]
  allKeywords: string[] // Flattened sorted list
}

/**
 * Extract high-entropy location keywords from properties using reverse geocoding
 * Returns keywords sorted hierarchically: cities → districts → sub-districts → postcode districts → streets
 */
export async function extractLocationKeywords(
  properties: Property[]
): Promise<LocationKeywords> {
  if (properties.length === 0) {
    return {
      cities: [],
      districts: [],
      subDistricts: [],
      postcodeDistricts: [],
      streets: [],
      allKeywords: [],
    }
  }

  // Filter properties with valid coordinates
  const propertiesWithCoords = properties.filter(
    (p) => p.latitude !== null && p.longitude !== null
  )

  if (propertiesWithCoords.length === 0) {
    return {
      cities: [],
      districts: [],
      subDistricts: [],
      postcodeDistricts: [],
      streets: [],
      allKeywords: [],
    }
  }

  const totalProperties = propertiesWithCoords.length

  // Cache geocoding results by rounded coordinates to avoid duplicate API calls
  // Geocoding helps deduplicate by providing standardized location names
  const geocodeCache = new Map<string, LocationComponents | null>()
  const roundCoord = (coord: number, precision = 4) =>
    Math.round(coord * Math.pow(10, precision)) / Math.pow(10, precision)

  // Use Sets for cities, districts, sub-districts, and streets to ensure uniqueness (geocoding helps deduplicate)
  const cities = new Set<string>()
  const districts = new Set<string>()
  const subDistricts = new Set<string>()
  const streets = new Set<string>()
  
  // Count frequency for postcode districts (we'll filter these by threshold)
  const postcodeDistrictCounts = new Map<string, number>()

  // Process properties in batches with throttling to respect API rate limits
  const BATCH_SIZE = 10
  const DELAY_MS = 100 // Delay between batches

  for (let i = 0; i < propertiesWithCoords.length; i += BATCH_SIZE) {
    const batch = propertiesWithCoords.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (property) => {
        const lat = property.latitude!
        const lng = property.longitude!
        const cacheKey = `${roundCoord(lat)},${roundCoord(lng)}`

        let components: LocationComponents | null = geocodeCache.get(cacheKey) ?? null

        if (components === undefined || components === null) {
          try {
            components = await reverseGeocodeLocation(lat, lng)
            geocodeCache.set(cacheKey, components)
          } catch (error) {
            console.warn(
              `Failed to reverse geocode property ${property.id}:`,
              error
            )
            components = null
            geocodeCache.set(cacheKey, null)
          }
        }

        if (components) {
          // Add all cities, districts, sub-districts, and streets to Sets (geocoding ensures standardized names)
          if (components.city) {
            cities.add(components.city)
          }
          if (components.district) {
            districts.add(components.district)
          }
          if (components.subDistrict) {
            subDistricts.add(components.subDistrict)
          }
          if (components.street) {
            streets.add(components.street)
          }
          // Count postcode districts for threshold filtering
          if (components.postcodeDistrict) {
            postcodeDistrictCounts.set(
              components.postcodeDistrict,
              (postcodeDistrictCounts.get(components.postcodeDistrict) || 0) + 1
            )
          }
        }
      })
    )

    // Add delay between batches to respect rate limits
    if (i + BATCH_SIZE < propertiesWithCoords.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
  }

  // Calculate threshold for postcode districts
  const postcodeDistrictThreshold = Math.ceil(totalProperties * 0.05) // 5%

  // Convert Sets to sorted arrays (all cities, districts, sub-districts, and streets included)
  const citiesArray = Array.from(cities).sort()
  const districtsArray = Array.from(districts).sort()
  const subDistrictsArray = Array.from(subDistricts).sort()
  const streetsArray = Array.from(streets).sort()
  
  // Filter postcode districts by threshold and sort
  const postcodeDistricts = Array.from(postcodeDistrictCounts.keys())
    .filter((p) => (postcodeDistrictCounts.get(p) || 0) >= postcodeDistrictThreshold)
    .sort()

  // Combine all keywords in hierarchical order: cities → districts → sub-districts → postcode districts → streets
  const allKeywords = [
    ...citiesArray,
    ...districtsArray,
    ...subDistrictsArray,
    ...postcodeDistricts,
    ...streetsArray,
  ]

  return {
    cities: citiesArray,
    districts: districtsArray,
    subDistricts: subDistrictsArray,
    postcodeDistricts,
    streets: streetsArray,
    allKeywords,
  }
}

/**
 * Generate a voice agent prompt describing available property filters and options
 * for a specific estate agent knowledge base
 * Returns both the prompt text and structured location keywords
 */
export async function generatePropertyQueryPrompt(
  knowledgeBaseId: string
): Promise<{ prompt: string; keywords: LocationKeywords }> {
  const supabase = await createClient()

  // Get knowledge base details
  const knowledgeBase = await getKnowledgeBase(knowledgeBaseId)
  if (!knowledgeBase || knowledgeBase.type !== 'estate_agent') {
    throw new Error('Knowledge base not found or not an estate agent type')
  }

  // Check for cached location data first
  let locationKeywords: LocationKeywords
  if (knowledgeBase.location_data) {
    // Use cached location data
    locationKeywords = knowledgeBase.location_data
  } else {
    // Extract location keywords from properties if not cached
    const { data: properties, error: propsError } = await supabase
      .from('properties')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)

    if (propsError) {
      throw new Error(`Failed to fetch properties: ${propsError.message}`)
    }

    if (!properties || properties.length === 0) {
      locationKeywords = {
        cities: [],
        districts: [],
        subDistricts: [],
        postcodeDistricts: [],
        streets: [],
        allKeywords: [],
      }
    } else {
      locationKeywords = await extractLocationKeywords(properties as Property[])
    }
  }

  // Fetch all properties to analyze available options
  const { data: properties, error } = await supabase
    .from('properties')
    .select('beds, baths, property_type, transaction_type, furnished_type, price, has_nearby_station, latitude, longitude')
    .eq('knowledge_base_id', knowledgeBaseId)

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`)
  }

  if (!properties || properties.length === 0) {
    const emptyPrompt = `No properties available for ${knowledgeBase.name}. Please sync properties first.`
    return {
      prompt: emptyPrompt,
      keywords: locationKeywords,
    }
  }

  // Extract unique values
  const beds = [...new Set(properties.map(p => p.beds).filter((b): b is number => b !== null))].sort((a, b) => a - b)
  const baths = [...new Set(properties.map(p => p.baths).filter((b): b is number => b !== null))].sort((a, b) => a - b)
  const propertyTypes = [...new Set(properties.map(p => p.property_type).filter((t): t is string => t !== null))]
  const transactionTypes = [...new Set(properties.map(p => p.transaction_type).filter((t): t is string => t !== null))]
  const furnishedTypes = [...new Set(properties.map(p => p.furnished_type).filter((t): t is string => t !== null))]

  // Get price ranges
  const prices = properties.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
  const rentalPrices = properties
    .filter(p => p.transaction_type === 'rent')
    .map(p => p.price)
    .filter((p): p is number => p !== null && p !== undefined)
  const salePrices = properties
    .filter(p => p.transaction_type === 'sale')
    .map(p => p.price)
    .filter((p): p is number => p !== null && p !== undefined)

  const rentalMin = rentalPrices.length > 0 ? Math.min(...rentalPrices) : null
  const rentalMax = rentalPrices.length > 0 ? Math.max(...rentalPrices) : null
  const saleMin = salePrices.length > 0 ? Math.min(...salePrices) : null
  const saleMax = salePrices.length > 0 ? Math.max(...salePrices) : null

  // Format price
  const formatPrice = (price: number, isRental: boolean) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price) + (isRental ? '/month' : '')
  }

  // Build the prompt
  const promptParts: string[] = []

  promptParts.push(`# Property Search Tool for ${knowledgeBase.name}`)
  promptParts.push('')
  promptParts.push(`You have access to a property search tool for ${knowledgeBase.name}. Use this tool to help customers find properties that match their criteria.`)
  promptParts.push('')
  promptParts.push('## Available Filters')
  promptParts.push('')
  promptParts.push('Use these filters to narrow down property searches. Filters can be combined to refine results.')
  promptParts.push('')

  // Transaction Type
  promptParts.push('### Transaction Type (IMPORTANT - Use this first to narrow results)')
  promptParts.push(`- **rent**: ${properties.filter(p => p.transaction_type === 'rent').length} rental properties available`)
  promptParts.push(`- **sale**: ${properties.filter(p => p.transaction_type === 'sale').length} properties for sale available`)
  promptParts.push('')

  // Bedrooms
  if (beds.length > 0) {
    promptParts.push('### Bedrooms')
    promptParts.push(`Available options: ${beds.join(', ')}`)
    promptParts.push(`Use the "beds" filter to specify the number of bedrooms.`)
    promptParts.push('')

    // Show distribution
    const bedCounts = beds.map(bed => {
      const count = properties.filter(p => p.beds === bed).length
      return `${bed} bed${bed !== 1 ? 's' : ''}: ${count} properties`
    })
    promptParts.push(`Property distribution: ${bedCounts.join(', ')}`)
    promptParts.push('')
  }

  // Bathrooms
  if (baths.length > 0) {
    promptParts.push('### Bathrooms')
    promptParts.push(`Available options: ${baths.join(', ')}`)
    promptParts.push(`Use the "baths" filter to specify the number of bathrooms.`)
    promptParts.push('')
  }

  // Property Types
  if (propertyTypes.length > 0) {
    promptParts.push('### Property Types')
    promptParts.push(`Available types: ${propertyTypes.join(', ')}`)
    promptParts.push(`Use the "property_type" filter to filter by property type.`)
    promptParts.push('')
  }

  // Furnished Type
  if (furnishedTypes.length > 0) {
    promptParts.push('### Furnishing Status')
    promptParts.push(`Available options: ${furnishedTypes.join(', ')}`)
    promptParts.push(`Use the "furnished_type" filter for rental properties.`)
    promptParts.push('')
  }

  // Price Ranges
  promptParts.push('### Price Ranges')
  if (rentalMin !== null && rentalMax !== null) {
    promptParts.push(`**Rentals**: ${formatPrice(rentalMin, true)} - ${formatPrice(rentalMax, true)}`)
  }
  if (saleMin !== null && saleMax !== null) {
    promptParts.push(`**Sales**: ${formatPrice(saleMin, false)} - ${formatPrice(saleMax, false)}`)
  }
  promptParts.push('')
  promptParts.push('Use the "price" filter with one of these formats:')
  promptParts.push('- `{ "filter": "under", "value": 2000 }` - Properties under £2000/month or £2000')
  promptParts.push('- `{ "filter": "over", "value": 500000 }` - Properties over £500,000')
  promptParts.push('- `{ "filter": "between", "value": 1000, "max_value": 2000 }` - Properties between £1000-£2000')
  promptParts.push('')

  // Location Filters
  promptParts.push('### Location Search')
  promptParts.push('')
  promptParts.push('**IMPORTANT: Always use the "location" filter for location-based searches.**')
  promptParts.push('')
  promptParts.push('- Use the **"location"** filter with any location query - this can be:')
  promptParts.push('  - City names (e.g., "London", "Manchester", "Birmingham")')
  promptParts.push('  - District/area names (e.g., "Kensington", "Westminster", "Salford")')
  promptParts.push('  - Postcodes (e.g., "SW1A 1AA", "M1 1AA")')
  promptParts.push('  - Street names (e.g., "East Street", "Main Street")')
  promptParts.push('  - **Important**: When searching for streets or specific locations, include the city or general area context when possible (e.g., "East Street, London" instead of just "East Street") to avoid matching streets in other countries')
  promptParts.push('  - Any UK location the customer mentions')
  promptParts.push('')
  promptParts.push('- The system uses Google Maps geocoding to find the location and searches for properties within the specified radius')
  promptParts.push('- **The system automatically filters out non-UK locations** - if geocoding finds a location outside the UK, it will fall back to searching property addresses directly')
  promptParts.push('- **If no properties are found within the default radius, the system automatically performs a fuzzy search** against property addresses with a wider radius (up to 50km)')
  promptParts.push('- Results are automatically sorted by distance from the location center (nearest first)')
  promptParts.push('- **Each property in the results will include a "distance_km" field** showing how far it is from the requested location center')
  promptParts.push('- **IMPORTANT**: Always check the distance_km value and inform users if a property is significantly far from their requested location (e.g., "This property is 15km away from London" or "Note: This property is 20km from Manchester, which might be further than you wanted")')
  promptParts.push('- This means even if an exact match isn\'t found, you\'ll get the nearest properties which is usually what customers want')
  promptParts.push('- Default search radius is 25km - use **"location_radius_km"** to adjust:')
  promptParts.push('  - Smaller radius (5-10km) for more precise, local searches')
  promptParts.push('  - Larger radius (25-50km) for broader area coverage')
  promptParts.push('')
  promptParts.push('**Do NOT use city, district, or postcode filters - always use "location" instead.**')
  promptParts.push('')

  // Other Filters
  promptParts.push('### Other Filters')
  const hasStationCount = properties.filter(p => p.has_nearby_station === true).length
  if (hasStationCount > 0) {
    promptParts.push(`- **has_nearby_station**: ${hasStationCount} properties have nearby stations`)
  }
  promptParts.push('')

  // Usage Instructions
  promptParts.push('## How to Use the Tool')
  promptParts.push('')
  promptParts.push('1. **Start with transaction type**: Always ask if they\'re looking to rent or buy')
  promptParts.push('2. **Gather criteria**: Ask about bedrooms, bathrooms, location preferences, and budget')
  promptParts.push('3. **Use filters strategically**: Start with filters that reduce results the most (transaction type, location, beds)')
  promptParts.push('4. **Combine filters**: Multiple filters can be combined for precise results')
  promptParts.push('')
  promptParts.push('## Understanding Refinements (IMPORTANT)')
  promptParts.push('')
  promptParts.push('**The tool returns up to 3 properties along with a `refinements` array and `totalCount`.**')
  promptParts.push('')
  promptParts.push('### When to Use Refinements:')
  promptParts.push('')
  promptParts.push('- **If totalCount > 10**: You MUST narrow down the search using refinements before presenting properties to the customer')
  promptParts.push('- **If totalCount between 4-10**: Suggest the customer narrow down further, but you can present the results if they prefer')
  promptParts.push('- **If totalCount ≤ 3**: Present the properties directly - no refinement needed')
  promptParts.push('')
  promptParts.push('### How Refinements Work:')
  promptParts.push('')
  promptParts.push('Each refinement suggestion includes:')
  promptParts.push('- `filterName`: The filter to apply (e.g., "beds", "transaction_type", "property_type")')
  promptParts.push('- `filterValue`: The value for that filter')
  promptParts.push('- `resultCount`: How many properties match if this refinement is added')
  promptParts.push('')
  promptParts.push('### Example Refinements Response:')
  promptParts.push('```json')
  promptParts.push('{')
  promptParts.push('  "properties": [/* 3 properties */],')
  promptParts.push('  "totalCount": 45,')
  promptParts.push('  "refinements": [')
  promptParts.push('    { "filterName": "beds", "filterValue": 2, "resultCount": 15 },')
  promptParts.push('    { "filterName": "beds", "filterValue": 3, "resultCount": 20 },')
  promptParts.push('    { "filterName": "property_type", "filterValue": "Flats", "resultCount": 30 },')
  promptParts.push('    { "filterName": "furnished_type", "filterValue": "Furnished", "resultCount": 12 }')
  promptParts.push('  ]')
  promptParts.push('}')
  promptParts.push('```')
  promptParts.push('')
  promptParts.push('### How to Present Refinements to Users:')
  promptParts.push('')
  promptParts.push('When totalCount is high (>10), say something like:')
  promptParts.push('')
  promptParts.push('*"I found 45 properties matching your criteria. To help narrow this down, I can filter by:*')
  promptParts.push('- *Number of bedrooms: 2 beds (15 properties) or 3 beds (20 properties)*')
  promptParts.push('- *Property type: Flats (30 properties)*')
  promptParts.push('- *Furnished: Furnished properties (12 properties)*')
  promptParts.push('')
  promptParts.push('*Which would you prefer, or would you like to add another criteria like location or price range?"*')
  promptParts.push('')
  promptParts.push('### Key Refinement Rules:')
  promptParts.push('')
  promptParts.push('1. **Always check totalCount first** - Don\'t present properties if totalCount > 10')
  promptParts.push('2. **Present refinements conversationally** - Don\'t just dump JSON, make it natural')
  promptParts.push('3. **Group similar refinements** - e.g., "2, 3, or 4 bedrooms" instead of listing separately')
  promptParts.push('4. **Prioritize the most useful refinements** - transaction_type, beds, property_type, location are usually most helpful')
  promptParts.push('5. **Keep narrowing until totalCount ≤ 10** - Once narrowed down enough, present the properties')
  promptParts.push('6. **If user says "show me what you have" with high count** - Explain you\'re only showing 3 of the total and suggest specific refinements')
  promptParts.push('')
  promptParts.push('## Response Format')
  promptParts.push('')
  promptParts.push('When you use the location filter, each property in the response will include:')
  promptParts.push('- **distance_km**: The distance in kilometers from the requested location center')
  promptParts.push('- All other standard property fields (beds, baths, price, address, etc.)')
  promptParts.push('')
  promptParts.push('**Always check and communicate distance information to users** when presenting properties:')
  promptParts.push('- Properties within 5km: "This property is [X]km from [location]"')
  promptParts.push('- Properties 5-15km away: "This property is [X]km from [location], which is a bit further out"')
  promptParts.push('- Properties over 15km away: "Note: This property is [X]km from [location], which is quite far from the area you mentioned. Would you like me to search for properties closer to [location]?"')
  promptParts.push('')
  promptParts.push('## Example Queries')
  promptParts.push('')
  promptParts.push('- "Find 2 bedroom rental properties in London under £2000/month"')
  promptParts.push('  → Use: `{ "transaction_type": "rent", "beds": 2, "location": "London", "price": { "filter": "under", "value": 2000 } }`')
  promptParts.push('')
  promptParts.push('- "Show me 3 bedroom houses for sale in Manchester"')
  promptParts.push('  → Use: `{ "transaction_type": "sale", "beds": 3, "location": "Manchester", "property_type": "Houses" }`')
  promptParts.push('')
  promptParts.push('- "Properties with 2+ bedrooms, 2 bathrooms, furnished, near a station in Kensington"')
  promptParts.push('  → Use: `{ "beds": 2, "baths": 2, "furnished_type": "Furnished", "has_nearby_station": true, "location": "Kensington" }`')
  promptParts.push('')
  promptParts.push('- "Properties near SW1A postcode"')
  promptParts.push('  → Use: `{ "location": "SW1A", "location_radius_km": 5 }` (smaller radius for postcode searches)')
  promptParts.push('')

  // API Endpoint
  promptParts.push('## API Endpoint')
  promptParts.push(`POST /api/query/estate-agent/${knowledgeBaseId}`)
  promptParts.push('')
  promptParts.push('The tool will return up to 3 matching properties sorted by relevance. Use the filters above to construct your query.')
  promptParts.push('')

  return {
    prompt: promptParts.join('\n'),
    keywords: locationKeywords,
  }
}

