import { Router } from "express";
import { buildSystemPrompt } from "../lib/knowledge.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GROQ_API_KEY is not set in server/.env" });
    return;
  }

  const messages = parseMessages(req.body?.messages);
  if (!messages) {
    res.status(400).json({ error: "Invalid messages" });
    return;
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  // Stop the Groq request if the user closes the page or presses stop.
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  try {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.2,
        max_completion_tokens: 2048,
        // gpt-oss models reason before answering; keep it short for chat speed.
        ...(model.startsWith("openai/gpt-oss") && { reasoning_effort: "low" }),
        messages: [
          { role: "system", content: await buildSystemPrompt() },
          ...messages,
        ],
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      console.error("Groq request failed", upstream.status, await upstream.text());
      if (upstream.status === 429) {
        res.status(429).json({
          error: "The assistant is busy right now. Please try again in a minute.",
        });
      } else {
        res.status(502).json({ error: "The assistant is unavailable right now" });
      }
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    const text = upstream.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(sseToText());
    for await (const delta of text) res.write(delta);
    res.end();
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Chat stream failed", error);
    if (res.headersSent) res.end();
    else res.status(502).json({ error: "The assistant is unavailable right now" });
  }
});

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
