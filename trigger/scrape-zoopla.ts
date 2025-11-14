import { task, logger } from "@trigger.dev/sdk/v3"
import { ApifyClient } from "apify-client"
import { createNoCookieClient } from "@/lib/supabase/serverNoCookies"
import type { ZooplaProperty } from "@/types/zoopla"
import type { EstateAgentKnowledgeBaseData, Property } from "@/lib/knowledge-bases"
import { normalizeAddress } from "@/lib/address-normalization"
import { extractLocationKeywords } from "@/lib/property-prompt"

interface ScrapeZooplaPayload {
  knowledgeBaseId: string
}

/**
 * Parse Zoopla price string (e.g., "£6,900,000") to numeric value
 * Handles cases where price might be a string, number, or null/undefined
 */
function parseZooplaPrice(price: string | number | null | undefined): number {
  // Handle null/undefined
  if (price == null) {
    return 0
  }
  
  // If already a number, return it
  if (typeof price === 'number') {
    return price
  }
  
  // If it's a string, parse it
  if (typeof price === 'string') {
    // Remove £, commas, and any other non-numeric characters except decimal point
    const numericString = price.replace(/[£,]/g, '')
    return parseFloat(numericString) || 0
  }
  
  // Fallback for any other type
  return 0
}

/**
 * Scrape Zoopla properties and store in database
 * Triggered when an estate agent knowledge base with Zoopla platform is created or needs re-sync
 */
