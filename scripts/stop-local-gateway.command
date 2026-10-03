#!/bin/bash
# ==============================================================================
# FBR Local Gateway — Desktop One-Click Terminator (macOS)
# Cleanly terminates the background proxy on port 5060
# ==============================================================================

PORT=5060
PID=$(lsof -ti tcp:$PORT 2>/dev/null)

if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null
  osascript -e 'display notification "FBR Local Gateway has been stopped." with title "FBR Gateway Stopped" sound name "Basso"'
  echo "FBR Local Gateway (PID $PID) stopped."
else
  osascript -e 'display notification "FBR Local Gateway was not running." with title "FBR Gateway" sound name "Tink"'
  echo "No process was running on port $PORT."
fi

sleep 1
exit 0
