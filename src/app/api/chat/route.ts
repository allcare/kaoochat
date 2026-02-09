import { NextRequest } from 'next/server';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

interface OpenClawRequest {
  type: 'req';
  id: string;
  method: string;
  params: any;
}

interface OpenClawResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: any;
}

interface OpenClawEvent {
  type: 'event';
  event: string;
  payload: any;
  seq?: number;
}

type OpenClawMessage = OpenClawRequest | OpenClawResponse | OpenClawEvent;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let ws: WebSocket | null = null;
        let isClosed = false;

        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data);
            } catch (e) {
              console.error('Error enqueueing data:', e);
            }
          }
        };

        const safeClose = () => {
          if (!isClosed) {
            isClosed = true;
            try {
              controller.close();
            } catch (e) {
              console.error('Error closing controller:', e);
            }
          }
        };

        try {
          // Connect to OpenClaw Gateway via WebSocket
          const wsUrl = 'wss://oclaw.kaoohi.com';
          const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.ZAI_API_KEY;

          console.log('Connecting to OpenClaw Gateway...');
          ws = new WebSocket(wsUrl);

          let connectNonce: string | null = null;
          let isConnected = false;
          const lastMessage = messages[messages.length - 1];

          // Wait for connection
          await new Promise<void>((resolve, reject) => {
            ws!.on('open', () => {
              console.log('✓ WebSocket opened');
              resolve();
            });
            ws!.on('error', (error) => {
              console.error('✗ WebSocket connection error:', error);
              reject(error);
            });
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
          });

          // Listen for responses
          ws.on('message', (data: WebSocket.Data) => {
            try {
              const message: OpenClawMessage = JSON.parse(data.toString());
              console.log('Received:', message.type, message.event || message.ok);

              // Handle connect challenge
              if (message.type === 'event' && message.event === 'connect.challenge') {
                connectNonce = message.payload.nonce;
                console.log('Received connect challenge, sending connect request...');

                // Send connect request with proper protocol
                const connectRequest: OpenClawRequest = {
                  type: 'req',
                  id: randomUUID(),
                  method: 'connect',
                  params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                      id: 'cli',
                      version: '0.1.0',
                      platform: 'web',
                      mode: 'node',
                    },
                    role: 'operator',
                    auth: {
                      token: gatewayToken,
                    },
                  },
                };
                ws!.send(JSON.stringify(connectRequest));
                return;
              }

              // Handle connect response
              if (message.type === 'res' && !isConnected) {
                if (message.ok) {
                  console.log('✓ Connected to Gateway, sending chat request...');
                  isConnected = true;

                  // Now send the actual chat request
                  const chatRequest: OpenClawRequest = {
                    type: 'req',
                    id: randomUUID(),
                    method: 'agent',
                    params: {
                      agentId: 'main',
                      message: lastMessage.content,
                      sessionKey: 'agent:main:main',
                      idempotencyKey: randomUUID(),
                    },
                  };
                  ws!.send(JSON.stringify(chatRequest));
                } else {
                  console.error('Connect failed:', message.error);
                  safeEnqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ error: message.error?.message || 'Connection failed' })}\n\n`
                    )
                  );
                  ws!.close();
                  safeClose();
                }
                return;
              }

              // Handle chat response
              if (message.type === 'res' && isConnected) {
                if (!message.ok) {
                  console.error('Chat request failed:', message.error);
                  safeEnqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ error: message.error?.message || 'Request failed' })}\n\n`
                    )
                  );
                  ws!.close();
                  safeClose();
                }
                return;
              }

              // Handle streaming events
              if (message.type === 'event' && isConnected) {
                const event = message.event;
                const payload = message.payload;

                // Handle agent events with streaming content
                if (event === 'agent' && payload?.stream === 'assistant') {
                  const content = payload?.data?.delta || '';
                  if (content) {
                    console.log('Content chunk:', content.substring(0, 50));
                    safeEnqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                }

                // Handle lifecycle end event
                if (event === 'agent' && payload?.stream === 'lifecycle' && payload?.data?.phase === 'end') {
                  console.log('✓ Stream completed');
                  safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                  ws!.close();
                  safeClose();
                }
              }
            } catch (e) {
              console.error('Error parsing WebSocket message:', e);
            }
          });

          ws.on('close', (code, reason) => {
            console.log(`WebSocket closed: ${code} ${reason}`);
            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            safeClose();
          });

          ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            if (!isClosed) {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'WebSocket error occurred' })}\n\n`
                )
              );
              safeClose();
            }
          });

          // Set timeout for response
          setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN && !isClosed) {
              console.log('Request timeout');
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Request timeout' })}\n\n`
                )
              );
              ws.close();
              safeClose();
            }
          }, 60000); // 60 second timeout

        } catch (error) {
          console.error('OpenClaw WebSocket error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          if (!isClosed) {
            safeEnqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  error: `OpenClaw connection failed: ${errorMessage}. Trying Z.ai fallback...`
                })}\n\n`
              )
            );

            // Fallback to direct Z.ai connection
            try {
              console.log('Falling back to direct Z.ai connection...');
              const OpenAI = (await import('openai')).default;
              const client = new OpenAI({
                apiKey: process.env.ZAI_API_KEY || '',
                baseURL: 'https://open.bigmodel.cn/api/paas/v4',
              });

              const streamResponse = await client.chat.completions.create({
                model: 'glm-4-plus',
                messages: messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 4096,
              });

              for await (const chunk of streamResponse) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                  safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              }

              safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            } catch (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ error: 'Both OpenClaw and Z.ai connections failed' })}\n\n`
                )
              );
            }
          }

          ws?.close();
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
