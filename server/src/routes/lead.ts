import { Router } from "express";
import { saveLead } from "../lib/leads.js";

export const leadRouter = Router();

leadRouter.post("/", async (req, res) => {
  const body = req.body;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";

  if (!name || name.length > 100) {
    res.status(400).json({ error: "Please enter your name." });
    return;
  }
  if (!isValidPhone(phone)) {
    res.status(400).json({ error: "Please enter a valid phone number." });
    return;
  }

  try {
    await saveLead({ name, phone, question, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to save lead", error);
    res
      .status(500)
      .json({ error: "Couldn't save your details. Please try again." });
    return;
  }

  res.json({ ok: true });
});

function isValidPhone(phone: string) {
  if (!/^\+?[\d\s\-().]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}
