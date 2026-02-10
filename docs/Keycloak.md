# Keycloak for Hawk SSO Development

This guide explains how to use Keycloak for testing Hawk's SSO implementation.

## Quick Start

### 1. Start Keycloak

From the project root:

```bash
docker-compose up keycloak
```

Keycloak will be available at: **http://localhost:8180**

### 2. Run Setup Script

The setup script will configure Keycloak with a test realm, SAML client, and test users.

**Option 1: Run from your host machine** (recommended):

```bash
cd api/test/integration/keycloak
KEYCLOAK_URL=http://localhost:8180 ./setup.sh
```

**Option 2: Run from API container** (if you don't have curl on host):

```bash
docker-compose exec -e KEYCLOAK_URL=http://keycloak:8180 api /keycloak/setup.sh
```

**Note:** The setup script requires `curl` and `bash` to interact with Keycloak API. The Keycloak container doesn't have these tools, so we either run from host or from another container (like `api`).

### 3. Access Keycloak Admin Console

- URL: http://localhost:8180
- Username: `admin`
- Password: `admin`

## Configuration

### Realm

- **Name**: `hawk`
- **SAML Endpoint**: http://localhost:8180/realms/hawk/protocol/saml

### SAML Client

- **Client ID / Entity ID**: `urn:hawk:tracker:saml`
  - This must match `SSO_SP_ENTITY_ID` environment variable in Hawk API
- **Protocol**: SAML 2.0
- **ACS URL**: http://localhost:4000/auth/sso/saml/{workspaceId}/acs
- **Name ID Format**: email

### Environment Variables

Hawk API requires the following environment variable:

- **SSO_SP_ENTITY_ID**: `urn:hawk:tracker:saml`
  - Set in `docker-compose.yml` or `.env` file
  - This is the Service Provider Entity ID used to identify Hawk in SAML requests

### Test Users

| Username | Email | Password | Department | Title |
|----------|-------|----------|------------|-------|
| testuser | testuser@hawk.local | password123 | Engineering | Software Engineer |
| alice | alice@hawk.local | password123 | Product | Product Manager |
| bob | bob@hawk.local | password123 | Engineering | Senior Developer |

## Hawk SSO Configuration

To configure SSO in Hawk workspace settings:

### Get Configuration Automatically

**Option 1: Use the helper script** (recommended):

```bash
cd api/test/integration/keycloak
./get-config.sh
```

This will output all required values that you can copy-paste into Hawk SSO settings.

**Option 2: Get values manually**:

### Required Fields

1. **IdP Entity ID**:
   ```
   http://localhost:8180/realms/hawk
   ```

2. **SSO URL**:
   ```
   http://localhost:8180/realms/hawk/protocol/saml
   ```

3. **X.509 Certificate**:

   **Via command line**:
   ```bash
   curl -s "http://localhost:8180/realms/hawk/protocol/saml/descriptor" | grep -oP '(?<=<ds:X509Certificate>)[^<]+' | head -1
   ```

   **Via Keycloak Admin Console**:
   - Go to Realm Settings → Keys
   - Find RS256 algorithm row
   - Click "Certificate" button
   - Copy the certificate (without BEGIN/END lines)
   - Paste into Hawk SSO settings

### Attribute Mapping

Configure these mappings in Hawk:

- **Email**: `email`
- **Name**: `name` (full name - combines firstName and lastName from Keycloak)
- **Department** (optional): `department`
- **Title** (optional): `title`

### Name ID Format

Select: **Email address (urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress)**

## Testing SSO Flow

### Manual Test

1. Configure SSO in Hawk workspace settings with the values above
2. Enable SSO for the workspace
3. Navigate to: http://localhost:4000/auth/sso/saml/{workspaceId}
4. You'll be redirected to Keycloak login page
5. Login with any test user (e.g., `testuser@hawk.local` / `password123`)
6. After successful authentication, you'll be redirected back to Hawk with tokens

### Automated Test

Run integration tests:

```bash
cd api
yarn test:integration
```

## Troubleshooting

### Keycloak not starting

Check Docker logs:
```bash
docker-compose logs keycloak
```

### Realm already exists

If you need to reset:
```bash
docker-compose down -v
docker-compose up keycloak
```

### Certificate issues

If SAML validation fails:
1. Verify the certificate is copied correctly (no extra spaces/newlines)
2. Ensure you copied the certificate content without BEGIN/END markers
3. Check Keycloak logs for signature errors

### Get SAML Metadata

You can view the full SAML metadata descriptor at:
```
http://localhost:8180/realms/hawk/protocol/saml/descriptor
```

This contains all technical details about the IdP configuration.

## Files

Files are located in `api/test/integration/keycloak/`:

- `import/hawk-realm.json` - Keycloak realm configuration
- `setup.sh` - Automated setup script

## Advanced Configuration

### Custom Workspace ID

To test with a different workspace ID, update the ACS URL in the Keycloak Admin Console:

1. Go to Clients → hawk-sp
2. Update `saml_assertion_consumer_url_post` attribute
3. Save changes

### Additional Users

You can add more users through:
- Keycloak Admin Console → Users → Add User
- Or update `api/test/integration/keycloak/import/hawk-realm.json` and re-import

### Different Port

If you need to run Keycloak on a different port:

1. Update `KC_HTTP_PORT` in `docker-compose.yml`
2. Update port mapping in `docker-compose.yml`
3. Update all URLs in this README
4. Update `api/test/integration/keycloak/import/hawk-realm.json` with new URLs
