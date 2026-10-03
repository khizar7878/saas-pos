#!/bin/bash
# ==============================================================================
# FBR Local Gateway — Desktop One-Click Launcher (macOS)
# Starts the lightweight domestic Pakistan IP proxy for FBR Tier-1 IMS on port 5060
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Robust project directory resolution for Desktop launcher
if [ -f "$SCRIPT_DIR/../scripts/local-fbr-proxy.mjs" ]; then
  PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
elif [ -f "$HOME/Documents/React/ak-retail-pos/scripts/local-fbr-proxy.mjs" ]; then
  PROJECT_DIR="$HOME/Documents/React/ak-retail-pos"
else
  PROJECT_DIR="/Users/khizar/Documents/React/ak-retail-pos"
fi

PORT=5060

# 1. Check if already running on port 5060
PID=$(lsof -ti tcp:$PORT 2>/dev/null)
if [ -n "$PID" ]; then
  HEALTH=$(curl -s -m 2 http://127.0.0.1:$PORT/api/health 2>/dev/null)
  if [[ "$HEALTH" == *"fbr-local-proxy"* ]]; then
    osascript -e 'display notification "FBR Local Gateway is ALREADY running on port 5060." with title "FBR Gateway Active" sound name "Glass"'
    echo "FBR Local Gateway is already active on port $PORT (PID $PID)."
    sleep 2
    exit 0
  fi
fi

# 2. Launch background process detached from terminal session
cd "$PROJECT_DIR"
nohup node scripts/local-fbr-proxy.mjs </dev/null > /tmp/fbr-local-proxy.log 2>&1 &
NEW_PID=$!
disown -h $NEW_PID 2>/dev/null

sleep 1

# 3. Verify health
HEALTH=$(curl -s -m 3 http://127.0.0.1:$PORT/api/health 2>/dev/null)
if [[ "$HEALTH" == *"fbr-local-proxy"* ]]; then
  osascript -e 'display notification "FBR Local Gateway is ONLINE (Domestic Pakistan IP) on port 5060." with title "FBR Gateway Online" sound name "Glass"'
  echo "======================================================="
  echo "  FBR Local Gateway started successfully (PID $NEW_PID)"
  echo "  Port: $PORT"
  echo "  Origin IP: Domestic Pakistan IP"
  echo "======================================================="
else
  osascript -e 'display alert "FBR Gateway Error" message "Could not verify local gateway on port 5060. Check /tmp/fbr-local-proxy.log"'
  echo "Error starting local proxy. Check /tmp/fbr-local-proxy.log"
fi

sleep 2
exit 0
