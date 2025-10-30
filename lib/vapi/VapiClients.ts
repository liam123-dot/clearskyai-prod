import { VapiClient } from "@vapi-ai/server-sdk";

if (!process.env.VAPI_API_KEY) {
    throw new Error("VAPI_API_KEY is not set");
}

export const vapiClient = new VapiClient({ token: process.env.VAPI_API_KEY! });
