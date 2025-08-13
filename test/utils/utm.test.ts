import { validateUtmParams, sanitizeUtmParams } from '../../src/utils/utm/utm';

describe('UTM Utils', () => {
  describe('validateUtmParams', () => {
    it('should return valid result for undefined or null utm', () => {
      expect(validateUtmParams(undefined)).toEqual({
        isValid: true,
        validKeys: [],
        invalidKeys: [],
      });
      expect(validateUtmParams(null as any)).toEqual({
        isValid: true,
        validKeys: [],
        invalidKeys: [],
      });
    });

    it('should return valid result for empty object', () => {
      expect(validateUtmParams({})).toEqual({ isValid: true, validKeys: [], invalidKeys: [] });
    });

    it('should return invalid result for non-object types', () => {
      expect(validateUtmParams('string' as any)).toEqual({
        isValid: false,
        validKeys: [],
        invalidKeys: ['_structure'],
      });
      expect(validateUtmParams(123 as any)).toEqual({
        isValid: false,
        validKeys: [],
        invalidKeys: ['_structure'],
      });
      expect(validateUtmParams(true as any)).toEqual({
        isValid: false,
        validKeys: [],
        invalidKeys: ['_structure'],
      });
      expect(validateUtmParams([] as any)).toEqual({
        isValid: false,
        validKeys: [],
        invalidKeys: ['_structure'],
      });
    });

    it('should identify invalid UTM keys', () => {
      const result1 = validateUtmParams({ invalidKey: 'value' } as any);
      expect(result1.isValid).toBe(false);
      expect(result1.invalidKeys).toContain('invalidKey');
      expect(result1.validKeys).toEqual([]);

      const result2 = validateUtmParams({ source: 'google', invalidKey: 'value' } as any);
      expect(result2.isValid).toBe(false);
      expect(result2.invalidKeys).toContain('invalidKey');
      expect(result2.validKeys).toContain('source');
    });

    it('should return valid result for valid UTM keys', () => {
      const result1 = validateUtmParams({ source: 'google' });
      expect(result1.isValid).toBe(true);
      expect(result1.validKeys).toContain('source');
      expect(result1.invalidKeys).toEqual([]);

      const result2 = validateUtmParams({ medium: 'cpc' });
      expect(result2.isValid).toBe(true);
      expect(result2.validKeys).toContain('medium');
    });

    it('should validate multiple UTM keys correctly', () => {
      const validUtm = {
        source: 'google',
        medium: 'cpc',
        campaign: 'spring_2025_launch',
        content: 'ad_variant_a',
        term: 'error_tracker',
      };
      const result = validateUtmParams(validUtm);
      expect(result.isValid).toBe(true);
      expect(result.validKeys).toEqual(['source', 'medium', 'campaign', 'content', 'term']);
      expect(result.invalidKeys).toEqual([]);
    });

    it('should identify non-string values as invalid', () => {
      const result1 = validateUtmParams({ source: 123 } as any);
      expect(result1.isValid).toBe(false);
      expect(result1.invalidKeys).toContain('source');

      const result2 = validateUtmParams({ source: 'google', medium: true } as any);
      expect(result2.isValid).toBe(false);
      expect(result2.validKeys).toContain('source');
      expect(result2.invalidKeys).toContain('medium');
    });

    it('should identify empty string values as invalid', () => {
      const result = validateUtmParams({ source: '' });
      expect(result.isValid).toBe(false);
      expect(result.invalidKeys).toContain('source');
    });

    it('should identify values that are too long as invalid', () => {
      const longValue = 'a'.repeat(201);
      const result = validateUtmParams({ source: longValue });
      expect(result.isValid).toBe(false);
      expect(result.invalidKeys).toContain('source');
    });

    it('should accept values at maximum length', () => {
      const maxLengthValue = 'a'.repeat(200);
      const result = validateUtmParams({ source: maxLengthValue });
      expect(result.isValid).toBe(true);
      expect(result.validKeys).toContain('source');
    });

    it('should identify values with invalid characters', () => {
      const result = validateUtmParams({ source: 'google@example' });
      expect(result.isValid).toBe(false);
      expect(result.invalidKeys).toContain('source');
    });

    it('should accept values with valid characters', () => {
      const result = validateUtmParams({ source: 'google-ads' });
      expect(result.isValid).toBe(true);
      expect(result.validKeys).toContain('source');
    });

    it('should handle mixed valid and invalid keys', () => {
      const input = {
        source: 'google',
        medium: 'invalid@chars',
        campaign: 'valid_campaign',
        invalidKey: 'value',
      } as any;
      const result = validateUtmParams(input);
      expect(result.isValid).toBe(false);
      expect(result.validKeys).toEqual(['source', 'campaign']);
      expect(result.invalidKeys).toEqual(['medium', 'invalidKey']);
    });

    it('should handle undefined and null values in object', () => {
      const result = validateUtmParams({ source: 'google', medium: undefined });
      expect(result.isValid).toBe(true);
      expect(result.validKeys).toContain('source');
      expect(result.validKeys).toEqual(['source', 'medium']); // undefined values are treated as valid (skipped)
      expect(result.invalidKeys).toEqual([]);
    });
  });

  describe('sanitizeUtmParams', () => {
    it('should return undefined for undefined or null utm', () => {
      expect(sanitizeUtmParams(undefined)).toBeUndefined();
      expect(sanitizeUtmParams(null as any)).toBeUndefined();
    });

    it('should return undefined for empty object', () => {
      expect(sanitizeUtmParams({})).toBeUndefined();
    });

    it('should filter out invalid keys', () => {
      const input = { source: 'google', invalidKey: 'value' } as any;
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ source: 'google' });
    });

    it('should sanitize values by removing invalid characters', () => {
      const input = { source: 'google@#$%ads' };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ source: 'googleads' });
    });

    it('should trim whitespace', () => {
      const input = { source: '  google ads  ' };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ source: 'google ads' });
    });

    it('should limit length to 200 characters', () => {
      const longValue = 'a'.repeat(250);
      const input = { source: longValue };
      const result = sanitizeUtmParams(input);
      expect(result?.source).toHaveLength(200);
    });

    it('should preserve valid characters', () => {
      const input = {
        source: 'google-ads',
        medium: 'cpc_campaign',
        campaign: 'spring.2025',
        content: 'Ad Variant 123',
        term: 'error_tracker-tool',
      };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual(input);
    });

    it('should remove entries with empty values after sanitization', () => {
      const input = { source: '@#$%', medium: 'cpc' };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ medium: 'cpc' });
    });

    it('should return undefined if all values become empty after sanitization', () => {
      const input = { source: '@#$%', medium: '!@#$' };
      const result = sanitizeUtmParams(input);
      expect(result).toBeUndefined();
    });

    it('should handle non-string values by filtering them out', () => {
      const input = { source: 'google', medium: 123, campaign: true } as any;
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ source: 'google' });
    });

    it('should handle null and undefined values', () => {
      const input = { source: 'google', medium: null as any, campaign: undefined };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({ source: 'google' });
    });

    it('should handle complex sanitization case', () => {
      const input = {
        source: '  Google@Ads#Campaign  ',
        medium: 'cpc$paid%search',
        campaign: 'spring_2025-launch.campaign',
        content: '!@#$%',
        term: 'error tracker tool',
      };
      const result = sanitizeUtmParams(input);
      expect(result).toEqual({
        source: 'GoogleAdsCampaign',
        medium: 'cpcpaidsearch',
        campaign: 'spring_2025-launch.campaign',
        term: 'error tracker tool',
      });
    });
  });
});
