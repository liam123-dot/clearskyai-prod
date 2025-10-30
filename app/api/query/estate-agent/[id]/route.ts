import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { queryProperties, PropertyQueryFilters } from "@/lib/properties";

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

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error querying properties:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
