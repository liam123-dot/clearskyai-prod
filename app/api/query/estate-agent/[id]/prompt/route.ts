import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generatePropertyQueryPrompt } from "@/lib/property-prompt";

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

    // Generate the prompt
    const prompt = await generatePropertyQueryPrompt(id);

    return NextResponse.json({ prompt }, { status: 200 });
  } catch (error) {
    console.error("Error generating property query prompt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

