export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
};

// Placeholder until a model is wired up: streams a canned reply word by word.
// Replace the body with a fetch to an API route that streams from the model.
export async function* getReply(
  messages: Message[],
  signal: AbortSignal,
): AsyncGenerator<string> {
  const last = messages[messages.length - 1]?.content ?? "";
  const reply = `This is a placeholder reply. No model is connected yet, but the interface is working. You said: "${last}"`;

  await wait(600, signal);
  for (const word of reply.split(/(\s+)/)) {
    await wait(30, signal);
    yield word;
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
