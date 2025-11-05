import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { ExternalLink, Phone, Clock, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AgentNav } from "./agent-nav"
import { getAuthSession } from "@/lib/auth"
import { TestAgentButtonWrapper } from "@/components/vapi/test-agent-button-wrapper"
import { getPhoneNumbersByAgent } from "@/lib/phone-numbers"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span className="font-medium">{phoneNumbers.length} {phoneNumbers.length === 1 ? 'Number' : 'Numbers'}:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {phoneNumbers.map((phoneNumber) => (
                <Popover key={phoneNumber.id}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 font-mono text-xs hover:bg-muted"
                    >
                      {formatPhoneNumber(phoneNumber.phone_number)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="start">
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Phone Number</div>
                        <div className="font-mono text-sm">{formatPhoneNumber(phoneNumber.phone_number)}</div>
                      </div>
                      
                      {isAdmin && (
                        <div>
                          <div className="text-sm font-medium mb-1">Provider</div>
                          <Badge variant="outline" className="capitalize">
                            {phoneNumber.provider}
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">SMS</span>
                          <Badge variant={phoneNumber.sms_enabled ? "default" : "secondary"} className="text-xs">
                            {phoneNumber.sms_enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>

                      {phoneNumber.time_based_routing_enabled && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Time-based Routing</span>
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        </div>
                      )}

                      {phoneNumber.schedules_count > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {phoneNumber.schedules_count} schedule{phoneNumber.schedules_count !== 1 ? 's' : ''} configured
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          </div>
        )}
        
        <AgentNav slug={slug} agentId={id} />
        
        {children}
      </div>
    </div>
  )
}