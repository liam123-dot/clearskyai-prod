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
      label: "Prompts"
    },
    {
      href: `/${slug}/agents/${agentId}/settings`,
      label: "Settings"
    },
    {
      href: `/${slug}/agents/${agentId}/tools`,
      label: "Tools"
    },
    {
      href: `/${slug}/agents/${agentId}/knowledge-base`,
      label: "Knowledge Base"
    },
    {
      href: `/${slug}/agents/${agentId}/success-eval`,
      label: "Success & Eval"
    }
  ]

  return <NavTabs tabs={tabs} />
}

