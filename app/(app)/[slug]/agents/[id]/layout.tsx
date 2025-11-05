import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { ExternalLink, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AgentNav } from "./agent-nav"
import { getAuthSession } from "@/lib/auth"
import { TestAgentButtonWrapper } from "@/components/vapi/test-agent-button-wrapper"
import { getPhoneNumbersByAgent } from "@/lib/phone-numbers"
import { Badge } from "@/components/ui/badge"

interface AgentLayoutProps {
  params: Promise<{ slug: string; id: string }>
  children: React.ReactNode
}

export default async function AgentLayout({ params, children }: AgentLayoutProps) {
  const { slug, id } = await params
  const { isAdmin } = await getAuthSession(slug)

  const agent = await getAgentById(id)

  if (!agent) {
    notFound()
  }

  const vapiDashboardUrl = `https://dashboard.vapi.ai/assistants/${agent.vapi_assistant_id}`
  
  // Fetch phone numbers attached to this agent
  const phoneNumbers = agent.id ? await getPhoneNumbersByAgent(agent.id) : []

  const formatPhoneNumber = (phone: string) => {
    // Simple formatting for US numbers
    if (phone.startsWith('+1') && phone.length === 12) {
      const cleaned = phone.substring(2)
      return `+1 (${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
    }
    return phone
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {agent.vapiAssistant.name || "Unnamed Agent"}
            </h1>
            {/* <p className="text-muted-foreground mt-2">
              Agent ID: {id}
            </p> */}
          </div>
          <div className="flex items-center gap-2">
            <TestAgentButtonWrapper slug={slug} agentId={id} assistantId={agent.vapi_assistant_id} />
            {isAdmin && (
              <Button asChild variant="outline">
                <Link href={vapiDashboardUrl} target="_blank" rel="noopener noreferrer">
                  View in Vapi
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
        
        {phoneNumbers.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>Phone Numbers:</span>
            </div>
            {phoneNumbers.map((phoneNumber) => (
              <div key={phoneNumber.id} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-sm">
                  {formatPhoneNumber(phoneNumber.phone_number)}
                </Badge>
                {isAdmin && (
                  <Badge variant="outline" className="capitalize text-xs">
                    {phoneNumber.provider}
                  </Badge>
                )}
                {phoneNumber.sms_enabled && (
                  <Badge variant="outline" className="text-xs">
                    SMS
                  </Badge>
                )}
                {phoneNumber.time_based_routing_enabled && (
                  <Badge variant="outline" className="text-xs">
                    Time Routing
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
        
        <AgentNav slug={slug} agentId={id} />
        
        {children}
      </div>
    </div>
  )
}