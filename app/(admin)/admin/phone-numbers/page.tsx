import { getPhoneNumbers } from '@/lib/phone-numbers'
import { getAgents } from '@/lib/vapi/agents'
import { getOrganizations } from '@/lib/organizations'
import { ImportTwilioDialog } from '@/components/phone-numbers/import-twilio-dialog'
import { BuyNumberDialog } from '@/components/phone-numbers/buy-number-dialog'
import { PhoneNumbersTable } from '@/components/phone-numbers/phone-numbers-table'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Phone Numbers",
}

export default async function AdminPhoneNumbersPage() {
  const [phoneNumbers, agents, organizations] = await Promise.all([
    getPhoneNumbers(),
    getAgents(),
    getOrganizations(),
  ])

  // Filter and map agents to only include assigned ones (with organization and valid id)
  const assignedAgents = agents
    .filter((agent): agent is typeof agent & { id: string } => agent.isAssigned && agent.id !== null)
    .map(agent => ({
      id: agent.id,
      vapi_assistant_id: agent.vapi_assistant_id,
      vapiAssistant: { name: agent.vapiAssistant.name }
    }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage phone numbers and assign them to agents and organizations
          </p>
        </div>
        <div className="flex gap-2">
          <ImportTwilioDialog isAdmin={true} />
          <BuyNumberDialog isAdmin={true} />
        </div>
      </div>

      <div className="border rounded-lg">
        <PhoneNumbersTable
          phoneNumbers={phoneNumbers}
          agents={assignedAgents}
          organizations={organizations}
          isAdmin={true}
        />
      </div>
    </div>
  )
}
