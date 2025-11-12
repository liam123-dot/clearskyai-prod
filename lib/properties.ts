import { createClient } from '@/lib/supabase/server'

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
  county?: string
  street?: string
  postcode?: string
  include_all?: boolean // If true, return all matching properties; if false, return only when <= 3 matches or return refinements
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

  // Apply fuzzy matching for city, district, and county filters
  if (filters.city) {
    const matchedCity = await fuzzyMatchLocationField(supabase, knowledgeBaseId, filters.city, 'city')
    if (matchedCity) {
      console.log(`Fuzzy matched city "${filters.city}" to "${matchedCity}"`)
      filters.city = matchedCity
    } else {
      // No match found - return empty properties with available cities as refinements
      console.warn(`No match found for city: ${filters.city}`)
      const refinements = await generateLocationRefinements(supabase, knowledgeBaseId, filters, 'city')
      return {
        properties: [],
        totalCount: 0,
        refinements,
      }
    }
  }

  if (filters.district) {
    const matchedDistrict = await fuzzyMatchLocationField(supabase, knowledgeBaseId, filters.district, 'district')
    if (matchedDistrict) {
      console.log(`Fuzzy matched district "${filters.district}" to "${matchedDistrict}"`)
      filters.district = matchedDistrict
    } else {
      // No match found - return empty properties with available districts as refinements
      console.warn(`No match found for district: ${filters.district}`)
      const refinements = await generateLocationRefinements(supabase, knowledgeBaseId, filters, 'district')
      return {
        properties: [],
        totalCount: 0,
        refinements,
      }
    }
  }

  if (filters.county) {
    const matchedCounty = await fuzzyMatchLocationField(supabase, knowledgeBaseId, filters.county, 'county')
    if (matchedCounty) {
      console.log(`Fuzzy matched county "${filters.county}" to "${matchedCounty}"`)
      filters.county = matchedCounty
    } else {
      // No match found - return empty properties with available counties as refinements
      console.warn(`No match found for county: ${filters.county}`)
      const refinements = await generateLocationRefinements(supabase, knowledgeBaseId, filters, 'county')
      return {
        properties: [],
        totalCount: 0,
        refinements,
      }
    }
  }

  // Store matched streets array for later use
  let matchedStreets: string[] | null = null
  
  if (filters.street) {
    // Create a copy of filters without street to pass to fuzzyMatchStreet
    const { street, include_all, ...otherFilters } = filters
    matchedStreets = await fuzzyMatchStreet(supabase, knowledgeBaseId, filters.street, otherFilters)
    if (matchedStreets && matchedStreets.length > 0) {
      if (matchedStreets.length === 1) {
        console.log(`Fuzzy/phonetic matched street "${filters.street}" to "${matchedStreets[0]}"`)
      } else {
        console.log(`Fuzzy/phonetic matched street "${filters.street}" to ${matchedStreets.length} streets: ${matchedStreets.join(', ')}`)
      }
      // Don't set filters.street here - we'll use matchedStreets array directly in the query
    } else {
      // No match found - return empty properties with similar streets as refinements
      console.warn(`No match found for street: ${filters.street}`)
      const refinements = await generateStreetRefinements(supabase, knowledgeBaseId, filters, filters.street)
      return {
        properties: [],
        totalCount: 0,
        refinements,
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

  // Apply exact match for location filters (fuzzy matching already applied above)
  if (filters.city) {
    query = query.eq('city', filters.city)
  }
  if (filters.district) {
    query = query.eq('district', filters.district)
  }
  if (filters.county) {
    query = query.eq('county', filters.county)
  }
  // Use matchedStreets array if available (allows matching multiple streets)
  if (matchedStreets && matchedStreets.length > 0) {
    if (matchedStreets.length === 1) {
      query = query.eq('street_address', matchedStreets[0])
    } else {
      // Multiple streets matched - use .in() to match any of them
      query = query.in('street_address', matchedStreets)
    }
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

  const includeAll = filters.include_all ?? false
  const finalTotalCount = totalCount || 0

  // Generate refinement suggestions first (needed to determine if we should return properties)
  const refinements = await generateRefinements(
    supabase,
    knowledgeBaseId,
    filters,
    finalTotalCount
  )

  // Determine if we should return properties or just refinements
  let propertiesToReturn: PropertySearchResult[] = []

  if (includeAll) {
    // Return ALL matching properties when include_all is true
    const { data: properties, error } = await query
      .order('added_on', { ascending: false })

    if (error) {
      console.error('Error fetching properties:', error)
      throw error
    }

    propertiesToReturn = (properties || []).map(prop => ({
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
  } else {
    // If include_all is false (default)
    if (finalTotalCount <= 3) {
      // Return all properties when count is 3 or less
      const { data: properties, error } = await query
        .order('added_on', { ascending: false })

      if (error) {
        console.error('Error fetching properties:', error)
        throw error
      }

      propertiesToReturn = (properties || []).map(prop => ({
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
    } else {
      // If more than 3 results, check if refinements can narrow results
      const refinementsThatNarrow = refinements.filter(r => r.resultCount < finalTotalCount)
      
      if (refinementsThatNarrow.length > 0) {
        // Return empty properties array - refinements can help narrow down
        propertiesToReturn = []
      } else {
        // No useful refinements - return all properties (cannot narrow further)
        const { data: properties, error } = await query
          .order('added_on', { ascending: false })

        if (error) {
          console.error('Error fetching properties:', error)
          throw error
        }

        propertiesToReturn = (properties || []).map(prop => ({
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
      }
    }
  }

  return {
    properties: propertiesToReturn,
    totalCount: finalTotalCount,
    refinements,
  }
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
 * Generate Soundex code for phonetic matching
 * Soundex algorithm converts names to a code based on sound
 * Useful for matching similar-sounding street names
 */
function getSoundexCode(str: string): string {
  if (!str) return ''
  
  // Convert to uppercase and remove non-letters
  const cleaned = str.toUpperCase().replace(/[^A-Z]/g, '')
  if (cleaned.length === 0) return ''
  
  // Keep first letter
  let soundex = cleaned[0]
  
  // Soundex digit mapping
  const mapping: Record<string, string> = {
    'B': '1', 'F': '1', 'P': '1', 'V': '1',
    'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
    'D': '3', 'T': '3',
    'L': '4',
    'M': '5', 'N': '5',
    'R': '6'
  }
  
  let prevCode = mapping[cleaned[0]] || ''
  
  // Process remaining letters
  for (let i = 1; i < cleaned.length && soundex.length < 4; i++) {
    const code = mapping[cleaned[i]] || ''
    
    // Skip vowels and H, W, Y
    if (code === '') continue
    
    // Skip if same as previous code (avoid doubles)
    if (code !== prevCode) {
      soundex += code
      prevCode = code
    }
  }
  
  // Pad with zeros to length 4
  while (soundex.length < 4) {
    soundex += '0'
  }
  
  return soundex.substring(0, 4)
}

/**
 * Calculate phonetic similarity between two strings using Soundex
 * Returns true if they sound similar
 */
function phoneticMatch(str1: string, str2: string): boolean {
  const code1 = getSoundexCode(str1)
  const code2 = getSoundexCode(str2)
  return code1 !== '' && code1 === code2
}

/**
 * Find fuzzy and phonetic match for street address
 * Multi-stage matching: exact, substring, fuzzy, and phonetic
 * Returns array of matched street addresses or null if no match found
 * Returns multiple streets if they match equally well (e.g., searching "gardens" matches both "Craig House Gardens" and "Portland Gardens")
 * Applies other filters first to only search within properties that match those criteria
 */
async function fuzzyMatchStreet(
  supabase: any,
  knowledgeBaseId: string,
  searchTerm: string,
  otherFilters?: Omit<PropertyQueryFilters, 'street' | 'include_all'>
): Promise<string[] | null> {
  // Build query with other filters applied first
  let query = supabase
    .from('properties')
    .select('street_address, full_address')
    .eq('knowledge_base_id', knowledgeBaseId)
    .not('street_address', 'is', null)

  // Apply other filters if provided
  if (otherFilters) {
    if (otherFilters.beds !== undefined) {
      query = query.eq('beds', otherFilters.beds)
    }
    if (otherFilters.baths !== undefined) {
      query = query.eq('baths', otherFilters.baths)
    }
    if (otherFilters.transaction_type) {
      query = query.eq('transaction_type', otherFilters.transaction_type)
    }
    if (otherFilters.property_type) {
      query = query.eq('property_type', otherFilters.property_type)
    }
    if (otherFilters.furnished_type) {
      query = query.eq('furnished_type', otherFilters.furnished_type)
    }
    if (otherFilters.has_nearby_station !== undefined) {
      query = query.eq('has_nearby_station', otherFilters.has_nearby_station)
    }
    if (otherFilters.city) {
      query = query.eq('city', otherFilters.city)
    }
    if (otherFilters.district) {
      query = query.eq('district', otherFilters.district)
    }
    if (otherFilters.county) {
      query = query.eq('county', otherFilters.county)
    }
    if (otherFilters.postcode) {
      query = query.ilike('postcode', `%${otherFilters.postcode}%`)
    }
    
    // Apply price filters if provided
    if (otherFilters.price && otherFilters.price.filter) {
      const { min, max } = parsePriceFilter(otherFilters.price)
      if (min !== undefined) {
        query = query.gte('price', min)
      }
      if (max !== undefined) {
        query = query.lte('price', max)
      }
    }
  }

  const { data: properties, error } = await query

  if (error || !properties || properties.length === 0) {
    return null
  }

  // Collect all unique street addresses
  const streetAddresses = new Set<string>()
  properties.forEach((p: any) => {
    if (p.street_address) streetAddresses.add(p.street_address)
  })

  const uniqueStreets = Array.from(streetAddresses)
  const normalizedSearch = searchTerm.toLowerCase().trim()

  // Stage 1: Try exact match (case-insensitive)
  const exactMatches = uniqueStreets.filter(
    (street) => street.toLowerCase().trim() === normalizedSearch
  )
  if (exactMatches.length > 0) {
    return exactMatches
  }

  // Stage 2: Try substring match - return ALL streets that match
  const substringMatches = uniqueStreets.filter(
    (street) => {
      const normalizedStreet = street.toLowerCase().trim()
      return normalizedStreet.includes(normalizedSearch) || normalizedSearch.includes(normalizedStreet)
    }
  )
  if (substringMatches.length > 0) {
    return substringMatches
  }

  // Stage 3 & 4: Try fuzzy match and phonetic match - return ALL above threshold
  const matchedStreets: Map<string, number> = new Map()

  for (const street of uniqueStreets) {
    const normalizedStreet = street.toLowerCase().trim()

    // Fuzzy match using Levenshtein distance (60% threshold - more forgiving)
    const similarity = stringSimilarity(normalizedSearch, normalizedStreet)
    if (similarity >= 0.6) {
      matchedStreets.set(street, Math.max(matchedStreets.get(street) || 0, similarity))
    }

    // Phonetic match using Soundex (handles similar-sounding names)
    if (phoneticMatch(searchTerm, street)) {
      const phoneticScore = 0.75 // Give phonetic matches a decent score
      matchedStreets.set(street, Math.max(matchedStreets.get(street) || 0, phoneticScore))
    }
  }

  if (matchedStreets.size > 0) {
    // Return all streets that matched, sorted by score (best first)
    return Array.from(matchedStreets.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([street]) => street)
  }

  return null
}

/**
 * Find fuzzy match for a location field (city, district, or county)
 * Returns the matched value from the database or null if no match found
 */
async function fuzzyMatchLocationField(
  supabase: any,
  knowledgeBaseId: string,
  searchTerm: string,
  fieldName: 'city' | 'district' | 'county'
): Promise<string | null> {
  // Get all unique values for the field
  const { data: properties, error } = await supabase
    .from('properties')
    .select(fieldName)
    .eq('knowledge_base_id', knowledgeBaseId)
    .not(fieldName, 'is', null)

  if (error || !properties || properties.length === 0) {
    return null
  }

  // Get unique values and filter out nulls
  const allValues = properties
    .map((p: any) => p[fieldName])
    .filter((v: any): v is string => typeof v === 'string' && v !== null)
  const uniqueValues: string[] = [...new Set<string>(allValues)]
  const normalizedSearch = searchTerm.toLowerCase().trim()

  // Try exact match first (case-insensitive)
  const exactMatch = uniqueValues.find(
    (value) => value.toLowerCase().trim() === normalizedSearch
  )
  if (exactMatch) {
    return exactMatch
  }

  // Try fuzzy match with 60% similarity threshold (more forgiving for typos)
  let bestMatch: { value: string; score: number } | null = null
  
  for (const value of uniqueValues) {
    const normalizedValue = value.toLowerCase().trim()
    
    // Check for substring match first (higher priority)
    if (normalizedValue.includes(normalizedSearch) || normalizedSearch.includes(normalizedValue)) {
      const score = normalizedSearch.length / Math.max(normalizedValue.length, normalizedSearch.length)
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { value, score }
      }
    } else {
      // Use Levenshtein distance for fuzzy matching
      const similarity = stringSimilarity(normalizedSearch, normalizedValue)
      if (similarity >= 0.6 && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { value, score: similarity }
      }
    }
  }

  return bestMatch && bestMatch.score >= 0.6 ? bestMatch.value : null
}

/**
 * Generate street refinements when no match is found
 * Returns top 10-15 most similar streets sorted by phonetic/fuzzy similarity
 * Only considers streets with properties matching other filter criteria
 */
async function generateStreetRefinements(
  supabase: any,
  knowledgeBaseId: string,
  filters: PropertyQueryFilters,
  searchTerm: string
): Promise<RefinementSuggestion[]> {
  const suggestions: RefinementSuggestion[] = []

  // Build query with other filters applied (excluding street)
  let query = supabase
    .from('properties')
    .select('street_address')
    .eq('knowledge_base_id', knowledgeBaseId)
    .not('street_address', 'is', null)

  // Apply other filters (excluding street)
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
  if (filters.city) {
    query = query.eq('city', filters.city)
  }
  if (filters.district) {
    query = query.eq('district', filters.district)
  }
  if (filters.county) {
    query = query.eq('county', filters.county)
  }
  if (filters.postcode) {
    query = query.ilike('postcode', `%${filters.postcode}%`)
  }
  
  // Apply price filters if provided
  if (filters.price && filters.price.filter) {
    const { min, max } = parsePriceFilter(filters.price)
    if (min !== undefined) {
      query = query.gte('price', min)
    }
    if (max !== undefined) {
      query = query.lte('price', max)
    }
  }

  const { data: properties, error } = await query

  if (error || !properties || properties.length === 0) {
    return suggestions
  }

  // Count occurrences and calculate similarity scores
  const streetScores: Map<string, { count: number; score: number }> = new Map()
  const normalizedSearch = searchTerm.toLowerCase().trim()

  properties.forEach((prop: any) => {
    const street = prop.street_address
    if (street) {
      if (!streetScores.has(street)) {
        // Calculate combined similarity score
        const fuzzyScore = stringSimilarity(normalizedSearch, street.toLowerCase().trim())
        const phoneticScore = phoneticMatch(searchTerm, street) ? 0.8 : 0
        const combinedScore = Math.max(fuzzyScore, phoneticScore)
        
        streetScores.set(street, { count: 1, score: combinedScore })
      } else {
        const existing = streetScores.get(street)!
        existing.count++
      }
    }
  })

  // Sort by similarity score (best matches first), then by count
  const sortedStreets = Array.from(streetScores.entries())
    .sort((a, b) => {
      // First sort by score (descending)
      if (b[1].score !== a[1].score) {
        return b[1].score - a[1].score
      }
      // Then by count (descending)
      return b[1].count - a[1].count
    })
    .slice(0, 15) // Limit to top 15 results

  // Create refinement suggestions
  sortedStreets.forEach(([street, data]) => {
    suggestions.push({
      filterName: 'street',
      filterValue: street,
      resultCount: data.count,
    })
  })

  return suggestions
}

/**
 * Generate location refinements when no match is found
 * Returns all available values for the specified location field
 */
async function generateLocationRefinements(
  supabase: any,
  knowledgeBaseId: string,
  filters: PropertyQueryFilters,
  fieldName: 'city' | 'district' | 'county'
): Promise<RefinementSuggestion[]> {
  const suggestions: RefinementSuggestion[] = []

  // Get all unique values for the field
  const { data: properties, error } = await supabase
    .from('properties')
    .select(fieldName)
    .eq('knowledge_base_id', knowledgeBaseId)
    .not(fieldName, 'is', null)

  if (error || !properties || properties.length === 0) {
    return suggestions
  }

  // Count occurrences of each value
  const valueCounts: Record<string, number> = {}
  properties.forEach((prop: any) => {
    const value = prop[fieldName]
    if (value) {
      valueCounts[value] = (valueCounts[value] || 0) + 1
    }
  })

  // Create refinement suggestions sorted by count
  Object.entries(valueCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .forEach(([value, count]) => {
      suggestions.push({
        filterName: fieldName,
        filterValue: value,
        resultCount: count as number,
      })
    })

  return suggestions
}

/**
 * Generate refinements from an array of pre-filtered properties
 */
function generateRefinementsFromArray(
  properties: any[],
  filters: PropertyQueryFilters,
  totalCount: number
): RefinementSuggestion[] {
  const suggestions: RefinementSuggestion[] = []

  // Helper to add refinement - shows ALL options so counts add up
  const addRefinement = (
    filterName: string,
    filterValue: string | number | boolean | PriceFilter,
    count: number
  ) => {
    // Show all options with count > 0
    if (count > 0) {
      suggestions.push({
        filterName,
        filterValue,
        resultCount: count,
      })
    }
  }

  // Priority 1: Transaction type (rent/sale)
  if (!filters.transaction_type) {
    const transactionCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.transaction_type) {
        transactionCounts[prop.transaction_type] = (transactionCounts[prop.transaction_type] || 0) + 1
      }
    })
    Object.entries(transactionCounts).forEach(([type, count]) => {
      addRefinement('transaction_type', type, count)
    })
  }

  // Priority 2: Beds
  if (filters.beds === undefined) {
    const bedsCounts: Record<number, number> = {}
    properties.forEach(prop => {
      if (prop.beds !== null && prop.beds !== undefined) {
        bedsCounts[prop.beds] = (bedsCounts[prop.beds] || 0) + 1
      }
    })
    // Sort by number of beds
    Object.entries(bedsCounts)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([beds, count]) => {
        addRefinement('beds', parseInt(beds), count)
      })
  }

  // Priority 3: Baths
  if (filters.baths === undefined) {
    const bathsCounts: Record<number, number> = {}
    properties.forEach(prop => {
      if (prop.baths !== null && prop.baths !== undefined) {
        bathsCounts[prop.baths] = (bathsCounts[prop.baths] || 0) + 1
      }
    })
    // Sort by number of baths
    Object.entries(bathsCounts)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([baths, count]) => {
        addRefinement('baths', parseInt(baths), count)
      })
  }

  // Priority 4: City
  if (!filters.city) {
    const cityCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.city) {
        cityCounts[prop.city] = (cityCounts[prop.city] || 0) + 1
      }
    })
    // Show ALL cities sorted by count to ensure they add up
    Object.entries(cityCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([city, count]) => {
        addRefinement('city', city, count)
      })
  }

  // Priority 5: District
  if (!filters.district) {
    const districtCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.district) {
        districtCounts[prop.district] = (districtCounts[prop.district] || 0) + 1
      }
    })
    // Show ALL districts sorted by count to ensure they add up
    Object.entries(districtCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([district, count]) => {
        addRefinement('district', district, count)
      })
  }

  // Priority 6: Price ranges - show when transaction_type is set OR all properties are of one type
  // Determine the transaction type to use for rounding logic
  const uniqueTransactionTypes = [...new Set(properties.map(p => p.transaction_type).filter(t => t))]
  const hasOnlyOneTransactionType = uniqueTransactionTypes.length === 1
  const effectiveTransactionType = filters.transaction_type || (hasOnlyOneTransactionType ? uniqueTransactionTypes[0] : null)
  
  if (effectiveTransactionType) {
    const prices = properties
      .map(p => Number(p.price))
      .filter(p => !isNaN(p))
      .sort((a, b) => a - b)

    if (prices.length > 0) {
      const minPrice = prices[0]
      const maxPrice = prices[prices.length - 1]
      const priceRange = maxPrice - minPrice

      if (priceRange > 0) {
        // Create three even buckets based on tertiles (33rd and 66th percentiles)
        const tertile1 = prices[Math.floor(prices.length * 0.33)] // 33rd percentile
        const tertile2 = prices[Math.floor(prices.length * 0.66)] // 66th percentile

        // Round to nice numbers
        const roundToNice = (num: number) => {
          if (effectiveTransactionType === 'rent') {
            if (num < 1000) return Math.round(num / 50) * 50
            if (num < 5000) return Math.round(num / 100) * 100
            return Math.round(num / 500) * 500
          }
          if (num < 100000) return Math.round(num / 10000) * 10000
          if (num < 1000000) return Math.round(num / 50000) * 50000
          return Math.round(num / 100000) * 100000
        }

        let roundedTertile1 = roundToNice(tertile1)
        let roundedTertile2 = roundToNice(tertile2)

        // Ensure tertile2 is greater than tertile1 after rounding
        // If they're the same, adjust to ensure three distinct buckets
        if (roundedTertile1 === roundedTertile2) {
          // Find the next price point above tertile1 for the middle bucket
          const pricesAboveTertile1 = prices.filter(p => p > roundedTertile1)
          if (pricesAboveTertile1.length > 0) {
            // Use the actual price at 66th percentile without rounding if rounding caused collision
            roundedTertile2 = Math.ceil(tertile2)
          }
        }

        // Only create buckets if we have distinct values
        const buckets: Array<{ filter: PriceFilter; min?: number; max?: number }> = []
        
        if (roundedTertile1 < roundedTertile2) {
          // We have three distinct buckets
          buckets.push({ filter: { filter: 'under', value: roundedTertile1 }, max: roundedTertile1 })
          buckets.push({ filter: { filter: 'between', value: roundedTertile1, max_value: roundedTertile2 }, min: roundedTertile1, max: roundedTertile2 })
          buckets.push({ filter: { filter: 'over', value: roundedTertile2 }, min: roundedTertile2 })
        } else {
          // Fallback: split into two buckets if we can't create three distinct ones
          buckets.push({ filter: { filter: 'under', value: roundedTertile1 }, max: roundedTertile1 })
          buckets.push({ filter: { filter: 'over', value: roundedTertile1 }, min: roundedTertile1 })
        }

        // Count properties in each bucket
        // Under: exclusive (p < tertile1)
        // Between: inclusive on both ends (p >= tertile1 && p <= tertile2)
        // Over: exclusive (p > tertile2)
        for (const bucket of buckets) {
          const countInBucket = prices.filter(p => {
            if (bucket.min !== undefined && bucket.max !== undefined) {
              // Between bucket: inclusive on both ends
              return p >= bucket.min && p <= bucket.max
            } else if (bucket.max !== undefined) {
              // Under bucket: exclusive (strictly less than)
              return p < bucket.max
            } else if (bucket.min !== undefined) {
              // Over bucket: exclusive (strictly greater than)
              return p > bucket.min
            }
            return false
          }).length

          // Always show price buckets when transaction_type is present
          if (countInBucket > 0) {
            suggestions.push({
              filterName: 'price',
              filterValue: bucket.filter,
              resultCount: countInBucket,
            })
          }
        }
      }
    }
  }

  // Priority 7: Property type
  if (!filters.property_type) {
    const typeCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.property_type) {
        typeCounts[prop.property_type] = (typeCounts[prop.property_type] || 0) + 1
      }
    })
    // Sort by count (most common first)
    Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        addRefinement('property_type', type, count)
      })
  }

  // Priority 8: Furnished type
  if (!filters.furnished_type) {
    const furnishedCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.furnished_type) {
        furnishedCounts[prop.furnished_type] = (furnishedCounts[prop.furnished_type] || 0) + 1
      }
    })
    // Sort by count (most common first)
    Object.entries(furnishedCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        addRefinement('furnished_type', type, count)
      })
  }

  // Priority 9: Has nearby station
  if (filters.has_nearby_station === undefined) {
    const stationCounts: Record<string, number> = { 'true': 0, 'false': 0 }
    properties.forEach(prop => {
      if (prop.has_nearby_station !== null && prop.has_nearby_station !== undefined) {
        const key = prop.has_nearby_station ? 'true' : 'false'
        stationCounts[key] = (stationCounts[key] || 0) + 1
      }
    })
    Object.entries(stationCounts).forEach(([hasStation, count]) => {
      if (count > 0) {
        addRefinement('has_nearby_station', hasStation === 'true', count)
      }
    })
  }

  // Priority 10: Street addresses (fallback when no other refinements narrow results)
  const refinementsThatNarrow = suggestions.filter(s => s.resultCount < totalCount)
  if (refinementsThatNarrow.length === 0 && totalCount > 1) {
    const streetCounts: Record<string, number> = {}
    properties.forEach(prop => {
      if (prop.street_address) {
        streetCounts[prop.street_address] = (streetCounts[prop.street_address] || 0) + 1
      }
    })
    
    // Add street addresses sorted by count
    Object.entries(streetCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([street, count]) => {
        if (count > 0) {
          suggestions.push({
            filterName: 'street_address',
            filterValue: street,
            resultCount: count,
          })
        }
      })
  }

  return suggestions
}

