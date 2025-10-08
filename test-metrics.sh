#!/bin/bash

# Script to manually test the Prometheus metrics endpoint
# This can be run locally with a running instance of the API

METRICS_PORT=${METRICS_PORT:-9090}
METRICS_URL="http://localhost:${METRICS_PORT}/metrics"

echo "Testing Prometheus Metrics Endpoint..."
echo "URL: ${METRICS_URL}"
echo ""

# Test if the endpoint is accessible
if curl -s -o /dev/null -w "%{http_code}" "${METRICS_URL}" | grep -q "200"; then
    echo "✓ Metrics endpoint is accessible (HTTP 200)"
else
    echo "✗ Metrics endpoint is not accessible"
    exit 1
fi

echo ""
echo "Sample metrics output:"
echo "======================"
curl -s "${METRICS_URL}" | head -50
echo ""
echo "..."
echo ""

# Check for specific metrics
echo "Checking for required metrics..."

if curl -s "${METRICS_URL}" | grep -q "nodejs_version_info"; then
    echo "✓ Default Node.js metrics present"
else
    echo "✗ Default Node.js metrics missing"
    exit 1
fi

if curl -s "${METRICS_URL}" | grep -q "http_request_duration_seconds"; then
    echo "✓ HTTP request duration metrics present"
else
    echo "✗ HTTP request duration metrics missing"
    exit 1
fi

if curl -s "${METRICS_URL}" | grep -q "http_requests_total"; then
    echo "✓ HTTP request counter metrics present"
else
    echo "✗ HTTP request counter metrics missing"
    exit 1
fi

echo ""
echo "All checks passed! ✓"
