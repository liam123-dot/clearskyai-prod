'use client'

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect, useState, useRef } from "react"
import * as React from "react"
import { ChevronRight } from "lucide-react"

interface SiteHeaderProps {
  isAdmin?: boolean
  showAdminButton?: boolean
}

interface BreadcrumbItemData {
  label: string
  href?: string
  isLoading?: boolean
}

export function SiteHeader({ isAdmin = false, showAdminButton = true }: SiteHeaderProps) {
  const pathname = usePathname()
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItemData[]>([])
  const [nameCache, setNameCache] = useState<Record<string, string>>({})
  const [loadingTrigger, setLoadingTrigger] = useState(0)
  const loadingIdsRef = React.useRef<Set<string>>(new Set())
  
  useEffect(() => {
    const generateBreadcrumbs = () => {
      const segments = pathname.split('/').filter(Boolean)
      const items: BreadcrumbItemData[] = []
      
      // Known route segments that are NOT IDs (even if they follow a resource type)
      const knownRoutes = new Set(['credentials', 'create', 'settings', 'billing', 'users', 'tools', 'knowledge-base'])
      
      // Always start with Dashboard
      items.push({ label: 'Dashboard', href: segments[0] ? `/${segments[0]}` : '/' })
      
      // Build breadcrumbs from path segments
      let currentPath = ''
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        currentPath += `/${segment}`
        
        // Skip the slug segment
        if (i === 0) continue
        
        // Check if this segment is an ID (previous segment is a resource type AND current segment is not a known route)
        const prevSegment = segments[i - 1]
        const isResourceType = ['agents', 'tools', 'knowledge-base', 'phone-numbers'].includes(prevSegment)
        const isKnownRoute = knownRoutes.has(segment)
        const isResourceId = isResourceType && !isKnownRoute
        
        if (isResourceId) {
          // Try to get cached name
          const cachedName = nameCache[segment]
          const isLoading = loadingIdsRef.current.has(segment)
          
          // If no cached name, mark as loading immediately and start fetch
          if (!cachedName && !isLoading && segments[0]) {
            loadingIdsRef.current.add(segment)
            // Trigger re-render to show skeleton immediately
            setLoadingTrigger(prev => prev + 1)
            
            const resourceType = prevSegment === 'knowledge-base' ? 'knowledge-base' : prevSegment
            fetch(`/api/${segments[0]}/${resourceType}/${segment}/name`)
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (data?.name) {
                  setNameCache(prev => ({ ...prev, [segment]: data.name }))
                }
              })
              .catch(() => {})
              .finally(() => {
                loadingIdsRef.current.delete(segment)
                // Trigger re-render to update breadcrumbs
                setLoadingTrigger(prev => prev + 1)
              })
          }
          
          // Only show label if we have a cached name, never show the ID
          // If loading, isLoading will be true and skeleton will be shown
          const isCurrentlyLoading = loadingIdsRef.current.has(segment) && !cachedName
          
          items.push({ 
            label: cachedName || '',
            href: currentPath,
            isLoading: isCurrentlyLoading
          })
        } else {
          // Regular segment - capitalize and format
          const label = segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          
          items.push({ 
            label,
            href: currentPath
          })
        }
      }
      
      setBreadcrumbs(items)
    }
    
    generateBreadcrumbs()
  }, [pathname, nameCache, loadingTrigger])
  
  // Get the current page title (last breadcrumb)
  const currentTitle = breadcrumbs.length > 0 
    ? breadcrumbs[breadcrumbs.length - 1].label 
    : 'Dashboard'

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {breadcrumbs.length > 1 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <div key={index} className="flex items-center gap-2">
                    {index > 0 && (
                      <BreadcrumbSeparator>
                        <ChevronRight className="h-4 w-4" />
                      </BreadcrumbSeparator>
                    )}
                    {isLast ? (
                      <BreadcrumbPage className="text-base font-medium">
                        {item.isLoading ? (
                          <Skeleton className="h-4 w-24" />
                        ) : (
                          item.label
                        )}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                          <Link href={item.href || '#'} className="text-muted-foreground hover:text-foreground">
                            {item.isLoading ? (
                              <Skeleton className="h-4 w-24" />
                            ) : (
                              item.label
                            )}
                          </Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                    )}
                  </div>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className="text-base font-medium">{currentTitle}</h1>
        )}
        {isAdmin && showAdminButton && (
          <div className="ml-auto">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">Admin Dashboard</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
