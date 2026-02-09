#!/bin/bash

# KaooChat Curl Test Script
# Quick test using curl to verify the API endpoint

API_URL="http://localhost:3001/api/chat"
MESSAGE="${1:-Hello! Tell me a short joke}"

echo "🦞 KaooChat API Test (curl)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📤 Sending: \"$MESSAGE\""
echo ""
echo "📥 Response:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -N -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$MESSAGE\"}]}" \
  2>/dev/null | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      data="${line#data: }"
      if [[ $data == "[DONE]" ]]; then
        echo ""
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ Stream completed!"
      else
        # Extract content from JSON
        content=$(echo "$data" | grep -o '"content":"[^"]*"' | sed 's/"content":"//;s/"$//')
        if [ -n "$content" ]; then
          printf "%b" "$content"
        fi
      fi
    fi
  done

echo ""
