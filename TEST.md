# KaooChat Testing Guide 🦞

This guide contains several test scripts to verify that KaooChat is working correctly with your OpenClaw Gateway.

## Prerequisites

Make sure the development server is running:
```bash
npm run dev
```

The server should be available at http://localhost:3001

## Test Scripts

### 1. Quick API Test (Node.js)

Tests the KaooChat API endpoint with streaming support.

```bash
# Run with default message
node test-chat.js

# Run with custom message
node test-chat.js "What is the capital of France?"
```

**What it tests:**
- ✅ API endpoint availability
- ✅ JSON request/response handling
- ✅ Server-Sent Events streaming
- ✅ Error handling

---

### 2. Curl Test (Bash)

Quick test using curl - useful for debugging.

```bash
# Run with default message
./test-chat.sh

# Run with custom message
./test-chat.sh "Tell me about OpenClaw"
```

**What it tests:**
- ✅ HTTP POST to /api/chat
- ✅ Streaming response parsing
- ✅ Basic connectivity

---

### 3. Direct OpenClaw Gateway Test (Node.js)

Tests direct WebSocket connection to OpenClaw Gateway - bypasses the Next.js API.

```bash
# Run with default message
node test-openclaw-connection.js

# Run with custom message
node test-openclaw-connection.js "Hello from test script!"
```

**What it tests:**
- ✅ WebSocket connection to wss://oclaw.kaoohi.com
- ✅ OpenClaw handshake protocol (connect.challenge)
- ✅ Authentication with gateway token
- ✅ agent.chat method
- ✅ Streaming response events

---

## Expected Output

### Successful Test Output

```
🦞 KaooChat API Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 Sending: "Hello! Tell me a short joke"

📥 Response:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Why don't scientists trust atoms?

Because they make up everything!


✅ Stream completed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Total characters: 67
✅ Test successful!
```

---

## Troubleshooting

### Error: Connection Refused

```
❌ Test failed: fetch failed
```

**Solution:** Make sure the dev server is running:
```bash
npm run dev
```

---

### Error: WebSocket Connection Failed

```
❌ WebSocket error: connect ECONNREFUSED
```

**Possible causes:**
1. OpenClaw Gateway is not running
2. Network connectivity issues
3. Wrong Gateway URL

**Check:**
```bash
# Test Gateway connectivity
curl -I https://oclaw.kaoohi.com

# Check if Gateway WebSocket is accessible
wscat -c wss://oclaw.kaoohi.com
```

---

### Error: Invalid Handshake

```
❌ Error: invalid handshake: first request must be connect
```

**Status:** This error means the WebSocket connected but the protocol is wrong. The fix is already implemented in the latest code.

---

### Error: Authentication Failed

```
❌ Connect failed: { code: 'UNAUTHORIZED', message: '...' }
```

**Solution:** Check your gateway token in `.env.local`:
```bash
cat .env.local | grep OPENCLAW_GATEWAY_TOKEN
```

Make sure it matches the token from `/Users/arnau1/sources/kaobot/.env`

---

## Server Logs

To monitor the server logs while testing:

```bash
# In a separate terminal
tail -f /tmp/claude-*/kaoochat/tasks/*.output

# Or check recent logs
npm run dev | grep -E "(Connecting|Connected|Received|Error)"
```

**Look for:**
- ✅ "✓ WebSocket opened"
- ✅ "Received connect challenge"
- ✅ "✓ Connected to Gateway"
- ✅ "Content chunk: ..."
- ✅ "✓ Stream completed"

---

## Integration Test Flow

Full test sequence to verify everything works:

```bash
# 1. Test direct OpenClaw connection
node test-openclaw-connection.js

# 2. Test KaooChat API endpoint
node test-chat.js

# 3. Test via browser
# Open http://localhost:3001 and send a message
```

---

## What Each Test Validates

| Test | WebSocket | Handshake | Streaming | API | Browser |
|------|-----------|-----------|-----------|-----|---------|
| test-openclaw-connection.js | ✅ | ✅ | ✅ | ❌ | ❌ |
| test-chat.js | ✅ | ✅ | ✅ | ✅ | ❌ |
| test-chat.sh | ✅ | ✅ | ✅ | ✅ | ❌ |
| Browser test | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Success Criteria

All tests should show:
1. ✅ WebSocket connection established
2. ✅ Handshake completed (connect.challenge → connect → OK)
3. ✅ Chat request sent (agent.chat)
4. ✅ Response received and streamed
5. ✅ Stream completion signal

If any test fails, check the troubleshooting section above.
