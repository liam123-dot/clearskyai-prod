import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { queryProperties, PropertyQueryFilters, PropertyQueryResponse, PriceFilter } from "@/lib/properties";

/**
 * Format property query results as plain text
 */
function formatPropertiesAsText(result: PropertyQueryResponse): string {
  const lines: string[] = [];
  
  // Header with total count
  lines.push(`PROPERTIES (Total: ${result.totalCount})`);
  lines.push('---');
  lines.push('');
  
  // Format each property
  result.properties.forEach((prop, index) => {
    lines.push(`Property ${index + 1}:`);
    lines.push(`Baths: ${prop.baths ?? 'Not specified'}`);
    lines.push(`Price: £${prop.price ?? 'Not specified'}`);
    lines.push(`Property Type: ${prop.property_type ?? 'Not specified'}`);
    lines.push(`Property Subtype: ${prop.property_subtype ?? 'Not specified'}`);
    lines.push(`Title: ${prop.title ?? 'Not specified'}`);
    lines.push(`Transaction Type: ${prop.transaction_type ?? 'Not specified'}`);
    lines.push(`Full Address: ${prop.full_address ?? 'Not specified'}`);
    lines.push(`City: ${prop.city ?? 'Not specified'}`);
    lines.push(`Furnished Type: ${prop.furnished_type ?? 'Not specified'}`);
    lines.push(`Has Nearby Station: ${prop.has_nearby_station ? 'Yes' : 'No'}`);
    lines.push(`Has Online Viewing: ${prop.has_online_viewing ? 'Yes' : 'No'}`);
    lines.push(`Pets Allowed: ${prop.pets_allowed === null ? 'Not specified' : prop.pets_allowed ? 'Yes' : 'No'}`);
    lines.push(`Description: ${prop.description ?? 'Not specified'}`);
    
    // Only include distance if it exists (location-based search)
    if (prop.distance_km !== undefined) {
      lines.push(`Distance: ${prop.distance_km} km`);
    }
    
    lines.push('');
  });
  
  // Format refinements
  lines.push('REFINEMENTS');
  lines.push('---');
  
  if (result.refinements.length === 0) {
    lines.push('No refinements available');
  } else {
    result.refinements.forEach(refinement => {
      const filterLabel = refinement.filterName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      let valueStr: string;
      
      // Handle PriceFilter objects
      if (refinement.filterName === 'price' && typeof refinement.filterValue === 'object' && refinement.filterValue !== null) {
        const priceFilter = refinement.filterValue as PriceFilter;
        if (priceFilter.filter === 'under') {
          valueStr = `under £${priceFilter.value.toLocaleString()}`;
        } else if (priceFilter.filter === 'over') {
          valueStr = `over £${priceFilter.value.toLocaleString()}`;
        } else if (priceFilter.filter === 'between' && priceFilter.max_value !== undefined) {
          valueStr = `£${priceFilter.value.toLocaleString()} - £${priceFilter.max_value.toLocaleString()}`;
        } else {
          valueStr = JSON.stringify(priceFilter);
        }
      } else if (typeof refinement.filterValue === 'string') {
        valueStr = `"${refinement.filterValue}"`;
      } else if (typeof refinement.filterValue === 'boolean') {
        valueStr = refinement.filterValue.toString();
      } else if (typeof refinement.filterValue === 'number') {
        valueStr = refinement.filterValue.toString();
      } else {
        valueStr = String(refinement.filterValue);
      }
      
      const resultStr = refinement.resultCount === 1 ? 'result' : 'results';
      lines.push(`${filterLabel} ${valueStr}: ${refinement.resultCount} ${resultStr}`);
    });
  }
  
  return lines.join('\n');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse request body
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 }
        );
    }
    const filters: PropertyQueryFilters = {
      beds: body.beds,
      baths: body.baths,
      price: body.price,
      transaction_type: body.transaction_type,
      property_type: body.property_type,
      furnished_type: body.furnished_type,
      has_nearby_station: body.has_nearby_station,
      city: body.city,
      district: body.district,
      postcode: body.postcode,
      location: body.location,
      location_radius_km: body.location_radius_km,
    };

    // Validate knowledge base exists and is of type estate_agent
    const supabase = await createServiceClient();
    const { data: knowledgeBase, error: kbError } = await supabase
      .from("knowledge_bases")
      .select("id, type")
      .eq("id", id)
      .single();

    if (kbError || !knowledgeBase) {
      return NextResponse.json(
        { error: "Knowledge base not found" },
        { status: 404 }
      );
    }

    if (knowledgeBase.type !== "estate_agent") {
      return NextResponse.json(
        { error: "Knowledge base must be of type estate_agent" },
        { status: 400 }
      );
    }

    // Query properties with filters
    const result = await queryProperties(id, filters);

    // Format as plain text and wrap in JSON response
    const textResponse = formatPropertiesAsText(result);

    return NextResponse.json({ response: textResponse }, { status: 200 });
  } catch (error) {
    console.error("Error querying properties:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
