import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type Lead = {
  name: string;
  phone: string;
  question: string;
  createdAt: string;
};

// server/data, whether running from src/ (dev) or dist/ (build).
const LEADS_DIR = path.resolve(import.meta.dirname, "../../data");
const LEADS_FILE = path.join(LEADS_DIR, "leads.jsonl");

export async function saveLead(lead: Lead) {
  await mkdir(LEADS_DIR, { recursive: true });
  await appendFile(LEADS_FILE, JSON.stringify(lead) + "\n", "utf8");
  await notifyLead(lead);
}

// Email delivery goes here once the destination account is decided.
async function notifyLead(lead: Lead) {
  console.log(`New lead saved from ${lead.name}`);
}
