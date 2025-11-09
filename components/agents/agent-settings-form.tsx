"use client"

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Loader2, X, Plus } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Voice {
  voice_id: string
  name: string
  preview_url: string
  category?: string
  language?: string
  accent?: string
}

interface AgentSettingsFormProps {
  agentId: string
  slug: string
  isAdmin: boolean
  initialVoiceId: string
  initialEndpointing: number
  initialEotThreshold: number
  initialEotTimeoutMs: number
  initialStartSpeakingPlanWaitSeconds: number
  initialTranscriptionOnPunctuationSeconds: number
  initialTranscriptionOnNoPunctuationSeconds: number
  initialTranscriptionOnNumberSeconds: number
  initialStopSpeakingPlanVoiceSeconds: number
  initialStopSpeakingPlanNumWords: number
  initialStopSpeakingPlanBackoffSeconds: number
  initialServerMessages: string[]
  initialKeyterms: string[]
}

export function AgentSettingsForm({
  agentId,
  slug,
  isAdmin,
  initialVoiceId,
  initialEndpointing,
  initialEotThreshold,
  initialEotTimeoutMs,
  initialStartSpeakingPlanWaitSeconds,
  initialTranscriptionOnPunctuationSeconds,
  initialTranscriptionOnNoPunctuationSeconds,
  initialTranscriptionOnNumberSeconds,
  initialStopSpeakingPlanVoiceSeconds,
  initialStopSpeakingPlanNumWords,
  initialStopSpeakingPlanBackoffSeconds,
  initialServerMessages,
  initialKeyterms,
}: AgentSettingsFormProps) {
  // Baseline values (last saved state) - used for change detection
  const [baselineVoiceId, setBaselineVoiceId] = useState(initialVoiceId)
  const [baselineEndpointing, setBaselineEndpointing] = useState(initialEndpointing)
  const [baselineEotThreshold, setBaselineEotThreshold] = useState(initialEotThreshold)
  const [baselineEotTimeoutMs, setBaselineEotTimeoutMs] = useState(initialEotTimeoutMs)
  const [baselineStartSpeakingPlanWaitSeconds, setBaselineStartSpeakingPlanWaitSeconds] = useState(initialStartSpeakingPlanWaitSeconds)
  const [baselineTranscriptionOnPunctuationSeconds, setBaselineTranscriptionOnPunctuationSeconds] = useState(initialTranscriptionOnPunctuationSeconds)
  const [baselineTranscriptionOnNoPunctuationSeconds, setBaselineTranscriptionOnNoPunctuationSeconds] = useState(initialTranscriptionOnNoPunctuationSeconds)
  const [baselineTranscriptionOnNumberSeconds, setBaselineTranscriptionOnNumberSeconds] = useState(initialTranscriptionOnNumberSeconds)
  const [baselineStopSpeakingPlanVoiceSeconds, setBaselineStopSpeakingPlanVoiceSeconds] = useState(initialStopSpeakingPlanVoiceSeconds)
  const [baselineStopSpeakingPlanNumWords, setBaselineStopSpeakingPlanNumWords] = useState(initialStopSpeakingPlanNumWords)
  const [baselineStopSpeakingPlanBackoffSeconds, setBaselineStopSpeakingPlanBackoffSeconds] = useState(initialStopSpeakingPlanBackoffSeconds)
  const [baselineKeyterms, setBaselineKeyterms] = useState<string[]>(initialKeyterms)

  // Current form values
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoiceId)
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [languageFilter, setLanguageFilter] = useState<string>('en')
  const [accentFilter, setAccentFilter] = useState<string>('british')
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [availableAccents, setAvailableAccents] = useState<string[]>([])
  const [voiceSelectionMode, setVoiceSelectionMode] = useState<'library' | 'custom'>('library')
  const [customVoiceId, setCustomVoiceId] = useState('')
  const [customVoiceName, setCustomVoiceName] = useState<string | null>(null)
  const [customVoicePreviewUrl, setCustomVoicePreviewUrl] = useState<string | null>(null)
  const [isLookingUpVoice, setIsLookingUpVoice] = useState(false)
  const [voiceLookupError, setVoiceLookupError] = useState<string | null>(null)
  const [isCustomVoiceConfirmed, setIsCustomVoiceConfirmed] = useState(false)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})
  
  // Admin-only state
  const [endpointing, setEndpointing] = useState(initialEndpointing)
  const [eotThreshold, setEotThreshold] = useState(initialEotThreshold)
  const [eotTimeoutMs, setEotTimeoutMs] = useState(initialEotTimeoutMs)
  const [startSpeakingPlanWaitSeconds, setStartSpeakingPlanWaitSeconds] = useState(initialStartSpeakingPlanWaitSeconds)
  const [transcriptionOnPunctuationSeconds, setTranscriptionOnPunctuationSeconds] = useState(initialTranscriptionOnPunctuationSeconds)
  const [transcriptionOnNoPunctuationSeconds, setTranscriptionOnNoPunctuationSeconds] = useState(initialTranscriptionOnNoPunctuationSeconds)
  const [transcriptionOnNumberSeconds, setTranscriptionOnNumberSeconds] = useState(initialTranscriptionOnNumberSeconds)
  const [stopSpeakingPlanVoiceSeconds, setStopSpeakingPlanVoiceSeconds] = useState(initialStopSpeakingPlanVoiceSeconds)
  const [stopSpeakingPlanNumWords, setStopSpeakingPlanNumWords] = useState(initialStopSpeakingPlanNumWords)
  const [stopSpeakingPlanBackoffSeconds, setStopSpeakingPlanBackoffSeconds] = useState(initialStopSpeakingPlanBackoffSeconds)
  const [keyterms, setKeyterms] = useState<string[]>(initialKeyterms)
  const [newKeyword, setNewKeyword] = useState('')

  // Function to fetch custom voice details (used for auto-loading)
  const fetchCustomVoiceDetails = async (voiceId: string) => {
    if (!voiceId.trim()) return

    setIsLookingUpVoice(true)
    setVoiceLookupError(null)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/voices/${voiceId.trim()}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to lookup voice')
      }

      const data = await response.json()
      setCustomVoiceName(data.name)
      setCustomVoicePreviewUrl(data.preview_url || null)
      setVoiceLookupError(null)
      setIsCustomVoiceConfirmed(true)
    } catch (error) {
      console.error('Error looking up voice:', error)
      // Don't show toast for auto-load failures, just log
      setVoiceLookupError(null) // Don't show error on auto-load
    } finally {
      setIsLookingUpVoice(false)
    }
  }

  // Fetch voices with filters
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setIsLoadingVoices(true)
        const params = new URLSearchParams({
          language: languageFilter,
          accent: accentFilter,
        })
        const response = await fetch(`/api/${slug}/agents/${agentId}/voices?${params}`)

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch voices')
        }

        const data = await response.json()
        const filteredVoices = data.voices || []
        setVoices(filteredVoices)
        
        // Update available filter options
        if (data.filters) {
          setAvailableLanguages(data.filters.languages || [])
          setAvailableAccents(data.filters.accents || [])
        }

        // Check if baseline voice ID (saved voice) is not in filtered list
        if (baselineVoiceId && !filteredVoices.some((v: Voice) => v.voice_id === baselineVoiceId)) {
          // This is a custom voice ID - switch to custom mode
          setVoiceSelectionMode('custom')
          setCustomVoiceId(baselineVoiceId)
          
          // Automatically fetch voice details
          try {
            const voiceResponse = await fetch(`/api/${slug}/agents/${agentId}/voices/${baselineVoiceId}`)
            if (voiceResponse.ok) {
              const voiceData = await voiceResponse.json()
              setCustomVoiceName(voiceData.name)
              setCustomVoicePreviewUrl(voiceData.preview_url || null)
              setIsCustomVoiceConfirmed(true)
            }
          } catch (error) {
            console.error('Error auto-loading custom voice:', error)
            // Silently fail for auto-load
          }
        } else if (baselineVoiceId && filteredVoices.some((v: Voice) => v.voice_id === baselineVoiceId)) {
          // Voice is in library - select it in library mode
          setSelectedVoiceId(baselineVoiceId)
          setVoiceSelectionMode('library')
        }
      } catch (error) {
        console.error('Error fetching voices:', error)
        toast.error('Failed to load voices', {
          description: error instanceof Error ? error.message : 'An error occurred',
        })
      } finally {
        setIsLoadingVoices(false)
      }
    }

    fetchVoices()
  }, [slug, agentId, languageFilter, accentFilter])

  const handlePlayPreview = (voiceId: string, previewUrl: string) => {
    // Stop any currently playing audio
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })

    // Create or get audio element for this voice
    if (!audioRefs.current[voiceId]) {
      const audio = new Audio(previewUrl)
      audioRefs.current[voiceId] = audio

      audio.addEventListener('ended', () => {
        setPlayingVoiceId(null)
      })

      audio.addEventListener('error', () => {
        setPlayingVoiceId(null)
        toast.error('Failed to play voice preview')
      })
    }

    const audio = audioRefs.current[voiceId]
    setPlayingVoiceId(voiceId)
    audio.play()
  }

  const handleStopPreview = () => {
    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) {
        audio.pause()
        audio.currentTime = 0
      }
    })
    setPlayingVoiceId(null)
  }

  const handleConfirmCustomVoice = async () => {
    if (!customVoiceId.trim()) {
      setVoiceLookupError('Please enter a voice ID')
      return
    }

    setIsLookingUpVoice(true)
    setVoiceLookupError(null)
    setCustomVoiceName(null)
    setCustomVoicePreviewUrl(null)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/voices/${customVoiceId.trim()}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to lookup voice')
      }

      const data = await response.json()
      setCustomVoiceName(data.name)
      setCustomVoicePreviewUrl(data.preview_url || null)
      setVoiceLookupError(null)
      setIsCustomVoiceConfirmed(true)
      
      // Show success toast
      toast.success('Voice confirmed successfully', {
        description: `${data.name} is now selected`,
      })
    } catch (error) {
      console.error('Error looking up voice:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to lookup voice'
      setVoiceLookupError(errorMessage)
      setCustomVoiceName(null)
      setCustomVoicePreviewUrl(null)
      setIsCustomVoiceConfirmed(false)
      toast.error('Failed to lookup voice', {
        description: errorMessage,
      })
    } finally {
      setIsLookingUpVoice(false)
    }
  }

  const handleEditCustomVoice = () => {
    setIsCustomVoiceConfirmed(false)
    setVoiceLookupError(null)
    handleStopPreview()
  }

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim()
    if (!trimmed) return

    // Split by comma and process each keyword
    const keywordsToAdd = trimmed
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0 && !keyterms.includes(k))

    if (keywordsToAdd.length > 0) {
      setKeyterms([...keyterms, ...keywordsToAdd])
      setNewKeyword('')
    }
  }

  const handleRemoveKeyword = (keywordToRemove: string) => {
    setKeyterms(keyterms.filter(k => k !== keywordToRemove))
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddKeyword()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if keyterms changed (order-insensitive comparison)
    const keytermsChanged = 
      keyterms.length !== baselineKeyterms.length ||
      !keyterms.every(k => baselineKeyterms.includes(k)) ||
      !baselineKeyterms.every(k => keyterms.includes(k))

    // Determine the actual voice ID to use (custom or selected)
    const actualVoiceId = voiceSelectionMode === 'custom' ? customVoiceId : selectedVoiceId

    const hasChanges =
      actualVoiceId !== baselineVoiceId ||
      keytermsChanged ||
      (isAdmin && (
        endpointing !== baselineEndpointing ||
        eotThreshold !== baselineEotThreshold ||
        eotTimeoutMs !== baselineEotTimeoutMs ||
        startSpeakingPlanWaitSeconds !== baselineStartSpeakingPlanWaitSeconds ||
        transcriptionOnPunctuationSeconds !== baselineTranscriptionOnPunctuationSeconds ||
        transcriptionOnNoPunctuationSeconds !== baselineTranscriptionOnNoPunctuationSeconds ||
        transcriptionOnNumberSeconds !== baselineTranscriptionOnNumberSeconds ||
        stopSpeakingPlanVoiceSeconds !== baselineStopSpeakingPlanVoiceSeconds ||
        stopSpeakingPlanNumWords !== baselineStopSpeakingPlanNumWords ||
        stopSpeakingPlanBackoffSeconds !== baselineStopSpeakingPlanBackoffSeconds
      ))

    if (!hasChanges) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)

    try {
      const updatePayload: any = {
        voiceId: actualVoiceId !== baselineVoiceId ? actualVoiceId : undefined,
      }

      // Add keyterms if they changed (for all users)
      if (keytermsChanged) {
        updatePayload.transcriber = {
          keyterm: keyterms,
        }
      }

      // Add admin-only fields if user is admin
      if (isAdmin) {
        // Always set voiceId when admin saves to ensure model is set to eleven_flash_v2_5
        if (actualVoiceId) {
          updatePayload.voiceId = actualVoiceId
        }

        // Always set serverMessages to include chat.created and end-of-call-report when admin saves
        updatePayload.serverMessages = ['chat.created', 'end-of-call-report']

        // Always set transcriber with flux-general-en and deepgram provider when admin saves
        // Merge with keyterms if they were already set above
        updatePayload.transcriber = {
          model: 'flux-general-en',
          provider: 'deepgram',
          language: 'en',
          endpointing,
          eotThreshold,
          eotTimeoutMs,
          ...(updatePayload.transcriber || {}),
          keyterm: keyterms,
        }

        // Always set startSpeakingPlan with smartEndpointingEnabled: false when admin saves
        updatePayload.startSpeakingPlan = {
          waitSeconds: startSpeakingPlanWaitSeconds,
          smartEndpointingEnabled: false,
          transcriptionEndpointingPlan: {
            onPunctuationSeconds: transcriptionOnPunctuationSeconds,
            onNoPunctuationSeconds: transcriptionOnNoPunctuationSeconds,
            onNumberSeconds: transcriptionOnNumberSeconds,
          },
        }

        // Only update stopSpeakingPlan if it changed
        const hasStopSpeakingPlanChanges =
          stopSpeakingPlanVoiceSeconds !== baselineStopSpeakingPlanVoiceSeconds ||
          stopSpeakingPlanNumWords !== baselineStopSpeakingPlanNumWords ||
          stopSpeakingPlanBackoffSeconds !== baselineStopSpeakingPlanBackoffSeconds

        if (hasStopSpeakingPlanChanges) {
          updatePayload.stopSpeakingPlan = {
            voiceSeconds: stopSpeakingPlanVoiceSeconds,
            numWords: stopSpeakingPlanNumWords,
            backoffSeconds: stopSpeakingPlanBackoffSeconds,
          }
        }
      }

      // Remove undefined fields
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key]
        }
      })

      const response = await fetch(`/api/${slug}/agents/${agentId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update agent')
      }

      // Optimistic update: update baseline values to current values
      setBaselineVoiceId(actualVoiceId)
      setBaselineKeyterms([...keyterms])
      
      if (isAdmin) {
        setBaselineEndpointing(endpointing)
        setBaselineEotThreshold(eotThreshold)
        setBaselineEotTimeoutMs(eotTimeoutMs)
        setBaselineStartSpeakingPlanWaitSeconds(startSpeakingPlanWaitSeconds)
        setBaselineTranscriptionOnPunctuationSeconds(transcriptionOnPunctuationSeconds)
        setBaselineTranscriptionOnNoPunctuationSeconds(transcriptionOnNoPunctuationSeconds)
        setBaselineTranscriptionOnNumberSeconds(transcriptionOnNumberSeconds)
        setBaselineStopSpeakingPlanVoiceSeconds(stopSpeakingPlanVoiceSeconds)
        setBaselineStopSpeakingPlanNumWords(stopSpeakingPlanNumWords)
        setBaselineStopSpeakingPlanBackoffSeconds(stopSpeakingPlanBackoffSeconds)
      }

      toast.success('Agent settings updated successfully!')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while updating the agent.'

      toast.error('Failed to update agent settings', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Voice Settings</CardTitle>
          <CardDescription>
            Select the voice that will be used for the agent's responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={languageFilter}
                onValueChange={(value) => {
                  setLanguageFilter(value)
                }}
              >
                <SelectTrigger id="language" className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {availableLanguages.map((lang) => (
                    <SelectItem key={lang} value={lang.toLowerCase()}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent">Accent</Label>
              <Select
                value={accentFilter}
                onValueChange={(value) => {
                  setAccentFilter(value)
                }}
              >
                <SelectTrigger id="accent" className="w-full">
                  <SelectValue placeholder="Select accent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accents</SelectItem>
                  {availableAccents.map((accent) => (
                    <SelectItem key={accent} value={accent.toLowerCase()}>
                      {accent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Voice Selection</Label>
            <Tabs 
              value={voiceSelectionMode} 
              onValueChange={(value) => {
                const newMode = value as 'library' | 'custom'
                setVoiceSelectionMode(newMode)
                handleStopPreview()
                
                // When switching to custom mode, populate with current voice ID if available
                if (newMode === 'custom') {
                  const currentVoiceId = selectedVoiceId || baselineVoiceId
                  if (currentVoiceId && !customVoiceId) {
                    setCustomVoiceId(currentVoiceId)
                    // Check if this voice is in the loaded list to get its name
                    const voice = voices.find(v => v.voice_id === currentVoiceId)
                    if (voice) {
                      setCustomVoiceName(voice.name)
                      setCustomVoicePreviewUrl(voice.preview_url)
                      setIsCustomVoiceConfirmed(true)
                    }
                  }
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="library">Voice Library</TabsTrigger>
                <TabsTrigger value="custom">Custom Voice ID</TabsTrigger>
              </TabsList>
              
              <TabsContent value="library" className="space-y-4 mt-4">
                {isLoadingVoices ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading voices...
                  </div>
                ) : voices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No voices available. Please check your ElevenLabs API configuration.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {!selectedVoiceId ? (
                      // No voice selected - show dropdown
                      <Select
                        value={selectedVoiceId}
                        onValueChange={(value) => {
                          handleStopPreview()
                          setSelectedVoiceId(value)
                        }}
                      >
                        <SelectTrigger id="voice" className="w-full">
                          <SelectValue placeholder="Select a voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{voice.name}</span>
                                {voice.preview_url && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 ml-2"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (playingVoiceId === voice.voice_id) {
                                        handleStopPreview()
                                      } else {
                                        handlePlayPreview(voice.voice_id, voice.preview_url)
                                      }
                                    }}
                                  >
                                    {playingVoiceId === voice.voice_id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Play className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      // Voice selected - show selected card (consistent with custom voice ID)
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs">
                                Selected
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">
                              {voices.find(v => v.voice_id === selectedVoiceId)?.name || 'Unknown Voice'}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {selectedVoiceId}
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => {
                              setSelectedVoiceId('')
                              handleStopPreview()
                            }}
                            variant="outline"
                            size="sm"
                          >
                            Change
                          </Button>
                        </div>
                        {(() => {
                          const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId)
                          return selectedVoice?.preview_url && (
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (playingVoiceId === selectedVoiceId) {
                                    handleStopPreview()
                                  } else {
                                    handlePlayPreview(selectedVoiceId, selectedVoice.preview_url)
                                  }
                                }}
                              >
                                {playingVoiceId === selectedVoiceId ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Stop Preview
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Preview Voice
                                  </>
                                )}
                              </Button>
                              {playingVoiceId === selectedVoiceId && (
                                <p className="text-xs text-muted-foreground">
                                  Playing preview...
                                </p>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-3 mt-4">
                {!isCustomVoiceConfirmed ? (
                  // Edit mode - entering/confirming voice ID
                  <>
                    <div className="flex gap-2">
                      <Input
                        id="custom-voice-input"
                        placeholder="Enter custom voice ID"
                        value={customVoiceId}
                        onChange={(e) => {
                          setCustomVoiceId(e.target.value)
                          // Clear voice name, preview, and error when ID changes
                          setCustomVoiceName(null)
                          setCustomVoicePreviewUrl(null)
                          setVoiceLookupError(null)
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleConfirmCustomVoice}
                        disabled={isLookingUpVoice || !customVoiceId.trim()}
                      >
                        {isLookingUpVoice ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Confirming...
                          </>
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                    </div>
                    {voiceLookupError && (
                      <p className="text-sm text-destructive">
                        {voiceLookupError}
                      </p>
                    )}
                  </>
                ) : (
                  // View mode - voice confirmed and selected
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            Selected
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">
                          {customVoiceName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {customVoiceId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleEditCustomVoice}
                        variant="outline"
                        size="sm"
                      >
                        Edit
                      </Button>
                    </div>
                    {customVoicePreviewUrl && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (playingVoiceId === customVoiceId) {
                              handleStopPreview()
                            } else {
                              handlePlayPreview(customVoiceId, customVoicePreviewUrl)
                            }
                          }}
                        >
                          {playingVoiceId === customVoiceId ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Stop Preview
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Preview Voice
                            </>
                          )}
                        </Button>
                        {playingVoiceId === customVoiceId && (
                          <p className="text-xs text-muted-foreground">
                            Playing preview...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keywords</CardTitle>
          <CardDescription>
            Add keywords to improve transcription accuracy for specific terms, locations, or phrases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter a keyword or comma-separated keywords..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
          {keyterms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keyterms.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="px-3 py-1 text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No keywords added yet. Add keywords to help the transcriber recognize specific terms.
            </p>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>
              Advanced transcriber and speaking plan configurations (Admin only).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="endpointing" className="text-sm font-medium">
                  Endpointing: {endpointing}
                </Label>
                <Slider
                  id="endpointing"
                  min={0}
                  max={1000}
                  step={10}
                  value={[endpointing]}
                  onValueChange={(values) => setEndpointing(values[0])}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controls when the transcriber detects the end of a phrase (0-1000).
                </p>
              </div>

              <div>
                <Label htmlFor="eotThreshold" className="text-sm font-medium">
                  EOT Threshold: {eotThreshold.toFixed(2)}
                </Label>
                <Slider
                  id="eotThreshold"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[eotThreshold]}
                  onValueChange={(values) => setEotThreshold(values[0])}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  End-of-turn confidence threshold (0.0-1.0).
                </p>
              </div>

              <div>
                <Label htmlFor="eotTimeoutMs" className="text-sm font-medium">
                  EOT Timeout (ms): {eotTimeoutMs}
                </Label>
                <Slider
                  id="eotTimeoutMs"
                  min={0}
                  max={5000}
                  step={100}
                  value={[eotTimeoutMs]}
                  onValueChange={(values) => setEotTimeoutMs(values[0])}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum time to wait for end-of-turn detection in milliseconds (0-5000ms).
                </p>
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t">
              <div>
                <Label htmlFor="startSpeakingPlanWaitSeconds" className="text-sm font-medium">
                  Start Speaking Wait: {startSpeakingPlanWaitSeconds.toFixed(1)} (sec)
                </Label>
                <Slider
                  id="startSpeakingPlanWaitSeconds"
                  min={0}
                  max={5}
                  step={0.1}
                  value={[startSpeakingPlanWaitSeconds]}
                  onValueChange={(values) => setStartSpeakingPlanWaitSeconds(values[0])}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  How long to wait before the agent starts speaking (0-5 sec).
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium">Transcription Endpointing Plan</Label>
                
                <div>
                  <Label htmlFor="transcriptionOnPunctuationSeconds" className="text-sm font-medium">
                    On Punctuation: {transcriptionOnPunctuationSeconds.toFixed(1)} (sec)
                  </Label>
                  <Slider
                    id="transcriptionOnPunctuationSeconds"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[transcriptionOnPunctuationSeconds]}
                    onValueChange={(values) => setTranscriptionOnPunctuationSeconds(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum seconds to wait after transcription ending with punctuation (0-3 sec).
                  </p>
                </div>

                <div>
                  <Label htmlFor="transcriptionOnNoPunctuationSeconds" className="text-sm font-medium">
                    On No Punctuation: {transcriptionOnNoPunctuationSeconds.toFixed(1)} (sec)
                  </Label>
                  <Slider
                    id="transcriptionOnNoPunctuationSeconds"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[transcriptionOnNoPunctuationSeconds]}
                    onValueChange={(values) => setTranscriptionOnNoPunctuationSeconds(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum seconds to wait after transcription ending without punctuation (0-3 sec).
                  </p>
                </div>

                <div>
                  <Label htmlFor="transcriptionOnNumberSeconds" className="text-sm font-medium">
                    On Number: {transcriptionOnNumberSeconds.toFixed(1)} (sec)
                  </Label>
                  <Slider
                    id="transcriptionOnNumberSeconds"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[transcriptionOnNumberSeconds]}
                    onValueChange={(values) => setTranscriptionOnNumberSeconds(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum seconds to wait after transcription ending with a number (0-3 sec).
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <Label className="text-sm font-medium">Stop Speaking Plan</Label>
                
                <div>
                  <Label htmlFor="stopSpeakingPlanNumWords" className="text-sm font-medium">
                    Number of Words: {stopSpeakingPlanNumWords}
                  </Label>
                  <Slider
                    id="stopSpeakingPlanNumWords"
                    min={0}
                    max={10}
                    step={1}
                    value={[stopSpeakingPlanNumWords]}
                    onValueChange={(values) => setStopSpeakingPlanNumWords(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of words the customer has to say before the assistant will stop talking (0-10).
                  </p>
                </div>

                <div>
                  <Label htmlFor="stopSpeakingPlanVoiceSeconds" className="text-sm font-medium">
                    Voice Seconds: {stopSpeakingPlanVoiceSeconds.toFixed(1)} (sec)
                  </Label>
                  <Slider
                    id="stopSpeakingPlanVoiceSeconds"
                    min={0}
                    max={0.5}
                    step={0.1}
                    value={[stopSpeakingPlanVoiceSeconds]}
                    onValueChange={(values) => setStopSpeakingPlanVoiceSeconds(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Seconds customer has to speak before the assistant stops talking (0-0.5 sec).
                  </p>
                </div>

                <div>
                  <Label htmlFor="stopSpeakingPlanBackoffSeconds" className="text-sm font-medium">
                    Back Off Seconds: {stopSpeakingPlanBackoffSeconds.toFixed(1)} (sec)
                  </Label>
                  <Slider
                    id="stopSpeakingPlanBackoffSeconds"
                    min={0}
                    max={10}
                    step={0.1}
                    value={[stopSpeakingPlanBackoffSeconds]}
                    onValueChange={(values) => setStopSpeakingPlanBackoffSeconds(values[0])}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Seconds to wait before the assistant will start talking again after being interrupted (0-10 sec).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={
            isSaving ||
            ((voiceSelectionMode === 'custom' ? customVoiceId : selectedVoiceId) === baselineVoiceId &&
              (keyterms.length === baselineKeyterms.length &&
                keyterms.every(k => baselineKeyterms.includes(k)) &&
                baselineKeyterms.every(k => keyterms.includes(k))) &&
              (!isAdmin || (
                endpointing === baselineEndpointing &&
                eotThreshold === baselineEotThreshold &&
                eotTimeoutMs === baselineEotTimeoutMs &&
                startSpeakingPlanWaitSeconds === baselineStartSpeakingPlanWaitSeconds &&
                transcriptionOnPunctuationSeconds === baselineTranscriptionOnPunctuationSeconds &&
                transcriptionOnNoPunctuationSeconds === baselineTranscriptionOnNoPunctuationSeconds &&
                transcriptionOnNumberSeconds === baselineTranscriptionOnNumberSeconds &&
                stopSpeakingPlanVoiceSeconds === baselineStopSpeakingPlanVoiceSeconds &&
                stopSpeakingPlanNumWords === baselineStopSpeakingPlanNumWords &&
                stopSpeakingPlanBackoffSeconds === baselineStopSpeakingPlanBackoffSeconds
              )))
          }
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  )
}

