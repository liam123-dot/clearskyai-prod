import { getAgentById } from "@/lib/vapi/agents"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AgentNav } from "./agent-nav"
import { getAuthSession } from "@/lib/auth"

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

  return (
    <div className="px-4 lg:px-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {agent.vapiAssistant.name || "Unnamed Agent"}
            </h1>
            <p className="text-muted-foreground mt-2">
              Agent ID: {id}
            </p>
          </div>
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href={vapiDashboardUrl} target="_blank" rel="noopener noreferrer">
                View in Vapi
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
        
        <AgentNav slug={slug} agentId={id} />
        
        {children}
      </div>
    </div>
  )
}