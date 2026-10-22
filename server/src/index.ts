import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { chatRouter } from "./routes/chat.js";
import { leadRouter } from "./routes/lead.js";

// Load server/.env if present; real environment variables take precedence.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

const PORT = Number(process.env.PORT) || 4000;

const app = express();

// In development the Vite proxy makes requests same-origin, so CORS is only
// needed when the frontend is hosted on another domain (CLIENT_ORIGIN).
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",").map((o) => o.trim()) ?? false,
  }),
);
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/chat", chatRouter);
app.use("/api/lead", leadRouter);

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  const status = error.status ?? error.statusCode ?? 500;
  res.status(status).json({
    error: status < 500 ? "Invalid request" : "Something went wrong",
  });
};
app.use(handleError);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
