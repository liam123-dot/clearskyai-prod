import { scrapeAllResults, scrapePropertiesFromUrl } from "@/lib/scrapers/rightmove";
import { NextResponse } from "next/server";

export async function GET() {

    const properties = await scrapeAllResults('https://www.rightmove.co.uk/property-to-rent/find/Tara-and-Co/Leamington-Spa.html?locationIdentifier=BRANCH%5E14581&propertyStatus=all&includeLetAgreed=true&_includeLetAgreed=on')

    return NextResponse.json({ success: true, properties })

}
