'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import { ChevronDown, ChevronUp, Loader2, AlertCircle, Send, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Tool } from '@/lib/tools'
import { ToolItem } from '@/components/tools/tool-item'
import { KnowledgeBase } from '@/lib/knowledge-bases'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { promptTemplates, getTemplateById } from '@/lib/prompt-templates'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface PromptEditorButtonProps {
  agentId: string
  slug: string
  currentPrompt?: string
  onPromptUpdate?: () => void
}

export function PromptEditorButton({ agentId, slug, currentPrompt = '', onPromptUpdate }: PromptEditorButtonProps) {
  const [open, setOpen] = useState(false)
  const [tools, setTools] = useState<Tool[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(false)
  const [showToolsKbs, setShowToolsKbs] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<Record<string, { prompt: string; loading: boolean }>>({})
  const [pendingPromptUpdate, setPendingPromptUpdate] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Use the Vercel AI SDK's useChat hook for chat management
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/${slug}/agents/${agentId}/prompt-chat`,
    }),
    onError: (error) => {
      toast.error('Failed to send message')
      console.error(error)
    },
  })
  
  const [input, setInput] = useState('')
  const isLoading = status === 'submitted' || status === 'streaming'

  // Scroll to bottom when messages change or when prompt update appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingPromptUpdate])

  // Check for prompt updates in the last assistant message (including during streaming)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant') {
        // Extract text from parts (including partial content during streaming)
        const fullText = lastMessage.parts
          .filter((part) => part.type === 'text')
          .map((part) => part.type === 'text' ? part.text : '')
          .join('')
        
        const promptUpdate = extractPromptUpdate(fullText)
        if (promptUpdate) {
          setPendingPromptUpdate(promptUpdate)
        } else {
          // Clear pending update if it's no longer in the message
          setPendingPromptUpdate(null)
        }
      }
    }
  }, [messages])

  // Reset chat when sheet opens
  useEffect(() => {
    if (open) {
      // Note: In AI SDK v5, we can't directly reset messages via setMessages
      // The chat will be empty on mount, and resets when the sheet reopens
      setPendingPromptUpdate(null)
      setInput('')
      if (tools.length === 0 && knowledgeBases.length === 0 && !loading) {
        fetchToolsAndKbs()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fetchToolsAndKbs = async () => {
    setLoading(true)
    try {
      const [toolsResponse, knowledgeBasesResponse] = await Promise.all([
        fetch(`/api/${slug}/agents/${agentId}/tools`),
        fetch(`/api/${slug}/agents/${agentId}/knowledge-bases`),
      ])

      if (!toolsResponse.ok || !knowledgeBasesResponse.ok) {
        throw new Error('Failed to fetch data')
      }

      const toolsData = await toolsResponse.json()
      const knowledgeBasesData = await knowledgeBasesResponse.json()

      // Filter out preemptive-only tools
      const filteredTools = (toolsData.tools || []).filter((tool: Tool) => {
        if (tool.attach_to_agent === false && tool.execute_on_call_start === true) {
          return false
        }
        return true
      })
      
      setTools(filteredTools)
      setKnowledgeBases(knowledgeBasesData.knowledgeBases || [])
    } catch (error) {
      toast.error('Failed to load tools and knowledge bases')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const fetchToolPrompt = async (toolId: string) => {
    if (prompts[toolId]) return

    setPrompts(prev => ({ ...prev, [toolId]: { prompt: '', loading: true } }))
    try {
      const response = await fetch(`/api/${slug}/tools/${toolId}/llm-prompt`)
      if (!response.ok) throw new Error('Failed to fetch prompt')
      const data = await response.json()
      setPrompts(prev => ({ ...prev, [toolId]: { prompt: data.prompt || '', loading: false } }))
    } catch (error) {
      toast.error('Failed to load tool prompt')
      console.error(error)
      setPrompts(prev => ({ ...prev, [toolId]: { prompt: '', loading: false } }))
    }
  }

  const fetchKnowledgeBasePrompt = async (knowledgeBaseId: string) => {
    if (prompts[knowledgeBaseId]) return

    setPrompts(prev => ({ ...prev, [knowledgeBaseId]: { prompt: '', loading: true } }))
    try {
      const response = await fetch(`/api/query/estate-agent/${knowledgeBaseId}/prompt`)
      if (!response.ok) throw new Error('Failed to fetch prompt')
      const data = await response.json()
      setPrompts(prev => ({ ...prev, [knowledgeBaseId]: { prompt: data.prompt || '', loading: false } }))
    } catch (error) {
      toast.error('Failed to load knowledge base prompt')
      console.error(error)
      setPrompts(prev => ({ ...prev, [knowledgeBaseId]: { prompt: '', loading: false } }))
    }
  }

  const toggleItem = (id: string, isKnowledgeBase: boolean) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      if (isKnowledgeBase) {
        fetchKnowledgeBasePrompt(id)
      } else {
        fetchToolPrompt(id)
      }
    }
  }

  const extractPromptUpdate = (content: string): string | null => {
    // Try to match complete tags first (both opening and closing)
    const completeMatch = content.match(/<prompt_update>([\s\S]*?)<\/prompt_update>/)
    if (completeMatch) {
      return completeMatch[1].trim()
    }
    
    // If no complete match, check for opening tag only (streaming case)
    const partialMatch = content.match(/<prompt_update>([\s\S]*)/)
    if (partialMatch) {
      return partialMatch[1].trim()
    }
    
    return null
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading) {
      sendMessage({ text: input })
      setInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        sendMessage({ text: input })
        setInput('')
      }
    }
  }

  const useTemplate = (templateId: string) => {
    const template = getTemplateById(templateId)
    
    if (template && !isLoading) {
      // Send the entire template content as the initial message
      sendMessage({ text: template.template })
    }
  }

  const applyPromptUpdate = async () => {
    if (!pendingPromptUpdate || isApplying) return

    setIsApplying(true)
    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pendingPromptUpdate }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update prompt')
      }

      toast.success('System prompt updated successfully!')
      setPendingPromptUpdate(null)
      
      // Notify parent to refresh
      if (onPromptUpdate) {
        onPromptUpdate()
      }
    } catch (error) {
      toast.error('Failed to apply prompt update')
      console.error(error)
    } finally {
      setIsApplying(false)
    }
  }

  const rejectPromptUpdate = () => {
    setPendingPromptUpdate(null)
    toast.info('Prompt update rejected')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Prompt Editor
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>AI Prompt Editor</SheetTitle>
          <SheetDescription>
            Chat with AI to design and edit your agent's system prompt
          </SheetDescription>
        </SheetHeader>

        {/* Template Selector */}
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Select
              onValueChange={(value) => useTemplate(value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a prompt template..." />
              </SelectTrigger>
              <SelectContent>
                {promptTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-muted-foreground">
                          {template.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Chat Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-muted-foreground">
              <Sparkles className="h-12 w-12 opacity-50" />
              <div>
                <p className="font-medium">Start a conversation</p>
                <p className="text-sm">Ask me to help design or modify your agent's system prompt</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className={`text-sm ${message.role === 'user' ? 'text-primary-foreground' : ''}`}>
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          // Check if this message contains a prompt_update (complete or partial)
                          const hasPromptUpdate = /<prompt_update>/.test(part.text)
                          
                          // If it has a prompt_update, show a placeholder instead of the full content
                          if (hasPromptUpdate) {
                            // Remove both complete and partial prompt_update tags
                            const cleanText = part.text
                              .replace(/<prompt_update>[\s\S]*?<\/prompt_update>/g, '')
                              .replace(/<prompt_update>[\s\S]*/g, '')
                              .trim()
                            // Show placeholder if there's no other content, or show the other content if it exists
                            const displayText = cleanText || '*A system prompt update has been generated. Review it below.*'
                            
                            return (
                              <ReactMarkdown
                                key={index}
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  // Style code blocks
                                  code: ({ node, className, children, ...props }) => {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return (
                                      <code className={className} {...props}>
                                        {children}
                                      </code>
                                    )
                                  },
                                  // Style pre blocks
                                  pre: ({ children }) => (
                                    <pre className="bg-background/50 rounded p-2 overflow-x-auto my-2">
                                      {children}
                                    </pre>
                                  ),
                                  // Style links
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={message.role === 'user' ? 'text-primary-foreground underline' : 'text-primary underline'}
                                    >
                                      {children}
                                    </a>
                                  ),
                                  // Style lists
                                  ul: ({ children }) => (
                                    <ul className="list-disc list-inside my-2 space-y-1">
                                      {children}
                                    </ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="list-decimal list-inside my-2 space-y-1">
                                      {children}
                                    </ol>
                                  ),
                                  // Style headings
                                  h1: ({ children }) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                                  // Style blockquotes
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2">
                                      {children}
                                    </blockquote>
                                  ),
                                }}
                              >
                                {displayText}
                              </ReactMarkdown>
                            )
                          }
                          
                          // No prompt_update, show content normally
                          return (
                            <ReactMarkdown
                              key={index}
                              remarkPlugins={[remarkGfm]}
                              components={{
                                // Style code blocks
                                code: ({ node, className, children, ...props }) => {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  )
                                },
                                // Style pre blocks
                                pre: ({ children }) => (
                                  <pre className="bg-background/50 rounded p-2 overflow-x-auto my-2">
                                    {children}
                                  </pre>
                                ),
                                // Style links
                                a: ({ href, children }) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={message.role === 'user' ? 'text-primary-foreground underline' : 'text-primary underline'}
                                  >
                                    {children}
                                  </a>
                                ),
                                // Style lists
                                ul: ({ children }) => (
                                  <ul className="list-disc list-inside my-2 space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal list-inside my-2 space-y-1">
                                    {children}
                                  </ol>
                                ),
                                // Style headings
                                h1: ({ children }) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                                h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                                h3: ({ children }) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                                // Style blockquotes
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2">
                                    {children}
                                  </blockquote>
                                ),
                              }}
                            >
                              {part.text}
                            </ReactMarkdown>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Prompt Update Card */}
              {pendingPromptUpdate && (
                <Card className="p-4 border-2 border-primary/50 bg-primary/5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>Suggested System Prompt Update</span>
                      {isLoading && (
                        <span className="text-xs text-muted-foreground font-normal">
                          (Streaming...)
                        </span>
                      )}
                    </div>
                    <div className="bg-background rounded-md p-3 border max-h-64 overflow-y-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code: ({ node, className, children, ...props }) => (
                              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-muted rounded p-2 overflow-x-auto my-2 text-xs">
                                {children}
                              </pre>
                            ),
                            h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-xs font-semibold mt-1 mb-1">{children}</h3>,
                            ul: ({ children }) => (
                              <ul className="list-disc list-inside my-2 space-y-1 text-xs">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal list-inside my-2 space-y-1 text-xs">
                                {children}
                              </ol>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2 text-xs">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {pendingPromptUpdate}
                        </ReactMarkdown>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={applyPromptUpdate}
                        disabled={isApplying || isLoading}
                        size="sm"
                        className="flex-1"
                      >
                        {isApplying ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Applying...
                          </>
                        ) : isLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                            Waiting for completion...
                          </>
                        ) : (
                          'Apply Changes'
                        )}
                      </Button>
                      <Button
                        onClick={rejectPromptUpdate}
                        disabled={isApplying || isLoading}
                        variant="outline"
                        size="sm"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t px-6 py-4 bg-background">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message... (Shift+Enter for new line)"
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isLoading || status !== 'ready'}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || status !== 'ready'}
              size="icon"
              className="h-[60px] w-[60px] shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>

        {/* Collapsible Tools & KBs Section */}
        <div className="border-t bg-muted/30">
          <button
            onClick={() => setShowToolsKbs(!showToolsKbs)}
            className="w-full flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View Attached Tools & Knowledge Bases</span>
              <span className="text-xs text-muted-foreground">
                ({tools.length + knowledgeBases.length} items)
              </span>
            </div>
            {showToolsKbs ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          
          {showToolsKbs && (
            <div className="px-6 pb-4 max-h-96 overflow-y-auto space-y-4">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : tools.length === 0 && knowledgeBases.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mr-2" />
                  <span className="text-sm text-muted-foreground">No tools or knowledge bases attached</span>
                </div>
              ) : (
                <>
                  {/* Knowledge Base Tools Section */}
                  {knowledgeBases.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Knowledge Bases</h3>
                        <span className="text-xs text-muted-foreground">({knowledgeBases.length})</span>
                      </div>
                      <div className="space-y-1">
                        {knowledgeBases.map((kb) => {
                          const isExpanded = expandedId === kb.id
                          const promptData = prompts[kb.id]
                          
                          return (
                            <div
                              key={kb.id}
                              className="border rounded-md overflow-hidden bg-background"
                            >
                              <button
                                onClick={() => toggleItem(kb.id, true)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 flex-shrink-0 bg-purple-100 dark:bg-purple-900 rounded flex items-center justify-center text-[10px] font-medium text-purple-700 dark:text-purple-300">
                                    KB
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{kb.name}</div>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-2 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-2 flex-shrink-0" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="border-t bg-muted/30 p-3">
                                  {promptData?.loading ? (
                                    <div className="flex items-center justify-center py-3">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                      <span className="text-xs text-muted-foreground">Loading prompt...</span>
                                    </div>
                                  ) : promptData?.prompt ? (
                                    <div className="bg-background rounded-md p-2 border max-h-64 overflow-y-auto">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {promptData.prompt}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      No prompt available for this knowledge base
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Regular Tools Section */}
                  {tools.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tools</h3>
                        <span className="text-xs text-muted-foreground">({tools.length})</span>
                      </div>
                      <div className="space-y-1">
                        {tools.map((tool) => {
                          const isExpanded = expandedId === tool.id
                          const promptData = prompts[tool.id]
                          
                          return (
                            <div
                              key={tool.id}
                              className="border rounded-md overflow-hidden bg-background"
                            >
                              <button
                                onClick={() => toggleItem(tool.id, false)}
                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                              >
                                <ToolItem 
                                  tool={tool} 
                                  showDescription={false}
                                  className="flex-1"
                                />
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-2 flex-shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-2 flex-shrink-0" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="border-t bg-muted/30 p-3">
                                  {promptData?.loading ? (
                                    <div className="flex items-center justify-center py-3">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                                      <span className="text-xs text-muted-foreground">Loading prompt...</span>
                                    </div>
                                  ) : promptData?.prompt ? (
                                    <div className="bg-background rounded-md p-2 border max-h-64 overflow-y-auto">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {promptData.prompt}
                                      </pre>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                      No prompt available for this tool
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

