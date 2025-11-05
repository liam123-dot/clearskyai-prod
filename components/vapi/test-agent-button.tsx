'use client';

import React, { useState } from 'react';

import { useVapi } from '@/hooks/use-vapi';

import { Button } from '@/components/ui/button';

import { Phone, PhoneOff, Loader2 } from 'lucide-react';

export function TestAgentButton({ assistantId, vapiPublishableKey }: { assistantId: string, vapiPublishableKey: string }) {

  const {

    start,

    stop,

    isSessionActive,

  } = useVapi(vapiPublishableKey);

  

  const [isConnecting, setIsConnecting] = useState(false);

  const handleClick = async () => {

    if (isSessionActive) {

      stop();

    } else {

      setIsConnecting(true);

      try {

        await start(assistantId);

      } finally {

        // Reset connecting state after a short delay to show the transition

        setTimeout(() => setIsConnecting(false), 1000);

      }

    }

  };

  const getButtonContent = () => {

    if (isConnecting) {

      return (

        <>

          <Loader2 className="h-4 w-4 animate-spin" />

          Connecting...

        </>

      );

    }

    

    if (isSessionActive) {

      return (

        <>

          <PhoneOff className="h-4 w-4" />

          End Call

        </>

      );

    }

    

    return (

      <>

        <Phone className="h-4 w-4" />

        Test Agent

      </>

    );

  };

  return (

    <Button

      onClick={handleClick}

      disabled={isConnecting}

      size="sm"

      variant="outline"

      className="h-9 text-sm"

    >

      {getButtonContent()}

    </Button>

  );

};

