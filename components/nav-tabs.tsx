'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface NavTab {
  href: string
  label: string
}

interface NavTabsProps {
  tabs: NavTab[]
}

export function NavTabs({ tabs }: NavTabsProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    // For the exact base route, only match exact pathname
    const baseRoute = tabs[0]?.href
    if (href === baseRoute) {
      return pathname === href
    }
    // For other routes, match if pathname starts with the href
    return pathname.startsWith(href)
  }

  return (
    <div className="flex gap-2 border-b">
      {tabs.map((tab) => (
        <Link 
          key={tab.href}
          href={tab.href}
          prefetch={true}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "rounded-b-none border-b-2",
            isActive(tab.href) 
              ? "border-primary" 
              : "border-transparent"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

