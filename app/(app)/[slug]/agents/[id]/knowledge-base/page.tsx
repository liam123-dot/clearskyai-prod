import { getAuthSession } from "@/lib/auth"
import { getKnowledgeBasesWithAgentStatus } from "@/lib/knowledge-bases"
import { getAgentById } from "@/lib/agents"
import { AgentKnowledgeBases } from "./agent-knowledge-bases"
import { Card, CardContent } from "@/components/ui/card"

export default async function AgentKnowledgeBasePage({params}: {params: Promise<{slug: string, id: string}>}) {

    const {slug, id} = await params

    const { organizationId } = await getAuthSession(slug)
    const agent = await getAgentById(id)

    if (!agent) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-destructive">Agent not found</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const knowledgeBases = await getKnowledgeBasesWithAgentStatus(
        organizationId,
        id
    )

    return (
        <div className="space-y-6">
            <AgentKnowledgeBases slug={slug} agentId={id} knowledgeBases={knowledgeBases} />
        </div>
    )
}
