"use client"

import { useCallback, useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PhoneIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Orb } from "@/components/ui/orb"
import { ShimmeringText } from "@/components/ui/shimmering-text"
import { useVapi } from "@/hooks/use-vapi"

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting" | null

interface VoiceWidgetProps {
  assistantId: string
  vapiPublishableKey: string
  agentName?: string
  agentDescription?: string
  theme?: "light" | "dark" | "system"
}

export function VoiceWidget({ 
  assistantId, 
  vapiPublishableKey,
  agentName = "Voice Assistant",
  agentDescription = "Tap to start voice chat",
  theme = "system"
}: VoiceWidgetProps) {
  const [agentState, setAgentState] = useState<AgentState>("disconnected")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    start,
    stop,
    isSessionActive,
    volumeLevel,
  } = useVapi(vapiPublishableKey)

  // Sync agentState with isSessionActive
  useEffect(() => {
    if (isSessionActive && agentState !== "connected") {
      setAgentState("connected")
    } else if (!isSessionActive && agentState === "connected") {
      setAgentState("disconnected")
    }
  }, [isSessionActive, agentState])

  const startConversation = useCallback(async () => {
    try {
      setErrorMessage(null)
      setAgentState("connecting")
      
      // Request microphone permissions
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Start Vapi session
      await start(assistantId)
      // State will be updated via useEffect when isSessionActive changes
    } catch (error) {
      console.error("Error starting conversation:", error)
      setAgentState("disconnected")
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please enable microphone permissions in your browser.")
      } else {
        setErrorMessage("Failed to start conversation. Please try again.")
      }
    }
  }, [assistantId, start])

  const handleCall = useCallback(() => {
    if (agentState === "disconnected" || agentState === null) {
      startConversation()
    } else if (agentState === "connected") {
      setAgentState("disconnecting")
      stop()
      setAgentState("disconnected")
    }
  }, [agentState, stop, startConversation])

  const isCallActive = agentState === "connected"
  const isTransitioning = agentState === "connecting" || agentState === "disconnecting"

  // Determine variant based on theme, not connection state
  const buttonVariant = theme === "light" ? "secondary" : "default"

  // Normalize volume level for orb (Vapi provides 0-1 range)
  const getInputVolume = useCallback(() => {
    return Math.min(1.0, Math.pow(volumeLevel || 0, 0.5) * 2.5)
  }, [volumeLevel])

  const getOutputVolume = useCallback(() => {
    // For now, use input volume. In future, we can add output volume tracking
    return Math.min(1.0, Math.pow(volumeLevel || 0, 0.5) * 2.5)
  }, [volumeLevel])

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
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
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