export const scrapeZoopla = task({
  id: "scrape-zoopla",
  maxDuration: 300, // 5 minutes
  run: async (payload: ScrapeZooplaPayload) => {
    const { knowledgeBaseId } = payload
    
    logger.info("🏠 Starting Zoopla scraper", { knowledgeBaseId })

    // Get knowledge base details
    const supabase = createNoCookieClient()
    
    const { data: knowledgeBase, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("*")
      .eq("id", knowledgeBaseId)
      .single()

    if (kbError || !knowledgeBase) {
      throw new Error(`Knowledge base not found: ${kbError?.message || "Unknown error"}`)
    }

    if (knowledgeBase.type !== "estate_agent") {
      throw new Error(`Knowledge base type must be estate_agent, got: ${knowledgeBase.type}`)
    }

    const data = knowledgeBase.data as EstateAgentKnowledgeBaseData
    const { for_sale_url, rental_url } = data

    // Build URLs array
    const urls: { url: string }[] = []
    if (for_sale_url) urls.push({ url: for_sale_url })
    if (rental_url) urls.push({ url: rental_url })

    if (urls.length === 0) {
      logger.warn("⚠️  No URLs configured for knowledge base")
      return { success: true, propertiesScraped: 0 }
    }

    logger.info("🔍 Fetching properties from Apify", { 
      forSaleUrl: for_sale_url || "not provided",
      rentalUrl: rental_url || "not provided",
      urlCount: urls.length
    })

    // Initialize Apify client
    const apiToken = process.env.APIFY_API_KEY
    if (!apiToken) {
      throw new Error("APIFY_API_KEY environment variable not configured")
    }

    const client = new ApifyClient({ token: apiToken })

    // Configure and run Apify actor (dhrumil~zoopla-scraper)
    const input = {
      addEmptyTrackerRecord: false,
      enableDelistingTracker: false,
      fullPropertyDetails: true,
      listUrls: urls,
      monitoringMode: false,
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "GB"
      },
      email: ""
    }

    logger.info("  ↳ Starting Apify actor run...")
    const run = await client.actor("dhrumil~zoopla-scraper").call(input)

    // Fetch all items from dataset
    logger.info("  ↳ Fetching dataset...")
    const allProperties: ZooplaProperty[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const { items, total } = await client.dataset(run.defaultDatasetId).listItems({
        offset,
        limit,
      })

      allProperties.push(...(items as unknown as ZooplaProperty[]))
      
      logger.info(`  ↳ Fetched batch: ${items.length} properties (${allProperties.length}/${total} total)`)

      if (allProperties.length >= total || items.length === 0) {
        break
      }

      offset += items.length
    }

    logger.info("✅ Dataset fetched from Apify", { totalProperties: allProperties.length })

    if (allProperties.length === 0) {
      logger.warn("⚠️  No properties found")
      return { success: true, propertiesScraped: 0 }
    }

    // Delete existing properties for this knowledge base first
    logger.info("🗑️  Deleting existing properties for this knowledge base...")
    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .eq("knowledge_base_id", knowledgeBaseId)

    if (deleteError) {
      logger.error("❌ Failed to delete existing properties", { error: deleteError.message })
      throw new Error(`Failed to delete existing properties: ${deleteError.message}`)
    }

    logger.info("✅ Existing properties deleted")

    // Transform properties for insertion
    logger.info("💾 Inserting properties into database...")
    
    // Normalize addresses in batches to avoid rate limits
    const propertyRecords = await Promise.all(
      allProperties.map(async (prop) => {
        // Determine transaction type: 'for-sale' -> 'sale', 'to-rent' -> 'rent'
        const transactionType = prop.type === 'to-rent' ? 'rent' : 'sale'

        // Normalize address using AI
        let normalizedAddress
        try {
          normalizedAddress = await normalizeAddress(prop.address)
          logger.info(`Normalized address: "${prop.address}" -> ${JSON.stringify(normalizedAddress)}`)
        } catch (error) {
          logger.warn(`Failed to normalize address "${prop.address}": ${error instanceof Error ? error.message : String(error)}`)
          // Fallback to simple parsing
          const addressParts = prop.address.split(", ")
          normalizedAddress = {
            street_address: addressParts.slice(0, -2).join(", ") || null,
            city: addressParts[addressParts.length - 2] || null,
            district: addressParts[addressParts.length - 3] || null,
            postcode: prop.postalCode || null,
            county: prop.countyArea || null,
          }
        }

        // Parse bedroom and bathroom counts
        const beds = prop.bedrooms ? parseInt(prop.bedrooms, 10) : null
        const baths = prop.bathrooms ? parseInt(prop.bathrooms, 10) : null

        // Parse price
        const price = parseZooplaPrice(prop.price)

        // Parse coordinates
        const latitude = prop.coordinates?.latitude ? parseFloat(prop.coordinates.latitude) : null
        const longitude = prop.coordinates?.longitude ? parseFloat(prop.coordinates.longitude) : null

        return {
          knowledge_base_id: knowledgeBaseId,
          source: "zoopla",
          external_id: prop.uprn || prop.id,
          url: prop.url,
          beds: beds,
          baths: baths,
          price: price,
          property_type: prop.propertyType,
          property_subtype: null, // Zoopla doesn't provide subtype in the same way
          title: prop.title,
          transaction_type: transactionType,
          street_address: normalizedAddress.street_address,
          city: normalizedAddress.city,
          district: normalizedAddress.district,
          postcode: prop.postalCode || normalizedAddress.postcode,
          postcode_district: prop.outcode || prop.postalCode?.split(" ")[0] || null,
          county: prop.countyArea || normalizedAddress.county,
          full_address: prop.address,
          latitude: latitude,
          longitude: longitude,
          // Rental-specific fields - Zoopla doesn't provide these in the same detail as Rightmove
          deposit: null,
          let_available_date: null,
          minimum_term_months: null,
          let_type: null,
          furnished_type: null,
          // Sale-specific fields - Zoopla doesn't provide tenure info in basic scrape
          tenure_type: null,
          years_remaining_lease: null,
          // Boolean flags
          has_online_viewing: false, // Not available in Zoopla data
          is_retirement: false,
          is_shared_ownership: false,
          pets_allowed: null,
          bills_included: null,
          // Media
          image_count: prop.images?.length || 0,
          has_floorplan: false, // Not directly available in the data
          has_virtual_tour: false,
          // Content
          description: prop.description,
          features: prop.features || [],
          // Metadata - Zoopla doesn't provide addedOn in the same format
          added_on: null,
          scraped_at: new Date().toISOString(),
          // Store full original data
          original_data: prop,
        }
      })
    )

    // Insert in batches
    const BATCH_SIZE = 100
    let insertedCount = 0

    for (let i = 0; i < propertyRecords.length; i += BATCH_SIZE) {
      const batch = propertyRecords.slice(i, i + BATCH_SIZE)
      
      const { error: insertError, data: insertedData } = await supabase
        .from("properties")
        .insert(batch)
        .select()

      if (insertError) {
        logger.error("❌ Failed to insert batch", {
          batchStart: i,
          batchSize: batch.length,
          error: insertError.message,
          details: insertError
        })
        throw new Error(`Failed to insert properties: ${insertError.message}`)
      }

      insertedCount += batch.length
      logger.info(`  ↳ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(propertyRecords.length / BATCH_SIZE)} (${batch.length} properties)`)
    }

    logger.info("🎉 Zoopla scraping completed", {
      knowledgeBaseId,
      propertiesScraped: insertedCount
    })

    // Extract and cache location keywords
    if (insertedCount > 0) {
      try {
        logger.info("📍 Extracting location keywords from properties...")
        
        // Fetch all properties for this knowledge base
        const { data: properties, error: fetchError } = await supabase
          .from("properties")
          .select("id, latitude, longitude")
          .eq("knowledge_base_id", knowledgeBaseId)

        if (fetchError) {
          logger.warn("⚠️  Failed to fetch properties for location extraction", { error: fetchError.message })
        } else if (properties && properties.length > 0) {
          // Fetch full property data needed for extraction
          const { data: fullProperties, error: fullFetchError } = await supabase
            .from("properties")
            .select("*")
            .eq("knowledge_base_id", knowledgeBaseId)

          if (fullFetchError) {
            logger.warn("⚠️  Failed to fetch full property data for location extraction", { error: fullFetchError.message })
          } else if (fullProperties) {
            const locationKeywords = await extractLocationKeywords(fullProperties as Property[])
            
            // Update knowledge base with location data
            const { error: updateError } = await supabase
              .from("knowledge_bases")
              .update({ location_data: locationKeywords })
              .eq("id", knowledgeBaseId)

            if (updateError) {
              logger.warn("⚠️  Failed to update knowledge base with location data", { error: updateError.message })
            } else {
              logger.info("✅ Location keywords extracted and cached", {
                cities: locationKeywords.cities.length,
                districts: locationKeywords.districts.length,
                subDistricts: locationKeywords.subDistricts.length,
                postcodeDistricts: locationKeywords.postcodeDistricts.length,
                streets: locationKeywords.streets.length,
              })
            }
          }
        }
      } catch (error) {
        logger.warn("⚠️  Error extracting location keywords (non-fatal)", { 
          error: error instanceof Error ? error.message : String(error) 
        })
        // Don't fail the task if location extraction fails
      }
    }

    return {
      success: true,
      propertiesScraped: insertedCount,
    }
  },
})

