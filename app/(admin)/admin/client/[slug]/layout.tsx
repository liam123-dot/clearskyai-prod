import { NavTabs } from "@/components/nav-tabs"
import { getClientBySlug } from "@/lib/client"
import { Button } from "@/components/ui/button"
import { IconExternalLink } from "@tabler/icons-react"
import Link from "next/link"

const baseUrl = process.env.NEXT_PUBLIC_APP_URL

export default async function AdminClientLayout({ children, params }: { children: React.ReactNode, params: Promise<{ slug: string }> }) {
  const { slug } = await params

    const client = await getClientBySlug(slug)

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1>{client?.name}</h1>
          {client?.slug && baseUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link 
                href={`${baseUrl}/${client.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      <NavTabs tabs={[
        {
          href: `/admin/client/${slug}`,
          label: "Overview",
        },
        {
            href: `/admin/client/${slug}/users`,
            label: "Users",
        },
        {
            href: `/admin/client/${slug}/billing`,
            label: "Billing",
        },
      ]} />
      {children}
    </div>
  )
}