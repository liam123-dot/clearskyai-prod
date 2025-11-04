"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Copy, Check, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface LocationDataSheetProps {
  knowledgeBaseId: string
  knowledgeBaseName: string
  organizationSlug: string
}

interface LocationKeywords {
  cities: string[]
  districts: string[]
  subDistricts: string[]
  postcodeDistricts: string[]
  streets: string[]
}

interface PropertySummary {
  totalCount: number
  rentalCount: number
  saleCount: number
  rentalMinPrice: number | null
  rentalMaxPrice: number | null
  saleMinPrice: number | null
  saleMaxPrice: number | null
  prompt: string
}

export function LocationDataSheet({ 
  knowledgeBaseId, 
  knowledgeBaseName,
  organizationSlug 
}: LocationDataSheetProps) {
  const [locationData, setLocationData] = useState<LocationKeywords | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedLevel, setCopiedLevel] = useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [open, setOpen] = useState(false)
  
  // Selected locality levels (not individual items)
  const [selectedCitiesLevel, setSelectedCitiesLevel] = useState(false)
  const [selectedDistrictsLevel, setSelectedDistrictsLevel] = useState(false)
  const [selectedSubDistrictsLevel, setSelectedSubDistrictsLevel] = useState(false)
  const [selectedPostcodeDistrictsLevel, setSelectedPostcodeDistrictsLevel] = useState(false)
  const [selectedStreetsLevel, setSelectedStreetsLevel] = useState(false)
  
  // Property summary for selected locations
  const [propertySummary, setPropertySummary] = useState<PropertySummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const fetchLocationData = async () => {
    if (locationData) return // Already loaded
    
    setLoading(true)
    try {
      const response = await fetch(`/api/${organizationSlug}/knowledge-bases/${knowledgeBaseId}/location-data`)
      if (!response.ok) {
        throw new Error("Failed to fetch location data")
      }
      const data = await response.json()
      setLocationData(data.locationData)
    } catch (error) {
      toast.error("Failed to load location data")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLevel = async (level: string, keywords: string[]) => {
    if (keywords.length === 0) return

    try {
      const keywordsText = keywords.join(', ')
      await navigator.clipboard.writeText(keywordsText)
      setCopiedLevel(level)
      toast.success(`${level} copied to clipboard`)
      setTimeout(() => setCopiedLevel(null), 2000)
    } catch (error) {
      toast.error(`Failed to copy ${level}`)
      console.error(error)
    }
  }

  const getAllKeywords = (): string[] => {
    if (!locationData) return []
    return [
      ...locationData.cities,
      ...locationData.districts,
      ...locationData.subDistricts,
      ...locationData.postcodeDistricts,
      ...locationData.streets,
    ]
  }

  const handleCopyAllKeywords = async () => {
    const allKeywords = getAllKeywords()
    if (allKeywords.length === 0) return

    try {
      const keywordsText = allKeywords.join(', ')
      await navigator.clipboard.writeText(keywordsText)
      setCopiedLevel('all')
      toast.success("All keywords copied to clipboard")
      setTimeout(() => setCopiedLevel(null), 2000)
    } catch (error) {
      toast.error("Failed to copy keywords")
      console.error(error)
    }
  }

  useEffect(() => {
    if (open && !locationData && !loading) {
      fetchLocationData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Fetch property summary when selections change
  useEffect(() => {
    const hasSelections = 
      selectedCitiesLevel ||
      selectedDistrictsLevel ||
      selectedSubDistrictsLevel ||
      selectedPostcodeDistrictsLevel ||
      selectedStreetsLevel

    if (hasSelections) {
      fetchPropertySummary()
    } else {
      setPropertySummary(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCitiesLevel, selectedDistrictsLevel, selectedSubDistrictsLevel, selectedPostcodeDistrictsLevel, selectedStreetsLevel])

  const fetchPropertySummary = async () => {
    setLoadingSummary(true)
    try {
      // Build query params based on selected locality levels
      const params = new URLSearchParams()
      
      // Include all items from selected levels
      if (selectedCitiesLevel && locationData) {
        params.append('cities', locationData.cities.join(','))
      }
      if (selectedDistrictsLevel && locationData) {
        params.append('districts', locationData.districts.join(','))
      }
      if (selectedSubDistrictsLevel && locationData) {
        params.append('subDistricts', locationData.subDistricts.join(','))
      }
      if (selectedPostcodeDistrictsLevel && locationData) {
        params.append('postcodeDistricts', locationData.postcodeDistricts.join(','))
      }
      if (selectedStreetsLevel && locationData) {
        params.append('streets', locationData.streets.join(','))
      }

      // Request all properties by setting a high pageSize
      params.append('pageSize', '10000')
      
      const response = await fetch(
        `/api/${organizationSlug}/knowledge-bases/${knowledgeBaseId}/properties?${params.toString()}`
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch property summary")
      }
      
      const data = await response.json()
      
      // Use totalCount from pagination for accurate count
      const totalCount = data.pagination?.totalCount || 0
      
      const allProperties = data.properties || []
      const rentalProperties = allProperties.filter((p: any) => p.transaction_type === 'rent')
      const saleProperties = allProperties.filter((p: any) => p.transaction_type === 'sale')
      
      const rentalPrices = rentalProperties.map((p: any) => p.price).filter((p: number | null): p is number => p !== null && p !== undefined)
      const salePrices = saleProperties.map((p: any) => p.price).filter((p: number | null): p is number => p !== null && p !== undefined)
      
      const summary = data.summary
      
      // Build prompt text for the agent - location only
      const promptParts: string[] = []
      promptParts.push(`These are the properties you have available:`)
      promptParts.push('')
      
      // Add location context based on selected levels
      const locationParts: string[] = []
      if (selectedCitiesLevel && locationData) {
        locationParts.push(`Cities: ${locationData.cities.join(', ')}`)
      }
      if (selectedDistrictsLevel && locationData) {
        locationParts.push(`Districts: ${locationData.districts.join(', ')}`)
      }
      if (selectedSubDistrictsLevel && locationData) {
        locationParts.push(`Sub-Districts: ${locationData.subDistricts.join(', ')}`)
      }
      if (selectedPostcodeDistrictsLevel && locationData) {
        locationParts.push(`Postcode Districts: ${locationData.postcodeDistricts.join(', ')}`)
      }
      if (selectedStreetsLevel && locationData) {
        locationParts.push(`Streets: ${locationData.streets.join(', ')}`)
      }
      
      if (locationParts.length > 0) {
        locationParts.forEach(part => promptParts.push(part))
      } else {
        promptParts.push('No locations selected.')
      }
      
      setPropertySummary({
        totalCount: totalCount,
        rentalCount: summary?.rentalCount ?? rentalProperties.length,
        saleCount: summary?.saleCount ?? saleProperties.length,
        rentalMinPrice: summary?.rentalMinPrice ?? (rentalPrices.length > 0 ? Math.min(...rentalPrices) : null),
        rentalMaxPrice: summary?.rentalMaxPrice ?? (rentalPrices.length > 0 ? Math.max(...rentalPrices) : null),
        saleMinPrice: summary?.saleMinPrice ?? (salePrices.length > 0 ? Math.min(...salePrices) : null),
        saleMaxPrice: summary?.saleMaxPrice ?? (salePrices.length > 0 ? Math.max(...salePrices) : null),
        prompt: promptParts.join('\n'),
      })
    } catch (error) {
      console.error('Error fetching property summary:', error)
      toast.error("Failed to load property summary")
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleCopyPrompt = async () => {
    if (!propertySummary?.prompt) return

    try {
      await navigator.clipboard.writeText(propertySummary.prompt)
      setCopiedPrompt(true)
      toast.success("Prompt copied to clipboard")
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch (error) {
      toast.error("Failed to copy prompt")
      console.error(error)
    }
  }


  const formatPrice = (price: number, isRental: boolean) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price) + (isRental ? '/month' : '')
  }

  const totalKeywords = getAllKeywords().length

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" onClick={fetchLocationData}>
          <MapPin className="h-4 w-4 mr-2" />
          View Location Data
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle>Location Keywords</SheetTitle>
          <SheetDescription>
            Location names extracted from properties in {knowledgeBaseName}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">Loading location data...</div>
            </div>
          ) : locationData && totalKeywords > 0 ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Transcription Keywords</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalKeywords} location names organized by locality level
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAllKeywords}
                  disabled={loading}
                >
                  {copiedLevel === 'all' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy All
                    </>
                  )}
                </Button>
              </div>

              {/* Cities */}
              {locationData.cities.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedCitiesLevel}
                        onCheckedChange={(checked) => setSelectedCitiesLevel(checked === true)}
                      />
                      <h4 className="text-xs font-medium">Cities ({locationData.cities.length})</h4>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyLevel('Cities', locationData.cities)}
                    >
                      {copiedLevel === 'Cities' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-background rounded p-2 border text-xs font-mono break-words">
                    {locationData.cities.join(', ')}
                  </div>
                </div>
              )}

              {/* Districts */}
              {locationData.districts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedDistrictsLevel}
                        onCheckedChange={(checked) => setSelectedDistrictsLevel(checked === true)}
                      />
                      <h4 className="text-xs font-medium">Districts ({locationData.districts.length})</h4>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyLevel('Districts', locationData.districts)}
                    >
                      {copiedLevel === 'Districts' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-background rounded p-2 border text-xs font-mono break-words">
                    {locationData.districts.join(', ')}
                  </div>
                </div>
              )}

              {/* Sub-Districts */}
              {locationData.subDistricts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedSubDistrictsLevel}
                        onCheckedChange={(checked) => setSelectedSubDistrictsLevel(checked === true)}
                      />
                      <h4 className="text-xs font-medium">Sub-Districts ({locationData.subDistricts.length})</h4>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyLevel('Sub-Districts', locationData.subDistricts)}
                    >
                      {copiedLevel === 'Sub-Districts' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-background rounded p-2 border text-xs font-mono break-words">
                    {locationData.subDistricts.join(', ')}
                  </div>
                </div>
              )}

              {/* Postcode Districts */}
              {locationData.postcodeDistricts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedPostcodeDistrictsLevel}
                        onCheckedChange={(checked) => setSelectedPostcodeDistrictsLevel(checked === true)}
                      />
                      <h4 className="text-xs font-medium">Postcode Districts ({locationData.postcodeDistricts.length})</h4>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyLevel('Postcode Districts', locationData.postcodeDistricts)}
                    >
                      {copiedLevel === 'Postcode Districts' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-background rounded p-2 border text-xs font-mono break-words">
                    {locationData.postcodeDistricts.join(', ')}
                  </div>
                </div>
              )}

              {/* Streets */}
              {locationData.streets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedStreetsLevel}
                        onCheckedChange={(checked) => setSelectedStreetsLevel(checked === true)}
                      />
                      <h4 className="text-xs font-medium">Streets ({locationData.streets.length})</h4>
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyLevel('Streets', locationData.streets)}
                    >
                      {copiedLevel === 'Streets' ? (
                        <>
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="bg-background rounded p-2 border text-xs font-mono break-words">
                    {locationData.streets.join(', ')}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">No location data available. Sync properties first.</div>
            </div>
          )}

          {/* Property Summary Prompt */}
          {(selectedCitiesLevel || selectedDistrictsLevel || selectedSubDistrictsLevel || selectedPostcodeDistrictsLevel || selectedStreetsLevel) && (
            <div className="bg-muted rounded-lg p-4 space-y-3 border">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Property Availability Prompt</h3>
                {propertySummary?.prompt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPrompt}
                    disabled={loadingSummary}
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Prompt
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {loadingSummary ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading property summary...
                </div>
              ) : propertySummary?.prompt ? (
                <div className="bg-background rounded p-3 border">
                  <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                    {propertySummary.prompt}
                  </pre>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No properties found for selected locations.</div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

