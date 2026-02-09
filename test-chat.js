#!/usr/bin/env node

/**
 * KaooChat API Test Script
 * Tests the chat API endpoint with streaming support
 */

const API_URL = 'http://localhost:3001/api/chat';

async function testChat(message) {
  console.log('\n🦞 KaooChat API Test');
  console.log('━'.repeat(50));
  console.log(`📤 Sending: "${message}"\n`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('📥 Response:');
    console.log('━'.repeat(50));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('\n\n✅ Stream completed!');
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              process.stdout.write(parsed.content);
              fullResponse += parsed.content;
            } else if (parsed.error) {
              console.error('\n\n❌ Error:', parsed.error);
              return;
            }
          } catch (e) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }

    console.log('\n━'.repeat(50));
    console.log(`\n📊 Total characters: ${fullResponse.length}`);
    console.log('✅ Test successful!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure the dev server is running on http://localhost:3001\n');
    process.exit(1);
  }
}

// Get message from command line or use default
const testMessage = process.argv[2] || 'Hello! Can you tell me a short joke?';

testChat(testMessage);
