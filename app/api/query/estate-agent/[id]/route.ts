import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { queryProperties, PropertyQueryFilters, PropertyQueryResponse, PriceFilter } from "@/lib/properties";

/**
 * Format property query results as plain text
 */
function formatPropertiesAsText(result: PropertyQueryResponse, filters: PropertyQueryFilters): string {
  const lines: string[] = [];
  
  // Filter out refinements that don't narrow results (resultCount === totalCount)
  const narrowingRefinements = result.refinements.filter(r => r.resultCount < result.totalCount);
  
  // Find implied filters (refinements where resultCount === totalCount)
  const impliedFilters = result.refinements.filter(r => r.resultCount === result.totalCount);
  
  // Build summary of active filters
  const activeFilters: string[] = [];
  
  // Add explicit filters from request
  if (filters.transaction_type) {
    activeFilters.push(`Transaction Type: ${filters.transaction_type}`);
  }
  if (filters.beds !== undefined) {
    activeFilters.push(`${filters.beds} ${filters.beds === 1 ? 'bed' : 'beds'}`);
  }
  if (filters.baths !== undefined) {
    activeFilters.push(`${filters.baths} ${filters.baths === 1 ? 'bath' : 'baths'}`);
  }
  if (filters.city) {
    activeFilters.push(`City: ${filters.city}`);
  }
  if (filters.district) {
    activeFilters.push(`District: ${filters.district}`);
  }
  if (filters.postcode) {
    activeFilters.push(`Postcode: ${filters.postcode}`);
  }
  if (filters.county) {
    activeFilters.push(`County: ${filters.county}`);
  }
  if (filters.street) {
    activeFilters.push(`Street: ${filters.street}`);
  }
  if (filters.property_type) {
    activeFilters.push(`Property Type: ${filters.property_type}`);
  }
  if (filters.furnished_type) {
    activeFilters.push(`Furnished Type: ${filters.furnished_type}`);
  }
  if (filters.has_nearby_station !== undefined) {
    activeFilters.push(`Has Nearby Station: ${filters.has_nearby_station ? 'Yes' : 'No'}`);
  }
  if (filters.price) {
    const priceFilter = filters.price;
    if (priceFilter.filter === 'under') {
      activeFilters.push(`Price: under £${priceFilter.value.toLocaleString()}`);
    } else if (priceFilter.filter === 'over') {
      activeFilters.push(`Price: over £${priceFilter.value.toLocaleString()}`);
    } else if (priceFilter.filter === 'between' && priceFilter.max_value !== undefined) {
      activeFilters.push(`Price: £${priceFilter.value.toLocaleString()} - £${priceFilter.max_value.toLocaleString()}`);
    }
  }
  
  // Add implied filters (where all results match)
  // Only add if not already explicitly filtered
  impliedFilters.forEach(refinement => {
    // Skip if this filter is already explicitly set
    if (refinement.filterName === 'transaction_type' && filters.transaction_type) return;
    if (refinement.filterName === 'beds' && filters.beds !== undefined) return;
    if (refinement.filterName === 'baths' && filters.baths !== undefined) return;
    if (refinement.filterName === 'city' && filters.city) return;
    if (refinement.filterName === 'district' && filters.district) return;
    if (refinement.filterName === 'county' && filters.county) return;
    if (refinement.filterName === 'street' && filters.street) return;
    if (refinement.filterName === 'postcode' && filters.postcode) return;
    if (refinement.filterName === 'property_type' && filters.property_type) return;
    if (refinement.filterName === 'furnished_type' && filters.furnished_type) return;
    if (refinement.filterName === 'has_nearby_station' && filters.has_nearby_station !== undefined) return;
    if (refinement.filterName === 'price' && filters.price) return;
    
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
      valueStr = refinement.filterValue;
    } else if (typeof refinement.filterValue === 'boolean') {
      valueStr = refinement.filterValue ? 'Yes' : 'No';
    } else if (typeof refinement.filterValue === 'number') {
      valueStr = refinement.filterValue.toString();
    } else {
      valueStr = String(refinement.filterValue);
    }
    
    // Format based on filter type
    if (refinement.filterName === 'transaction_type') {
      activeFilters.push(`All properties are ${valueStr}`);
    } else if (refinement.filterName === 'beds') {
      activeFilters.push(`All properties have ${valueStr} ${valueStr === '1' ? 'bed' : 'beds'}`);
    } else if (refinement.filterName === 'baths') {
      activeFilters.push(`All properties have ${valueStr} ${valueStr === '1' ? 'bath' : 'baths'}`);
    } else {
      activeFilters.push(`All properties: ${filterLabel} ${valueStr}`);
    }
  });
  
  // Header with total count
  lines.push(`PROPERTIES (Total: ${result.totalCount})`);
  lines.push('---');
  lines.push('');
  
  // Display active filters summary
  if (activeFilters.length > 0) {
    lines.push('ACTIVE FILTERS:');
    activeFilters.forEach(filter => {
      lines.push(`- ${filter}`);
    });
    lines.push('');
  }
  
  // Handle case where no properties are returned (only refinements)
  if (result.properties.length === 0) {
    lines.push('No properties returned. Please use the refinements below to narrow your search.');
    lines.push('');
  } else {
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
      
      lines.push('');
    });
  }
  
  // Format refinements (only show those that can narrow results)
  lines.push('REFINEMENTS');
  lines.push('---');
  
  if (narrowingRefinements.length === 0) {
    lines.push('No refinements available');
  } else {
    narrowingRefinements.forEach(refinement => {
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
      county: body.county,
      street: body.street,
      postcode: body.postcode,
      include_all: body.include_all ?? false,
    };

    // Check if request is from test query component
    const fromTestQuery = body._fromTestQuery === true;

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
    const textResponse = formatPropertiesAsText(result, filters);

    // Only include refinements if request is from test query component
    const response: { response: string; refinements?: typeof result.refinements; totalCount?: number } = {
      response: textResponse,
    };

    if (fromTestQuery) {
      response.refinements = result.refinements;
      response.totalCount = result.totalCount;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error querying properties:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
