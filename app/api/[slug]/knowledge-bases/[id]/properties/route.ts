import { NextRequest, NextResponse } from 'next/server'
import { getProperties } from '@/lib/knowledge-bases'
import { getAuthSession } from '@/lib/auth'
import { getKnowledgeBase } from '@/lib/knowledge-bases'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const { organizationId, organisation } = await getAuthSession(slug)

    if (!organizationId || !organisation) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const knowledgeBase = await getKnowledgeBase(id)

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      )
    }

    // Verify the knowledge base belongs to this organization
    if (knowledgeBase.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Knowledge base does not belong to this organization' },
        { status: 404 }
      )
    }

    // Get pagination parameters and filters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '24', 10)
    const offset = (page - 1) * pageSize

    // Get location filters
    const cities = searchParams.get('cities')?.split(',').filter(Boolean) || []
    const districts = searchParams.get('districts')?.split(',').filter(Boolean) || []
    const subDistricts = searchParams.get('subDistricts')?.split(',').filter(Boolean) || []
    const postcodeDistricts = searchParams.get('postcodeDistricts')?.split(',').filter(Boolean) || []
    const streets = searchParams.get('streets')?.split(',').filter(Boolean) || []

    // Fetch all properties
    let allProperties = await getProperties(id)
    
    // Apply location filters
    if (cities.length > 0 || districts.length > 0 || subDistricts.length > 0 || postcodeDistricts.length > 0 || streets.length > 0) {
      allProperties = allProperties.filter(prop => {
        const matchesCity = cities.length === 0 || (prop.city && cities.some(c => prop.city?.toLowerCase().includes(c.toLowerCase())))
        const matchesDistrict = districts.length === 0 || (prop.district && districts.some(d => prop.district?.toLowerCase().includes(d.toLowerCase())))
        // Sub-districts are typically in the district field or can be matched via full address
        const matchesSubDistrict = subDistricts.length === 0 || (prop.district && subDistricts.some(sd => prop.district?.toLowerCase().includes(sd.toLowerCase())) ||
          (prop.full_address && subDistricts.some(sd => prop.full_address.toLowerCase().includes(sd.toLowerCase()))))
        const matchesPostcode = postcodeDistricts.length === 0 || (prop.postcode_district && postcodeDistricts.includes(prop.postcode_district))
        const matchesStreet = streets.length === 0 || (prop.street_address && streets.some(s => prop.street_address?.toLowerCase().includes(s.toLowerCase())) || 
          (prop.full_address && streets.some(s => prop.full_address.toLowerCase().includes(s.toLowerCase()))))
        
        return matchesCity && matchesDistrict && matchesSubDistrict && matchesPostcode && matchesStreet
      })
    }
    
    const totalCount = allProperties.length
    
    // Paginate
    const paginatedProperties = allProperties.slice(offset, offset + pageSize)

    // Calculate summary statistics
    const rentalProperties = allProperties.filter(p => p.transaction_type === 'rent')
    const saleProperties = allProperties.filter(p => p.transaction_type === 'sale')
    const rentalCount = rentalProperties.length
    const saleCount = saleProperties.length
    
    const rentalPrices = rentalProperties.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
    const salePrices = saleProperties.map(p => p.price).filter((p): p is number => p !== null && p !== undefined)
    
    const rentalMinPrice = rentalPrices.length > 0 ? Math.min(...rentalPrices) : null
    const rentalMaxPrice = rentalPrices.length > 0 ? Math.max(...rentalPrices) : null
    const saleMinPrice = salePrices.length > 0 ? Math.min(...salePrices) : null
    const saleMaxPrice = salePrices.length > 0 ? Math.max(...salePrices) : null
    
    const lastSynced = allProperties.length > 0 
      ? allProperties.reduce((latest, prop) => {
          const scrapedAt = new Date(prop.scraped_at).getTime()
          const latestTime = new Date(latest.scraped_at).getTime()
          return scrapedAt > latestTime ? prop : latest
        }).scraped_at
      : null

    return NextResponse.json({
      properties: paginatedProperties,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      summary: {
        rentalCount,
        saleCount,
        rentalMinPrice,
        rentalMaxPrice,
        saleMinPrice,
        saleMaxPrice,
        lastSynced,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/[slug]/knowledge-bases/[id]/properties:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}

