import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { queryProperties } from "@/lib/properties";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Query properties with no filters to get all available refinements
    const result = await queryProperties(id, {});

    // Group refinements by filter name and extract unique values
    const filterMap: Record<string, any[]> = {};
    
    result.refinements.forEach((refinement) => {
      if (!filterMap[refinement.filterName]) {
        filterMap[refinement.filterName] = [];
      }
      filterMap[refinement.filterName].push(refinement.filterValue);
    });

    return NextResponse.json({ filters: filterMap });
  } catch (error) {
    console.error("Error getting filters:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
