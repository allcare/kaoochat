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

export async function GET(req: NextRequest) {
  try {
    const wsUrl = 'wss://oclaw.kaoohi.com';
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.ZAI_API_KEY;

    console.log('Fetching chat history from OpenClaw...');

    return new Promise<Response>((resolve) => {
      const ws = new WebSocket(wsUrl);
      let isConnected = false;
      let historyRequestId = '';

      const timeout = setTimeout(() => {
        ws.close();
        resolve(new Response(
          JSON.stringify({ messages: [] }),
          { headers: { 'Content-Type': 'application/json' } }
        ));
      }, 10000);

      ws.on('open', () => {
        console.log('WebSocket opened for history fetch');
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: OpenClawMessage = JSON.parse(data.toString());

          // Handle connect challenge
          if (message.type === 'event' && message.event === 'connect.challenge') {
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
            ws.send(JSON.stringify(connectRequest));
            return;
          }

          // Handle connect response
          if (message.type === 'res' && !isConnected) {
            if (message.ok) {
              console.log('Connected to Gateway, fetching history...');
              isConnected = true;

              // Request chat history
              historyRequestId = randomUUID();
              const historyRequest: OpenClawRequest = {
                type: 'req',
                id: historyRequestId,
                method: 'chat.history',
                params: {
                  sessionKey: 'agent:main:main',
                  limit: 100, // Fetch last 100 messages
                },
              };
              ws.send(JSON.stringify(historyRequest));
            } else {
              console.error('Connect failed:', message.error);
              clearTimeout(timeout);
              ws.close();
              resolve(new Response(
                JSON.stringify({ messages: [] }),
                { headers: { 'Content-Type': 'application/json' } }
              ));
            }
            return;
          }

          // Handle history response
          if (message.type === 'res' && message.id === historyRequestId) {
            clearTimeout(timeout);
            if (message.ok && message.payload) {
              console.log('Chat history received:', message.payload.messages?.length || 0, 'messages');
              ws.close();
              resolve(new Response(
                JSON.stringify({
                  messages: message.payload.messages || [],
                  sessionKey: message.payload.sessionKey,
                }),
                { headers: { 'Content-Type': 'application/json' } }
              ));
            } else {
              console.error('History fetch failed:', message.error);
              ws.close();
              resolve(new Response(
                JSON.stringify({ messages: [] }),
                { headers: { 'Content-Type': 'application/json' } }
              ));
            }
            return;
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        ws.close();
        resolve(new Response(
          JSON.stringify({ messages: [] }),
          { headers: { 'Content-Type': 'application/json' } }
        ));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
      });
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    return new Response(
      JSON.stringify({ messages: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
