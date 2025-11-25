"use client"

import { useCallback, useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PhoneIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Orb } from "@/components/ui/orb"
import { ShimmeringText } from "@/components/ui/shimmering-text"
import { useConversation } from "@elevenlabs/react"

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting" | null

interface VoiceWidgetProps {
  agentId: string
  agentName?: string
  agentDescription?: string
  theme?: "light" | "dark" | "system"
}

export function VoiceWidget({ 
  agentId, 
  agentName = "Voice Assistant",
  agentDescription = "Tap to start voice chat",
  theme = "system"
}: VoiceWidgetProps) {
  const [agentState, setAgentState] = useState<AgentState>("disconnected")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const conversation = useConversation()
  const {
    status,
    isSpeaking,
    getInputVolume,
    getOutputVolume,
    startSession,
    endSession
  } = conversation

  // Sync agentState with conversation status
  useEffect(() => {
    if (status === "connected" && agentState !== "connected") {
      setAgentState("connected")
    } else if (status === "disconnected" && agentState === "connected") {
      setAgentState("disconnected")
    }
  }, [status, agentState])

  const startConversation = useCallback(async () => {
    try {
      setErrorMessage(null)
      setAgentState("connecting")
      
      // Request microphone permissions
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Start ElevenLabs session
      await startSession({
        agentId: agentId,
        connectionType: "webrtc",
      })
      
    } catch (error) {
      console.error("Error starting conversation:", error)
      setAgentState("disconnected")
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please enable microphone permissions in your browser.")
      } else {
        setErrorMessage("Failed to start conversation. Please try again.")
      }
    }
  }, [agentId, startSession])

  const handleCall = useCallback(async () => {
    if (agentState === "disconnected" || agentState === null) {
      await startConversation()
    } else if (agentState === "connected") {
      setAgentState("disconnecting")
      await endSession()
      setAgentState("disconnected")
    }
  }, [agentState, endSession, startConversation])

  const isTransitioning = agentState === "connecting" || agentState === "disconnecting"

  // Determine variant based on theme, not connection state
  const buttonVariant = theme === "light" ? "secondary" : "default"

  // Normalize volume level for orb
  const getNormalizedInputVolume = useCallback(() => {
    // ElevenLabs volume is usually 0-1 but can be low, boost it slightly for visual effect
    return Math.min(1.0, (getInputVolume() || 0) * 2.5)
  }, [getInputVolume])

  const getNormalizedOutputVolume = useCallback(() => {
    return Math.min(1.0, (getOutputVolume() || 0) * 2.5)
  }, [getOutputVolume])

  return (
    <div className="fixed bottom-5 right-5 z-50 pointer-events-auto">
      <Button
        onClick={handleCall}
        disabled={isTransitioning}
        variant={buttonVariant}
        className={cn(
          "h-[60px] rounded-full shadow-lg hover:shadow-xl transition-all duration-200",
          "flex items-center gap-3 px-4 pr-6"
        )}
      >
        {/* Orb Container */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="bg-muted relative h-full w-full rounded-full p-0.5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_4px_rgba(0,0,0,0.5)]">
            <div className="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_6px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_6px_rgba(0,0,0,0.3)]">
              <Orb
                className="h-full w-full"
                volumeMode="manual"
                getInputVolume={getNormalizedInputVolume}
                getOutputVolume={getNormalizedOutputVolume}
              />
            </div>
          </div>
        </div>

        {/* Button Text */}
        <div className="flex items-center gap-2">
          <PhoneIcon className="h-5 w-5" />
          <AnimatePresence mode="wait" initial={false}>
            {errorMessage ? (
              <motion.span
                key="error"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                ERROR
              </motion.span>
            ) : agentState === "connecting" ? (
              <motion.span
                key="connecting"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                <ShimmeringText 
                  text="CONNECTING..." 
                  startOnView={false}
                  className="text-current"
                />
              </motion.span>
            ) : agentState === "connected" ? (
              <motion.span
                key="connected"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                END CALL
              </motion.span>
            ) : agentState === "disconnecting" ? (
              <motion.span
                key="disconnecting"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                <ShimmeringText 
                  text="ENDING..." 
                  startOnView={false}
                  className="text-current"
                />
              </motion.span>
            ) : (
              <motion.span
                key="voice-chat"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="text-sm font-semibold whitespace-nowrap"
              >
                VOICE CHAT
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Button>
    </div>
  )
}

