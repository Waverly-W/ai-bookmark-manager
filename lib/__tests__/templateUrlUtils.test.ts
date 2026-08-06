import { describe, expect, it } from 'vitest';
import {
    buildTemplateUrl,
    extractTemplatePlaceholders,
    isValidTemplatePlaceholderName,
    validateTemplateUrl
} from '../templateUrlUtils';

describe('templateUrlUtils', () => {
    it('extracts unique placeholders while preserving order', () => {
        expect(
            extractTemplatePlaceholders('https://example.com/search?q={keyword}&source={keyword}&city={city}')
        ).toEqual(['keyword', 'city']);
    });

    it('rejects invalid placeholder names', () => {
        expect(isValidTemplatePlaceholderName('keyword')).toBe(true);
        expect(isValidTemplatePlaceholderName('1keyword')).toBe(false);
        expect(isValidTemplatePlaceholderName('keyword-name')).toBe(false);
        expect(isValidTemplatePlaceholderName('')).toBe(false);
    });

    it('validates template urls with placeholders', () => {
        expect(
            validateTemplateUrl('Search', 'https://example.com/search?q={keyword}')
        ).toEqual({
            isValid: true,
            errors: [],
            placeholders: ['keyword']
        });
    });

    it('returns validation errors for malformed placeholders', () => {
        const result = validateTemplateUrl('Search', 'https://example.com/search?q={keyword-name}');

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('placeholder');
    });

    it('builds the final encoded url from inputs', () => {
        expect(
            buildTemplateUrl('https://example.com/search?q={keyword}&city={city}', {
                keyword: 'hello world',
                city: 'shanghai/浦东'
            })
        ).toBe('https://example.com/search?q=hello%20world&city=shanghai%2F%E6%B5%A6%E4%B8%9C');
    });

    it('supports templates without placeholders', () => {
        expect(buildTemplateUrl('https://example.com/docs', {})).toBe('https://example.com/docs');
    });
});
