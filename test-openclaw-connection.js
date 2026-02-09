#!/usr/bin/env node

/**
 * OpenClaw WebSocket Connection Test
 * Tests direct WebSocket connection to OpenClaw Gateway
 */

const WebSocket = require('ws');
const { randomUUID } = require('crypto');

const GATEWAY_URL = 'wss://oclaw.kaoohi.com';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'I5dDki9JWDv5k4FaFhEzqRIzAYvJpOXfnQUydBFdI';
const TEST_MESSAGE = process.argv[2] || 'Hello! Tell me a short joke';

console.log('\n🦞 OpenClaw Gateway Connection Test');
console.log('━'.repeat(50));
console.log(`🔗 Connecting to: ${GATEWAY_URL}`);
console.log(`📤 Test message: "${TEST_MESSAGE}"\n`);

const ws = new WebSocket(GATEWAY_URL);
let isConnected = false;

ws.on('open', () => {
  console.log('✓ WebSocket opened');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`\n📨 Received [${message.type}]:`, JSON.stringify(message, null, 2));

    // Handle connect challenge
    if (message.type === 'event' && message.event === 'connect.challenge') {
      const connectNonce = message.payload.nonce;
      console.log('\n🔐 Sending connect request with nonce...');

      const connectRequest = {
        type: 'req',
        id: randomUUID(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'cli',
            version: '0.1.0',
            platform: 'node',
            mode: 'node',
          },
          role: 'operator',
          auth: {
            token: GATEWAY_TOKEN,
          },
        },
      };
      ws.send(JSON.stringify(connectRequest));
      return;
    }

    // Handle connect response
    if (message.type === 'res' && !isConnected) {
      if (message.ok) {
        console.log('\n✅ Connected to Gateway!');
        console.log('\n💬 Sending chat request...');
        isConnected = true;

        const chatRequest = {
          type: 'req',
          id: randomUUID(),
          method: 'agent',
          params: {
            agentId: 'main',
            message: TEST_MESSAGE,
            sessionKey: 'agent:main:main',
            idempotencyKey: randomUUID(),
          },
        };
        ws.send(JSON.stringify(chatRequest));
      } else {
        console.error('\n❌ Connect failed:', message.error);
        ws.close();
        process.exit(1);
      }
      return;
    }

    // Handle streaming events
    if (message.type === 'event' && isConnected) {
      // Handle agent events with streaming content
      if (message.event === 'agent' && message.payload?.stream === 'assistant') {
        const content = message.payload?.data?.delta || '';
        if (content) {
          process.stdout.write(content);
        }
      }

      // Handle lifecycle end event
      if (message.event === 'agent' && message.payload?.stream === 'lifecycle' && message.payload?.data?.phase === 'end') {
        console.log('\n\n✅ Stream completed!');
        ws.close();
        process.exit(0);
      }
    }
  } catch (e) {
    console.error('Error parsing message:', e);
  }
});

ws.on('close', (code, reason) => {
  console.log(`\n🔌 WebSocket closed: ${code} ${reason || '(no reason)'}`);
});

ws.on('error', (error) => {
  console.error('\n❌ WebSocket error:', error.message);
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout - closing connection');
  ws.close();
  process.exit(1);
}, 30000);
