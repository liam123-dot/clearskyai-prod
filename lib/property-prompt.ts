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
  promptParts.push(`This tool searches through our property database to help customers find properties that match their requirements.`)
  promptParts.push('')
  
  // Location Coverage
  promptParts.push('## Location Coverage')
  promptParts.push('')
  if (locationKeywords.cities.length > 0 || locationKeywords.districts.length > 0) {
    if (locationKeywords.cities.length > 0) {
      promptParts.push(`**Cities**: ${locationKeywords.cities.join(', ')}`)
    }
    if (locationKeywords.districts.length > 0) {
      promptParts.push(`**Districts**: ${locationKeywords.districts.join(', ')}`)
    }
    promptParts.push('')
    promptParts.push('The tool uses intelligent location matching:')
    promptParts.push('- Searches by city names, district names, postcodes, or street names')
    promptParts.push('- Uses Google Maps geocoding to find locations and searches within a specified radius (default 25km)')
    promptParts.push('- Automatically filters out non-UK locations')
    promptParts.push('- If no exact matches found, performs fuzzy search against property addresses')
    promptParts.push('- Returns properties sorted by distance (nearest first)')
    promptParts.push('- **Important**: Always inform users of the distance when properties are significantly far from their requested location')
  } else {
    promptParts.push('Location data not yet available. Use the location filter to search by any UK city, district, postcode, or street name.')
  }
  promptParts.push('')
  
  // Property Inventory
  promptParts.push('## Property Inventory')
  promptParts.push('')
  promptParts.push(`**Total Properties**: ${properties.length}`)
  
  // Transaction types with distribution
  const rentalCount = properties.filter(p => p.transaction_type === 'rent').length
  const saleCount = properties.filter(p => p.transaction_type === 'sale').length
  
  if (rentalCount > 0 || saleCount > 0) {
    promptParts.push('')
    promptParts.push('### Transaction Types')
    if (rentalCount > 0) {
      promptParts.push(`- **Rentals**: ${rentalCount} properties`)
      if (rentalMin !== null && rentalMax !== null) {
        promptParts.push(`  - Price range: ${formatPrice(rentalMin, true)} - ${formatPrice(rentalMax, true)}`)
      }
    }
    if (saleCount > 0) {
      promptParts.push(`- **Sales**: ${saleCount} properties`)
      if (saleMin !== null && saleMax !== null) {
        promptParts.push(`  - Price range: ${formatPrice(saleMin, false)} - ${formatPrice(saleMax, false)}`)
      }
    }
  }
  
  // Bedroom distribution
  if (beds.length > 0) {
    promptParts.push('')
    promptParts.push('### Bedroom Distribution')
    const bedCounts = beds.map(bed => {
      const count = properties.filter(p => p.beds === bed).length
      return `  - ${bed} bed${bed !== 1 ? 's' : ''}: ${count} properties`
    })
    promptParts.push(bedCounts.join('\n'))
  }
  
  // Property types
  if (propertyTypes.length > 0) {
    promptParts.push('')
    promptParts.push('### Property Types Available')
    promptParts.push(`${propertyTypes.join(', ')}`)
  }
  
  // Furnishing options
  if (furnishedTypes.length > 0) {
    promptParts.push('')
    promptParts.push('### Furnishing Options')
    promptParts.push(`${furnishedTypes.join(', ')}`)
  }
  
  promptParts.push('')
  promptParts.push('## How This Tool Works')
  promptParts.push('')
  promptParts.push('The property search tool allows you to filter properties using multiple criteria:')
  promptParts.push('')
  promptParts.push('**Available Filters:**')
  promptParts.push('- `transaction_type` - "rent" or "sale" (ALWAYS use this first)')
  promptParts.push('- `location` - Any UK city, district, postcode, or street name')
  promptParts.push('- `location_radius_km` - Search radius in km (default: 25km, range: 5-50km)')
  promptParts.push('- `beds` - Number of bedrooms')
  promptParts.push('- `baths` - Number of bathrooms')
  promptParts.push('- `property_type` - Type of property (e.g., "House", "Flat")')
  promptParts.push('- `furnished_type` - Furnishing status (for rentals)')
  promptParts.push('- `price` - Price filter with options:')
  promptParts.push('  - `{ "filter": "under", "value": 2000 }` - Under £2000')
  promptParts.push('  - `{ "filter": "over", "value": 500000 }` - Over £500,000')
  promptParts.push('  - `{ "filter": "between", "value": 1000, "max_value": 2000 }` - Between £1000-£2000')
  if (properties.filter(p => p.has_nearby_station === true).length > 0) {
    promptParts.push('- `has_nearby_station` - Properties near train/tube stations')
  }
  promptParts.push('')
  promptParts.push('## How to Use This Tool')
  promptParts.push('')
  promptParts.push('1. **Start with transaction type** - Always ask if they\'re looking to rent or buy')
  promptParts.push('2. **Gather key criteria** - Location, bedrooms, and budget are most important')
  promptParts.push('3. **Use filters strategically** - Start broad, then narrow down with additional filters')
  promptParts.push('4. **Watch the totalCount** - The tool returns up to 3 properties plus a totalCount:')
  promptParts.push('   - If totalCount > 10: Ask for more filters to narrow down before showing properties')
  promptParts.push('   - If totalCount 4-10: Can show results or ask if they want to narrow further')
  promptParts.push('   - If totalCount ≤ 3: Present properties directly')
  promptParts.push('5. **Narrow conversationally** - Ask natural questions about location, beds, budget, etc.')
  promptParts.push('6. **Check distances** - When using location filter, always inform users of property distances')
  promptParts.push('')
  promptParts.push('## Handling Results')
  promptParts.push('')
  promptParts.push('The tool returns:')
  promptParts.push('- Up to 3 matching properties (or all properties if include_all is true)')
  promptParts.push('- `totalCount` - Total number of matches')
  promptParts.push('- `distance_km` - Distance from requested location (when using location filter)')
  promptParts.push('')
  promptParts.push('**Response strategy based on totalCount:**')
  promptParts.push('- If totalCount > 10: Ask clarifying questions to narrow down (location, bedrooms, price range)')
  promptParts.push('- If totalCount 4-10: Offer to show all results or narrow further')
  promptParts.push('- If totalCount ≤ 3: Present properties directly')
  promptParts.push('')
  promptParts.push('**Natural conversation flow:**')
  promptParts.push('- "I found 45 properties. Let me help narrow this down. What area are you interested in?"')
  promptParts.push('- "Would you prefer 2 or 3 bedrooms?"')
  promptParts.push('- "What\'s your budget range?"')
  promptParts.push('- Keep asking until you have enough filters to get a manageable number of results')
  promptParts.push('')
  promptParts.push('**When presenting distance information:**')
  promptParts.push('- Properties within 5km: "This property is [X]km from [location]"')
  promptParts.push('- Properties 5-15km away: "This property is [X]km from [location], which is a bit further out"')
  promptParts.push('- Properties over 15km away: "Note: This property is [X]km from [location], which is quite far from the area you mentioned. Would you like me to search for properties closer to [location]?"')
  promptParts.push('')
  promptParts.push('## Example Usage')
  promptParts.push('')
  promptParts.push('**Customer**: "I\'m looking for a 2 bedroom flat to rent in London under £2000 per month"')
  promptParts.push('')
  promptParts.push('**Search with**: ')
  promptParts.push('- transaction_type: "rent"')
  promptParts.push('- beds: 2')
  promptParts.push('- location: "London"')
  promptParts.push('- property_type: "Flat"')
  promptParts.push('- price: { "filter": "under", "value": 2000 }')
  promptParts.push('')
  promptParts.push('**If results return 50 properties**, ask natural follow-up questions:')
  promptParts.push('"I found 50 two-bedroom flats in London under £2000/month. To help narrow this down:')
  promptParts.push('- Which specific area in London are you interested in?')
  promptParts.push('- Would you prefer furnished or unfurnished?')
  promptParts.push('- Are you looking to be near a train station?"')
  promptParts.push('')
  promptParts.push('Then call the tool again with the additional filters they specify.')
  promptParts.push('')

  return {
    prompt: promptParts.join('\n'),
    keywords: locationKeywords,
  }
}

