"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { z } from 'zod'
import { PipedreamActionToolConfig, ToolFormProps, ParameterSource } from '@/lib/tools/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, Plus, HelpCircle, Info, AlertTriangle, AlertCircle, Play } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CredentialsDialog } from '@/components/tools/credentials-dialog'
import { ParameterConfigField, ParameterConfig } from '@/components/tools/parameter-config'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PipedreamApp {
  id: string
  name: string
  nameSlug: string
  imgSrc?: string
}

interface PipedreamAccount {
  id: string
  name?: string
  app: {
    nameSlug: string
    name: string
    imgSrc?: string
  }
  healthy: boolean
}

interface PipedreamAction {
  key: string
  name: string
  description?: string
  configurableProps?: ConfigurableProp[]
}

interface ConfigurableProp {
  name: string
  type: string
  label?: string
  description?: string
  optional?: boolean
  hidden?: boolean
  app?: string
  remoteOptions?: boolean
  useQuery?: boolean
  options?: string[]
  default?: string
  // Alert-specific properties
  alertType?: 'info' | 'neutral' | 'warning' | 'error'
  content?: string
}

// Use ParameterConfig from parameter-config component
type PropConfig = ParameterConfig

interface PipedreamActionToolFormProps extends ToolFormProps<PipedreamActionToolConfig> {
  slug: string
}

