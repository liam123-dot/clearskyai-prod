import { getPhoneNumbersByOrganization } from '@/lib/phone-numbers'
import { getAgentsByOrganization } from '@/lib/vapi/agents'
import { createServiceClient } from '@/lib/supabase/server'
import { ImportTwilioDialog } from '@/components/phone-numbers/import-twilio-dialog'
// import { BuyNumberDialog } from '@/components/phone-numbers/buy-number-dialog'
import { PhoneNumbersTable } from '@/components/phone-numbers/phone-numbers-table'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: "Phone Numbers",
  }
}

export default async function OrganizationPhoneNumbersPage({ params }: PageProps) {
  const { slug } = await params
  
  // Get organization ID from slug
  const supabase = await createServiceClient()
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .select('id, slug')
    .eq('slug', slug)
    .single()

  if (orgError || !org) {
    notFound()
  }

  const [phoneNumbers, agentsData] = await Promise.all([
    getPhoneNumbersByOrganization(org.id),
    getAgentsByOrganization(org.id),
  ])

  // Map agents to include organization_id for the component
  const agents = agentsData.map(agent => ({
    id: agent.id,
    vapi_assistant_id: agent.vapi_assistant_id,
    organization_id: agent.organization.id,
    vapiAssistant: { name: agent.vapiAssistant.name }
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
        </div>
        <div className="flex gap-2">
          <ImportTwilioDialog isAdmin={false} organizationSlug={slug} />
          {/* <BuyNumberDialog isAdmin={false} organizationSlug={slug} /> */}
        </div>
      </div>

      <div className="border rounded-lg">
        <PhoneNumbersTable
          phoneNumbers={phoneNumbers}
          agents={agents}
          isAdmin={false}
          organizationSlug={slug}
        />
      </div>

      {phoneNumbers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No phone numbers yet. Import or buy your first phone number to get started.
          </p>
        </div>
      )}
    </div>
  )
}

