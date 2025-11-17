import { estateAgentDemoPrompt } from './estate-agent-template'

export interface PromptTemplate {
  id: string
  name: string
  description?: string
  template: string
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: 'estate-agent-template',
    name: 'Estate Agent',
    description: 'A comprehensive template for estate agent voice assistants',
    template: estateAgentDemoPrompt,
  },
]

export function getTemplateById(id: string): PromptTemplate | undefined {
  return promptTemplates.find((template) => template.id === id)
}

export function getTemplatesByQuery(query: string): PromptTemplate[] {
  if (!query) return promptTemplates
  
  const lowerQuery = query.toLowerCase()
  return promptTemplates.filter(
    (template) =>
      template.id.toLowerCase().includes(lowerQuery) ||
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description?.toLowerCase().includes(lowerQuery)
  )
}

