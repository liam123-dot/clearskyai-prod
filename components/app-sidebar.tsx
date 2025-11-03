"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import {
  IconBook,
  IconDashboard,
  IconPhone,
  IconPhoneCall,
  IconRobot,
  IconSettings,
  IconShoppingCart,
  IconTools,
  IconUser,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  type: "organization" | "admin"
  slug?: string
  orgName?: string
  user?: {
    name: string
    email: string
    avatar?: string
  }
}

export function AppSidebar({ type, slug, orgName, user, ...props }: AppSidebarProps) {
  // Organization navigation items
  const orgNavItems = [
    {
      title: "Dashboard",
      url: `/${slug}`,
      icon: IconDashboard,
    },
    {
      title: "Agents",
      url: `/${slug}/agents`,
      icon: IconRobot,
    },
    {
      title: "Tools",
      url: `/${slug}/tools`,
      icon: IconTools,
    },
    {
      title: "Knowledge Base",
      url: `/${slug}/knowledge-base`,
      icon: IconBook,
    },
    {
      title: "Calls",
      url: `/${slug}/calls`,
      icon: IconPhoneCall,
    },
    {
      title: "Phone Numbers",
      url: `/${slug}/phone-numbers`,
      icon: IconPhone,
    },
  ]

  // Admin navigation items
  const adminNavItems = [
    {
      title: "Dashboard",
      url: "/admin",
      icon: IconDashboard,
    },
    {
      title: "Clients",
      url: "/admin/client",
      icon: IconUser,
    },
    {
      title: "Agents",
      url: "/admin/agents",
      icon: IconRobot,
    },
    {
      title: "Tools",
      url: "/admin/tools",
      icon: IconTools,
    },
    {
      title: "Calls",
      url: "/admin/calls",
      icon: IconPhoneCall,
    },
    {
      title: "Phone Numbers",
      url: "/admin/phone-numbers",
      icon: IconPhone,
    },
    {
      title: "Products",
      url: "/admin/products",
      icon: IconShoppingCart,
    },
  ]

  const navSecondaryItems = type === "admin" ? [] : [
    {
      title: "Settings",
      url: `/${slug}/settings`,
      icon: IconSettings,
      items: [
        {
          title: "General",
          url: `/${slug}/settings`,
        },
        {
          title: "Billing",
          url: `/${slug}/settings/billing`,
        },
      ],
    },
  ]

  const navItems = type === "organization" ? orgNavItems : adminNavItems

  const defaultUser = {
    name: user?.name || user?.email?.split('@')[0] || "User",
    email: user?.email || "",
    avatar: user?.avatar || "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={type === "organization" ? `/${slug}` : "/admin"}>
                <Image
                  src="/clearsky_ai_icon_color.png"
                  alt="Clearsky AI"
                  width={20}
                  height={20}
                  className="!size-5"
                />
                <span className="text-base font-semibold">Clearsky AI</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser 
          user={defaultUser}
          organisationName={type === "organization" ? (orgName || slug || "Organization") : undefined}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
