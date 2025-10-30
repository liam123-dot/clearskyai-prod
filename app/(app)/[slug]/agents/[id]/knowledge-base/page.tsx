import { getAuthSession } from "@/lib/auth"
import { getKnowledgeBasesWithAgentStatus } from "@/lib/knowledge-bases"
import { AgentKnowledgeBases } from "./agent-knowledge-bases"

export default async function AgentKnowledgeBasePage({params}: {params: Promise<{slug: string, id: string}>}) {

    const {slug, id} = await params

    const { organizationId } = await getAuthSession(slug)

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
