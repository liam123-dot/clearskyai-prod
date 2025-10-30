import { createClient } from '@/lib/supabase/server'
import { getKnowledgeBase } from '@/lib/knowledge-bases'

/**
 * Generate a voice agent prompt describing available property filters and options
 * for a specific estate agent knowledge base
 */
export async function generatePropertyQueryPrompt(
  knowledgeBaseId: string
): Promise<string> {
  const supabase = await createClient()

  // Get knowledge base details
  const knowledgeBase = await getKnowledgeBase(knowledgeBaseId)
  if (!knowledgeBase || knowledgeBase.type !== 'estate_agent') {
    throw new Error('Knowledge base not found or not an estate agent type')
  }

  // Fetch all properties to analyze available options
  const { data: properties, error } = await supabase
    .from('properties')
    .select('beds, baths, property_type, transaction_type, furnished_type, price, has_nearby_station')
    .eq('knowledge_base_id', knowledgeBaseId)

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`)
  }

  if (!properties || properties.length === 0) {
    return `No properties available for ${knowledgeBase.name}. Please sync properties first.`
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

  return promptParts.join('\n')
}

