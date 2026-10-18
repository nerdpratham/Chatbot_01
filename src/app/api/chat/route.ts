import { buildSystemPrompt } from "@/lib/knowledge";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "GROQ_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body?.messages);
  if (!messages) {
    return Response.json({ error: "Invalid messages" }, { status: 400 });
  }

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      stream: true,
      temperature: 0.2,
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: await buildSystemPrompt() },
        ...messages,
      ],
    }),
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    console.error("Groq request failed", upstream.status, await upstream.text());
    return Response.json(
      { error: "The assistant is unavailable right now" },
      { status: 502 },
    );
  }

  const text = upstream.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(sseToText())
    .pipeThrough(new TextEncoderStream());

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Keeps the most recent turns and drops anything malformed.
function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const messages = value.slice(-MAX_MESSAGES).flatMap((m): ChatMessage[] => {
    if (
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim()
    ) {
      return [{ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }];
    }
    return [];
  });

  return messages.at(-1)?.role === "user" ? messages : null;
}

// Turns Groq's OpenAI-style server-sent events into plain text deltas.
function sseToText() {
  let buffer = "";

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(delta);
        } catch {
          // Ignore keep-alive or malformed lines.
        }
      }
    },
  });
}
