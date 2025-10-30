import { getAuthSession } from "@/lib/auth"
import { getOrganizationBilling } from "@/lib/billing"
import { UserBillingPageClient } from "@/components/billing/user-billing-page-client"
import type { Metadata } from "next"

interface BillingPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BillingPageProps): Promise<Metadata> {
  return {
    title: "Billing",
  }
}

export default async function OrganizationBillingPage({ params }: BillingPageProps) {
  const { slug } = await params
  const { organizationId } = await getAuthSession(slug)

  if (!organizationId) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border p-6">
          <p className="text-sm text-destructive">Organization not found</p>
        </div>
      </div>
    )
  }

  const billingState = await getOrganizationBilling(organizationId)

  return (
    <div className="space-y-6">
      <UserBillingPageClient initialState={billingState} slug={slug} />
    </div>
  )
}