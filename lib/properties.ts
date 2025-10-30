import { createClient } from '@/lib/supabase/server'
import { geocodeLocation } from '@/lib/geocoding'

// Price filter structure
export interface PriceFilter {
  filter: 'under' | 'over' | 'between'
  value: number
  max_value?: number // Only used when filter is 'between'
}

/**
 * Parse a PriceFilter into min and max values
 */
function parsePriceFilter(priceFilter: PriceFilter): { min?: number; max?: number } {
  switch (priceFilter.filter) {
    case 'under':
      return { max: priceFilter.value }
    case 'over':
      return { min: priceFilter.value }
    case 'between':
      if (priceFilter.max_value === undefined) {
        throw new Error('max_value is required when filter is "between"')
      }
      return { min: priceFilter.value, max: priceFilter.max_value }
    default:
      throw new Error(`Invalid price filter: ${priceFilter.filter}`)
  }
}

// Query filter interfaces
export interface PropertyQueryFilters {
  beds?: number
  baths?: number
  price?: PriceFilter
  transaction_type?: 'rent' | 'sale'
  property_type?: string
  furnished_type?: string
  has_nearby_station?: boolean
  city?: string
  district?: string
  postcode?: string
  location?: string // General location search (e.g., "London")
  location_radius_km?: number // Radius in kilometers (default: 25km)
}

// Simplified property result (only key fields)
export interface PropertySearchResult {
  id: string
  url: string
  beds: number | null
  baths: number | null
  price: number
  property_type: string | null
  property_subtype: string | null
  title: string | null
  transaction_type: string
  full_address: string
  city: string | null
  district: string | null
  postcode: string | null
  furnished_type: string | null
  has_nearby_station: boolean | null
  has_online_viewing: boolean | null
  is_retirement: boolean
  pets_allowed: boolean | null
  image_count: number | null
  has_floorplan: boolean | null
  description: string | null
  added_on: string | null
  distance_km?: number | null // Distance from location center (if location filter used)
}

// Refinement suggestion for narrowing results
export interface RefinementSuggestion {
  filterName: string
  filterValue: string | number | boolean | PriceFilter
  resultCount: number
}

// Complete query response
export interface PropertyQueryResponse {
  properties: PropertySearchResult[]
  totalCount: number
  refinements: RefinementSuggestion[]
}

/**
 * Query properties with filters and return refinement suggestions
 */
