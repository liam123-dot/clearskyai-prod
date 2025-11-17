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
import { Badge } from '@/components/ui/badge'
import { promptTemplates, getTemplatesByQuery, PromptTemplate } from '@/lib/prompts'

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
  
  // @-mention autocomplete state
  const [showTemplateAutocomplete, setShowTemplateAutocomplete] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contentEditableRef = useRef<HTMLDivElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)

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
      setShowTemplateAutocomplete(false)
      setTemplateQuery('')
      setMentionStartPos(null)
      setSelectedTemplateIndex(0)
      if (tools.length === 0 && knowledgeBases.length === 0 && !loading) {
        fetchToolsAndKbs()
      }
      
      // Clear contentEditable
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Clear contentEditable when input is cleared
  useEffect(() => {
    if (!input && contentEditableRef.current && contentEditableRef.current.textContent) {
      contentEditableRef.current.textContent = ''
    }
  }, [input])

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

  // Extract template references from text and return them with their positions
  const extractTemplateReferences = (text: string): Array<{ template: PromptTemplate; start: number; end: number }> => {
    const references: Array<{ template: PromptTemplate; start: number; end: number }> = []
    const templateMentionRegex = /@([a-zA-Z0-9_-]+)/g
    let match
    
    while ((match = templateMentionRegex.exec(text)) !== null) {
      const templateId = match[1]
      const template = promptTemplates.find(t => t.id === templateId)
      if (template) {
        references.push({
          template,
          start: match.index,
          end: match.index + match[0].length,
        })
      }
    }
    
    return references
  }

  // Render text with template references highlighted
  const renderTextWithTemplateHighlights = (text: string, isUserMessage: boolean, markdownComponents: any) => {
    const templateRefs = extractTemplateReferences(text)
    
    if (templateRefs.length === 0) {
      return null // No templates to highlight, return null to use default rendering
    }
    
    // Sort references by start position (ascending)
    templateRefs.sort((a, b) => a.start - b.start)
    
    // Build array of segments (text and badges)
    const segments: Array<{ type: 'text' | 'badge'; content: string; template?: PromptTemplate }> = []
    let lastIndex = 0
    
    for (const ref of templateRefs) {
      // Add text before this reference
      if (ref.start > lastIndex) {
        segments.push({
          type: 'text',
          content: text.substring(lastIndex, ref.start),
        })
      }
      
      // Add badge for this reference
      segments.push({
        type: 'badge',
        content: `@${ref.template.id}`,
        template: ref.template,
      })
      
      lastIndex = ref.end
    }
    
    // Add remaining text after last reference
    if (lastIndex < text.length) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex),
      })
    }
    
    // Render segments - badges inline, text with markdown
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {segments.map((segment, idx) => {
          if (segment.type === 'badge' && segment.template) {
            return (
              <Badge
                key={`template-${idx}`}
                variant="secondary"
                className="font-mono text-xs inline-flex items-center"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                @{segment.template.id}
              </Badge>
            )
          }
          // Render text segments with markdown
          return (
            <span key={`text-${idx}`} className="inline">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {segment.content}
              </ReactMarkdown>
            </span>
          )
        })}
      </span>
    )
  }

  // Filter templates based on query
  const filteredTemplates = getTemplatesByQuery(templateQuery)

  // Handle template selection
  const selectTemplate = (template: PromptTemplate) => {
    if (!contentEditableRef.current || mentionStartPos === null) return
    
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    
    // Get current position and text
    const currentText = extractTextFromContentEditable(contentEditableRef.current)
    const beforeMention = currentText.substring(0, mentionStartPos)
    
    // Find the end of the current @ mention
    const textAfterAt = currentText.substring(mentionStartPos + 1)
    const spaceIndex = textAfterAt.search(/[\s\n]/)
    const mentionEnd = mentionStartPos + 1 + (spaceIndex === -1 ? textAfterAt.length : spaceIndex)
    const afterMention = currentText.substring(mentionEnd)
    
    // Manually update the contentEditable DOM
    const range = selection.getRangeAt(0)
    
    // Find and remove the @ mention text
    const walker = document.createTreeWalker(
      contentEditableRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let node
    let charCount = 0
    while ((node = walker.nextNode())) {
      const textNode = node as Text
      const textLength = textNode.textContent?.length || 0
      
      if (charCount + textLength > mentionStartPos) {
        // This text node contains the start of the mention
        const offsetInNode = mentionStartPos - charCount
        const lengthToRemove = mentionEnd - mentionStartPos
        
        // Remove the @ mention text
        textNode.textContent = 
          (textNode.textContent?.substring(0, offsetInNode) || '') +
          (textNode.textContent?.substring(offsetInNode + lengthToRemove) || '')
        
        // Insert the badge
        const badgeSpan = document.createElement('span')
        badgeSpan.contentEditable = 'false'
        badgeSpan.className = 'inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2 py-0.5 text-xs font-medium font-mono'
        badgeSpan.setAttribute('data-template-id', template.id)
        badgeSpan.innerHTML = `<svg class="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>@${template.id}`
        
        // Add space after badge
        const spaceNode = document.createTextNode(' ')
        
        // Insert badge and space
        if (textNode.parentNode) {
          textNode.parentNode.insertBefore(badgeSpan, textNode.nextSibling)
          textNode.parentNode.insertBefore(spaceNode, badgeSpan.nextSibling)
          
          // Position cursor after the space
          const newRange = document.createRange()
          newRange.setStartAfter(spaceNode)
          newRange.setEndAfter(spaceNode)
          selection.removeAllRanges()
          selection.addRange(newRange)
        }
        
        break
      }
      
      charCount += textLength
    }
    
    // Extract the updated text from contentEditable and update state
    setTimeout(() => {
      if (contentEditableRef.current) {
        const updatedText = extractTextFromContentEditable(contentEditableRef.current)
        setInput(updatedText)
      }
    }, 0)
    
    // Reset autocomplete state
    setShowTemplateAutocomplete(false)
    setTemplateQuery('')
    setMentionStartPos(null)
    setSelectedTemplateIndex(0)
    
    // Focus the contentEditable
    contentEditableRef.current.focus()
  }

  // Extract text from contentEditable div (replacing badges with @template-id)
  const extractTextFromContentEditable = (element: HTMLElement): string => {
    let text = ''
    
    // Helper function to recursively process nodes
    const processNode = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        
        // Check if it's a badge element with template ID
        const templateId = el.getAttribute('data-template-id')
        if (templateId) {
          text += `@${templateId}`
          return // Skip children of badge
        }
        
        // Process children of non-badge elements
        node.childNodes.forEach(child => processNode(child))
      } else if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || ''
      }
    }
    
    element.childNodes.forEach(child => processNode(child))
    
    return text
  }


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Extract current text from contentEditable (includes @template-id from badges)
    let messageText = input
    if (contentEditableRef.current) {
      messageText = extractTextFromContentEditable(contentEditableRef.current)
    }
    
    if (messageText.trim() && !isLoading) {
      // Expand template references (e.g., @template-id)
      const templateMentionRegex = /@([a-zA-Z0-9_-]+)/g
      const expandedMessage = messageText.replace(templateMentionRegex, (match, templateId) => {
        const template = promptTemplates.find(t => t.id === templateId)
        if (template) {
          return `@${templateId}\n\n${template.template}`
        }
        return match // Keep original if template not found
      })
      
      sendMessage({ text: expandedMessage })
      setInput('')
      
      // Clear the contentEditable
      if (contentEditableRef.current) {
        contentEditableRef.current.textContent = ''
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showTemplateAutocomplete && filteredTemplates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedTemplateIndex((prev) => 
          prev < filteredTemplates.length - 1 ? prev + 1 : prev
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedTemplateIndex((prev) => (prev > 0 ? prev - 1 : 0))
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        selectTemplate(filteredTemplates[selectedTemplateIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowTemplateAutocomplete(false)
        setTemplateQuery('')
        setMentionStartPos(null)
        return
      }
    }
    
    // Normal Enter handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading && !showTemplateAutocomplete) {
        sendMessage({ text: input })
        setInput('')
      }
    }
  }

  // Handle @ detection in textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    
    setInput(value)
    
    // Find @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      // Check if there's a space after @ (which would mean @ is not active)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        // We have an active @ mention
        const query = textAfterAt
        setTemplateQuery(query)
        setMentionStartPos(lastAtIndex)
        setShowTemplateAutocomplete(true)
        setSelectedTemplateIndex(0)
        return
      }
    }
    
    // No active @ mention
    setShowTemplateAutocomplete(false)
    setTemplateQuery('')
    setMentionStartPos(null)
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
          Prompt Editor
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Prompt Editor</SheetTitle>
          <SheetDescription>
            Chat with AI to design and edit your agent's system prompt
          </SheetDescription>
        </SheetHeader>

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
                            
                            // Define markdown components
                            const markdownComponents = {
                              code: ({ node, className, children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              pre: ({ children }: any) => (
                                <pre className="bg-background/50 rounded p-2 overflow-x-auto my-2">
                                  {children}
                                </pre>
                              ),
                              a: ({ href, children }: any) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={message.role === 'user' ? 'text-primary-foreground underline' : 'text-primary underline'}
                                >
                                  {children}
                                </a>
                              ),
                              ul: ({ children }: any) => (
                                <ul className="list-disc list-inside my-2 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }: any) => (
                                <ol className="list-decimal list-inside my-2 space-y-1">
                                  {children}
                                </ol>
                              ),
                              h1: ({ children }: any) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                              h2: ({ children }: any) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                              h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                              blockquote: ({ children }: any) => (
                                <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2">
                                  {children}
                                </blockquote>
                              ),
                            }
                            
                            return (
                              <ReactMarkdown
                                key={index}
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {displayText}
                              </ReactMarkdown>
                            )
                          }
                          
                          // Check for template references and highlight them
                          const templateHighlight = renderTextWithTemplateHighlights(
                            part.text,
                            message.role === 'user',
                            {
                              code: ({ node, className, children, ...props }: any) => {
                                const match = /language-(\w+)/.exec(className || '')
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              },
                              pre: ({ children }: any) => (
                                <pre className="bg-background/50 rounded p-2 overflow-x-auto my-2">
                                  {children}
                                </pre>
                              ),
                              a: ({ href, children }: any) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={message.role === 'user' ? 'text-primary-foreground underline' : 'text-primary underline'}
                                >
                                  {children}
                                </a>
                              ),
                              ul: ({ children }: any) => (
                                <ul className="list-disc list-inside my-2 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }: any) => (
                                <ol className="list-decimal list-inside my-2 space-y-1">
                                  {children}
                                </ol>
                              ),
                              h1: ({ children }: any) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                              h2: ({ children }: any) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                              h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                              blockquote: ({ children }: any) => (
                                <blockquote className="border-l-4 border-muted-foreground/30 pl-3 italic my-2">
                                  {children}
                                </blockquote>
                              ),
                            }
                          )
                          
                          // If template highlights exist, use them; otherwise use normal markdown
                          if (templateHighlight) {
                            return <div key={index}>{templateHighlight}</div>
                          }
                          
                          // No prompt_update, show content normally
                          return (
                            <ReactMarkdown
                              key={index}
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code: ({ node, className, children, ...props }: any) => {
                                  const match = /language-(\w+)/.exec(className || '')
                                  return (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  )
                                },
                                pre: ({ children }: any) => (
                                  <pre className="bg-background/50 rounded p-2 overflow-x-auto my-2">
                                    {children}
                                  </pre>
                                ),
                                a: ({ href, children }: any) => (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={message.role === 'user' ? 'text-primary-foreground underline' : 'text-primary underline'}
                                  >
                                    {children}
                                  </a>
                                ),
                                ul: ({ children }: any) => (
                                  <ul className="list-disc list-inside my-2 space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }: any) => (
                                  <ol className="list-decimal list-inside my-2 space-y-1">
                                    {children}
                                  </ol>
                                ),
                                h1: ({ children }: any) => <h1 className="text-lg font-bold mt-2 mb-1">{children}</h1>,
                                h2: ({ children }: any) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                                h3: ({ children }: any) => <h3 className="text-sm font-semibold mt-1 mb-1">{children}</h3>,
                                blockquote: ({ children }: any) => (
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
        <div className="border-t px-6 py-4 bg-background relative">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <div className="relative flex-1">
              {/* ContentEditable div for input with badge support */}
              <div
                ref={contentEditableRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  if (contentEditableRef.current) {
                    const newText = extractTextFromContentEditable(contentEditableRef.current)
                    setInput(newText)
                    
                    // Handle @ detection
                    const lastAtIndex = newText.lastIndexOf('@')
                    
                    if (lastAtIndex !== -1) {
                      const textAfterAt = newText.substring(lastAtIndex + 1)
                      // Check if we have an active @ mention (no space or newline after it)
                      const spaceIndex = textAfterAt.indexOf(' ')
                      const newlineIndex = textAfterAt.indexOf('\n')
                      
                      if (spaceIndex === -1 && newlineIndex === -1) {
                        setTemplateQuery(textAfterAt)
                        setMentionStartPos(lastAtIndex)
                        setShowTemplateAutocomplete(true)
                        setSelectedTemplateIndex(0)
                        return
                      }
                    }
                    
                    setShowTemplateAutocomplete(false)
                    setTemplateQuery('')
                    setMentionStartPos(null)
                  }
                }}
                onKeyDown={handleKeyPress}
                onFocus={() => {
                  // Remove placeholder on focus
                  if (contentEditableRef.current) {
                    const placeholder = contentEditableRef.current.querySelector('.placeholder-text')
                    if (placeholder) {
                      placeholder.remove()
                    }
                  }
                }}
                onBlur={() => {
                  // Re-add placeholder if empty
                  if (contentEditableRef.current && !input) {
                    const hasContent = contentEditableRef.current.textContent?.trim()
                    if (!hasContent) {
                      contentEditableRef.current.innerHTML = '<span class="placeholder-text text-muted-foreground pointer-events-none select-none">Type your message... Use @ to reference templates (Shift+Enter for new line)</span>'
                    }
                  }
                }}
                className="min-h-[60px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
                style={{
                  minHeight: '60px',
                  maxHeight: '120px',
                }}
                data-placeholder="Type your message... Use @ to reference templates (Shift+Enter for new line)"
              />
              
              {/* Hidden textarea for form value (needed for some edge cases) */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={() => {}}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              
              {/* Template Autocomplete Dropdown */}
              {showTemplateAutocomplete && filteredTemplates.length > 0 && (
                <div
                  ref={autocompleteRef}
                  className="absolute bottom-full left-0 mb-2 w-full bg-popover border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto"
                >
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground px-2 py-1 mb-1">
                      Templates
                    </div>
                    {filteredTemplates.map((template, index) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => selectTemplate(template)}
                        className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors ${
                          index === selectedTemplateIndex ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">@{template.id}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.name}
                          </span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

