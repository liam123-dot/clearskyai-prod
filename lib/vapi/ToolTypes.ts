import { Vapi } from '@vapi-ai/server-sdk';

// ============================================
// SHARED TYPES
// ============================================

/** Shared tool message type used by all tools */
export interface ToolMessage {
  type: "request-start" | "request-complete" | "request-failed" | "request-delayed";
  content?: string;
  blocking?: boolean;
}

/** Function definition for tools */
export interface ToolFunction {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

// ============================================
// FULL TOOL INTERFACES (Complete Objects)
// ============================================

/** SMS Tool - Full interface with system metadata */
export interface SmsTool {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "sms";
  function: ToolFunction;
  messages: ToolMessage[];
  metadata: {
    from: string;
  };
  orgId: string;
}

/** API Request Tool - Full interface with system metadata */
export interface ApiRequestTool {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "apiRequest";
  function: ToolFunction;
  messages: ToolMessage[];
  orgId: string;
  name: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: {
    type: "object";
    properties: Record<string, {
      type: string;
      value: string;
    }>;
  };
  body?: {
    type: "object";
    required: string[];
    properties: Record<string, {
      description?: string;
      type: string;
      default?: string;
      enum?: string[];
    }>;
  };
  variableExtractionPlan: {
    schema: {
      type: "object";
      required: string[];
      properties: Record<string, any>;
    };
    aliases: any[];
  };
}

/** Transfer Call Tool - Full interface with system metadata */
export interface TransferCallTool {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "transferCall";
  function: ToolFunction;
  messages: ToolMessage[];
  orgId: string;
  destinations: Array<{
    type: "number" | "assistant" | "sip";
    number?: string;
    message?: string;
    description?: string;
    transferPlan?: {
      mode: "warm-transfer-say-message" | "warm-transfer-say-summary" | "cold-transfer";
      message?: string;
      sipVerb?: string;
      summaryPlan?: {
        enabled: boolean;
        messages: Array<{
          role: string;
          content: string;
        }>;
        timeoutSeconds: number;
        useAssistantLlm: boolean;
      };
    };
    numberE164CheckEnabled?: boolean;
  }>;
}

/** External App Tool - Full interface with system metadata and database data */
export interface ExternalAppTool {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "externalApp";
  function: ToolFunction;
  messages?: ToolMessage[];
  orgId: string;
  // Database fields
  dbId?: string;
  name: string;
  label?: string;
  description?: string;
  functionSchema: any;
  staticConfig?: any;
  propsConfig?: any;
  app?: string;
  appName?: string;
  appImgSrc?: string;
  accountId?: string;
  actionKey?: string;
  actionName?: string;
  externalId: string;
  agentId?: string;
  clientId?: string;
  organizationId?: string;
}

// ============================================
// CREATE INTERFACES (For Creating Tools)
// ============================================

/** SMS Tool - For creating tools (includes type, no system metadata) */
export interface CreateSmsToolDto {
  type: "sms";
  function: ToolFunction;
  messages: ToolMessage[];
  metadata: {
    from: string;
  };
}

/** API Request Tool - For creating tools (includes type, no system metadata) */
export interface CreateApiRequestToolDto {
  type: "apiRequest";
  function: ToolFunction;
  messages: ToolMessage[];
  name: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: {
    type: "object";
    properties: Record<string, {
      type: string;
      value: string;
    }>;
  };
  body?: {
    type: "object";
    required: string[];
    properties: Record<string, {
      description?: string;
      type: string;
      default?: string;
      enum?: string[];
    }>;
  };
  variableExtractionPlan: {
    schema: {
      type: "object";
      required: string[];
      properties: Record<string, any>;
    };
    aliases: any[];
  };
}

/** Transfer Call Tool - For creating tools (includes type, no system metadata) */
export interface CreateTransferCallToolDto {
  type: "transferCall";
  function: ToolFunction;
  messages: ToolMessage[];
  destinations: Array<{
    type: "number" | "assistant" | "sip";
    number?: string;
    message?: string;
    description?: string;
    transferPlan?: {
      mode: "warm-transfer-say-message" | "warm-transfer-say-summary" | "cold-transfer";
      message?: string;
      sipVerb?: string;
      summaryPlan?: {
        enabled: boolean;
        messages: Array<{
          role: string;
          content: string;
        }>;
        timeoutSeconds: number;
        useAssistantLlm: boolean;
      };
    };
    numberE164CheckEnabled?: boolean;
  }>;
}

// ============================================
// UPDATE INTERFACES (For Updating Tools)
// ============================================

/** SMS Tool - For updating tools (excludes id, createdAt, updatedAt, type, orgId) */
export interface UpdateSmsToolDto {
  function?: ToolFunction;
  messages?: ToolMessage[];
  metadata?: {
    from: string;
  };
}

/** API Request Tool - For updating tools (excludes id, createdAt, updatedAt, type, orgId) */
export interface UpdateApiRequestToolDto {
  function?: ToolFunction;
  messages?: ToolMessage[];
  name?: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: {
    type: "object";
    properties: Record<string, {
      type: string;
      value: string;
    }>;
  };
  body?: {
    type: "object";
    required: string[];
    properties: Record<string, {
      description?: string;
      type: string;
      default?: string;
      enum?: string[];
    }>;
  };
  variableExtractionPlan?: {
    schema: {
      type: "object";
      required: string[];
      properties: Record<string, any>;
    };
    aliases: any[];
  };
}

/** Transfer Call Tool - For updating tools (excludes id, createdAt, updatedAt, type, orgId) */
export interface UpdateTransferCallToolDto {
  function?: ToolFunction;
  messages?: ToolMessage[];
  destinations?: Array<{
    type: "number" | "assistant" | "sip";
    number?: string;
    message?: string;
    description?: string;
    transferPlan?: {
      mode: "warm-transfer-say-message" | "warm-transfer-say-summary" | "cold-transfer";
      message?: string;
      sipVerb?: string;
      summaryPlan?: {
        enabled: boolean;
        messages: Array<{
          role: string;
          content: string;
        }>;
        timeoutSeconds: number;
        useAssistantLlm: boolean;
      };
    };
    numberE164CheckEnabled?: boolean;
  }>;
}

// ============================================
// UNION TYPES
// ============================================

/** Union type for all full tool objects (with system metadata) */
export type VapiTool = SmsTool | ApiRequestTool | TransferCallTool | ExternalAppTool;

/** Union type for all tool DTOs (for creating tools) */
export type CreateVapiToolDto = CreateSmsToolDto | CreateApiRequestToolDto | CreateTransferCallToolDto;

/** Union type for all tool update DTOs (for updating tools) */
export type UpdateVapiToolDto = UpdateSmsToolDto | UpdateApiRequestToolDto | UpdateTransferCallToolDto;

// ============================================
// HELPER TYPES
// ============================================

/** Use this type for functions that accept any of the tool types */
export type AnyVapiTool = VapiTool;

/** Use this type for functions that create any of the tool types */
export type CreateAnyVapiToolDto = CreateVapiToolDto;

/** Use this type for functions that update any of the tool types */
export type UpdateAnyVapiToolDto = UpdateVapiToolDto;