import '../../../src/env-test';
import { extractAttribute } from '../../../src/sso/saml/utils';

describe('SAML Utils', () => {
  describe('extractAttribute', () => {
    it('should return string value when attribute is a string', () => {
      const attributes = {
        email: 'user@example.com',
      };

      const result = extractAttribute(attributes, 'email');

      expect(result).toBe('user@example.com');
    });

    it('should return first element when attribute is an array', () => {
      const attributes = {
        email: ['primary@example.com', 'secondary@example.com'],
      };

      const result = extractAttribute(attributes, 'email');

      expect(result).toBe('primary@example.com');
    });

    it('should return undefined when attribute does not exist', () => {
      const attributes = {
        name: 'John Doe',
      };

      const result = extractAttribute(attributes, 'email');

      expect(result).toBeUndefined();
    });

    it('should return undefined when array is empty', () => {
      const attributes = {
        email: [] as string[],
      };

      const result = extractAttribute(attributes, 'email');

      expect(result).toBeUndefined();
    });

    it('should work with SAML-style attribute names', () => {
      const attributes = {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'user@example.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'John Doe',
      };

      const email = extractAttribute(
        attributes,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
      );
      const name = extractAttribute(
        attributes,
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
      );

      expect(email).toBe('user@example.com');
      expect(name).toBe('John Doe');
    });
  });
});
