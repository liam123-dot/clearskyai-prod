"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
import { IconChevronDown } from "@tabler/icons-react"
import * as Collapsible from "@radix-ui/react-collapsible"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: Icon
  items?: {
    title: string
    url: string
  }[]
}

function CollapsibleNavItem({ 
  item,
  isOpen: initialOpen,
  pathname
}: { 
  item: NavItem
  isOpen: boolean
  pathname: string
}) {
  const [open, setOpen] = React.useState(initialOpen)
  // Only highlight if a child is active, not the parent itself
  const isChildActive = item.items?.some(child => pathname === child.url || pathname.startsWith(child.url + '/')) || false
  // Don't highlight parent when on child routes
  const isParentActive = false // Never highlight parent for collapsible items

  // Sync open state when pathname changes
  React.useEffect(() => {
    if (isChildActive) {
      setOpen(true)
    }
  }, [isChildActive])

  return (
    <div suppressHydrationWarning>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <SidebarMenuItem>
          <Collapsible.Trigger asChild>
            <SidebarMenuButton 
              isActive={false}
              className="text-muted-foreground hover:text-foreground"
            >
              <item.icon className="size-4" />
              <span>{item.title}</span>
              <IconChevronDown className={`ml-auto size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </SidebarMenuButton>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <SidebarMenuSub>
              {item.items?.map((subItem) => {
                // Match exact path or subroutes
                // However, if sub-item URL matches parent URL (like General = Settings), only match exactly
                // to avoid highlighting General when on sibling routes like /settings/billing
                const isSameAsParent = subItem.url === item.url
                const isSubActive = pathname === subItem.url || (!isSameAsParent && pathname.startsWith(subItem.url + '/'))
                return (
                  <SidebarMenuSubItem key={subItem.title}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={isSubActive}
                    >
                      <Link href={subItem.url}>
                        <span>{subItem.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </SidebarMenuSub>
          </Collapsible.Content>
        </SidebarMenuItem>
      </Collapsible.Root>
    </div>
  )
}

export function NavSecondary({
  items,
  ...props
}: {
  items: NavItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const hasSubItems = item.items && item.items.length > 0
            // Only check child active for collapsible items
            const isChildActive = hasSubItems ? (item.items?.some(child => pathname === child.url || pathname.startsWith(child.url + '/')) || false) : false
            const isOpen = isChildActive

            if (hasSubItems) {
              return (
                <CollapsibleNavItem 
                  key={item.title} 
                  item={item}
                  isOpen={isOpen}
                  pathname={pathname}
                />
              )
            }

            // Match exact path or subroutes (e.g., /settings matches /settings/billing)
            const isActive = pathname === item.url || pathname.startsWith(item.url + '/')
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild
                  isActive={isActive}
                  className={isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
                >
                  <Link href={item.url}>
                    <item.icon className="size-4" />
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
