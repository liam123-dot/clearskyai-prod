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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface TestQuerySheetProps {
  knowledgeBaseId: string
  knowledgeBaseName: string
}

interface PriceFilter {
  filter: 'under' | 'over' | 'between'
  value: number
  max_value?: number
}

interface QueryFilters {
  transaction_type?: 'rent' | 'sale'
  beds?: number
  baths?: number
  price?: PriceFilter
  property_type?: string
  furnished_type?: string
  has_nearby_station?: boolean
  location?: string
  include_all?: boolean
}

interface RefinementSuggestion {
  filterName: string
  filterValue: string | number | boolean | PriceFilter
  resultCount: number
}

export function TestQuerySheet({ knowledgeBaseId, knowledgeBaseName }: TestQuerySheetProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string | null>(null)
  const [refinements, setRefinements] = useState<RefinementSuggestion[]>([])
  const [loadingRefinements, setLoadingRefinements] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(0)
  
  // Form state
  const [transactionType, setTransactionType] = useState<'rent' | 'sale' | ''>('')
  const [beds, setBeds] = useState<string>('')
  const [baths, setBaths] = useState<string>('')
  const [priceFilterType, setPriceFilterType] = useState<'under' | 'over' | 'between' | ''>('')
  const [priceValue, setPriceValue] = useState<string>('')
  const [priceMaxValue, setPriceMaxValue] = useState<string>('')
  const [propertyType, setPropertyType] = useState<string>('')
  const [furnishedType, setFurnishedType] = useState<string>('')
  const [hasNearbyStation, setHasNearbyStation] = useState<boolean | undefined>(undefined)
  const [location, setLocation] = useState<string>('')
  const [includeAll, setIncludeAll] = useState<boolean>(false)

  // Fetch refinements when sheet opens
  useEffect(() => {
    if (open && refinements.length === 0 && !loadingRefinements) {
      fetchRefinements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchRefinements = async () => {
    setLoadingRefinements(true)
    try {
      const response = await fetch(`/api/query/estate-agent/${knowledgeBaseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _fromTestQuery: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.refinements && Array.isArray(data.refinements)) {
          setRefinements(data.refinements)
        }
        if (data.totalCount !== undefined) {
          setTotalCount(data.totalCount)
        }
      }
    } catch (error) {
      console.error('Failed to fetch refinements:', error)
    } finally {
      setLoadingRefinements(false)
    }
  }

  // Group refinements by filter name for easy access and sort appropriately
  const refinementsByFilter = refinements.reduce((acc, ref) => {
    if (!acc[ref.filterName]) {
      acc[ref.filterName] = []
    }
    acc[ref.filterName].push(ref)
    return acc
  }, {} as Record<string, RefinementSuggestion[]>)

  // Sort refinements appropriately
  Object.keys(refinementsByFilter).forEach(filterName => {
    if (filterName === 'beds' || filterName === 'baths') {
      // Sort numerically
      refinementsByFilter[filterName].sort((a, b) => {
        if (typeof a.filterValue === 'number' && typeof b.filterValue === 'number') {
          return a.filterValue - b.filterValue
        }
        return 0
      })
    } else {
      // Sort by result count (most common first)
      refinementsByFilter[filterName].sort((a, b) => b.resultCount - a.resultCount)
    }
  })

  const buildFilters = (): QueryFilters => {
    const filters: QueryFilters = {}

    if (transactionType) {
      filters.transaction_type = transactionType as 'rent' | 'sale'
    }
    if (beds) {
      const bedsNum = parseInt(beds)
      if (!isNaN(bedsNum)) {
        filters.beds = bedsNum
      }
    }
    if (baths) {
      const bathsNum = parseInt(baths)
      if (!isNaN(bathsNum)) {
        filters.baths = bathsNum
      }
    }
    if (priceFilterType && priceValue) {
      const priceNum = parseFloat(priceValue)
      if (!isNaN(priceNum)) {
        const priceFilter: PriceFilter = {
          filter: priceFilterType as 'under' | 'over' | 'between',
          value: priceNum,
        }
        if (priceFilterType === 'between' && priceMaxValue) {
          const maxPriceNum = parseFloat(priceMaxValue)
          if (!isNaN(maxPriceNum)) {
            priceFilter.max_value = maxPriceNum
          }
        }
        filters.price = priceFilter
      }
    }
    if (propertyType) {
      filters.property_type = propertyType
    }
    if (furnishedType) {
      filters.furnished_type = furnishedType
    }
    if (hasNearbyStation !== undefined) {
      filters.has_nearby_station = hasNearbyStation
    }
    if (location) {
      filters.location = location
    }
    if (includeAll) {
      filters.include_all = true
    }

    return filters
  }


  const handleSearch = async () => {
    setLoading(true)
    setResults(null)
    
    try {
      const filters = buildFilters()
      // Add flag to indicate this request is from the test query component
      const requestBody = {
        ...filters,
        _fromTestQuery: true,
      }
      
      const response = await fetch(`/api/query/estate-agent/${knowledgeBaseId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to query properties')
      }

      const data = await response.json()
      setResults(data.response || 'No results returned')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to query properties')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setTransactionType('')
    setBeds('')
    setBaths('')
    setPriceFilterType('')
    setPriceValue('')
    setPriceMaxValue('')
    setPropertyType('')
    setFurnishedType('')
    setHasNearbyStation(undefined)
    setLocation('')
    setIncludeAll(false)
    setResults(null)
    // Reset and refetch refinements after clearing
    setRefinements([])
    setTotalCount(0)
    fetchRefinements()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Search className="h-4 w-4 mr-2" />
          Test Query Function
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto p-4">
        <SheetHeader>
          <SheetTitle>Test Query Function</SheetTitle>
          <SheetDescription>
            Test property search queries for {knowledgeBaseName}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Basic Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transaction-type">Transaction Type</Label>
                <Select 
                  value={transactionType || undefined} 
                  onValueChange={(value) => setTransactionType(value === 'none' ? '' : value as 'rent' | 'sale' | '')}
                >
                  <SelectTrigger id="transaction-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="beds">Beds</Label>
                <Select 
                  value={beds || undefined} 
                  onValueChange={(value) => setBeds(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="beds">
                    <SelectValue placeholder="Select beds" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {refinementsByFilter['beds']?.map((ref) => {
                      if (typeof ref.filterValue === 'number') {
                        return (
                          <SelectItem key={ref.filterValue} value={ref.filterValue.toString()}>
                            {ref.filterValue} {ref.filterValue === 1 ? 'bed' : 'beds'}
                          </SelectItem>
                        )
                      }
                      return null
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baths">Baths</Label>
                <Select 
                  value={baths || undefined} 
                  onValueChange={(value) => setBaths(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="baths">
                    <SelectValue placeholder="Select baths" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {refinementsByFilter['baths']?.map((ref) => {
                      if (typeof ref.filterValue === 'number') {
                        return (
                          <SelectItem key={ref.filterValue} value={ref.filterValue.toString()}>
                            {ref.filterValue} {ref.filterValue === 1 ? 'bath' : 'baths'}
                          </SelectItem>
                        )
                      }
                      return null
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="property-type">Property Type</Label>
                <Select 
                  value={propertyType || undefined} 
                  onValueChange={(value) => setPropertyType(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="property-type">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {refinementsByFilter['property_type']?.map((ref) => {
                      if (typeof ref.filterValue === 'string') {
                        return (
                          <SelectItem key={ref.filterValue} value={ref.filterValue}>
                            {ref.filterValue}
                          </SelectItem>
                        )
                      }
                      return null
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="furnished-type">Furnished Type</Label>
                <Select 
                  value={furnishedType || undefined} 
                  onValueChange={(value) => setFurnishedType(value === 'none' ? '' : value)}
                >
                  <SelectTrigger id="furnished-type">
                    <SelectValue placeholder="Select furnished type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {refinementsByFilter['furnished_type']?.map((ref) => {
                      if (typeof ref.filterValue === 'string') {
                        return (
                          <SelectItem key={ref.filterValue} value={ref.filterValue}>
                            {ref.filterValue}
                          </SelectItem>
                        )
                      }
                      return null
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="has-nearby-station">Has Nearby Station</Label>
                <Select 
                  value={hasNearbyStation === true ? 'true' : hasNearbyStation === false ? 'false' : 'none'} 
                  onValueChange={(value) => {
                    if (value === 'true') setHasNearbyStation(true)
                    else if (value === 'false') setHasNearbyStation(false)
                    else setHasNearbyStation(undefined)
                  }}
                >
                  <SelectTrigger id="has-nearby-station">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    <SelectItem value="true">Yes</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Price Filter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Price Filter</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price-filter-type">Filter Type</Label>
                <Select 
                  value={priceFilterType || undefined} 
                  onValueChange={(value) => setPriceFilterType(value === 'none' ? '' : value as 'under' | 'over' | 'between' | '')}
                >
                  <SelectTrigger id="price-filter-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="under">Under</SelectItem>
                    <SelectItem value="over">Over</SelectItem>
                    <SelectItem value="between">Between</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price-value">Price Value (£)</Label>
                <Input
                  id="price-value"
                  type="number"
                  placeholder="e.g. 1000"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  disabled={!priceFilterType}
                />
              </div>

              {priceFilterType === 'between' && (
                <div className="space-y-2">
                  <Label htmlFor="price-max-value">Max Price (£)</Label>
                  <Input
                    id="price-max-value"
                    type="number"
                    placeholder="e.g. 2000"
                    value={priceMaxValue}
                    onChange={(e) => setPriceMaxValue(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Location Filter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Location Filter</h3>
            <div className="space-y-2">
              <Label htmlFor="location">Location (Smart Search)</Label>
              <Input
                id="location"
                placeholder="e.g. Baker Street, Spinningfields, central Edinburgh"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Uses intelligent multi-strategy matching: fuzzy/phonetic address search + Google Places API boundaries
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Options</h3>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-all"
                checked={includeAll}
                onCheckedChange={(checked) => setIncludeAll(checked === true)}
              />
              <Label htmlFor="include-all" className="cursor-pointer">
                Include All Results (return all matching properties, not just top 3)
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Results</h3>
              <div className="bg-muted rounded-lg p-4 border">
                <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto max-h-[600px] overflow-y-auto">
                  {results}
                </pre>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

