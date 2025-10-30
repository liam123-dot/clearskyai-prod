'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { HelpCircle, Plus, X, Sparkles } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { detectVariables, getVariable } from '@/lib/tools/variables'

export interface ArrayItemConfig {
  mode: 'fixed' | 'ai'
  value?: string
  prompt?: string
}

export interface ParameterConfig {
  mode: 'fixed' | 'ai'
  // For fixed mode (non-array)
  value?: string | number | boolean
  // For AI mode (non-array)
  prompt?: string
  // For array mode
  arrayItems?: ArrayItemConfig[]
  // AI extension for arrays
  aiCanAdd?: boolean
  aiMustAdd?: boolean
  aiAddPrompt?: string
}

interface ParameterConfigProps {
  name: string
  label: string
  description?: string
  required?: boolean
  isArray?: boolean
  isBoolean?: boolean
  isInteger?: boolean
  hasOptions?: boolean
  options?: string[]
  defaultValue?: string | number | boolean
  value: ParameterConfig
  onChange: (config: ParameterConfig) => void
  onRemove?: () => void
  customFixedInput?: React.ReactNode
}

export function ParameterConfigField({
  name,
  label,
  description,
  required = false,
  isArray = false,
  isBoolean = false,
  isInteger = false,
  hasOptions = false,
  options = [],
  defaultValue,
  value,
  onChange,
  onRemove,
  customFixedInput,
}: ParameterConfigProps) {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filter options based on search query
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Detect variables in the current value (both fixed and AI modes)
  const detectedVariables = (() => {
    const vars: string[] = []
    
    // Check fixed value
    if (value.mode === 'fixed' && typeof value.value === 'string') {
      vars.push(...detectVariables(value.value))
    }
    
    // Check AI prompt
    if (value.mode === 'ai' && value.prompt) {
      vars.push(...detectVariables(value.prompt))
    }
    
    // Check array items
    if (value.arrayItems) {
      value.arrayItems.forEach((item) => {
        if (item.mode === 'fixed' && item.value) {
          vars.push(...detectVariables(item.value))
        } else if (item.mode === 'ai' && item.prompt) {
          vars.push(...detectVariables(item.prompt))
        }
      })
    }
    
    // Check AI extension prompt for arrays
    if (value.aiCanAdd && value.aiAddPrompt) {
      vars.push(...detectVariables(value.aiAddPrompt))
    }
    
    // Remove duplicates
    return Array.from(new Set(vars))
  })()
  
  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Header row - label and dropdown on same line for non-arrays */}
        {!isArray ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label className="font-medium">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
              </Label>
              {description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-sm">{description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                  onClick={onRemove}
                >
                  <X className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              )}
            </div>
            <Select
              value={value.mode}
              onValueChange={(mode) => {
                onChange({
                  mode: mode as 'fixed' | 'ai',
                  ...(mode === 'fixed'
                    ? { value: value.value || defaultValue || '' }
                    : { prompt: value.prompt || '' }),
                })
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed Value</SelectItem>
                <SelectItem value="ai">AI Generated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Label className="font-medium">
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-sm">{description}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto py-0.5 px-2 text-xs text-muted-foreground"
                onClick={onRemove}
              >
                <X className="h-3 w-3 mr-1" />
                Remove
              </Button>
            )}
          </div>
        )}

        {/* Variable Badges - Show detected variables */}
        {detectedVariables.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Variables detected:</span>
            {detectedVariables.map((varName) => {
              const variable = getVariable(varName)
              return variable ? (
                <Tooltip key={varName}>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="gap-1 cursor-help">
                      <Sparkles className="h-3 w-3" />
                      {variable.displayName}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm font-medium">{variable.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                    {variable.example && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Example: {variable.example}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ) : null
            })}
          </div>
        )}

        {/* Value Inputs */}
        {isArray ? (
          // Array type - each item has its own Fixed/AI selector
          <div className="space-y-2">
            {value.arrayItems?.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={item.mode}
                  onValueChange={(mode) => {
                    const newItems = [...(value.arrayItems || [])]
                    newItems[index] = {
                      mode: mode as 'fixed' | 'ai',
                      ...(mode === 'fixed' ? { value: item.value || '' } : { prompt: item.prompt || '' }),
                    }
                    onChange({ ...value, arrayItems: newItems })
                  }}
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="ai">AI</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={
                    item.mode === 'ai'
                      ? 'AI prompt (e.g., Extract email from conversation)'
                      : 'Enter value...'
                  }
                  value={item.mode === 'fixed' ? item.value || '' : item.prompt || ''}
                  onChange={(e) => {
                    const newItems = [...(value.arrayItems || [])]
                    if (item.mode === 'fixed') {
                      newItems[index] = { ...item, value: e.target.value }
                    } else {
                      newItems[index] = { ...item, prompt: e.target.value }
                    }
                    onChange({ ...value, arrayItems: newItems })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const newItems = value.arrayItems?.filter((_, i) => i !== index)
                    onChange({ ...value, arrayItems: newItems })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full border border-dashed"
              onClick={() => {
                onChange({
                  ...value,
                  arrayItems: [...(value.arrayItems || []), { mode: 'fixed', value: '' }],
                })
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>

            {/* AI Extension Options */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${name}-ai-can-add`}
                  checked={value.aiCanAdd || false}
                  onCheckedChange={(checked) =>
                    onChange({
                      ...value,
                      aiCanAdd: checked as boolean,
                      aiMustAdd: checked ? value.aiMustAdd : false,
                      aiAddPrompt: checked ? value.aiAddPrompt : '',
                    })
                  }
                />
                <Label
                  htmlFor={`${name}-ai-can-add`}
                  className="text-sm font-normal cursor-pointer"
                >
                  AI can add additional items
                </Label>
              </div>

              {value.aiCanAdd && (
                <>
                  <Input
                    placeholder="e.g., Add any other relevant email addresses from the conversation"
                    value={value.aiAddPrompt || ''}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        aiAddPrompt: e.target.value,
                      })
                    }
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`${name}-ai-must-add`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Force AI to add items
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground">
                            <HelpCircle className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="text-sm">Require the AI to add at least one additional item</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      id={`${name}-ai-must-add`}
                      checked={value.aiMustAdd || false}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...value,
                          aiMustAdd: checked,
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          // Non-array type - input below the header row
          value.mode === 'fixed' ? (
            customFixedInput ||
            (isBoolean ? (
              <div className="flex items-center space-x-2 h-10 px-3 border rounded-md bg-muted/30">
                <Switch
                  id={`${name}-boolean-value`}
                  checked={!!value.value}
                  onCheckedChange={(checked) => onChange({ ...value, value: checked })}
                />
                <Label htmlFor={`${name}-boolean-value`} className="text-sm font-normal cursor-pointer">
                  {value.value ? 'Yes' : 'No'}
                </Label>
              </div>
            ) : isInteger ? (
              <Input
                type="number"
                placeholder="Enter integer value..."
                value={typeof value.value === 'number' ? value.value : ''}
                onChange={(e) => onChange({ ...value, value: parseInt(e.target.value, 10) })}
              />
            ) : hasOptions && options.length > 0 ? (
              <Select
                value={typeof value.value === 'string' ? value.value : (defaultValue as string) || ''}
                onValueChange={(newValue) => onChange({ ...value, value: newValue })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value..." />
                </SelectTrigger>
                <SelectContent>
                  {options.length > 5 && (
                    <div className="px-2 py-2 border-b">
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-8"
                      />
                    </div>
                  )}
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      No results found
                    </div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Enter text or insert data..."
                value={typeof value.value === 'string' ? value.value : ''}
                onChange={(e) => onChange({ ...value, value: e.target.value })}
              />
            ))
          ) : (
            <Input
              placeholder="AI prompt (e.g., Extract email from conversation)"
              value={value.prompt || ''}
              onChange={(e) => onChange({ ...value, prompt: e.target.value })}
            />
          )
        )}
      </div>
    </TooltipProvider>
  )
}

