import { NavTabs } from "@/components/nav-tabs"
import { getClientBySlug } from "@/lib/client"

export default async function AdminClientLayout({ children, params }: { children: React.ReactNode, params: Promise<{ slug: string }> }) {
  const { slug } = await params

    const client = await getClientBySlug(slug)

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <h1>{client?.name}</h1>
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