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
    promptParts.push('- Searches by exact city, district, county, and full addresses (street + area + city + postcode)')
    promptParts.push('- Uses fuzzy matching to find closest match if exact name not found (60% similarity threshold - forgiving for typos)')
    promptParts.push('- Street search uses phonetic matching to handle similar-sounding names and misspellings')
    promptParts.push('- Street search is very flexible - searches the full address, so you can search by street name, area, or any part of the address')
    promptParts.push('- If no match found, returns all available options (or top 15 similar streets) as refinements')
    promptParts.push('- Example: User says "Londn" → system matches to "London" automatically')
    promptParts.push('- Example: User says "Sherrif Street" → system matches to "Sheriff Street" (handles typos)')
    promptParts.push('- Example: User says "Spinningfields" → matches properties on "Leftbank, Spinningfields, Manchester" (searches full address)')
    promptParts.push('- Example: User says "Baeker Street" → system matches to "Baker Street" using phonetic matching')
    promptParts.push('- Example: User says "XYZ City" (not in database) → system returns list of available cities')
  } else {
    promptParts.push('Location data not yet available. Use city, district, or county filters to search by location.')
  }
  promptParts.push('')
  
  // Property Inventory
  promptParts.push('## Property Inventory')
  promptParts.push('')
  promptParts.push(`**Total Properties**: ${properties.length}`)
  
  // Transaction types with distribution
  const rentalCount = properties.filter(p => p.transaction_type === 'rent').length
  const saleCount = properties.filter(p => p.transaction_type === 'sale').length
  
  // Determine if properties are rent-only, sale-only, or mixed
  const isRentOnly = rentalCount > 0 && saleCount === 0
  const isSaleOnly = saleCount > 0 && rentalCount === 0
  const isMixed = rentalCount > 0 && saleCount > 0
  
  if (rentalCount > 0 || saleCount > 0) {
    promptParts.push('')
    promptParts.push('### Transaction Types')
    
    // Highlight if all properties are of one type
    if (isRentOnly) {
      promptParts.push(`- **ALL PROPERTIES ARE FOR RENT** (${rentalCount} rental properties)`)
      promptParts.push('  - ⚠️ DO NOT ask if customer wants to rent or buy - all properties are rentals')
      if (rentalMin !== null && rentalMax !== null) {
        promptParts.push(`  - Price range: ${formatPrice(rentalMin, true)} - ${formatPrice(rentalMax, true)}`)
      }
    } else if (isSaleOnly) {
      promptParts.push(`- **ALL PROPERTIES ARE FOR SALE** (${saleCount} sale properties)`)
      promptParts.push('  - ⚠️ DO NOT ask if customer wants to rent or buy - all properties are for sale')
      if (saleMin !== null && saleMax !== null) {
        promptParts.push(`  - Price range: ${formatPrice(saleMin, false)} - ${formatPrice(saleMax, false)}`)
      }
    } else if (isMixed) {
      promptParts.push(`- **Mixed inventory** - both rentals and sales available`)
      if (rentalCount > 0) {
        promptParts.push(`  - **Rentals**: ${rentalCount} properties`)
        if (rentalMin !== null && rentalMax !== null) {
          promptParts.push(`    - Price range: ${formatPrice(rentalMin, true)} - ${formatPrice(rentalMax, true)}`)
        }
      }
      if (saleCount > 0) {
        promptParts.push(`  - **Sales**: ${saleCount} properties`)
        if (saleMin !== null && saleMax !== null) {
          promptParts.push(`    - Price range: ${formatPrice(saleMin, false)} - ${formatPrice(saleMax, false)}`)
        }
      }
      promptParts.push('  - ⚠️ ALWAYS ask if customer wants to rent or buy as first question')
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
  
  // Only mention transaction_type if inventory is mixed
  if (isMixed) {
    promptParts.push('- `transaction_type` - "rent" or "sale" (⚠️ ALWAYS ask and use this first since inventory is mixed)')
  } else if (isRentOnly) {
    promptParts.push('- `transaction_type` - Always set to "rent" (all properties are rentals - DO NOT ask customer)')
  } else if (isSaleOnly) {
    promptParts.push('- `transaction_type` - Always set to "sale" (all properties are for sale - DO NOT ask customer)')
  }
  
  promptParts.push('- `city` - City name (uses fuzzy matching, returns available cities if no match)')
  promptParts.push('- `district` - District name (uses fuzzy matching, returns available districts if no match)')
  promptParts.push('- `county` - County name (uses fuzzy matching, returns available counties if no match)')
  promptParts.push('- `street` - Street name or any part of address (searches full addresses, uses fuzzy + phonetic matching, returns top 15 similar streets if no match)')
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
  promptParts.push('- `include_all` - Set to true to return ALL matching properties with full details (descriptions, etc.)')
  promptParts.push('  - **ONLY use when**: Customer wants to hear about all current matches AND you cannot narrow down further OR they explicitly refuse to narrow down')
  promptParts.push('  - **NEVER use when**: There are too many properties (>10) - this will include ALL descriptions and overwhelm the conversation')
  promptParts.push('  - **Default behavior**: Without this flag, tool returns only 3 sample properties, which is usually sufficient')
  promptParts.push('')
  promptParts.push('## How to Use This Tool')
  promptParts.push('')
  
  // Conditional first step based on inventory type
  if (isMixed) {
    promptParts.push('1. **Start with transaction type** - Always ask if they\'re looking to rent or buy (inventory is mixed)')
  } else if (isRentOnly) {
    promptParts.push('1. **Skip transaction type** - All properties are rentals, automatically use transaction_type="rent" in queries')
  } else if (isSaleOnly) {
    promptParts.push('1. **Skip transaction type** - All properties are for sale, automatically use transaction_type="sale" in queries')
  }
  
  promptParts.push('2. **Gather key criteria** - Location, bedrooms, and budget are most important')
  promptParts.push('3. **Use filters strategically** - Start broad, then narrow down with additional filters')
  promptParts.push('4. **Watch the totalCount** - The tool returns up to 3 properties plus a totalCount:')
  promptParts.push('   - If totalCount > 10: Ask for more filters to narrow down before showing properties')
  promptParts.push('   - If totalCount 4-10: Can show results or ask if they want to narrow further')
  promptParts.push('   - If totalCount ≤ 3: Present properties directly')
  promptParts.push('5. **Narrow conversationally** - Ask natural questions about location, beds, budget, etc.')
  promptParts.push('6. **Handle location mismatches** - If user provides a location not in the database, the tool will return available options as refinements. Present these options to the user conversationally.')
  promptParts.push('')
  promptParts.push('## Handling Results')
  promptParts.push('')
  promptParts.push('The tool returns:')
  promptParts.push('- Up to 3 matching properties by default')
  promptParts.push('- `totalCount` - Total number of matches in the database')
  promptParts.push('- `refinements` - Available filter options to narrow results')
  promptParts.push('')
  promptParts.push('**Response strategy based on totalCount:**')
  promptParts.push('- If totalCount > 10: ALWAYS ask clarifying questions to narrow down (location, bedrooms, price range) - DO NOT use include_all')
  promptParts.push('- If totalCount 4-10: Ask if they want to narrow further OR use include_all only if they explicitly want to hear all details')
  promptParts.push('- If totalCount ≤ 3: Present properties directly (include_all can be used safely here if they want full details)')
  promptParts.push('- If totalCount = 0 and refinements exist: User\'s location didn\'t match - present the available location options conversationally')
  promptParts.push('')
  promptParts.push('**Natural conversation flow:**')
  promptParts.push('- "I found 45 properties. Let me help narrow this down. What area are you interested in?"')
  promptParts.push('- "Would you prefer 2 or 3 bedrooms?"')
  promptParts.push('- "What\'s your budget range?"')
  promptParts.push('- Keep asking until you have enough filters to get a manageable number of results')
  promptParts.push('')
  promptParts.push('**When location doesn\'t match:**')
  promptParts.push('- "I don\'t have properties in [user\'s location]. However, I have properties in: [list available cities/districts]"')
  promptParts.push('- "Did you mean one of these areas?"')
  promptParts.push('- Be helpful and conversational when presenting alternatives')
  promptParts.push('')
  promptParts.push('## Example Usage')
  promptParts.push('')
  promptParts.push('**Customer**: "I\'m looking for a 2 bedroom flat to rent in London under £2000 per month"')
  promptParts.push('')
  promptParts.push('**Search with**: ')
  promptParts.push('- transaction_type: "rent"')
  promptParts.push('- beds: 2')
  promptParts.push('- city: "London"')
  promptParts.push('- property_type: "Flat"')
  promptParts.push('- price: { "filter": "under", "value": 2000 }')
  promptParts.push('')
  promptParts.push('**If results return 50 properties**, ask natural follow-up questions:')
  promptParts.push('"I found 50 two-bedroom flats in London under £2000/month. To help narrow this down:')
  promptParts.push('- Which specific district in London are you interested in?')
  promptParts.push('- Would you prefer furnished or unfurnished?')
  promptParts.push('- Are you looking to be near a train station?"')
  promptParts.push('')
  promptParts.push('**If user provides unknown location**, the tool returns available options:')
  promptParts.push('"I don\'t have properties in [location]. I have properties in these cities: [city list from refinements]."')
  promptParts.push('')
  promptParts.push('**Customer**: "Do you have any properties on Main Street?"')
  promptParts.push('')
  promptParts.push('**Search with**:')
  promptParts.push('- transaction_type: "rent" (or "sale", depending on earlier conversation)')
  promptParts.push('- street: "Main Street"')
  promptParts.push('')
  promptParts.push('**Note**: Street search is very flexible and uses multi-stage matching on full addresses:')
  promptParts.push('1. Exact match: "Baker Street, Manchester, M1" → "Baker Street, Manchester, M1" ✓')
  promptParts.push('2. Substring: "Baker Street" or "Manchester M1" → "Baker Street, Manchester, M1" ✓')
  promptParts.push('3. Fuzzy: "Bker Street Manchester" → "Baker Street, Manchester, M1" ✓ (if 60%+ similar - handles typos)')
  promptParts.push('4. Phonetic: "Baeker Street" → "Baker Street, Manchester, M1" ✓ (sounds similar)')
  promptParts.push('')
  promptParts.push('You can search by: street name, area name, district, or even just part of postcode.')
  promptParts.push('If no match found, tool returns top 10-15 most similar addresses by fuzzy/phonetic score.')
  promptParts.push('')
  promptParts.push('Then call the tool again with the additional filters they specify or the corrected location.')
  promptParts.push('')

  return {
    prompt: promptParts.join('\n'),
    keywords: locationKeywords,
  }
}

