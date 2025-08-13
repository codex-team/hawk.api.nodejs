import { validateUtmParams } from '../../src/utils/utm/utm';

describe('UTM Utils', () => {
  describe('validateUtmParams', () => {
    it('should return empty object for undefined or null utm', () => {
      expect(validateUtmParams(undefined)).toEqual({});
      expect(validateUtmParams(null as any)).toEqual({});
    });

    it('should return empty object for empty object', () => {
      expect(validateUtmParams({})).toEqual({});
    });

    it('should return empty object for non-object types', () => {
      expect(validateUtmParams('string' as any)).toEqual({});
      expect(validateUtmParams(123 as any)).toEqual({});
      expect(validateUtmParams(true as any)).toEqual({});
      expect(validateUtmParams([] as any)).toEqual({});
    });

    it('should filter out invalid UTM keys', () => {
      const result1 = validateUtmParams({ invalidKey: 'value' } as any);
      expect(result1).toEqual({});

      const result2 = validateUtmParams({ source: 'google', invalidKey: 'value' } as any);
      expect(result2).toEqual({ source: 'google' });
    });

    it('should return valid UTM parameters', () => {
      const result1 = validateUtmParams({ source: 'google' });
      expect(result1).toEqual({ source: 'google' });

      const result2 = validateUtmParams({ medium: 'cpc' });
      expect(result2).toEqual({ medium: 'cpc' });
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
      expect(result).toEqual(validUtm);
    });

    it('should filter out non-string values', () => {
      const result1 = validateUtmParams({ source: 123 } as any);
      expect(result1).toEqual({});

      const result2 = validateUtmParams({ source: 'google', medium: true } as any);
      expect(result2).toEqual({ source: 'google' });
    });

    it('should filter out empty string values', () => {
      const result = validateUtmParams({ source: '' });
      expect(result).toEqual({});
    });

    it('should filter out values that are too long', () => {
      const longValue = 'a'.repeat(51);
      const result = validateUtmParams({ source: longValue });
      expect(result).toEqual({});
    });

    it('should accept values at maximum length', () => {
      const maxLengthValue = 'a'.repeat(50);
      const result = validateUtmParams({ source: maxLengthValue });
      expect(result).toEqual({ source: maxLengthValue });
    });

    it('should filter out values with invalid characters', () => {
      const result1 = validateUtmParams({ source: 'google@example' });
      expect(result1).toEqual({});

      const result2 = validateUtmParams({ source: 'google######' });
      expect(result2).toEqual({});
    });

    it('should accept values with valid characters', () => {
      const result = validateUtmParams({ source: 'google-ads' });
      expect(result).toEqual({ source: 'google-ads' });

      const result2 = validateUtmParams({
        source: 'google_ads',
        medium: 'cpc-campaign',
        campaign: 'spring.2025',
        content: 'Ad Variant 123',
        term: 'error tracker',
      });
      expect(result2).toEqual({
        source: 'google_ads',
        medium: 'cpc-campaign',
        campaign: 'spring.2025',
        content: 'Ad Variant 123',
        term: 'error tracker',
      });
    });

    it('should handle mixed valid and invalid keys', () => {
      const input = {
        source: 'google',
        medium: 'invalid@chars',
        campaign: 'valid_campaign',
        invalidKey: 'value',
      } as any;
      const result = validateUtmParams(input);
      expect(result).toEqual({ source: 'google', campaign: 'valid_campaign' });
    });

    it('should filter out undefined and null values', () => {
      const result = validateUtmParams({
        source: 'google',
        medium: undefined,
        campaign: null,
      } as any);
      expect(result).toEqual({ source: 'google' });
    });

    it('should validate each parameter independently', () => {
      const input = {
        source: '######', // invalid chars
        medium: 'cpc', // valid
        campaign: 'spring_2025_launch', // valid
        content: 'ad_variant_a', // valid
        term: 'error_tracker', // valid
      };
      const result = validateUtmParams(input);
      expect(result).toEqual({
        medium: 'cpc',
        campaign: 'spring_2025_launch',
        content: 'ad_variant_a',
        term: 'error_tracker',
      });
    });
  });
});
