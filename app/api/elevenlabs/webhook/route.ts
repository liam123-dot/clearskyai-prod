import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {

    const data = await request.json();
    console.log(JSON.stringify(data, null, 2));
    return NextResponse.json({ message: 'Webhook received', data: data });
}