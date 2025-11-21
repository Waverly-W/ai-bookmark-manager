
/**
 * JSON Schema Definition
 * Compatible with OpenAI's json_schema format
 */
export interface JSONSchema {
    type: "object" | "array" | "string" | "number" | "boolean" | "null";
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    additionalProperties?: boolean;
    description?: string;
    enum?: string[];
}

/**
 * AI Scenario Interface
 * Defines a specific AI capability (e.g., Rename Bookmark, Recommend Folder)
 */
export interface AIScenario<InputType, OutputType> {
    /**
     * Unique identifier for the scenario
     */
    id: string;

    /**
     * Human-readable name
     */
    name: string;

    /**
     * Description of what this scenario does
     */
    description: string;

    /**
     * Get the System Prompt based on locale
     */
    getSystemPrompt: (locale: string) => string;

    /**
     * Default User Prompt - Defines the style/content requirements
     * This is customizable by the user
     */
    defaultUserPrompt: string;

    /**
     * JSON Schema for the expected output
     */
    responseSchema: {
        name: string;
        strict: boolean;
        schema: JSONSchema;
    };

    /**
     * Function to format the user prompt with input data
     */
    formatUserPrompt: (template: string, input: InputType) => string;

    /**
     * Function to parse the raw JSON response into the typed output
     */
    parseResponse: (response: any) => OutputType;
}
