/**
 * Rightmove property data from Apify scraper
 */

export interface RightmoveStation {
  name: string
  distance: number
  unit: string
}

export interface RightmoveTenure {
  tenureType: string | null
  yearsRemainingOnLease: number | null
  message: string | null
}

export interface RightmoveBrochure {
  url: string
  caption: string
}

export interface RightmoveLivingCosts {
  councilTaxExempt: boolean
  councilTaxIncluded: boolean
  annualGroundRent: number | null
  groundRentReviewPeriodInYears: number | null
  groundRentPercentageIncrease: number | null
  annualServiceCharge: number | null
  councilTaxBand: string | null
  domesticRates: string | null
}

export interface RightmoveBranch {
  branchId: number
  branchName: string
  branchPostcode: string | null
  brandName: string
  companyName: string
  companyTradingName: string | null
  companyType: string
  displayAddress: string
  phone: string
}

export interface RightmoveLettings {
  letAvailableDate: string | null
  deposit: number | null
  minimumTermInMonths: number | null
  letType: string | null
  furnishType: string | null
}

export interface RightmoveSize {
  unit: string
  min: number | null
  max: number | null
}

export interface RightmoveProperty {
  url: string
  id: string
  address: string
  baths: number | null
  beds: number | null
  isBusinessForSale: boolean
  isCommercial: boolean
  latitude: number | null
  longitude: number | null
  description: string
  title: string
  tenure: RightmoveTenure
  soldPropertyType: string
  sizes: RightmoveSize[]
  propertySubType: string | null
  nearestStations: RightmoveStation[]
  nearestAirports: unknown[]
  brochures: RightmoveBrochure[]
  livingCosts: RightmoveLivingCosts
  branch: RightmoveBranch
  addedOn: string
  furnishedType: string | null
  lettings: RightmoveLettings | null
  ownership: string
  preOwned: string
  price: number
  propertyType: string
  isRetirement: boolean
  hasOnlineViewing: boolean
  images: string[]
  floorplans: string[]
  features: string[]
  primaryPrice: string
  secondaryPrice: string | null
  pricePerSqFt: number | null
}

