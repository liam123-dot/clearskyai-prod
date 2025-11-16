// Voice cost per million characters (default: $118.8 per million for ElevenLabs Flash v2.5)
// Can be overridden via environment variable VOICE_COST_PER_MILLION_CHARACTERS
const VOICE_COST_PER_MILLION_CHARACTERS = parseFloat(
    process.env.VOICE_COST_PER_MILLION_CHARACTERS || "118.8"
);

/**
 * Imputes voice costs in a costs array when cost is 0 but characters > 0
 * Returns a new array with imputed costs
 * 
 * @param costs - Array of cost entries
 * @returns New array with voice costs imputed where needed
 */
export function imputeVoiceCosts(costs: any[]): any[] {
    if (!Array.isArray(costs)) {
        return costs;
    }

    return costs.map((costEntry: any) => {
        // Check if this is a voice cost with 0 cost but characters > 0
        if (
            costEntry.type === 'voice' &&
            (costEntry.cost === 0 || costEntry.cost === null || costEntry.cost === undefined) &&
            costEntry.characters &&
            costEntry.characters > 0
        ) {
            // Calculate imputed cost: (characters / 1,000,000) * cost per million
            const imputedCost = (costEntry.characters / 1_000_000) * VOICE_COST_PER_MILLION_CHARACTERS;
            
            console.log(
                `Imputing voice cost: ${costEntry.characters} characters = $${imputedCost.toFixed(6)} ` +
                `(using $${VOICE_COST_PER_MILLION_CHARACTERS} per million characters)`
            );
            
            // Update the cost entry
            return {
                ...costEntry,
                cost: imputedCost,
                imputed: true, // Flag to indicate this cost was imputed
            };
        }
        
        return costEntry;
    });
}