export async function queryProperties(
  knowledgeBaseId: string,
  filters: PropertyQueryFilters
): Promise<PropertyQueryResponse> {
  const supabase = await createClient()

  console.log('Query filters:', filters)

  // Geocode location if provided
  let locationCoords: { latitude: number; longitude: number } | null = null
  if (filters.location) {
    try {
      const geocodeResult = await geocodeLocation(filters.location)
      if (geocodeResult) {
        // Check if the geocoded location is in the UK (rough bounds check)
        // UK bounds: Latitude ~50-60°N, Longitude ~-8°E to 2°E
        const isInUK = geocodeResult.latitude >= 49 && geocodeResult.latitude <= 61 &&
                       geocodeResult.longitude >= -9 && geocodeResult.longitude <= 3
        
        if (isInUK) {
          locationCoords = {
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude,
          }
          console.log(`Geocoded "${filters.location}" to UK location:`, locationCoords)
          
          // Validate that we can find properties near this location
          // If geocoding succeeded but no properties found, we'll try fuzzy matching
        } else {
          console.warn(`Geocoded "${filters.location}" to location outside UK (${geocodeResult.formattedAddress}), trying fuzzy search`)
          // Location is outside UK, try fuzzy matching instead
          const fuzzyMatch = await findFuzzyLocationMatch(supabase, knowledgeBaseId, filters.location)
          if (fuzzyMatch) {
            locationCoords = {
              latitude: fuzzyMatch.latitude,
              longitude: fuzzyMatch.longitude,
            }
            console.log(`Fuzzy matched "${filters.location}" to "${fuzzyMatch.matchedAddress}" at:`, locationCoords)
          } else {
            console.warn(`No fuzzy match found for: ${filters.location}, falling back to text search`)
            filters.city = filters.location
            filters.location = undefined
          }
        }
      } else {
        console.warn(`Failed to geocode location: ${filters.location}, trying fuzzy search on property addresses`)
        // Try fuzzy matching against property addresses
        const fuzzyMatch = await findFuzzyLocationMatch(supabase, knowledgeBaseId, filters.location)
        if (fuzzyMatch) {
          locationCoords = {
            latitude: fuzzyMatch.latitude,
            longitude: fuzzyMatch.longitude,
          }
          console.log(`Fuzzy matched "${filters.location}" to "${fuzzyMatch.matchedAddress}" at:`, locationCoords)
        } else {
          console.warn(`No fuzzy match found for: ${filters.location}, falling back to text search`)
          // Fallback: treat location as city filter
          filters.city = filters.location
          filters.location = undefined
        }
      }
    } catch (error) {
      console.error('Error geocoding location:', error)
      // Try fuzzy matching as fallback
      try {
        if (filters.location) {
          const fuzzyMatch = await findFuzzyLocationMatch(supabase, knowledgeBaseId, filters.location)
          if (fuzzyMatch) {
            locationCoords = {
              latitude: fuzzyMatch.latitude,
              longitude: fuzzyMatch.longitude,
            }
            console.log(`Fuzzy matched "${filters.location}" to "${fuzzyMatch.matchedAddress}" at:`, locationCoords)
          } else {
            // Fallback: treat location as city filter
            filters.city = filters.location
            filters.location = undefined
          }
        }
      } catch (fuzzyError) {
        console.error('Error in fuzzy matching:', fuzzyError)
        // Fallback: treat location as city filter
        if (filters.location) {
          filters.city = filters.location
          filters.location = undefined
        }
      }
    }
  }

  // Parse price filter if provided
  let minPrice: number | undefined
  let maxPrice: number | undefined
  
  if (filters.price && filters.price.filter) {
    const parsedPrice = parsePriceFilter(filters.price)
    minPrice = parsedPrice.min
    maxPrice = parsedPrice.max
  }

  const radiusMeters = filters.location_radius_km
    ? filters.location_radius_km * 1000
    : 25000 // Default 25km

  // If location filtering is used, we need to use PostGIS with raw SQL
  if (locationCoords) {
    const result = await queryPropertiesWithLocation(
      supabase,
      knowledgeBaseId,
      filters,
      locationCoords,
      radiusMeters
    )
    
    // If no properties found within radius, try fuzzy matching with a wider search
    if (result.totalCount === 0 && filters.location) {
      console.warn(`No properties found within ${radiusMeters / 1000}km of geocoded location, trying fuzzy search`)
      const fuzzyMatch = await findFuzzyLocationMatch(supabase, knowledgeBaseId, filters.location)
      if (fuzzyMatch) {
        // Use fuzzy match coordinates with a larger radius
        const largerRadius = Math.max(radiusMeters, 50000) // At least 50km
        console.log(`Using fuzzy match coordinates with larger radius: ${largerRadius / 1000}km`)
        return await queryPropertiesWithLocation(
          supabase,
          knowledgeBaseId,
          filters,
          { latitude: fuzzyMatch.latitude, longitude: fuzzyMatch.longitude },
          largerRadius
        )
      }
    }
    
    return result
  }

  // Build base query (standard query without location filtering)
  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })
    .eq('knowledge_base_id', knowledgeBaseId)

  // Apply exact match filters
  if (filters.beds !== undefined) {
    query = query.eq('beds', filters.beds)
  }
  if (filters.baths !== undefined) {
    query = query.eq('baths', filters.baths)
  }
  if (filters.transaction_type) {
    console.log('Applying transaction_type filter:', filters.transaction_type)
    query = query.eq('transaction_type', filters.transaction_type)
  }
  if (filters.property_type) {
    query = query.eq('property_type', filters.property_type)
  }
  if (filters.furnished_type) {
    query = query.eq('furnished_type', filters.furnished_type)
  }
  if (filters.has_nearby_station !== undefined) {
    query = query.eq('has_nearby_station', filters.has_nearby_station)
  }

  // Apply price range filters (use parsed values from price_range if available)
  if (minPrice !== undefined) {
    query = query.gte('price', minPrice)
  }
  if (maxPrice !== undefined) {
    query = query.lte('price', maxPrice)
  }

  // Apply fuzzy location filters (case-insensitive partial match)
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`)
  }
  if (filters.district) {
    query = query.ilike('district', `%${filters.district}%`)
  }
  if (filters.postcode) {
    query = query.ilike('postcode', `%${filters.postcode}%`)
  }

  // Get total count first (for refinements)
  const countQuery = query
  const { count: totalCount, error: countError } = await countQuery

  if (countError) {
    console.error('Error counting properties:', countError)
    throw countError
  }

  console.log('Total count after filters:', totalCount)

  // Get top 3 results, ordered by newest first
  const { data: properties, error } = await query
    .order('added_on', { ascending: false })
    .limit(3)

  if (error) {
    console.error('Error fetching properties:', error)
    throw error
  }

  // Map to simplified result format
  const results: PropertySearchResult[] = (properties || []).map(prop => ({
    id: prop.id,
    url: prop.url,
    beds: prop.beds,
    baths: prop.baths,
    price: prop.price,
    property_type: prop.property_type,
    property_subtype: prop.property_subtype,
    title: prop.title,
    transaction_type: prop.transaction_type,
    full_address: prop.full_address,
    city: prop.city,
    district: prop.district,
    postcode: prop.postcode,
    furnished_type: prop.furnished_type,
    has_nearby_station: prop.has_nearby_station,
    has_online_viewing: prop.has_online_viewing,
    is_retirement: prop.is_retirement,
    pets_allowed: prop.pets_allowed,
    image_count: prop.image_count,
    has_floorplan: prop.has_floorplan,
    description: prop.description,
    added_on: prop.added_on,
  }))

  // Generate refinement suggestions
  const refinements = await generateRefinements(
    supabase,
    knowledgeBaseId,
    filters,
    totalCount || 0
  )

  return {
    properties: results,
    totalCount: totalCount || 0,
    refinements,
  }
}

/**
 * Query properties with PostGIS location filtering
 * Uses JavaScript-based distance calculation as fallback
 */
async function queryPropertiesWithLocation(
  supabase: any,
  knowledgeBaseId: string,
  filters: PropertyQueryFilters,
  locationCoords: { latitude: number; longitude: number },
  radiusMeters: number
): Promise<PropertyQueryResponse> {
  const radiusKm = radiusMeters / 1000

  // Build base query with all filters except location
  let query = supabase
    .from('properties')
    .select('*', { count: 'exact' })
    .eq('knowledge_base_id', knowledgeBaseId)
    .not('location', 'is', null)

  // Apply other filters
  if (filters.beds !== undefined) {
    query = query.eq('beds', filters.beds)
  }
  if (filters.baths !== undefined) {
    query = query.eq('baths', filters.baths)
  }
  if (filters.transaction_type) {
    query = query.eq('transaction_type', filters.transaction_type)
  }
  if (filters.property_type) {
    query = query.eq('property_type', filters.property_type)
  }
  if (filters.furnished_type) {
    query = query.eq('furnished_type', filters.furnished_type)
  }
  if (filters.has_nearby_station !== undefined) {
    query = query.eq('has_nearby_station', filters.has_nearby_station)
  }

  // Parse price filter
  let minPrice: number | undefined
  let maxPrice: number | undefined
  
  if (filters.price && filters.price.filter) {
    const parsedPrice = parsePriceFilter(filters.price)
    minPrice = parsedPrice.min
    maxPrice = parsedPrice.max
  }

  if (minPrice !== undefined) {
    query = query.gte('price', minPrice)
  }
  if (maxPrice !== undefined) {
    query = query.lte('price', maxPrice)
  }
  if (filters.city) {
    query = query.ilike('city', `%${filters.city}%`)
  }
  if (filters.district) {
    query = query.ilike('district', `%${filters.district}%`)
  }
  if (filters.postcode) {
    query = query.ilike('postcode', `%${filters.postcode}%`)
  }

  // Fetch all properties (we'll filter by distance in JavaScript)
  // Note: For large datasets, consider using PostGIS RPC function
  const { data: properties, count: totalCountBeforeFilter, error } = await query

  if (error) {
    console.error('Error fetching properties:', error)
    throw error
  }

  // Filter by distance and sort
  const propertiesWithDistance = (properties || [])
    .map((prop: any) => {
      if (prop.latitude && prop.longitude) {
        const distance = calculateDistance(
          locationCoords.latitude,
          locationCoords.longitude,
          prop.latitude,
          prop.longitude
        )
        return { ...prop, distance_km: Math.round(distance * 100) / 100 } // Round to 2 decimal places
      }
      return null
    })
    .filter((prop: any): prop is any => prop !== null && prop.distance_km <= radiusKm)
    .sort((a: any, b: any) => {
      // Sort by distance first, then by date added
      if (a.distance_km !== b.distance_km) {
        return a.distance_km - b.distance_km
      }
      const dateA = a.added_on ? new Date(a.added_on).getTime() : 0
      const dateB = b.added_on ? new Date(b.added_on).getTime() : 0
      return dateB - dateA
    })
    .slice(0, 3)

  const totalCount = propertiesWithDistance.length

  // Map to simplified result format
  const results: PropertySearchResult[] = propertiesWithDistance.map((prop: any) => ({
    id: prop.id,
    url: prop.url,
    beds: prop.beds,
    baths: prop.baths,
    price: prop.price,
    property_type: prop.property_type,
    property_subtype: prop.property_subtype,
    title: prop.title,
    transaction_type: prop.transaction_type,
    full_address: prop.full_address,
    city: prop.city,
    district: prop.district,
    postcode: prop.postcode,
    furnished_type: prop.furnished_type,
    has_nearby_station: prop.has_nearby_station,
    has_online_viewing: prop.has_online_viewing,
    is_retirement: prop.is_retirement,
    pets_allowed: prop.pets_allowed,
    image_count: prop.image_count,
    has_floorplan: prop.has_floorplan,
    description: prop.description,
    added_on: prop.added_on,
    distance_km: prop.distance_km,
  }))

  // Generate refinement suggestions
  const refinements = await generateRefinements(
    supabase,
    knowledgeBaseId,
    filters,
    totalCount
  )

  return {
    properties: results,
    totalCount: totalCount,
    refinements,
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  const matrix: number[][] = []

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[s2.length][s1.length]
}

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1.0
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

/**
 * Extract street name from address (removes common street types)
 */
function extractStreetName(address: string): string {
  const streetTypes = ['street', 'road', 'lane', 'avenue', 'avenue', 'drive', 'way', 'close', 'court', 'crescent', 'grove', 'place', 'square', 'terrace', 'walk', 'gardens', 'park', 'hill', 'rise', 'vale', 'view']
  let normalized = address.toLowerCase().trim()
  
  // Remove common street type suffixes
  for (const type of streetTypes) {
    const regex = new RegExp(`\\s+${type}\\s*$`, 'i')
    normalized = normalized.replace(regex, '').trim()
  }
  
  return normalized
}

/**
 * Check if two addresses match by street name (ignoring street type)
 */
function matchStreetName(address1: string, address2: string): boolean {
  const street1 = extractStreetName(address1)
  const street2 = extractStreetName(address2)
  
  // Exact match on street name
  if (street1 === street2) return true
  
  // Check if one contains the other (partial match)
  if (street1.includes(street2) || street2.includes(street1)) {
    return true
  }
  
  // Check similarity with Levenshtein distance
  const similarity = stringSimilarity(street1, street2)
  return similarity > 0.85 // Higher threshold for street name matching
}

/**
 * Find fuzzy match for location query against property addresses
 */
async function findFuzzyLocationMatch(
  supabase: any,
  knowledgeBaseId: string,
  searchLocation: string
): Promise<{ latitude: number; longitude: number; matchedAddress: string } | null> {
  // Fetch all properties with addresses to search against
  const { data: properties, error } = await supabase
    .from('properties')
    .select('street_address, full_address, district, city, latitude, longitude')
    .eq('knowledge_base_id', knowledgeBaseId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(1000) // Limit to avoid performance issues

  if (error || !properties || properties.length === 0) {
    return null
  }

  const normalizedSearch = searchLocation.toLowerCase().trim()
  let bestMatch: {
    property: any
    score: number
    matchedField: string
    matchedValue: string
  } | null = null

  // Search through street_address, full_address, district, and city
  for (const prop of properties) {
    const fields = [
      { name: 'street_address', value: prop.street_address },
      { name: 'full_address', value: prop.full_address },
      { name: 'district', value: prop.district },
      { name: 'city', value: prop.city },
    ]

    for (const field of fields) {
      if (!field.value) continue

      const fieldValue = String(field.value).toLowerCase().trim()
      
      // For street addresses, check street name match (ignoring street type)
      if (field.name === 'street_address' || field.name === 'full_address') {
        if (matchStreetName(normalizedSearch, fieldValue)) {
          const street1 = extractStreetName(normalizedSearch)
          const street2 = extractStreetName(fieldValue)
          const score = street1 === street2 ? 1.0 : stringSimilarity(street1, street2)
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = {
              property: prop,
              score,
              matchedField: field.name,
              matchedValue: field.value,
            }
          }
          continue // Skip to next field if street name matched
        }
      }
      
      // Check for exact substring match first (higher priority)
      if (fieldValue.includes(normalizedSearch) || normalizedSearch.includes(fieldValue)) {
        const score = normalizedSearch.length / Math.max(fieldValue.length, normalizedSearch.length)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            property: prop,
            score,
            matchedField: field.name,
            matchedValue: field.value,
          }
        }
      } else {
        // Use Levenshtein distance for fuzzy matching
        const similarity = stringSimilarity(normalizedSearch, fieldValue)
        // Only consider matches with similarity > 0.7 (70% similar)
        if (similarity > 0.7 && (!bestMatch || similarity > bestMatch.score)) {
          bestMatch = {
            property: prop,
            score: similarity,
            matchedField: field.name,
            matchedValue: field.value,
          }
        }
      }
    }
  }

  if (bestMatch && bestMatch.score > 0.7) {
    return {
      latitude: bestMatch.property.latitude,
      longitude: bestMatch.property.longitude,
      matchedAddress: bestMatch.matchedValue,
    }
  }

  return null
}
async function generateRefinements(
  supabase: any,
  knowledgeBaseId: string,
  filters: PropertyQueryFilters,
  totalCount: number
): Promise<RefinementSuggestion[]> {
  const suggestions: RefinementSuggestion[] = []

  // Parse price filter for refinements query
  let minPriceForRefinements: number | undefined
  let maxPriceForRefinements: number | undefined
  
  if (filters.price && filters.price.filter) {
    const parsedPrice = parsePriceFilter(filters.price)
    minPriceForRefinements = parsedPrice.min
    maxPriceForRefinements = parsedPrice.max
  }

  // Build base query matching current filters (same as main query but without limit)
  const buildBaseQuery = () => {
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact', head: false })
      .eq('knowledge_base_id', knowledgeBaseId)

    if (filters.beds !== undefined) {
      query = query.eq('beds', filters.beds)
    }
    if (filters.baths !== undefined) {
      query = query.eq('baths', filters.baths)
    }
    if (filters.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type)
    }
    if (filters.property_type) {
      query = query.eq('property_type', filters.property_type)
    }
    if (filters.furnished_type) {
      query = query.eq('furnished_type', filters.furnished_type)
    }
    if (filters.has_nearby_station !== undefined) {
      query = query.eq('has_nearby_station', filters.has_nearby_station)
    }
    if (minPriceForRefinements !== undefined) {
      query = query.gte('price', minPriceForRefinements)
    }
    if (maxPriceForRefinements !== undefined) {
      query = query.lte('price', maxPriceForRefinements)
    }
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`)
    }
    if (filters.district) {
      query = query.ilike('district', `%${filters.district}%`)
    }
    if (filters.postcode) {
      query = query.ilike('postcode', `%${filters.postcode}%`)
    }

    return query
  }

  // Helper to add refinement if it would narrow results
  const addRefinement = (
    filterName: string,
    filterValue: string | number | boolean,
    count: number
  ) => {
    // Only suggest if count > 0 and count < totalCount (would narrow results)
    if (count > 0 && count < totalCount) {
      suggestions.push({
        filterName,
        filterValue,
        resultCount: count,
      })
    }
  }

  // Get refinements for transaction_type (rent vs sale)
  const { data: transactionData } = await buildBaseQuery()
    .select('transaction_type')
    .not('transaction_type', 'is', null)

  if (transactionData) {
    const transactionCounts = transactionData.reduce((acc: Record<string, number>, prop: any) => {
      const type = prop.transaction_type
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    Object.entries(transactionCounts).forEach(([type, count]) => {
      addRefinement('transaction_type', type, count as number)
    })
  }

  // Get refinements for beds (show all options)
  const { data: bedsData } = await buildBaseQuery()
    .select('beds')
    .not('beds', 'is', null)

  if (bedsData) {
    const bedsCounts = bedsData.reduce((acc: Record<number, number>, prop: any) => {
      const beds = prop.beds
      acc[beds] = (acc[beds] || 0) + 1
      return acc
    }, {})

    Object.entries(bedsCounts).forEach(([beds, count]) => {
      addRefinement('beds', parseInt(beds), count as number)
    })
  }

  // Get refinements for baths (show all options)
  const { data: bathsData } = await buildBaseQuery()
    .select('baths')
    .not('baths', 'is', null)

  if (bathsData) {
    const bathsCounts = bathsData.reduce((acc: Record<number, number>, prop: any) => {
      const baths = prop.baths
      acc[baths] = (acc[baths] || 0) + 1
      return acc
    }, {})

    Object.entries(bathsCounts).forEach(([baths, count]) => {
      addRefinement('baths', parseInt(baths), count as number)
    })
  }

  // Get refinements for property_type
  const { data: typeData } = await buildBaseQuery()
    .select('property_type')
    .not('property_type', 'is', null)

  if (typeData) {
    const typeCounts = typeData.reduce((acc: Record<string, number>, prop: any) => {
      const type = prop.property_type
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    Object.entries(typeCounts).forEach(([type, count]) => {
      addRefinement('property_type', type, count as number)
    })
  }

  // Get refinements for furnished_type
  const { data: furnishedData } = await buildBaseQuery()
    .select('furnished_type')
    .not('furnished_type', 'is', null)

  if (furnishedData) {
    const furnishedCounts = furnishedData.reduce((acc: Record<string, number>, prop: any) => {
      const type = prop.furnished_type
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    Object.entries(furnishedCounts).forEach(([type, count]) => {
      addRefinement('furnished_type', type, count as number)
    })
  }

  // Get refinements for has_nearby_station
  const { data: stationData } = await buildBaseQuery()
    .select('has_nearby_station')
    .not('has_nearby_station', 'is', null)

  if (stationData) {
    const stationCounts = stationData.reduce(
      (acc: Record<string, number>, prop: any) => {
        const hasStation = prop.has_nearby_station ? 'true' : 'false'
        acc[hasStation] = (acc[hasStation] || 0) + 1
        return acc
      },
      {}
    )

    Object.entries(stationCounts).forEach(([hasStation, count]) => {
      addRefinement('has_nearby_station', hasStation === 'true', count as number)
    })
  }

  // Get refinements for city (show all options)
  const { data: cityData } = await buildBaseQuery()
    .select('city')
    .not('city', 'is', null)

  if (cityData) {
    const cityCounts = cityData.reduce((acc: Record<string, number>, prop: any) => {
      const city = prop.city
      acc[city] = (acc[city] || 0) + 1
      return acc
    }, {})

    // Only show top 5 cities to avoid overwhelming response
    Object.entries(cityCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([city, count]) => {
        addRefinement('city', city, count as number)
      })
  }

  // Get refinements for district (show all options)
  const { data: districtData } = await buildBaseQuery()
    .select('district')
    .not('district', 'is', null)

  if (districtData) {
    const districtCounts = districtData.reduce((acc: Record<string, number>, prop: any) => {
      const district = prop.district
      acc[district] = (acc[district] || 0) + 1
      return acc
    }, {})

    // Only show top 5 districts to avoid overwhelming response
    Object.entries(districtCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .forEach(([district, count]) => {
        addRefinement('district', district, count as number)
      })
  }

  // Get price range refinements (only if transaction_type is filtered and no price already applied)
  // Price ranges only make sense within a single transaction type (rent vs sale)
  if (filters.transaction_type && !(filters.price && filters.price.filter)) {
    const { data: priceData } = await buildBaseQuery()
      .select('price, transaction_type')
      .not('price', 'is', null)

    if (priceData && priceData.length > 0) {
      const prices = priceData.map((p: any) => Number(p.price)).sort((a: number, b: number) => a - b)
      const minPrice = prices[0]
      const maxPrice = prices[prices.length - 1]
      const priceRange = maxPrice - minPrice

      // Define smart price buckets based on the price range
      const priceBuckets: Array<{ filter: PriceFilter; min?: number; max?: number }> = []

      if (priceRange > 0) {
        // Create dynamic buckets based on quartiles
        const q1 = prices[Math.floor(prices.length * 0.25)]
        const q2 = prices[Math.floor(prices.length * 0.5)] // median
        const q3 = prices[Math.floor(prices.length * 0.75)]

        // Round to nice numbers based on transaction type
        const roundToNice = (num: number) => {
          // For rentals (typically £500-£5000/month)
          if (filters.transaction_type === 'rent') {
            if (num < 1000) return Math.round(num / 50) * 50
            if (num < 5000) return Math.round(num / 100) * 100
            return Math.round(num / 500) * 500
          }
          // For sales (typically £100k-£millions)
          if (num < 100000) return Math.round(num / 10000) * 10000
          if (num < 1000000) return Math.round(num / 50000) * 50000
          return Math.round(num / 100000) * 100000
        }

        const roundedQ1 = roundToNice(q1)
        const roundedQ2 = roundToNice(q2)
        const roundedQ3 = roundToNice(q3)

        // Create buckets with PriceFilter format
        priceBuckets.push({ 
          filter: { filter: 'under', value: roundedQ2 }, 
          max: roundedQ2 
        })
        priceBuckets.push({ 
          filter: { filter: 'between', value: roundedQ2, max_value: roundedQ3 }, 
          min: roundedQ2, 
          max: roundedQ3 
        })
        priceBuckets.push({ 
          filter: { filter: 'over', value: roundedQ3 }, 
          min: roundedQ3 
        })
      }

      // Count properties in each bucket
      for (const bucket of priceBuckets) {
        const countInBucket = prices.filter((p: number) => {
          if (bucket.min !== undefined && bucket.max !== undefined) {
            return p >= bucket.min && p <= bucket.max
          } else if (bucket.max !== undefined) {
            return p <= bucket.max
          } else if (bucket.min !== undefined) {
            return p >= bucket.min
          }
          return false
        }).length

        if (countInBucket > 0 && countInBucket < totalCount) {
          suggestions.push({
            filterName: 'price',
            filterValue: bucket.filter,
            resultCount: countInBucket,
          })
        }
      }
    }
  }

  return suggestions
}

