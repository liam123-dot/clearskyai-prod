/**
 * Zoopla property data from Apify scraper (dhrumil~zoopla-scraper)
 */

export interface ZooplaCoordinates {
  latitude: string
  longitude: string
}

export interface ZooplaPriceHistory {
  action: string
  date: string
  price: string
}

export interface ZooplaPointOfInterest {
  title: string
  distance: string
}

export interface ZooplaProperty {
  // Identifiers
  id: string
  uprn?: string
  url: string
  
  // Basic details
  title: string
  nameOrNumber?: string
  address: string
  
  // Property details
  bedrooms: string
  bathrooms: string
  livingroom?: string
  sizeSqFeet?: string
  floor?: string
  
  // Pricing
  price: string
  priceMin?: string
  priceMax?: string
  
  // Location
  coordinates: ZooplaCoordinates
  postalCode: string
  incode?: string
  outcode?: string
  countyArea?: string
  region?: string
  
  // Property classification
  category: string
  type: 'for-sale' | 'to-rent'
  propertyType: string
  listingsCategory: string
  
  // Energy performance
  epc?: string
  epcRating?: string
  
  // Content
  description: string
  features?: string[]
  
  // Media
  images?: string[]
  
  // Agent information
  agent?: string
  agentPhone?: string
  
  // Historical data
  priceHistory?: ZooplaPriceHistory[]
  
  // Nearby points of interest
  pointsOfInterest?: ZooplaPointOfInterest[]
}

