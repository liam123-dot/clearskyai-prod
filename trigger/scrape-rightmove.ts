import { task, logger } from "@trigger.dev/sdk/v3"
import { ApifyClient } from "apify-client"
import { createTriggerClient } from "@/lib/supabase/trigger"
import type { RightmoveProperty } from "@/types/rightmove"
import type { EstateAgentKnowledgeBaseData, Property } from "@/lib/knowledge-bases"
import { normalizeAddress } from "@/lib/address-normalization"
import { extractLocationKeywords } from "@/lib/property-prompt"

interface ScrapeRightmovePayload {
  knowledgeBaseId: string
}

/**
 * Scrape Rightmove properties and store in database
 * Triggered when an estate agent knowledge base is created or needs re-sync
 */
export const scrapeRightmove = task({
  id: "scrape-rightmove",
  maxDuration: 300, // 5 minutes
  run: async (payload: ScrapeRightmovePayload) => {
    const { knowledgeBaseId } = payload
    
    logger.info("🏠 Starting Rightmove scraper", { knowledgeBaseId })

    // Get knowledge base details
    const supabase = createTriggerClient()
    
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
    const urls: string[] = []
    if (for_sale_url) urls.push(for_sale_url)
    if (rental_url) urls.push(rental_url)

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

    // Configure and run Apify actor
    const input = {
      startUrls: urls,
      customMapFunction: "(object) => { return {...object} }",
      extendOutputFunction: "($) => { return {} }",
      proxy: {
        useApifyProxy: true,
      },
    }

    logger.info("  ↳ Starting Apify actor run...")
    const run = await client.actor("LwR6JRNl4khcKXIWo").call(input)

    // Fetch all items from dataset
    logger.info("  ↳ Fetching dataset...")
    const allProperties: RightmoveProperty[] = []
    let offset = 0
    const limit = 1000

    while (true) {
      const { items, total } = await client.dataset(run.defaultDatasetId).listItems({
        offset,
        limit,
      })

      
      allProperties.push(...(items as unknown as RightmoveProperty[]))
      
      logger.info("  ↳ Fetched batch: ", { allProperties })
      
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
        // Determine transaction type
        const transactionType = prop.lettings ? "rent" : "sale"

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
            postcode: addressParts[addressParts.length - 1] || null,
            county: null,
          }
        }

        return {
          knowledge_base_id: knowledgeBaseId,
          source: "rightmove",
          rightmove_id: prop.id,
          url: prop.url,
          beds: prop.beds,
          baths: prop.baths,
          price: prop.price,
          property_type: prop.propertyType,
          property_subtype: prop.propertySubType,
          title: prop.title,
          transaction_type: transactionType,
          street_address: normalizedAddress.street_address,
          city: normalizedAddress.city,
          district: normalizedAddress.district,
          postcode: normalizedAddress.postcode,
          postcode_district: normalizedAddress.postcode?.split(" ")[0] || null,
          county: normalizedAddress.county,
          full_address: prop.address,
          latitude: prop.latitude,
          longitude: prop.longitude,
          // Rental-specific fields
          deposit: prop.lettings?.deposit || null,
          let_available_date: prop.lettings?.letAvailableDate || null,
          minimum_term_months: prop.lettings?.minimumTermInMonths || null,
          let_type: prop.lettings?.letType || null,
          furnished_type: prop.furnishedType,
          // Sale-specific fields
          tenure_type: prop.tenure?.tenureType || null,
          years_remaining_lease: prop.tenure?.yearsRemainingOnLease || null,
          // Boolean flags
          has_online_viewing: prop.hasOnlineViewing,
          is_retirement: prop.isRetirement,
          is_shared_ownership: prop.ownership?.toLowerCase().includes("shared") || false,
          pets_allowed: prop.features?.some((f) => 
            f.toLowerCase().includes("pet")
          ) || null,
          bills_included: prop.features?.some((f) => 
            f.toLowerCase().includes("bill") && f.toLowerCase().includes("included")
          ) || null,
          // Media
          image_count: prop.images?.length || 0,
          has_floorplan: (prop.floorplans?.length || 0) > 0,
          has_virtual_tour: prop.brochures?.some((b) => 
            b.caption.toLowerCase().includes("virtual")
          ) || false,
          // Content
          description: prop.description,
          features: prop.features || [],
          // Metadata
          added_on: prop.addedOn,
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

    logger.info("🎉 Rightmove scraping completed", {
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

