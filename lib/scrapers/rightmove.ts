/**
 * Rightmove Property Scraper - TypeScript Edition
 * 
 * Simplified scraper for extracting property listings from Rightmove's Next.js website
 */

import * as cheerio from 'cheerio';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Property {
  id: number;
  bedrooms?: number;
  bathrooms?: number;
  numberOfImages: number;
  numberOfFloorplans: number;
  numberOfVirtualTours: number;
  summary?: string;
  displayAddress?: string;
  countryCode?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  propertySubType?: string;
  price: {
    amount: number;
    frequency?: string;
    currencyCode: string;
    displayPrices: any[];
  };
  customer: {
    branchId: number;
    branchDisplayName?: string;
    branchName?: string;
    brandTradingName?: string;
    contactTelephone?: string;
    branchLandingPageUrl?: string;
  };
  propertyUrl?: string;
  transactionType: string;
  propertyImages?: {
    images: any[];
    mainImageSrc?: string;
  };
  firstVisibleDate?: string;
  addedOrReduced?: string;
  propertyTypeFullDescription?: string;
}

export interface ScrapeResult {
  properties: Property[];
  resultCount: number;
  query: any;
}

// ============================================================================
// Core Scraping Functions
// ============================================================================

/**
 * Extract __NEXT_DATA__ from a Rightmove page
 */
async function extractNextData(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  
  const nextDataScript = $('#__NEXT_DATA__');
  
  if (nextDataScript.length === 0) {
    throw new Error('Could not find __NEXT_DATA__ script tag. This might not be a Next.js site.');
  }

  const nextData = JSON.parse(nextDataScript.html() || '{}');

  console.log('Next data:', JSON.stringify(nextData.props.pageProps.searchResults, null, 2))
  
  return {
    fullData: nextData,
    props: nextData.props || {},
    pageProps: nextData.props?.pageProps || {},
    query: nextData.query || {},
    buildId: nextData.buildId || ''
  };
}

/**
 * Scrape properties from a Rightmove search URL
 */
export async function scrapePropertiesFromUrl(url: string): Promise<ScrapeResult> {
  const nextData = await extractNextData(url);
  const searchResults = nextData.pageProps.searchResults;
  
  if (!searchResults || !searchResults.properties) {
    throw new Error('No search results found in page data');
  }

  const properties: Property[] = searchResults.properties.map((prop: any) => ({
    id: prop.id,
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    numberOfImages: prop.numberOfImages || 0,
    numberOfFloorplans: prop.numberOfFloorplans || 0,
    numberOfVirtualTours: prop.numberOfVirtualTours || 0,
    summary: prop.summary,
    displayAddress: prop.displayAddress,
    countryCode: prop.countryCode,
    location: {
      latitude: prop.location?.latitude,
      longitude: prop.location?.longitude
    },
    propertySubType: prop.propertySubType,
    price: {
      amount: prop.price?.amount,
      frequency: prop.price?.frequency,
      currencyCode: prop.price?.currencyCode || 'GBP',
      displayPrices: prop.price?.displayPrices || []
    },
    customer: {
      branchId: prop.customer?.branchId,
      branchDisplayName: prop.customer?.branchDisplayName,
      branchName: prop.customer?.branchName,
      brandTradingName: prop.customer?.brandTradingName,
      contactTelephone: prop.customer?.contactTelephone,
      branchLandingPageUrl: prop.customer?.branchLandingPageUrl
    },
    propertyUrl: prop.propertyUrl,
    transactionType: prop.transactionType,
    propertyImages: {
      images: prop.propertyImages?.images || [],
      mainImageSrc: prop.propertyImages?.mainImageSrc
    },
    firstVisibleDate: prop.firstVisibleDate,
    addedOrReduced: prop.addedOrReduced,
    propertyTypeFullDescription: prop.propertyTypeFullDescription
  }));

  return {
    properties,
    resultCount: searchResults.resultCount || properties.length,
    query: nextData.query
  };
}

/**
 * Get the result count for a search URL without scraping all properties
 */
export async function getResultCount(url: string): Promise<number> {
  const nextData = await extractNextData(url);
  const resultCount = nextData.pageProps.searchResults?.resultCount;
  
  if (typeof resultCount === 'string') {
    return parseInt(resultCount.replace(/,/g, ''));
  }
  
  return resultCount || 0;
}

// ============================================================================
// URL Manipulation Utilities
// ============================================================================

/**
 * Set or update the index parameter in a URL for pagination
 */
export function setUrlIndex(url: string, index: number): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set('index', index.toString());
  return urlObj.toString();
}

/**
 * Set price range filters on a URL
 */
export function setUrlPriceRange(
  url: string, 
  minPrice?: number, 
  maxPrice?: number
): string {
  const urlObj = new URL(url);
  
  if (minPrice !== undefined) {
    urlObj.searchParams.set('minPrice', minPrice.toString());
  } else {
    urlObj.searchParams.delete('minPrice');
  }
  
  if (maxPrice !== undefined) {
    urlObj.searchParams.set('maxPrice', maxPrice.toString());
  } else {
    urlObj.searchParams.delete('maxPrice');
  }
  
  return urlObj.toString();
}

// ============================================================================
// Multi-Page Scraping
// ============================================================================

/**
 * Scrape multiple pages of results
 */
export async function scrapeMultiplePages(
  baseUrl: string, 
  numPages: number,
  onProgress?: (page: number, total: number) => void
): Promise<Property[]> {
  const allProperties: Property[] = [];
  
  for (let page = 0; page < numPages; page++) {
    try {
      const index = page * 24; // 24 results per page
      const url = setUrlIndex(baseUrl, index);
      
      const result = await scrapePropertiesFromUrl(url);
      allProperties.push(...result.properties);
      
      if (onProgress) {
        onProgress(page + 1, numPages);
      }
      
      // Be nice to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error scraping page ${page + 1}:`, error);
      break;
    }
  }
  
  // Remove duplicates based on ID
  const uniqueProperties = Array.from(
    new Map(allProperties.map(prop => [prop.id, prop])).values()
  );
  
  return uniqueProperties;
}

/**
 * Scrape all available results with automatic pagination
 */
export async function scrapeAllResults(
  baseUrl: string,
  onProgress?: (current: number, total: number) => void
): Promise<Property[]> {
  // First, get the total count
  const totalCount = await getResultCount(baseUrl);
  const numPages = Math.ceil(totalCount / 24);
  
  console.log(`Found ${totalCount} properties across ${numPages} pages`);
  
  return scrapeMultiplePages(baseUrl, numPages, onProgress);
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example: Scrape properties from a single page
 */
async function exampleSinglePage() {
  const url = "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=REGION%5E475";
  
  try {
    const result = await scrapePropertiesFromUrl(url);
    console.log(`Found ${result.properties.length} properties`);
    console.log('First property:', JSON.stringify(result.properties[0], null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example: Scrape multiple pages
 */
async function exampleMultiplePages() {
  const url = "https://www.rightmove.co.uk/property-to-rent/find.html?locationIdentifier=REGION%5E475";
  
  try {
    const properties = await scrapeMultiplePages(url, 3, (page, total) => {
      console.log(`Progress: ${page}/${total} pages`);
    });
    
    console.log(`Total properties scraped: ${properties.length}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run examples if this is the main module
if (require.main === module) {
  exampleSinglePage();
}