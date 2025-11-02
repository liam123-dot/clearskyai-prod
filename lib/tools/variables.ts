/**
 * Tool Parameter Variables
 * 
 * This file defines dynamic variables that can be used in tool parameters.
 * Variables are denoted by double curly braces: {{variable_name}}
 */

export interface ToolVariable {
  name: string
  displayName: string
  description: string
  example?: string
}

/**
 * Available variables for tool parameters
 */
export const TOOL_VARIABLES: Record<string, ToolVariable> = {
  caller_phone_number: {
    name: 'caller_phone_number',
    displayName: 'Caller Phone Number',
    description: 'The phone number of the person calling the agent',
    example: '+1234567890',
  },
  called_phone_number: {
    name: 'called_phone_number',
    displayName: 'Called Phone Number',
    description: 'The phone number that was called (agent\'s number)',
    example: '+1987654321',
  },
  now: {
    name: 'now',
    displayName: 'Current Time',
    description: 'The current date and time in ISO 8601 format',
    example: '2024-10-31T12:00:00.000Z',
  },
}

/**
 * Detects variables in a string (e.g., {{caller_phone_number}})
 * @param text - The text to search for variables
 * @returns Array of detected variable names
 */
export function detectVariables(text: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g
  const matches = text.matchAll(variablePattern)
  const variables: string[] = []
  
  for (const match of matches) {
    if (match[1] && TOOL_VARIABLES[match[1]]) {
      variables.push(match[1])
    }
  }
  
  return Array.from(new Set(variables)) // Remove duplicates
}

/**
 * Get variable information by name
 * @param variableName - The name of the variable (without braces)
 * @returns Variable information or null if not found
 */
export function getVariable(variableName: string): ToolVariable | null {
  return TOOL_VARIABLES[variableName] || null
}

/**
 * Check if a string contains any variables
 * @param text - The text to check
 * @returns True if the text contains at least one valid variable
 */
export function hasVariables(text: string): boolean {
  return detectVariables(text).length > 0
}

/**
 * Get all available variables
 * @returns Array of all tool variables
 */
export function getAllVariables(): ToolVariable[] {
  return Object.values(TOOL_VARIABLES)
}

/**
 * Context object containing values for variable substitution
 */
export interface VariableContext {
  caller_phone_number?: string
  called_phone_number?: string
  now?: string
}

/**
 * Substitutes variables in a string with actual values from context
 * @param text - The text containing {{variable}} placeholders
 * @param context - Object containing variable values
 * @returns String with all variables replaced
 */
export function substituteVariables(text: string, context: VariableContext): string {
  let result = text
  
  // Replace each variable if it exists in context
  if (context.caller_phone_number !== undefined) {
    result = result.replace(/\{\{caller_phone_number\}\}/g, context.caller_phone_number || '')
  }
  
  if (context.called_phone_number !== undefined) {
    result = result.replace(/\{\{called_phone_number\}\}/g, context.called_phone_number || '')
  }
  
  // Replace {{now}} with value from context if provided, otherwise use current ISO time
  if (context.now !== undefined) {
    result = result.replace(/\{\{now\}\}/g, context.now || '')
  } else {
    // Only compute automatically if not provided in context (for production use)
    result = result.replace(/\{\{now\}\}/g, new Date().toISOString())
  }
  
  return result
}

/**
 * Recursively substitutes variables in an object or array
 * @param value - The value to process (string, number, boolean, object, array)
 * @param context - Object containing variable values
 * @returns Processed value with all string values having variables substituted
 */
export function substituteVariablesInValue(
  value: unknown,
  context: VariableContext
): unknown {
  // If it's a string, substitute variables
  if (typeof value === 'string') {
    return substituteVariables(value, context)
  }
  
  // If it's an array, process each element
  if (Array.isArray(value)) {
    return value.map(item => substituteVariablesInValue(item, context))
  }
  
  // If it's an object, process each property
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteVariablesInValue(val, context)
    }
    return result
  }
  
  // For primitives (number, boolean, null, undefined), return as-is
  return value
}

