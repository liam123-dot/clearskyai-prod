import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_API_KEY,
});

/**
 * Create a Twilio phone number in ElevenLabs
 * This registers the phone number with ElevenLabs without assigning it to any agent
 * 
 * @param phoneNumber - Phone number in E.164 format (e.g., +14155551234)
 * @param accountSid - Twilio account SID
 * @param authToken - Twilio auth token
 * @returns The ElevenLabs phone number ID
 */
export async function createElevenLabsTwilioPhoneNumber(
  phoneNumber: string,
  accountSid: string,
  authToken: string
): Promise<string> {
  try {
    const response = await client.conversationalAi.phoneNumbers.create({
      provider: 'twilio',
      phoneNumber: phoneNumber,
      label: phoneNumber, // Use phone number as label for easy identification
      sid: accountSid,
      token: authToken,
      supportsInbound: true,
      supportsOutbound: false,
    });

    if (!response.phoneNumberId) {
      throw new Error('Failed to create ElevenLabs phone number: no ID returned');
    }

    return response.phoneNumberId;
  } catch (error) {
    console.error('Error creating ElevenLabs Twilio phone number:', error);
    throw new Error(
      `Failed to create ElevenLabs phone number: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update an ElevenLabs phone number to assign it to an agent
 * 
 * @param elevenLabsPhoneNumberId - The ElevenLabs phone number ID
 * @param agentId - The ElevenLabs agent ID to assign the phone number to (null to unassign)
 */
export async function updateElevenLabsPhoneNumberAgent(
  elevenLabsPhoneNumberId: string,
  agentId: string | null
): Promise<void> {
  try {
    await client.conversationalAi.phoneNumbers.update(elevenLabsPhoneNumberId, {
      agentId: agentId || undefined,
    });
  } catch (error) {
    console.error('Error updating ElevenLabs phone number agent:', error);
    throw new Error(
      `Failed to update ElevenLabs phone number agent: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

