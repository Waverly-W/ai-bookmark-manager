import { AIScenario } from '../types';

export interface AutoTaggingInput {
    url: string;
    title: string;
    existingTags: string[]; // List of existing tags to potentially reuse
}

export interface AutoTaggingOutput {
    tags: string[];
}

export const formatAutoTaggingSystemPrompt = (
    url: string,
    title: string,
    existingTags: string[],
    locale: string = 'en'
): string => {
    return `You are a pragmatic bookmark organizer. Your goal is to generate 3-5 relevant tags for the given webpage.
    
Input Information:
- URL: ${url}
- Title: ${title}
- System Locale: ${locale}

Existing Tags in System (Reuse these if relevant):
${existingTags.join(', ')}

Rules for Tagging:
1. Generate 3-5 tags.
2. Tags must be SHORT (1-2 words).
3. Tags must be in LOWERCASE.
4. If the content is technical, use precise technical terms.
5. If "Existing Tags" contains relevant tags, PRIORITIZE reusing them to maintain consistency.
6. Return tags in the user's preferred language based on the content.

CRITICAL: Return ONLY a valid JSON object with the following structure:
{
  "tags": ["tag1", "tag2", "tag3"]
}
`;
};

export const autoTaggingScenario: AIScenario<AutoTaggingInput, AutoTaggingOutput> = {
    id: 'auto-tagging',
    name: 'autoTagging',
    description: 'Generate tags for a bookmark based on URL and Title',
    defaultUserPrompt: 'Generate tags for this bookmark.',
    responseSchema: {
        name: "auto_tagging_response",
        strict: true,
        schema: {
            type: "object",
            properties: {
                tags: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    description: "List of suggested tags"
                }
            },
            required: ["tags"],
            additionalProperties: false
        }
    },
    formatUserPrompt: (template: string, input: AutoTaggingInput) => {
        return `${template}
        
Title: ${input.title}
URL: ${input.url}
`;
    },
    getSystemPrompt: (locale: string) => `You are a bookmark tagging assistant.`, // Dynamic prompt is handled in service
    parseResponse: (response: any): AutoTaggingOutput => {
        return {
            tags: response.tags || []
        };
    }
};
