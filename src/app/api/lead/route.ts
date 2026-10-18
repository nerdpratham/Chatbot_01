import { saveLead } from "@/lib/leads";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const question =
    typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";

  if (!name || name.length > 100) {
    return Response.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return Response.json(
      { error: "Please enter a valid phone number." },
      { status: 400 },
    );
  }

  try {
    await saveLead({ name, phone, question, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error("Failed to save lead", error);
    return Response.json(
      { error: "Couldn't save your details. Please try again." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}

function isValidPhone(phone: string) {
  if (!/^\+?[\d\s\-().]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}