export function PipedreamActionToolForm({
  slug,
  initialData,
  onChange,
}: PipedreamActionToolFormProps) {
  // App search state
  const [appSearchQuery, setAppSearchQuery] = useState('')
  const [apps, setApps] = useState<PipedreamApp[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedApp, setSelectedApp] = useState<PipedreamApp | null>(
    initialData?.pipedreamMetadata.app
      ? {
          id: initialData.pipedreamMetadata.app,
          nameSlug: initialData.pipedreamMetadata.app,
          name: initialData.pipedreamMetadata.appName,
          imgSrc: initialData.pipedreamMetadata.appImgSrc,
        }
      : null
  )

  // Credentials state
  const [credentials, setCredentials] = useState<PipedreamAccount[]>([])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const [selectedCredentialId, setSelectedCredentialId] = useState(
    initialData?.pipedreamMetadata.accountId || ''
  )

  // Action state
  const [actions, setActions] = useState<PipedreamAction[]>([])
  const [isLoadingActions, setIsLoadingActions] = useState(false)
  const [actionSearchQuery, setActionSearchQuery] = useState('')
  const [selectedAction, setSelectedAction] = useState<PipedreamAction | null>(null)

  // Props configuration state
  const [propsConfig, setPropsConfig] = useState<Record<string, PropConfig>>({})
  const [remoteOptionsData, setRemoteOptionsData] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({})
  const [loadingRemoteOptionsFor, setLoadingRemoteOptionsFor] = useState<string | null>(null)
  const [remoteOptionsQueries, setRemoteOptionsQueries] = useState<Record<string, string>>({})
  
  // Test dialog state
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testDialogAiValues, setTestDialogAiValues] = useState<Record<string, string | string[]>>({})
  const [isExecutingTest, setIsExecutingTest] = useState(false)
  const [testResults, setTestResults] = useState<{
    success: boolean
    result?: unknown
    error?: string
    exports?: unknown
    logs?: string[]
  } | null>(null)
  const [showTestResults, setShowTestResults] = useState(false)
  
  // Ref to store debounce timeouts
  const searchTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({})
  
  // Initialize from initialData when editing
  useEffect(() => {
    if (!initialData || !initialData.pipedreamMetadata || !selectedApp) return
    
    const initializeFromData = async () => {
      try {
        setIsLoadingCredentials(true)
        setIsLoadingActions(true)
        
        // Load credentials
        const credResponse = await fetch(`/api/${slug}/tools/credentials`)
        const credData = await credResponse.json()
        if (credData.success) {
          const appCredentials = (credData.accounts || []).filter(
            (acc: PipedreamAccount) => acc.app.nameSlug === selectedApp.nameSlug
          )
          setCredentials(appCredentials)
        }
        setIsLoadingCredentials(false)
        
        // Load actions
        const actionsResponse = await fetch(`/api/${slug}/tools/actions?app=${encodeURIComponent(selectedApp.nameSlug)}`)
        const actionsData = await actionsResponse.json()
        setIsLoadingActions(false)
        
        if (actionsData.success) {
          const sortedActions = (actionsData.actions || []).sort((a: PipedreamAction, b: PipedreamAction) =>
            a.name.localeCompare(b.name)
          )
          setActions(sortedActions)
          
          // Find and set the selected action
          const savedAction = sortedActions.find(
            (a: PipedreamAction) => a.key === initialData.pipedreamMetadata.actionKey
          )
          
          if (savedAction) {
            setSelectedAction(savedAction)
            
            // Convert initialData.params to PropConfig format
            const convertedPropsConfig: Record<string, PropConfig> = {}
            
            Object.entries(initialData.params).forEach(([key, paramSource]) => {
              if (paramSource.mode === 'fixed') {
                if (Array.isArray(paramSource.value)) {
                  // Array type
                  convertedPropsConfig[key] = {
                    mode: 'fixed',
                    arrayItems: paramSource.value.map((val: string | number | boolean) => ({
                      mode: 'fixed',
                      value: String(val),
                    })),
                  }
                } else {
                  // Single value (string | number | boolean)
                  const singleValue = paramSource.value as string | number | boolean
                  convertedPropsConfig[key] = {
                    mode: 'fixed',
                    value: singleValue,
                  }
                }
              } else if (paramSource.mode === 'ai') {
                convertedPropsConfig[key] = {
                  mode: 'ai',
                  prompt: paramSource.prompt || '',
                }
              } else if (paramSource.mode === 'array_extendable') {
                convertedPropsConfig[key] = {
                  mode: 'fixed',
                  arrayItems: (paramSource.fixedValues || []).map((val: string | number | boolean) => ({
                    mode: 'fixed',
                    value: String(val),
                  })),
                  aiCanAdd: paramSource.aiExtension?.enabled || false,
                  aiAddPrompt: paramSource.aiExtension?.prompt || '',
                  aiMustAdd: paramSource.aiExtension?.required || false,
                }
              }
            })
            
            setPropsConfig(convertedPropsConfig)
          }
        }
      } catch (error) {
        console.error('Error initializing from initialData:', error)
        setIsLoadingCredentials(false)
        setIsLoadingActions(false)
      }
    }
    
    initializeFromData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

  // Search apps
  const handleAppSearch = async () => {
    if (!appSearchQuery.trim()) {
      toast.error('Please enter a search term')
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch(
        `/api/${slug}/tools/credentials/apps?q=${encodeURIComponent(appSearchQuery)}`
      )
      const data = await response.json()

      if (data.success) {
        setApps(data.apps || [])
      } else {
        toast.error(data.error || 'Failed to search apps')
        setApps([])
      }
    } catch {
      toast.error('An error occurred while searching')
      setApps([])
    } finally {
      setIsSearching(false)
    }
  }

  // Select an app
  const handleAppSelect = async (app: PipedreamApp) => {
    setSelectedApp(app)
    setSelectedCredentialId('')
    setSelectedAction(null)
    setActions([])
    setPropsConfig({})

    // Load credentials and actions for this app
    await Promise.all([loadCredentials(app.nameSlug), loadActions(app.nameSlug)])
  }

  // Load credentials for app
  const loadCredentials = async (appSlug: string) => {
    setIsLoadingCredentials(true)

    try {
      const response = await fetch(`/api/${slug}/tools/credentials`)
      const data = await response.json()

      if (data.success) {
        // Filter credentials for this app
        const appCredentials = (data.accounts || []).filter(
          (acc: PipedreamAccount) => acc.app.nameSlug === appSlug
        )
        setCredentials(appCredentials)

        // Auto-select if only one credential
        if (appCredentials.length === 1) {
          setSelectedCredentialId(appCredentials[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    } finally {
      setIsLoadingCredentials(false)
    }
  }

  // Load actions for app
  const loadActions = async (appSlug: string) => {
    setIsLoadingActions(true)

    try {
      const response = await fetch(`/api/${slug}/tools/actions?app=${encodeURIComponent(appSlug)}`)
      const data = await response.json()

      if (data.success) {
        // Sort actions alphabetically
        const sortedActions = (data.actions || []).sort((a: PipedreamAction, b: PipedreamAction) =>
          a.name.localeCompare(b.name)
        )
        setActions(sortedActions)
      } else {
        toast.error(data.error || 'Failed to load actions')
      }
    } catch (error) {
      console.error('Failed to load actions:', error)
      toast.error('Failed to load actions')
    } finally {
      setIsLoadingActions(false)
    }
  }

  // Handle credential refresh after creating new one
  const handleCredentialCreated = async () => {
    if (selectedApp) {
      await loadCredentials(selectedApp.nameSlug)
    }
  }

  // Handle action selection
  const handleActionSelect = (actionKey: string) => {
    const action = actions.find((a) => a.key === actionKey)
    if (!action) return

    setSelectedAction(action)

    // Initialize props config
    const initialConfig: Record<string, PropConfig> = {}

    // Filter visible props
    const visibleProps = (action.configurableProps || []).filter(
      (prop) => !prop.hidden && prop.type !== 'app'
    )

    // Initialize required props as 'fixed', optional as not configured
    visibleProps.forEach((prop) => {
      // Skip alert-type props (they don't need configuration)
      if (prop.type === 'alert') return
      
      if (!prop.optional) {
        const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
        const isBooleanType = prop.type === 'boolean'
        
        if (isArrayType) {
          initialConfig[prop.name] = {
            mode: 'fixed',
            arrayItems: [{ mode: 'fixed', value: '' }],
          }
        } else if (isBooleanType) {
          initialConfig[prop.name] = {
            mode: 'fixed',
            value: prop.default !== undefined ? prop.default : false,
          }
        } else {
          initialConfig[prop.name] = {
            mode: 'fixed',
            value: prop.default || undefined,
          }
        }
      }
    })

    setPropsConfig(initialConfig)
    setRemoteOptionsData({})
  }

  // Load remote options for a prop
  const loadRemoteOptions = useCallback(async (propName: string, query: string = '') => {
    if (!selectedAction || !selectedCredentialId) return

    setLoadingRemoteOptionsFor(propName)

    try {
      // Build configured props
      const configuredProps: Record<string, string | number | boolean | { authProvisionId: string }> = {}

      // Add app/credential field
      const appField = selectedAction.configurableProps?.find((p) => p.type === 'app')
      if (appField) {
        configuredProps[appField.name] = {
          authProvisionId: selectedCredentialId,
        }
      }

      // Add other configured props
      Object.entries(propsConfig).forEach(([key, config]) => {
        if (key !== propName && config.mode === 'fixed' && config.value !== undefined) {
          configuredProps[key] = config.value
        }
      })

      const response = await fetch(`/api/${slug}/tools/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: selectedAction.key,
          propName,
          configuredProps,
          query,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Extract options
        let options: Array<{ label: string; value: string }> = []

        if (data.stringOptions && Array.isArray(data.stringOptions)) {
          options = data.stringOptions.map((str: string) => ({
            label: str,
            value: str,
          }))
        } else if (data.options && Array.isArray(data.options)) {
          options = data.options.map((opt: unknown) => {
            if (opt && typeof opt === 'object' && 'label' in opt && 'value' in opt) {
              return { label: String(opt.label), value: String(opt.value) }
            }
            const stringValue = String(opt)
            return { label: stringValue, value: stringValue }
          })
        }

        setRemoteOptionsData((prev) => ({
          ...prev,
          [propName]: options,
        }))

        // Auto-select if only one option
        if (options.length === 1) {
          setPropsConfig((prev) => ({
            ...prev,
            [propName]: {
              mode: 'fixed',
              value: options[0].value,
            },
          }))
        }
      } else {
        toast.error(data.error || 'Failed to load options')
      }
    } catch (error) {
      console.error('Error loading remote options:', error)
      toast.error('Failed to load options')
    } finally {
      setLoadingRemoteOptionsFor(null)
    }
  }, [selectedAction, selectedCredentialId, slug, propsConfig])

  // Update prop config
  const updatePropConfig = (propName: string, config: Partial<PropConfig>) => {
    setPropsConfig((prev) => ({
      ...prev,
      [propName]: {
        ...prev[propName],
        ...config,
      } as PropConfig,
    }))
  }

  // Auto-load remote options when a field becomes ready
  useEffect(() => {
    if (!selectedAction || !selectedCredentialId) return

    const visiblePropsLocal = selectedAction.configurableProps?.filter(
      (prop) => !prop.hidden && prop.type !== 'app'
    ) || []

    visiblePropsLocal.forEach((prop) => {
      // Only auto-load if:
      // 1. Prop has remoteOptions enabled
      // 2. Prop is configured (shown in the form)
      // 3. Not currently loading this prop
      // 4. Haven't loaded options yet
      // 5. Not in AI mode (only load for fixed mode)
      const config = propsConfig[prop.name]
      if (
        prop.remoteOptions &&
        config &&
        config.mode === 'fixed' &&
        loadingRemoteOptionsFor !== prop.name &&
        !remoteOptionsData[prop.name]
      ) {
        loadRemoteOptions(prop.name)
      }
    })
  }, [selectedAction, selectedCredentialId, propsConfig, loadingRemoteOptionsFor, remoteOptionsData, loadRemoteOptions])

  // Update parent whenever configuration changes
  useEffect(() => {
    if (!selectedApp || !selectedCredentialId || !selectedAction) return

    // Convert props config to ParameterSource format
    const params: Record<string, ParameterSource> = {}

    Object.entries(propsConfig).forEach(([key, config]) => {
      const prop = selectedAction.configurableProps?.find((p) => p.name === key)
      const isArrayType = prop?.type === 'string[]' || prop?.type === 'integer[]'

      if (isArrayType && config.arrayItems) {
        // Array type with individual item configurations
        const fixedValues: string[] = []
        const aiPrompts: string[] = []
        
        config.arrayItems.forEach((item) => {
          if (item.mode === 'fixed' && item.value) {
            fixedValues.push(item.value)
          } else if (item.mode === 'ai' && item.prompt) {
            aiPrompts.push(item.prompt)
          }
        })

        // If we have AI extension enabled
        if (config.aiCanAdd && config.aiAddPrompt) {
          params[key] = {
            mode: 'array_extendable',
            fixedValues,
            aiExtension: {
              enabled: true,
              prompt: config.aiAddPrompt,
              required: config.aiMustAdd || false,
              itemSchema: z.string().describe(config.aiAddPrompt),
            },
          }
        } else if (aiPrompts.length > 0 || fixedValues.length === 0) {
          // If any AI prompts exist, treat as AI mode
          params[key] = {
            mode: 'ai',
            prompt: aiPrompts.join(', ') || 'Extract values from conversation',
            schema: z.array(z.string()).describe(aiPrompts.join(', ') || 'Extract values'),
          }
        } else {
          // Pure fixed values
          params[key] = {
            mode: 'fixed',
            value: fixedValues,
          }
        }
      } else if (config.mode === 'fixed' && config.value !== undefined) {
        // Single fixed value
        params[key] = {
          mode: 'fixed',
          value: config.value,
        }
      } else if (config.mode === 'ai' && config.prompt) {
        // Single AI value
        params[key] = {
          mode: 'ai',
          prompt: config.prompt,
          schema: z.string().describe(config.prompt),
        }
      }
    })

    // Find the app field name from configurableProps
    const appField = selectedAction.configurableProps?.find((p) => p.type === 'app')

    const toolConfig: PipedreamActionToolConfig = {
      type: 'pipedream_action',
      label: initialData?.label || '',
      description: initialData?.description || '',
      pipedreamMetadata: {
        app: selectedApp.nameSlug,
        appName: selectedApp.name,
        appImgSrc: selectedApp.imgSrc,
        appFieldName: appField?.name || 'app',
        accountId: selectedCredentialId,
        actionKey: selectedAction.key,
        actionName: selectedAction.name,
      },
      params,
    }

    onChange(toolConfig)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, selectedCredentialId, selectedAction, propsConfig])

  // Get visible props
  const visibleProps = selectedAction?.configurableProps?.filter(
    (prop) => !prop.hidden && prop.type !== 'app'
  ) || []

  // Filtered actions for search
  const filteredActions = actions.filter((action) => {
    if (!actionSearchQuery.trim()) return true
    const query = actionSearchQuery.toLowerCase()
    return (
      action.name.toLowerCase().includes(query) ||
      action.description?.toLowerCase().includes(query)
    )
  })

  // ===== TEST FUNCTIONALITY =====
  
  // Get required fields that need AI input
  const getAiRequiredFields = (): Array<{ prop: ConfigurableProp; name: string }> => {
    if (!selectedAction) return []
    
    const visibleProps = selectedAction.configurableProps?.filter(
      (prop) => !prop.hidden && prop.type !== 'app' && prop.type !== 'alert'
    ) || []
    
    const aiFields: Array<{ prop: ConfigurableProp; name: string }> = []
    
    visibleProps.forEach((prop) => {
      const config = propsConfig[prop.name]
      
      if (!config) return
      
      const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
      
      if (isArrayType && config.arrayItems) {
        // Check if any array items are in AI mode
        const hasAiItems = config.arrayItems.some(item => item.mode === 'ai')
        if (hasAiItems) {
          aiFields.push({ prop, name: prop.name })
        }
      } else if (config.mode === 'ai') {
        aiFields.push({ prop, name: prop.name })
      }
    })
    
    return aiFields
  }
  
  // Check if all required fields are configured
  const validateRequiredFields = (): { valid: boolean; missingFields: string[] } => {
    if (!selectedAction) return { valid: false, missingFields: ['No action selected'] }
    
    const visibleProps = selectedAction.configurableProps?.filter(
      (prop) => !prop.hidden && prop.type !== 'app' && prop.type !== 'alert'
    ) || []
    
    const missingFields: string[] = []
    
    visibleProps.forEach((prop) => {
      if (!prop.optional) {
        const config = propsConfig[prop.name]
        
        if (!config) {
          missingFields.push(prop.label || prop.name)
          return
        }
        
        const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
        
        if (isArrayType && config.arrayItems) {
          const hasValidItems = config.arrayItems.some(
            item => (item.mode === 'fixed' && item.value) || (item.mode === 'ai' && item.prompt)
          )
          if (!hasValidItems) {
            missingFields.push(prop.label || prop.name)
          }
        } else if (config.mode === 'fixed' && config.value === undefined && !config.value) {
          missingFields.push(prop.label || prop.name)
        } else if (config.mode === 'ai' && !config.prompt) {
          missingFields.push(prop.label || prop.name)
        }
      }
    })
    
    return { valid: missingFields.length === 0, missingFields }
  }
  
  // Handle test button click
  const handleTestClick = () => {
    const validation = validateRequiredFields()
    
    if (!validation.valid) {
      toast.error(`Missing required fields: ${validation.missingFields.join(', ')}`)
      return
    }

    setTestDialogAiValues({})
    setTestResults(null)
    setShowTestResults(false)
    setShowTestDialog(true)
  }
  
  // Execute test
  const executeTest = async () => {
    if (!selectedApp || !selectedCredentialId || !selectedAction) return
    
    setIsExecutingTest(true)
    
    try {
      // Build the params to send
      const testParams: Record<string, unknown> = {}
      
      const visibleProps = selectedAction.configurableProps?.filter(
        (prop) => !prop.hidden && prop.type !== 'app' && prop.type !== 'alert'
      ) || []
      
      visibleProps.forEach((prop) => {
        const config = propsConfig[prop.name]
        if (!config) return
        
        const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
        
        if (isArrayType && config.arrayItems) {
          const values: string[] = []
          const arrayItems = config.arrayItems
          arrayItems.forEach((item, itemIndex) => {
            if (item.mode === 'fixed' && item.value) {
              values.push(item.value)
            } else if (item.mode === 'ai') {
              // Use user-provided AI value from dialog
              const userProvidedValue = testDialogAiValues[`${prop.name}_${itemIndex}`]
              if (userProvidedValue) {
                values.push(String(userProvidedValue))
              }
            }
          })
          if (values.length > 0) {
            testParams[prop.name] = values
          }
        } else if (config.mode === 'fixed' && config.value !== undefined) {
          testParams[prop.name] = config.value
        } else if (config.mode === 'ai') {
          // Use user-provided AI value from dialog
          const userProvidedValue = testDialogAiValues[prop.name]
          if (userProvidedValue) {
            testParams[prop.name] = userProvidedValue
          }
        }
      })
      
      // Call the execute endpoint
      const response = await fetch(`/api/tools/execute-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          app: selectedApp.nameSlug,
          appName: selectedApp.name,
          appImgSrc: selectedApp.imgSrc,
          appFieldName: selectedAction.configurableProps?.find(p => p.type === 'app')?.name || 'app',
          accountId: selectedCredentialId,
          actionKey: selectedAction.key,
          actionName: selectedAction.name,
          params: testParams,
        }),
      })
      
      const data = await response.json()
      
      setTestResults({
        success: data.success,
        result: data.result,
        error: data.error || data.details,
        exports: data.exports,
        logs: data.logs,
      })
      
      setShowTestResults(true)
      
      if (data.success) {
        toast.success('Test executed successfully!')
      } else {
        toast.error('Test execution failed')
      }
    } catch (error) {
      console.error('Error executing test:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setTestResults({
        success: false,
        error: errorMessage,
      })
      setShowTestResults(true)
      toast.error('Error executing test')
    } finally {
      setIsExecutingTest(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* App Selection */}
        {!selectedApp && (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Select App</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Search for the app you want to integrate with
              </p>
            </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search apps (e.g., Google Sheets, Slack)..."
                      value={appSearchQuery}
                      onChange={(e) => setAppSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAppSearch()}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={handleAppSearch} disabled={isSearching}>
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Searching...
                      </>
                    ) : (
                      'Search'
                    )}
                  </Button>
                </div>

                {/* Apps Grid */}
                {apps.length > 0 && (
                  <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                    {apps.map((app) => (
                      <Card
                        key={app.nameSlug}
                        className="hover:bg-accent cursor-pointer transition-colors p-4"
                        onClick={() => handleAppSelect(app)}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {app.imgSrc ? (
                            <Image src={app.imgSrc} alt={app.name} width={48} height={48} className="rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-lg font-medium">
                              {app.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="text-sm font-medium text-center line-clamp-2">
                            {app.name}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
        )}

        {/* Selected App, Credential, and Action */}
        {selectedApp && (
          <div className="space-y-4">
                {/* App Header */}
                <div className="flex items-center justify-between pb-3 border-b">
                  <div className="flex items-center gap-3">
                    {selectedApp.imgSrc && (
                      <Image src={selectedApp.imgSrc} alt={selectedApp.name} width={32} height={32} className="rounded" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{selectedApp.name}</div>
                      <div className="text-xs text-muted-foreground">Selected App</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedApp(null)
                      setSelectedCredentialId('')
                      setSelectedAction(null)
                      setPropsConfig({})
                    }}
                  >
                    Change App
                  </Button>
                </div>

                {/* Credential Selection */}
                <div className="space-y-2">
                  <Label>Credential</Label>
                  {isLoadingCredentials ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading credentials...</span>
                    </div>
                  ) : credentials.length > 0 ? (
                    <div className="flex gap-2">
                      <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose credential" />
                        </SelectTrigger>
                        <SelectContent>
                          {credentials.map((cred) => (
                            <SelectItem key={cred.id} value={cred.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    cred.healthy ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                />
                                <span>{cred.name || `${selectedApp.name} Account`}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <CredentialsDialog 
                        slug={slug}
                        app={selectedApp} 
                        onConnectionSuccess={handleCredentialCreated} 
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No credentials found for this app. Please add one.
                      </p>
                      <CredentialsDialog 
                        slug={slug}
                        app={selectedApp} 
                        onConnectionSuccess={handleCredentialCreated} 
                      />
                    </div>
                  )}
                </div>

                {/* Action Selection */}
                {selectedCredentialId && (
                  <div className="space-y-2">
                    <Label>Action</Label>
                    {isLoadingActions ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Loading actions...</span>
                      </div>
                    ) : actions.length > 0 ? (
                      <Select
                        value={selectedAction?.key || ''}
                        onValueChange={handleActionSelect}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Choose action (${actions.length} available)`} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[400px]">
                          {/* Search input */}
                          <div className="bg-popover border-b px-2 py-2 sticky top-0 z-50">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                              <Input
                                placeholder="Search actions..."
                                value={actionSearchQuery}
                                onChange={(e) => setActionSearchQuery(e.target.value)}
                                className="pl-8 h-8 border-input"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* Actions list */}
                          <div className="overflow-y-auto max-h-[340px] p-1">
                            {filteredActions.length > 0 ? (
                              filteredActions.map((action) => (
                                <div key={action.key} className="flex items-center">
                                  <SelectItem value={action.key} className="flex-1">
                                    {action.name}
                                  </SelectItem>
                                  {action.description && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) => e.stopPropagation()}
                                          className="px-2 text-muted-foreground hover:text-foreground"
                                        >
                                          <HelpCircle className="h-4 w-4" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-sm">{action.description}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                                No actions found
                              </div>
                            )}
                          </div>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">No actions available</p>
                    )}
                  </div>
                )}
          </div>
        )}

        {/* Props Configuration */}
        {selectedAction && visibleProps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-medium">Configure Fields</h3>
            <p className="text-sm text-muted-foreground">
              Configure the fields for this action. Required fields will unlock as you progress.
            </p>

            {visibleProps.map((prop) => {
              // Handle alert type props
              if (prop.type === 'alert') {
                const alertVariant = 
                  prop.alertType === 'error' ? 'destructive' : 'default'
                
                const AlertIcon = 
                  prop.alertType === 'error' ? AlertCircle :
                  prop.alertType === 'warning' ? AlertTriangle :
                  Info
                
                const alertColor =
                  prop.alertType === 'info' ? 'text-blue-600' :
                  prop.alertType === 'warning' ? 'text-yellow-600' :
                  prop.alertType === 'error' ? 'text-destructive' :
                  'text-muted-foreground'
                
                return (
                  <Alert key={prop.name} variant={alertVariant} className="my-3">
                    <AlertIcon className={alertColor} />
                    <AlertDescription>
                      {prop.content}
                    </AlertDescription>
                  </Alert>
                )
              }
              
              const config = propsConfig[prop.name]
              const hasConfig = config && config.mode !== undefined

              // Skip if optional and not configured
              if (prop.optional && !hasConfig) return null

              const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
              const isBooleanType = prop.type === 'boolean'
              const isIntegerType = prop.type === 'integer'

              return (
                <ParameterConfigField
                  key={prop.name}
                  name={prop.name}
                  label={prop.label || prop.name}
                  description={prop.description}
                  required={!prop.optional}
                  isArray={isArrayType}
                  isBoolean={isBooleanType}
                  isInteger={isIntegerType}
                  hasOptions={prop.options && prop.options.length > 0}
                  options={prop.options}
                  defaultValue={prop.default}
                  value={config || { mode: 'fixed' }}
                  onChange={(newConfig) => {
                    setPropsConfig((prev) => ({
                      ...prev,
                      [prop.name]: newConfig,
                    }))
                  }}
                  onRemove={
                    prop.optional
                      ? () => {
                          setPropsConfig((prev) => {
                            const updated = { ...prev }
                            delete updated[prop.name]
                            return updated
                          })
                        }
                      : undefined
                  }
                  customFixedInput={
                    prop.remoteOptions ? (
                      <div className="space-y-2">
                        <Select
                          value={typeof config?.value === 'string' ? config.value : ''}
                          onValueChange={(value) =>
                            updatePropConfig(prop.name, { value })
                          }
                          onOpenChange={(open) => {
                            if (open && !remoteOptionsData[prop.name]) {
                              loadRemoteOptions(prop.name)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select value..." />
                          </SelectTrigger>
                          <SelectContent>
                            {prop.useQuery && (
                              <div className="px-2 py-2 border-b">
                                <Input
                                  placeholder="Search..."
                                  value={remoteOptionsQueries[prop.name] || ''}
                                  onChange={(e) => {
                                    const query = e.target.value
                                    setRemoteOptionsQueries((prev) => ({
                                      ...prev,
                                      [prop.name]: query,
                                    }))
                                    
                                    // Clear existing timeout
                                    if (searchTimeoutsRef.current[prop.name]) {
                                      clearTimeout(searchTimeoutsRef.current[prop.name])
                                    }
                                    
                                    // Set new timeout for debounced search
                                    searchTimeoutsRef.current[prop.name] = setTimeout(() => {
                                      loadRemoteOptions(prop.name, query)
                                    }, 500)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-8"
                                />
                              </div>
                            )}
                            {loadingRemoteOptionsFor === prop.name ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            ) : remoteOptionsData[prop.name]?.length > 0 ? (
                              remoteOptionsData[prop.name].map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                {prop.useQuery && remoteOptionsQueries[prop.name] 
                                  ? 'No results found' 
                                  : 'No options available'}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : undefined
                  }
                />
              )
            })}

            {/* Optional Fields Section */}
            {visibleProps.some((p) => p.optional && !propsConfig[p.name]) && (
              <div className="space-y-2">
                <Label className="text-sm">Add Optional Parameter</Label>
                <Select
                  value=""
                  onValueChange={(propName) => {
                    setPropsConfig((prev) => ({
                      ...prev,
                      [propName]: { mode: 'fixed', value: undefined },
                    }))
                  }}
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <SelectValue placeholder="Add optional parameter..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {visibleProps
                      .filter((p) => p.optional && !propsConfig[p.name])
                      .map((prop) => (
                        <SelectItem key={prop.name} value={prop.name}>
                          {prop.label || prop.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Test Button */}
            <div className="pt-4 border-t">
              <Button
                type="button"
                onClick={handleTestClick}
                disabled={!selectedAction || !selectedCredentialId}
                className="w-full"
                variant="outline"
              >
                <Play className="h-4 w-4 mr-2" />
                Test Action
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Test Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="!w-[90vw] !max-w-none !h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Test {selectedAction?.name}</DialogTitle>
            <DialogDescription>
              {getAiRequiredFields().length === 0
                ? 'All fields are configured. Click execute to test the action.'
                : `Fill in the required values for ${getAiRequiredFields().length} AI field(s), then click execute.`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1">
            {!showTestResults ? (
              <div className="space-y-4">
                {getAiRequiredFields().length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Provide values for AI fields:</h4>
                  
                  {getAiRequiredFields().map(({ prop, name }) => {
                    const config = propsConfig[name]
                    const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
                    
                    return (
                      <div key={name} className="space-y-2">
                        <Label className="text-sm">
                          {prop.label || name}
                          <span className="text-destructive ml-1">*</span>
                        </Label>
                        {prop.description && (
                          <p className="text-xs text-muted-foreground">{prop.description}</p>
                        )}

                        {isArrayType && config?.arrayItems ? (
                          <div className="space-y-2">
                            {config.arrayItems.map((item, index) => {
                              if (item.mode !== 'ai') return null
                              const fieldKey = `${name}_${index}`
                              return (
                                <div key={index} className="flex flex-col gap-2">
                                  <p className="text-xs text-muted-foreground">
                                    {item.prompt}
                                  </p>
                                  <Input
                                    placeholder={`Enter value for ${prop.label || name}`}
                                    value={(testDialogAiValues[fieldKey] as string) || ''}
                                    onChange={(e) =>
                                      setTestDialogAiValues((prev) => ({
                                        ...prev,
                                        [fieldKey]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {config?.mode === 'ai' && (
                              <p className="text-xs text-muted-foreground">{config.prompt}</p>
                            )}
                            <Input
                              placeholder={`Enter value for ${prop.label || name}`}
                              value={(testDialogAiValues[name] as string) || ''}
                              onChange={(e) =>
                                setTestDialogAiValues((prev) => ({
                                  ...prev,
                                  [name]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Summary of Fixed Values */}
              {propsConfig && Object.keys(propsConfig).length > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Fixed values that will be used:</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {Object.entries(propsConfig).map(([propName, config]) => {
                      const prop = selectedAction?.configurableProps?.find(p => p.name === propName)
                      if (!prop || prop.type === 'app' || prop.type === 'alert') return null
                      
                      const isArrayType = prop.type === 'string[]' || prop.type === 'integer[]'
                      
                      if (isArrayType && config?.arrayItems) {
                        const fixedValues = config.arrayItems
                          .filter(item => item.mode === 'fixed' && item.value)
                          .map(item => item.value)
                        
                        if (fixedValues.length === 0) return null
                        
                        return (
                          <div key={propName}>
                            <span className="font-medium">{prop.label || propName}:</span>{' '}
                            {fixedValues.join(', ')}
                          </div>
                        )
                      } else if (config?.mode === 'fixed' && config.value !== undefined) {
                        return (
                          <div key={propName}>
                            <span className="font-medium">{prop.label || propName}:</span>{' '}
                            {String(config.value)}
                          </div>
                        )
                      }
                      
                      return null
                    })}
                   </div>
                 </div>
               )}
               </div>
             ) : (
               /* Test Results */
               <div className="space-y-4">
                 {testResults?.success ? (
                   <Alert className="border-green-200 bg-green-50">
                     <AlertCircle className="h-4 w-4 text-green-600" />
                     <AlertDescription className="text-green-800">
                       Test executed successfully!
                     </AlertDescription>
                   </Alert>
                 ) : (
                   <Alert variant="destructive">
                     <AlertCircle className="h-4 w-4" />
                     <AlertDescription>
                       {testResults?.error || 'Test execution failed'}
                     </AlertDescription>
                   </Alert>
                 )}

                 <Tabs defaultValue="result" className="w-full">
                   <TabsList className="grid w-full grid-cols-3">
                     <TabsTrigger value="result">Result</TabsTrigger>
                     <TabsTrigger value="exports">Exports</TabsTrigger>
                     <TabsTrigger value="logs">Logs</TabsTrigger>
                   </TabsList>

                   <TabsContent value="result" className="space-y-3 mt-3">
                     {testResults?.result !== null && testResults?.result !== undefined && (
                       <div className="space-y-2">
                         <Label className="text-sm font-medium">Response:</Label>
                         <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                           {String(JSON.stringify(testResults.result, null, 2))}
                         </pre>
                       </div>
                     )}
                   </TabsContent>

                   <TabsContent value="exports" className="space-y-3 mt-3">
                     {testResults?.exports ? (
                       <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                         {String(JSON.stringify(testResults.exports, null, 2))}
                       </pre>
                     ) : (
                       <p className="text-sm text-muted-foreground">No exports returned</p>
                     )}
                   </TabsContent>

                   <TabsContent value="logs" className="space-y-3 mt-3">
                     {testResults?.logs && testResults.logs.length > 0 ? (
                       <div className="bg-black text-white p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
                         {testResults.logs.map((log, i) => (
                           <div key={i}>{log}</div>
                         ))}
                       </div>
                     ) : (
                       <p className="text-sm text-muted-foreground">No logs available</p>
                     )}
                   </TabsContent>
                 </Tabs>
               </div>
             )}
           </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
            {!showTestResults ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTestDialog(false)}
                  disabled={isExecutingTest}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={executeTest}
                  disabled={isExecutingTest || (getAiRequiredFields().length > 0 && getAiRequiredFields().some(
                    ({ name }) => !testDialogAiValues[name]
                  ))}
                >
                  {isExecutingTest ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Execute Test
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTestResults(false)
                    setTestResults(null)
                    setTestDialogAiValues({})
                  }}
                >
                  Test Again
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowTestDialog(false)}
                >
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

