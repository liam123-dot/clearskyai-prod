'use client'

import { NavTabs } from "@/components/nav-tabs"

interface AgentNavProps {
  agentId: string
  slug: string
}

export function AgentNav({ agentId, slug }: AgentNavProps) {
  const tabs = [
    {
      href: `/${slug}/agents/${agentId}`,
      label: "Overview"
    },
    {
      href: `/${slug}/agents/${agentId}/tools`,
      label: "Tools"
    },
    {
      href: `/${slug}/agents/${agentId}/knowledge-base`,
      label: "Knowledge Base"
    }
  ]

  return <NavTabs tabs={tabs} />
}

