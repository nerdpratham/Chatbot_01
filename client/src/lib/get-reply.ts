import { API_URL } from "./api";

export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
};

// Streams the assistant's reply from the chat API as text chunks.
export async function* getReply(
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    if (value) yield value;
  }
}
