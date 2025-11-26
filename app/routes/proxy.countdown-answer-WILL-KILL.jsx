// proxy.countdown-answer.jsx

import { prisma } from "../db.server";

export async function action({ request }) {
  let body = {};

  // Тепер ми шлемо application/json, тож можна читати як JSON
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = body.email || null;
  const answer = body.answer || null;
  const deviceType = body.device_type || null;

  if (!answer) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.countdownAnswer.create({
    data: {
      shop: null, // можеш потім додати shop, якщо будеш передавати
      email,
      answer,
      deviceType,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
