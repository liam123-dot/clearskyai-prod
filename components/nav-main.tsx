"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            // Match exact path or subroutes (e.g., /agents matches /agents/[id] or /agents/[id]/settings)
            // For base routes (like Dashboard /${slug} or /admin), only match exactly to avoid highlighting on all subroutes
            const pathSegments = item.url.split('/').filter(Boolean)
            const isBaseRoute = pathSegments.length <= 1 // e.g., ["org-123"] or ["admin"]
            const isActive = pathname === item.url || (!isBaseRoute && pathname.startsWith(item.url + '/'))
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title} 
                  asChild
                  isActive={isActive}
                  className={isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
                >
                  <Link href={item.url}>
                    {item.icon && <item.icon className="size-4" />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
