import '../../../src/env-test';
import { validateAudience, validateRecipient, validateTimeConditions } from '../../../src/sso/saml/utils';

describe('SAML Utils', () => {
  describe('validateAudience', () => {
    const originalEnv = process.env.SSO_SP_ENTITY_ID;

    afterEach(() => {
      /**
       * Restore original env value
       */
      if (originalEnv) {
        process.env.SSO_SP_ENTITY_ID = originalEnv;
      } else {
        /**
         * Use Reflect.deleteProperty to avoid TypeScript error with delete operator
         */
        Reflect.deleteProperty(process.env, 'SSO_SP_ENTITY_ID');
      }
    });

    it('should return true when audience matches SSO_SP_ENTITY_ID', () => {
      process.env.SSO_SP_ENTITY_ID = 'urn:hawk:tracker:saml';
      const result = validateAudience('urn:hawk:tracker:saml');
      expect(result).toBe(true);
    });

    it('should return false when audience does not match SSO_SP_ENTITY_ID', () => {
      process.env.SSO_SP_ENTITY_ID = 'urn:hawk:tracker:saml';
      const result = validateAudience('urn:different:entity');
      expect(result).toBe(false);
    });

    it('should throw error when SSO_SP_ENTITY_ID is not set', () => {
      /**
       * Use Reflect.deleteProperty to avoid TypeScript error with delete operator
       */
      Reflect.deleteProperty(process.env, 'SSO_SP_ENTITY_ID');
      expect(() => {
        validateAudience('urn:hawk:tracker:saml');
      }).toThrow('SSO_SP_ENTITY_ID environment variable is not set');
    });
  });

  describe('validateRecipient', () => {
    it('should return true when recipient matches expected ACS URL', () => {
      const recipient = 'https://api.example.com/auth/sso/saml/workspace123/acs';
      const expectedAcsUrl = 'https://api.example.com/auth/sso/saml/workspace123/acs';
      const result = validateRecipient(recipient, expectedAcsUrl);
      expect(result).toBe(true);
    });

    it('should return false when recipient does not match expected ACS URL', () => {
      const recipient = 'https://api.example.com/auth/sso/saml/workspace123/acs';
      const expectedAcsUrl = 'https://api.example.com/auth/sso/saml/workspace456/acs';
      const result = validateRecipient(recipient, expectedAcsUrl);
      expect(result).toBe(false);
    });
  });

  describe('validateTimeConditions', () => {
    /**
     * Mock Date.now() for time-based tests using jest.spyOn
     */
    let dateNowSpy: jest.SpyInstance<number, []>;

    afterEach(() => {
      if (dateNowSpy) {
        dateNowSpy.mockRestore();
      }
    });

    it('should return true when assertion is valid (current time is between NotBefore and NotOnOrAfter)', () => {
      const notBefore = new Date('2025-01-01T00:00:00Z');
      const notOnOrAfter = new Date('2025-01-01T01:00:00Z');
      const currentTime = new Date('2025-01-01T00:30:00Z').getTime();

      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
      const result = validateTimeConditions(notBefore, notOnOrAfter);
      expect(result).toBe(true);
    });

    it('should return false when assertion is expired (current time is after NotOnOrAfter)', () => {
      const notBefore = new Date('2025-01-01T00:00:00Z');
      const notOnOrAfter = new Date('2025-01-01T01:00:00Z');
      const currentTime = new Date('2025-01-01T01:30:00Z').getTime();

      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
      const result = validateTimeConditions(notBefore, notOnOrAfter);
      expect(result).toBe(false);
    });

    it('should return false when assertion is not yet valid (current time is before NotBefore)', () => {
      const notBefore = new Date('2025-01-01T00:00:00Z');
      const notOnOrAfter = new Date('2025-01-01T01:00:00Z');
      const currentTime = new Date('2024-12-31T23:30:00Z').getTime();

      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
      const result = validateTimeConditions(notBefore, notOnOrAfter);
      expect(result).toBe(false);
    });

    it('should account for clock skew', () => {
      const notBefore = new Date('2025-01-01T00:00:00Z');
      const notOnOrAfter = new Date('2025-01-01T01:00:00Z');
      /**
       * Current time is 1 minute before NotBefore, but with 2 minute clock skew it should be valid
       */
      const currentTime = new Date('2024-12-31T23:59:00Z').getTime();
      const clockSkew = 2 * 60 * 1000; // 2 minutes

      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
      const result = validateTimeConditions(notBefore, notOnOrAfter, clockSkew);
      expect(result).toBe(true);
    });

    it('should account for clock skew when assertion is expired', () => {
      const notBefore = new Date('2025-01-01T00:00:00Z');
      const notOnOrAfter = new Date('2025-01-01T01:00:00Z');
      /**
       * Current time is 1 minute after NotOnOrAfter, but with 2 minute clock skew it should still be valid
       * (clock skew extends the window: notOnOrAfterTime = 01:00:00 + 2min = 01:02:00)
       */
      const currentTime = new Date('2025-01-01T01:01:00Z').getTime();
      const clockSkew = 2 * 60 * 1000; // 2 minutes

      dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(currentTime);
      const result = validateTimeConditions(notBefore, notOnOrAfter, clockSkew);
      /**
       * With clock skew: notOnOrAfterTime = 2025-01-01T01:00:00Z + 2min = 2025-01-01T01:02:00Z
       * Current time = 2025-01-01T01:01:00Z
       * Should be valid
       */
      expect(result).toBe(true);
    });
  });
});

