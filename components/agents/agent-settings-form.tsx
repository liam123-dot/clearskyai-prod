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
import { Play, Loader2 } from 'lucide-react'

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
  initialPrompt: string
  initialVoiceId: string
}

export function AgentSettingsForm({
  agentId,
  slug,
  initialPrompt,
  initialVoiceId,
}: AgentSettingsFormProps) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoiceId)
  const [voices, setVoices] = useState<Voice[]>([])
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [languageFilter, setLanguageFilter] = useState<string>('en')
  const [accentFilter, setAccentFilter] = useState<string>('british')
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [availableAccents, setAvailableAccents] = useState<string[]>([])
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

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

        // If selected voice is no longer in filtered list, clear selection
        if (selectedVoiceId && !filteredVoices.some((v: Voice) => v.voice_id === selectedVoiceId)) {
          setSelectedVoiceId('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const hasChanges =
      prompt !== initialPrompt || selectedVoiceId !== initialVoiceId

    if (!hasChanges) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`/api/${slug}/agents/${agentId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt !== initialPrompt ? prompt : undefined,
          voiceId: selectedVoiceId !== initialVoiceId ? selectedVoiceId : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update agent')
      }

      toast.success('Agent settings updated successfully!')
      
      // Refresh the page to show updated data
      window.location.reload()
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
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            Configure the system message that guides the agent's behavior and responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Enter the system prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This prompt defines how the agent behaves and responds to users.
            </p>
          </div>
        </CardContent>
      </Card>

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
            <Label htmlFor="voice">Voice</Label>
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
              <div className="space-y-2">
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
                {selectedVoiceId && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const selectedVoice = voices.find(
                          (v) => v.voice_id === selectedVoiceId
                        )
                        if (selectedVoice?.preview_url) {
                          if (playingVoiceId === selectedVoiceId) {
                            handleStopPreview()
                          } else {
                            handlePlayPreview(selectedVoiceId, selectedVoice.preview_url)
                          }
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
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={isSaving || prompt === initialPrompt && selectedVoiceId === initialVoiceId}
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

