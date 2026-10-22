import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_URL } from "../lib/api";
import { parseReply, type Contact } from "../lib/contact";
import { getReply, type Message } from "../lib/get-reply";

const SUGGESTIONS = [
  "What does SixDX do?",
  "What is the Reality Twin?",
  "Tell me about the RAYX case study",
  "How much would a digital twin of my plant cost?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [status, setStatus] = useState<"idle" | "waiting" | "streaming">(
    "idle",
  );
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = status !== "idle";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setStatus("waiting");

    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = crypto.randomUUID();

    try {
      let started = false;
      for await (const chunk of getReply(history, controller.signal)) {
        if (!started) {
          started = true;
          setStatus("streaming");
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: chunk },
          ]);
          continue;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Sorry, something went wrong. ${
              error instanceof Error ? error.message : "Please try again."
            }`,
          },
        ]);
        console.error(error);
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
      textareaRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    stop();
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <BotAvatar />
          <h1 className="text-base font-semibold">SixDX Assistant</h1>
        </div>
        <button
          type="button"
          onClick={newChat}
          disabled={messages.length === 0}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          New chat
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                message={m}
                question={
                  messages.slice(0, i).findLast((p) => p.role === "user")
                    ?.content ?? ""
                }
                contact={contact}
                onContactSaved={setContact}
              />
            ))
          )}
          {status === "waiting" && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 shadow-sm focus-within:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-500"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about SixDX…"
            rows={1}
            autoFocus
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] leading-6 outline-none placeholder:text-zinc-400"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop generating"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <span className="size-3 rounded-sm bg-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Enter to send · Shift + Enter for a new line
        </p>
      </footer>
    </div>
  );
}

function MessageBubble({
  message,
  question,
  contact,
  onContactSaved,
}: {
  message: Message;
  question: string;
  contact: Contact | null;
  onContactSaved: (contact: Contact) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-[15px] leading-6 text-white dark:bg-zinc-100 dark:text-zinc-900">
          {message.content}
        </div>
      </div>
    );
  }

  const { text, wantsContact } = parseReply(message.content);

  return (
    <div className="flex gap-3">
      <BotAvatar />
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        {text && (
          <div className="whitespace-pre-wrap text-[15px] leading-6">
            {renderBold(text)}
          </div>
        )}
        {wantsContact && (
          <ContactForm
            question={question}
            saved={contact}
            onSaved={onContactSaved}
          />
        )}
      </div>
    </div>
  );
}

// The model sometimes uses **bold** markdown; show it as bold instead of asterisks.
function renderBold(text: string) {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold">
          {part}
        </strong>
      ) : (
        part
      ),
    );
}

function ContactForm({
  question,
  saved,
  onSaved,
}: {
  question: string;
  saved: Contact | null;
  onSaved: (contact: Contact) => void;
}) {
  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved?.phone ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, question }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Couldn't send your details.");
      onSaved({ name: name.trim(), phone: phone.trim() });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your details.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Thanks, {name.trim()}. Someone from our team will contact you at{" "}
        {phone.trim()} soon.
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-400";

  return (
    <form
      onSubmit={submit}
      className="flex max-w-md flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Leave your name and phone number and our team will get back to you.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        maxLength={100}
        required
        className={inputClass}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone number"
        type="tel"
        autoComplete="tel"
        maxLength={25}
        required
        className={inputClass}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {state === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3" aria-label="Assistant is typing">
      <BotAvatar />
      <div className="flex items-center gap-1 pt-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-bounce rounded-full bg-zinc-400"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-8 pt-[15vh] text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <BotIcon className="size-6" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          How can I help you today?
        </h2>
      </div>
      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-zinc-200 px-4 py-3 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
      <BotIcon className="size-4" />
    </div>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13v1M15 13v1" />
    </svg>
  );
}
