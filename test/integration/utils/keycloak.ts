import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXml = promisify(parseString);

/**
 * Keycloak configuration
 */
export const keycloakConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://keycloak:8180',
  realm: 'hawk',
  clientId: 'hawk-sp',
  adminUser: 'admin',
  adminPassword: 'admin',
};

/**
 * Test user credentials
 */
export const testUsers = {
  testuser: {
    username: 'testuser',
    password: 'password123',
    email: 'testuser@hawk.local',
    firstName: 'Test',
    lastName: 'User',
  },
  alice: {
    username: 'alice',
    password: 'password123',
    email: 'alice@hawk.local',
    firstName: 'Alice',
    lastName: 'Johnson',
  },
  bob: {
    username: 'bob',
    password: 'password123',
    email: 'bob@hawk.local',
    firstName: 'Bob',
    lastName: 'Smith',
  },
};

/**
 * Keycloak SAML configuration for Hawk
 */
export interface KeycloakSamlConfig {
  /**
   * IdP Entity ID
   */
  idpEntityId: string;

  /**
   * SSO URL
   */
  ssoUrl: string;

  /**
   * X.509 Certificate (PEM format, without headers)
   */
  x509Cert: string;
}

/**
 * Get Keycloak admin token
 */
export async function getAdminToken(): Promise<string> {
  const response = await axios.post(
    `${keycloakConfig.baseUrl}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      username: keycloakConfig.adminUser,
      password: keycloakConfig.adminPassword,
      grant_type: 'password',
      client_id: 'admin-cli',
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
}

/**
 * Get Keycloak SAML configuration for Hawk
 */
export async function getKeycloakSamlConfig(): Promise<KeycloakSamlConfig> {
  /**
   * Fetch SAML metadata descriptor
   */
  const descriptorUrl = `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}/protocol/saml/descriptor`;
  const response = await axios.get(descriptorUrl);

  /**
   * Parse XML to extract certificate
   * xml2js handles namespaces by creating keys with namespace prefixes
   * Keycloak uses 'md:' prefix for metadata elements and 'ds:' for signature elements
   */
  const parsed: any = await parseXml(response.data);

  /**
   * Access EntityDescriptor with namespace prefix
   */
  const entityDescriptor = parsed['md:EntityDescriptor'] || parsed.EntityDescriptor;

  if (!entityDescriptor) {
    throw new Error('EntityDescriptor not found in SAML metadata');
  }

  /**
   * Access IDPSSODescriptor with namespace prefix
   */
  const idpDescriptor =
    entityDescriptor['md:IDPSSODescriptor']?.[0] || entityDescriptor.IDPSSODescriptor?.[0];

  if (!idpDescriptor) {
    throw new Error('IDPSSODescriptor not found in SAML metadata');
  }

  /**
   * Find signing certificate from KeyDescriptor elements
   */
  let x509Cert = '';
  const keyDescriptors = idpDescriptor['md:KeyDescriptor'] || idpDescriptor.KeyDescriptor || [];

  for (const kd of keyDescriptors) {
    if (!kd.$?.use || kd.$?.use === 'signing') {
      /**
       * Try different possible paths for X509Certificate with namespace prefixes
       */
      const keyInfo = kd['ds:KeyInfo']?.[0] || kd.KeyInfo?.[0];

      if (keyInfo) {
        const x509Data = keyInfo['ds:X509Data']?.[0] || keyInfo.X509Data?.[0];

        if (x509Data) {
          x509Cert = x509Data['ds:X509Certificate']?.[0] || x509Data.X509Certificate?.[0] || '';
        }
      }

      if (x509Cert) {
        break;
      }
    }
  }

  if (!x509Cert) {
    throw new Error('X509 Certificate not found in SAML metadata');
  }

  return {
    idpEntityId: `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}`,
    ssoUrl: `${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}/protocol/saml`,
    x509Cert: x509Cert.trim(),
  };
}

/**
 * Simulate SSO login flow and get SAML Response
 *
 * This function performs browser-like login to Keycloak and extracts the SAML Response
 *
 * @param username - Keycloak username
 * @param password - Keycloak password
 * @param acsUrl - ACS URL where SAML Response should be sent
 * @returns SAML Response and RelayState
 */
export async function performKeycloakLogin(
  username: string,
  password: string,
  acsUrl: string
): Promise<{ samlResponse: string; relayState?: string }> {
  /**
   * This is a simplified version. In a real test, you would need to:
   * 1. Make a request to Hawk's SSO initiation endpoint
   * 2. Follow redirects to Keycloak
   * 3. Submit login form
   * 4. Extract SAML Response from the POST to ACS
   *
   * For now, this is a placeholder that would require additional libraries
   * like puppeteer or playwright for full browser automation.
   */
  throw new Error('Browser automation not implemented. Use mock SAML Response for tests.');
}

/**
 * Create a mock SAML Response for testing
 *
 * NOTE: This is a simplified mock. For real tests, you should either:
 * - Use actual Keycloak-generated SAML Response (via browser automation)
 * - Use a proper SAML Response generator library
 *
 * @param email - User email
 * @param nameId - Name ID (usually email)
 * @param attributes - Additional SAML attributes
 * @returns Base64-encoded SAML Response
 */
export function createMockSamlResponse(
  email: string,
  nameId: string,
  attributes: Record<string, string> = {}
): string {
  const now = new Date().toISOString();
  const notOnOrAfter = new Date(Date.now() + 300000).toISOString(); // 5 minutes
  const issueInstant = now;
  const sessionNotOnOrAfter = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  /**
   * This is a minimal SAML Response structure
   * In production, this would be generated by the IdP (Keycloak)
   */
  const samlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="_${generateId()}"
                Version="2.0"
                IssueInstant="${issueInstant}"
                Destination="${attributes.acsUrl || 'http://localhost:4000/auth/sso/saml/test/acs'}"
                InResponseTo="${attributes.inResponseTo || '_test_request_id'}">
  <saml:Issuer>${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                  ID="_${generateId()}"
                  Version="2.0"
                  IssueInstant="${issueInstant}">
    <saml:Issuer>${keycloakConfig.baseUrl}/realms/${keycloakConfig.realm}</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="${notOnOrAfter}"
                                      Recipient="${attributes.acsUrl || 'http://localhost:4000/auth/sso/saml/test/acs'}"
                                      InResponseTo="${attributes.inResponseTo || '_test_request_id'}"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${now}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>hawk-sp</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="${now}" SessionNotOnOrAfter="${sessionNotOnOrAfter}">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
        <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:type="xs:string">${email}</saml:AttributeValue>
      </saml:Attribute>
      ${attributes.name ? `
      <saml:Attribute Name="name" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
        <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema"
                             xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                             xsi:type="xs:string">${attributes.name}</saml:AttributeValue>
      </saml:Attribute>` : ''}
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

  /**
   * Base64 encode the SAML Response
   */
  return Buffer.from(samlResponse).toString('base64');
}

/**
 * Generate random ID for SAML messages
 */
function generateId(): string {
  return '_' + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('');
}

/**
 * Wait for Keycloak to be ready
 *
 * @param maxRetries - Maximum number of retries
 * @param retryInterval - Interval between retries in ms
 */
export async function waitForKeycloak(maxRetries = 30, retryInterval = 2000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get(`${keycloakConfig.baseUrl}/health/ready`);
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error('Keycloak failed to start in time');
      }
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}
