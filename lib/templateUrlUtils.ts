export const TEMPLATE_URL_PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

export interface TemplateUrlValidationResult {
    isValid: boolean;
    errors: string[];
    placeholders: string[];
}

export const isValidTemplatePlaceholderName = (name: string): boolean =>
    /^[A-Za-z][A-Za-z0-9_]*$/.test(name);

const extractPlaceholderTokens = (template: string): string[] => template.match(/\{[^}]*\}/g) || [];

export const extractTemplatePlaceholders = (template: string): string[] => {
    const placeholders: string[] = [];
    const seen = new Set<string>();

    for (const token of extractPlaceholderTokens(template)) {
        const placeholderName = token.slice(1, -1);

        if (!isValidTemplatePlaceholderName(placeholderName) || seen.has(placeholderName)) {
            continue;
        }

        seen.add(placeholderName);
        placeholders.push(placeholderName);
    }

    return placeholders;
};

export const validateTemplateUrl = (name: string, template: string): TemplateUrlValidationResult => {
    const errors: string[] = [];

    if (!name.trim()) {
        errors.push('Template name is required');
    }

    if (!template.trim()) {
        errors.push('Template URL is required');

        return {
            isValid: false,
            errors,
            placeholders: []
        };
    }

    const invalidPlaceholder = extractPlaceholderTokens(template).find((token) => {
        const placeholderName = token.slice(1, -1);
        return !isValidTemplatePlaceholderName(placeholderName);
    });

    if (invalidPlaceholder) {
        errors.push(`Invalid placeholder: ${invalidPlaceholder}`);
    }

    const templateForValidation = template.replace(/\{[^}]+\}/g, 'example');

    try {
        new URL(templateForValidation);
    } catch {
        errors.push('Template URL is invalid');
    }

    return {
        isValid: errors.length === 0,
        errors,
        placeholders: extractTemplatePlaceholders(template)
    };
};

export const buildTemplateUrl = (template: string, values: Record<string, string>): string =>
    template.replace(TEMPLATE_URL_PLACEHOLDER_PATTERN, (_, placeholderName: string) =>
        encodeURIComponent(values[placeholderName] ?? '')
    );
