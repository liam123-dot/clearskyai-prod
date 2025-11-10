'use client'

import { Tool } from '@/lib/tools'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { getToolImageSrc, getToolTypeLabel, getToolTypeBadgeColor } from '@/lib/tools/display'

interface ToolItemProps {
  tool: Tool
  showDescription?: boolean
  className?: string
  onClick?: () => void
  rightContent?: React.ReactNode
  asButton?: boolean
}

export function ToolItem({ 
  tool, 
  showDescription = false, 
  className = '',
  onClick,
  rightContent,
  asButton = false
}: ToolItemProps) {
  const imageSrc = getToolImageSrc(tool)
  const typeLabel = getToolTypeLabel(tool.type, tool)
  
  const content = (
    <div className={`flex items-center gap-3 flex-1 min-w-0 ${className}`}>
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={tool.label || tool.name}
          width={32}
          height={32}
          className="flex-shrink-0 rounded object-contain"
        />
      ) : (
        <div className="w-8 h-8 flex-shrink-0 bg-muted rounded flex items-center justify-center text-xs font-medium">
          {(tool.label || tool.name).charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{tool.label || tool.name}</div>
        {showDescription && tool.description && (
          <div className="text-sm text-muted-foreground truncate mt-0.5">
            {tool.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Badge
          variant="outline"
          className={`${getToolTypeBadgeColor(tool.type)} font-medium`}
        >
          {typeLabel}
        </Badge>
        {rightContent}
      </div>
    </div>
  )
  
  if (asButton && onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left"
      >
        {content}
      </button>
    )
  }
  
  return content
}

