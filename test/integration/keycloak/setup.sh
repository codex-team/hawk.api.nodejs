#!/bin/bash

# Keycloak Setup Script for Hawk SSO Development
# This script configures Keycloak with realm, client, and test users

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8180}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="hawk"

# Determine the script directory and realm file path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REALM_FILE="${SCRIPT_DIR}/import/hawk-realm.json"

# Check if realm file exists
if [ ! -f "$REALM_FILE" ]; then
  echo "❌ Realm configuration file not found: $REALM_FILE"
  exit 1
fi

echo "🔧 Setting up Keycloak for Hawk SSO..."
echo "Keycloak URL: $KEYCLOAK_URL"

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to start..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s -f "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1; then
    echo "✓ Keycloak is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Waiting for Keycloak... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Keycloak failed to start in time"
  exit 1
fi

# Additional wait for admin user to be fully initialized
echo "⏳ Waiting for admin user to be ready..."
sleep 3

# Get admin token with retries
echo "🔑 Obtaining admin token..."
TOKEN_RETRIES=10
TOKEN_RETRY_COUNT=0
ACCESS_TOKEN=""

while [ $TOKEN_RETRY_COUNT -lt $TOKEN_RETRIES ]; do
  TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$ADMIN_USER" \
    -d "password=$ADMIN_PASSWORD" \
    -d "grant_type=password" \
    -d "client_id=admin-cli")

  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

  if [ -n "$ACCESS_TOKEN" ]; then
    echo "✓ Admin token obtained"
    break
  fi

  TOKEN_RETRY_COUNT=$((TOKEN_RETRY_COUNT + 1))
  if [ $TOKEN_RETRY_COUNT -lt $TOKEN_RETRIES ]; then
    echo "Retrying token request... ($TOKEN_RETRY_COUNT/$TOKEN_RETRIES)"
    sleep 2
  fi
done

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to obtain admin token after $TOKEN_RETRIES attempts"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

# Check if realm already exists
echo "🔍 Checking if realm '$REALM_NAME' exists..."
REALM_EXISTS=$(curl -s -o /dev/null -w "%{http_code}" "$KEYCLOAK_URL/admin/realms/$REALM_NAME" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [ "$REALM_EXISTS" = "200" ]; then
  echo "⚠️  Realm '$REALM_NAME' already exists. Skipping realm creation."
  echo "   To reconfigure, delete the realm manually or remove Keycloak data volume."
else
  echo "📦 Importing realm from configuration..."

  # Import realm
  IMPORT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$KEYCLOAK_URL/admin/realms" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d @"$REALM_FILE")

  HTTP_CODE=$(echo "$IMPORT_RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$IMPORT_RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "201" ]; then
    echo "✓ Realm '$REALM_NAME' created successfully!"
  else
    echo "❌ Failed to create realm (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
    exit 1
  fi
fi

# Get realm's SAML descriptor for reference
echo "📋 Fetching SAML metadata..."
SAML_DESCRIPTOR=$(curl -s "$KEYCLOAK_URL/realms/$REALM_NAME/protocol/saml/descriptor")

if echo "$SAML_DESCRIPTOR" | grep -q "EntityDescriptor"; then
  echo "✓ SAML metadata is available"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🎉 Keycloak setup completed successfully!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📍 Configuration Details:"
  echo "   Keycloak Admin Console: $KEYCLOAK_URL"
  echo "   Admin credentials: $ADMIN_USER / $ADMIN_PASSWORD"
  echo "   Realm: $REALM_NAME"
  echo "   Client ID: hawk-sp"
  echo ""
  echo "👥 Test Users:"
  echo "   - testuser@hawk.local / password123"
  echo "   - alice@hawk.local / password123"
  echo "   - bob@hawk.local / password123"
  echo ""
  echo "🔗 SSO URLs for Hawk configuration:"
  echo "   IdP Entity ID: $KEYCLOAK_URL/realms/$REALM_NAME"
  echo "   SSO URL: $KEYCLOAK_URL/realms/$REALM_NAME/protocol/saml"
  echo "   SAML Metadata: $KEYCLOAK_URL/realms/$REALM_NAME/protocol/saml/descriptor"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Open Hawk SSO settings in workspace"
  echo "   2. Configure SSO with the URLs above"
  echo "   3. Copy X.509 certificate from Keycloak admin console"
  echo "      (Realm Settings → Keys → RS256 → Certificate)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "⚠️  SAML metadata not available yet. Keycloak may still be initializing."
fi
