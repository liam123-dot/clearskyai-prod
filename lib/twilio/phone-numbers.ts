import Twilio from 'twilio';

export interface TwilioPhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface AvailablePhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

export interface SearchParams {
  countryCode?: string;
  areaCode?: string;
  contains?: string;
  limit?: number;
}

/**
 * List all phone numbers in a Twilio account
 */
export async function listTwilioPhoneNumbers(
  accountSid: string,
  authToken: string
): Promise<TwilioPhoneNumber[]> {
  try {
    const client = Twilio(accountSid, authToken);
    
    const numbers = await client.incomingPhoneNumbers.list();
    
    return numbers.map((number: any) => ({
      sid: number.sid,
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      capabilities: {
        voice: number.capabilities.voice ?? false,
        sms: number.capabilities.sms ?? false,
        mms: number.capabilities.mms ?? false,
      },
    }));
  } catch (error) {
    console.error('Error listing Twilio phone numbers:', error);
    throw new Error(`Failed to list Twilio phone numbers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for available phone numbers to purchase
 */
export async function searchAvailableNumbers(
  accountSid: string,
  authToken: string,
  params: SearchParams = {}
): Promise<AvailablePhoneNumber[]> {
  try {
    const client = Twilio(accountSid, authToken);
    const countryCode = params.countryCode || 'US';
    
    const searchOptions: {
      areaCode?: number;
      contains?: string;
      limit?: number;
    } = {
      limit: params.limit || 20,
    };
    
    if (params.areaCode) {
      searchOptions.areaCode = parseInt(params.areaCode, 10);
    }
    
    if (params.contains) {
      searchOptions.contains = params.contains;
    }
    
    const numbers = await client
      .availablePhoneNumbers(countryCode)
      .local
      .list(searchOptions);
    
    return numbers.map((number: any) => ({
      phoneNumber: number.phoneNumber,
      friendlyName: number.friendlyName,
      locality: number.locality,
      region: number.region,
      capabilities: {
        voice: number.capabilities.voice ?? false,
        sms: number.capabilities.sms ?? false,
        mms: number.capabilities.mms ?? false,
      },
    }));
  } catch (error) {
    console.error('Error searching available numbers:', error);
    throw new Error(`Failed to search available numbers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Purchase a phone number and configure it with webhook URL
 */
export async function purchasePhoneNumber(
  accountSid: string,
  authToken: string,
  phoneNumber: string,
  webhookUrl: string
): Promise<TwilioPhoneNumber> {
  try {
    const client = Twilio(accountSid, authToken);
    
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      voiceUrl: webhookUrl,
      voiceMethod: 'POST',
    });
    
    return {
      sid: purchasedNumber.sid,
      phoneNumber: purchasedNumber.phoneNumber,
      friendlyName: purchasedNumber.friendlyName,
      capabilities: {
        voice: purchasedNumber.capabilities.voice ?? false,
        sms: purchasedNumber.capabilities.sms ?? false,
        mms: purchasedNumber.capabilities.mms ?? false,
      },
    };
  } catch (error) {
    console.error('Error purchasing phone number:', error);
    throw new Error(`Failed to purchase phone number: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update an existing phone number's webhook configuration
 */
export async function updatePhoneNumberWebhook(
  accountSid: string,
  authToken: string,
  phoneNumberSid: string,
  webhookUrl: string
): Promise<void> {
  try {
    const client = Twilio(accountSid, authToken);
    
    await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: webhookUrl,
      voiceMethod: 'POST',
    });
  } catch (error) {
    console.error('Error updating phone number webhook:', error);
    throw new Error(`Failed to update webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