async function generateRefinements(
  supabase: any,
  knowledgeBaseId: string,
  filters: PropertyQueryFilters,
  totalCount: number,
  filteredProperties?: any[] // Optional pre-filtered properties array
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

  // If pre-filtered properties are provided, use them directly
  if (filteredProperties && filteredProperties.length > 0) {
    return generateRefinementsFromArray(filteredProperties, filters, totalCount)
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
      query = query.eq('city', filters.city)
    }
    if (filters.district) {
      query = query.eq('district', filters.district)
    }
    if (filters.county) {
      query = query.eq('county', filters.county)
    }
    if (filters.postcode) {
      query = query.ilike('postcode', `%${filters.postcode}%`)
    }

    return query
  }

  // Helper to add refinement - shows ALL options so counts add up
  const addRefinement = (
    filterName: string,
    filterValue: string | number | boolean,
    count: number
  ) => {
    // Show all options with count > 0
    if (count > 0) {
      suggestions.push({
        filterName,
        filterValue,
        resultCount: count,
      })
    }
  }

  // Priority 1: Transaction type (rent/sale)
  if (!filters.transaction_type) {
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
  }

  // Priority 2: Beds
  if (filters.beds === undefined) {
    const { data: bedsData } = await buildBaseQuery()
      .select('beds')
      .not('beds', 'is', null)

    if (bedsData) {
      const bedsCounts = bedsData.reduce((acc: Record<number, number>, prop: any) => {
        const beds = prop.beds
        acc[beds] = (acc[beds] || 0) + 1
        return acc
      }, {})

      // Sort by number of beds
      Object.entries(bedsCounts)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([beds, count]) => {
          addRefinement('beds', parseInt(beds), count as number)
        })
    }
  }

  // Priority 3: Baths
  if (filters.baths === undefined) {
    const { data: bathsData } = await buildBaseQuery()
      .select('baths')
      .not('baths', 'is', null)

    if (bathsData) {
      const bathsCounts = bathsData.reduce((acc: Record<number, number>, prop: any) => {
        const baths = prop.baths
        acc[baths] = (acc[baths] || 0) + 1
        return acc
      }, {})

      // Sort by number of baths
      Object.entries(bathsCounts)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([baths, count]) => {
          addRefinement('baths', parseInt(baths), count as number)
        })
    }
  }

  // Priority 4: City
  if (!filters.city) {
    const { data: cityData } = await buildBaseQuery()
      .select('city')
      .not('city', 'is', null)

    if (cityData) {
      const cityCounts = cityData.reduce((acc: Record<string, number>, prop: any) => {
        const city = prop.city
        acc[city] = (acc[city] || 0) + 1
        return acc
      }, {})

      // Show ALL cities sorted by count to ensure they add up
      Object.entries(cityCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([city, count]) => {
          addRefinement('city', city, count as number)
        })
    }
  }

  // Priority 5: District
  if (!filters.district) {
    const { data: districtData } = await buildBaseQuery()
      .select('district')
      .not('district', 'is', null)

    if (districtData) {
      const districtCounts = districtData.reduce((acc: Record<string, number>, prop: any) => {
        const district = prop.district
        acc[district] = (acc[district] || 0) + 1
        return acc
      }, {})

      // Show ALL districts sorted by count to ensure they add up
      Object.entries(districtCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([district, count]) => {
          addRefinement('district', district, count as number)
        })
    }
  }

  // Priority 6: County
  if (!filters.county) {
    const { data: countyData } = await buildBaseQuery()
      .select('county')
      .not('county', 'is', null)

    if (countyData) {
      const countyCounts = countyData.reduce((acc: Record<string, number>, prop: any) => {
        const county = prop.county
        acc[county] = (acc[county] || 0) + 1
        return acc
      }, {})

      // Show ALL counties sorted by count to ensure they add up
      Object.entries(countyCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([county, count]) => {
          addRefinement('county', county, count as number)
        })
    }
  }

  // Priority 7: Price ranges - show when transaction_type is set OR all properties are of one type
  // First check if we should show price refinements
  const { data: allPropsForPriceCheck } = await buildBaseQuery()
    .select('transaction_type')
  
  const uniqueTransactionTypes = allPropsForPriceCheck 
    ? [...new Set(allPropsForPriceCheck.map((p: any) => p.transaction_type).filter((t: any) => t))]
    : []
  const hasOnlyOneTransactionType = uniqueTransactionTypes.length === 1
  const effectiveTransactionType = filters.transaction_type || (hasOnlyOneTransactionType ? uniqueTransactionTypes[0] : null)
  
  if (effectiveTransactionType) {
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
        // Create three even buckets based on tertiles (33rd and 66th percentiles)
        const tertile1 = prices[Math.floor(prices.length * 0.33)] // 33rd percentile
        const tertile2 = prices[Math.floor(prices.length * 0.66)] // 66th percentile

        // Round to nice numbers based on transaction type
        const roundToNice = (num: number) => {
          // For rentals (typically £500-£5000/month)
          if (effectiveTransactionType === 'rent') {
            if (num < 1000) return Math.round(num / 50) * 50
            if (num < 5000) return Math.round(num / 100) * 100
            return Math.round(num / 500) * 500
          }
          // For sales (typically £100k-£millions)
          if (num < 100000) return Math.round(num / 10000) * 10000
          if (num < 1000000) return Math.round(num / 50000) * 50000
          return Math.round(num / 100000) * 100000
        }

        let roundedTertile1 = roundToNice(tertile1)
        let roundedTertile2 = roundToNice(tertile2)

        // Ensure tertile2 is greater than tertile1 after rounding
        // If they're the same, adjust to ensure three distinct buckets
        if (roundedTertile1 === roundedTertile2) {
          // Find the next price point above tertile1 for the middle bucket
          const pricesAboveTertile1 = prices.filter((p: number) => p > roundedTertile1)
          if (pricesAboveTertile1.length > 0) {
            // Use the actual price at 66th percentile without rounding if rounding caused collision
            roundedTertile2 = Math.ceil(tertile2)
          }
        }

        // Only create buckets if we have distinct values
        if (roundedTertile1 < roundedTertile2) {
          // We have three distinct buckets
          priceBuckets.push({ 
            filter: { filter: 'under', value: roundedTertile1 }, 
            max: roundedTertile1 
          })
          priceBuckets.push({ 
            filter: { filter: 'between', value: roundedTertile1, max_value: roundedTertile2 }, 
            min: roundedTertile1, 
            max: roundedTertile2 
          })
          priceBuckets.push({ 
            filter: { filter: 'over', value: roundedTertile2 }, 
            min: roundedTertile2 
          })
        } else {
          // Fallback: split into two buckets if we can't create three distinct ones
          priceBuckets.push({ 
            filter: { filter: 'under', value: roundedTertile1 }, 
            max: roundedTertile1 
          })
          priceBuckets.push({ 
            filter: { filter: 'over', value: roundedTertile1 }, 
            min: roundedTertile1 
          })
        }
      }

      // Count properties in each bucket
      // Under: exclusive (p < tertile1)
      // Between: inclusive on both ends (p >= tertile1 && p <= tertile2)
      // Over: exclusive (p > tertile2)
      for (const bucket of priceBuckets) {
        const countInBucket = prices.filter((p: number) => {
          if (bucket.min !== undefined && bucket.max !== undefined) {
            // Between bucket: inclusive on both ends
            return p >= bucket.min && p <= bucket.max
          } else if (bucket.max !== undefined) {
            // Under bucket: exclusive (strictly less than)
            return p < bucket.max
          } else if (bucket.min !== undefined) {
            // Over bucket: exclusive (strictly greater than)
            return p > bucket.min
          }
          return false
        }).length

        // Always show price buckets when transaction_type is present
        if (countInBucket > 0) {
          suggestions.push({
            filterName: 'price',
            filterValue: bucket.filter,
            resultCount: countInBucket,
          })
        }
      }
    }
  }

  // Priority 7: Property type
  if (!filters.property_type) {
    const { data: typeData } = await buildBaseQuery()
      .select('property_type')
      .not('property_type', 'is', null)

    if (typeData) {
      const typeCounts = typeData.reduce((acc: Record<string, number>, prop: any) => {
        const type = prop.property_type
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

      // Sort by count (most common first)
      Object.entries(typeCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([type, count]) => {
          addRefinement('property_type', type, count as number)
        })
    }
  }

  // Priority 8: Furnished type
  if (!filters.furnished_type) {
    const { data: furnishedData } = await buildBaseQuery()
      .select('furnished_type')
      .not('furnished_type', 'is', null)

    if (furnishedData) {
      const furnishedCounts = furnishedData.reduce((acc: Record<string, number>, prop: any) => {
        const type = prop.furnished_type
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {})

      // Sort by count (most common first)
      Object.entries(furnishedCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([type, count]) => {
          addRefinement('furnished_type', type, count as number)
        })
    }
  }

  // Priority 9: Has nearby station
  if (filters.has_nearby_station === undefined) {
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
  }

  // Priority 10: Street addresses (fallback when no other refinements narrow results)
  const refinementsThatNarrow = suggestions.filter(s => s.resultCount < totalCount)
  if (refinementsThatNarrow.length === 0 && totalCount > 1) {
    const { data: streetData } = await buildBaseQuery()
      .select('street_address')
      .not('street_address', 'is', null)

    if (streetData) {
      const streetCounts = streetData.reduce((acc: Record<string, number>, prop: any) => {
        const street = prop.street_address
        acc[street] = (acc[street] || 0) + 1
        return acc
      }, {})

      // Add street addresses sorted by count
      Object.entries(streetCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .forEach(([street, count]) => {
          const countNum = count as number
          if (countNum > 0) {
            suggestions.push({
              filterName: 'street_address',
              filterValue: street,
              resultCount: countNum,
            })
          }
        })
    }
  }

  return suggestions
}

