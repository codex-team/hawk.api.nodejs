import { validateUtmParams, sanitizeUtmParams } from '../../src/utils/utm/utm';

describe('UTM Utils', () => {
  describe('validateUtmParams', () => {
    it('should return true for undefined or null utm', () => {
      expect(validateUtmParams(undefined)).toBe(true);
      expect(validateUtmParams(null as any)).toBe(true);
    });

    it('should return true for empty object', () => {
      expect(validateUtmParams({})).toBe(true);
    });

    it('should return false for non-object types', () => {
      expect(validateUtmParams('string' as any)).toBe(false);
      expect(validateUtmParams(123 as any)).toBe(false);
      expect(validateUtmParams(true as any)).toBe(false);
      expect(validateUtmParams([] as any)).toBe(false);
    });

    it('should return false for invalid UTM keys', () => {
      expect(validateUtmParams({ invalidKey: 'value' } as any)).toBe(false);
      expect(validateUtmParams({ source: 'google', invalidKey: 'value' } as any)).toBe(false);
    });

    it('should return true for valid UTM keys', () => {
      expect(validateUtmParams({ source: 'google' })).toBe(true);
      expect(validateUtmParams({ medium: 'cpc' })).toBe(true);
      expect(validateUtmParams({ campaign: 'spring_2025' })).toBe(true);
      expect(validateUtmParams({ content: 'ad_variant_a' })).toBe(true);
      expect(validateUtmParams({ term: 'error_tracker' })).toBe(true);
    });

    it('should return true for multiple valid UTM keys', () => {
      const validUtm = {
        source: 'google',
        medium: 'cpc',
        campaign: 'spring_2025_launch',
        content: 'ad_variant_a',
        term: 'error_tracker',
      };
      expect(validateUtmParams(validUtm)).toBe(true);
    });

    it('should return false for non-string values', () => {
      expect(validateUtmParams({ source: 123 } as any)).toBe(false);
      expect(validateUtmParams({ source: true } as any)).toBe(false);
      expect(validateUtmParams({ source: {} } as any)).toBe(false);
      expect(validateUtmParams({ source: [] } as any)).toBe(false);
    });

    it('should return false for empty string values', () => {
      expect(validateUtmParams({ source: '' })).toBe(false);
    });

    it('should return false for values that are too long', () => {
      const longValue = 'a'.repeat(201);
      expect(validateUtmParams({ source: longValue })).toBe(false);
    });

    it('should return true for values at maximum length', () => {
      const maxLengthValue = 'a'.repeat(200);
      expect(validateUtmParams({ source: maxLengthValue })).toBe(true);
    });

    it('should return false for values with invalid characters', () => {
      expect(validateUtmParams({ source: 'google@example' })).toBe(false);
      expect(validateUtmParams({ source: 'google#hash' })).toBe(false);
      expect(validateUtmParams({ source: 'google$money' })).toBe(false);
      expect(validateUtmParams({ source: 'google%percent' })).toBe(false);
    });

    it('should return true for values with valid characters', () => {
      expect(validateUtmParams({ source: 'google-ads' })).toBe(true);
      expect(validateUtmParams({ source: 'google_ads' })).toBe(true);
      expect(validateUtmParams({ source: 'google.com' })).toBe(true);
      expect(validateUtmParams({ source: 'Google Ads 123' })).toBe(true);
    });

    it('should handle undefined and null values in object', () => {
      expect(validateUtmParams({ source: 'google', medium: undefined })).toBe(true);
      expect(validateUtmParams({ source: 'google', medium: null as any })).toBe(true);
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
