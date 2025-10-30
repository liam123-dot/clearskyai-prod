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

