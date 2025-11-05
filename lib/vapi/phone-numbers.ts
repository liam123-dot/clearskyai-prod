import { vapiClient } from './VapiClients';

/**
 * Create a Twilio phone number in VAPI
 * This registers the phone number with VAPI without assigning it to any assistant
 * 
 * @param phoneNumber - Phone number in E.164 format (e.g., +14155551234)
 * @param accountSid - Twilio account SID
 * @param authToken - Twilio auth token
 * @returns The VAPI phone number ID
 */
export async function createVapiTwilioPhoneNumber(
  phoneNumber: string,
  accountSid: string,
  authToken: string
): Promise<string> {
  try {
    const response = await vapiClient.phoneNumbers.create({
      provider: 'twilio',
      number: phoneNumber,
      twilioAccountSid: accountSid,
      twilioAuthToken: authToken,
      // Do not assign to any assistant - this will be done later
      // Do not set server URL - this will be set when assigning to an agent
    });

    if (!response.id) {
      throw new Error('Failed to create VAPI phone number: no ID returned');
    }

    return response.id;
  } catch (error) {
    console.error('Error creating VAPI Twilio phone number:', error);
    throw new Error(
      `Failed to create VAPI phone number: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a VAPI phone number to assign it to an assistant
 * 
 * @param vapiPhoneNumberId - The VAPI phone number ID
 * @param assistantId - The VAPI assistant ID to assign the phone number to
 */
export async function updateVapiPhoneNumberAssistant(
  vapiPhoneNumberId: string,
  assistantId: string | null
): Promise<void> {
  try {
    await vapiClient.phoneNumbers.update(vapiPhoneNumberId, {
      assistantId: assistantId || undefined,
    });
  } catch (error) {
    console.error('Error updating VAPI phone number assistant:', error);
    throw new Error(
      `Failed to update VAPI phone number assistant: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update SMS enabled status for a VAPI phone number
 * 
 * @param vapiPhoneNumberId - The VAPI phone number ID
 * @param smsEnabled - Whether SMS should be enabled
 */
export async function updateVapiPhoneNumberSmsEnabled(
  vapiPhoneNumberId: string,
  smsEnabled: boolean
): Promise<void> {
  try {
    await vapiClient.phoneNumbers.update(vapiPhoneNumberId, {
      smsEnabled: smsEnabled,
    });
  } catch (error) {
    console.error('Error updating VAPI phone number SMS enabled:', error);
    throw new Error(
      `Failed to update VAPI phone number SMS enabled: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

