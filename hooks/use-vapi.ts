'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Vapi from '@vapi-ai/web';

export const useVapi = (vapiPublishableKey: string) => {
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<{ role: string, text: string }[]>([]);
  const vapiRef = useRef<any>(null);

  const initializeVapi = useCallback(() => {
    if (!vapiRef.current && vapiPublishableKey) {
      const vapiInstance = new Vapi(vapiPublishableKey);
      vapiRef.current = vapiInstance;

      // Call started
      vapiInstance.on('call-start', () => {
        console.log('Call has started');
        setIsSessionActive(true);
      });

      // Call ended
      vapiInstance.on('call-end', () => {
        console.log('Call has ended');
        setIsSessionActive(false);
        setIsSpeaking(false);
        setVolumeLevel(0);
      });

      // Speech events
      vapiInstance.on('speech-start', () => {
        console.log('Assistant started speaking');
        setIsSpeaking(true);
      });

      vapiInstance.on('speech-end', () => {
        console.log('Assistant stopped speaking');
        setIsSpeaking(false);
      });

      // Volume level
      vapiInstance.on('volume-level', (level: number) => {
        setVolumeLevel(level);
      });

      // Messages (transcripts, function calls, etc.)
      vapiInstance.on('message', (message: any) => {
        console.log('Message received:', message);
        
        if (message.type === 'transcript') {
          setConversation((prev) => [
            ...prev,
            {
              role: message.role,
              text: message.transcript
            }
          ]);
        }
      });

      // Error handling
      vapiInstance.on('error', (error: any) => {
        console.error('Vapi error:', error);
      });
    }
  }, [vapiPublishableKey]);

  useEffect(() => {
    initializeVapi();

    return () => {
      if (vapiRef.current) {
        vapiRef.current.stop();
      }
    };
  }, [initializeVapi]);

  const start = async (assistantId: string) => {
    if (vapiRef.current && assistantId) {
      try {
        await vapiRef.current.start(assistantId);
      } catch (error) {
        console.error('Failed to start call:', error);
      }
    }
  };

  const stop = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
    }
  };

  const toggleMute = () => {
    if (vapiRef.current) {
      const currentMuteState = vapiRef.current.isMuted();
      vapiRef.current.setMuted(!currentMuteState);
    }
  };

  const send = (message: { type: string; message: { role: string; content: string } }) => {
    if (vapiRef.current) {
      vapiRef.current.send(message);
    }
  };

  return {
    start,
    stop,
    toggleMute,
    send,
    isSessionActive,
    isSpeaking,
    volumeLevel,
    conversation,
    vapi: vapiRef.current
  };
};

