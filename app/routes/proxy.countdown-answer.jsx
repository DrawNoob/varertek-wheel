// app/routes/proxy.countdown-answer.jsx
import { prisma } from "../db.server";

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    // Можеш поставити конкретний домен замість *,
    // наприклад "https://cherie-dev-store.myshopify.com"
    "Access-Control-Allow-Origin": "*",
  };
}

export async function action({ request }) {
  // Ми шлемо text/plain, тому читаємо сирий текст
  const text = await request.text();
  let body = {};

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  const email = body.email || null;
  const answer = body.answer || null;

  if (!answer) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  await prisma.countdownAnswer.create({
    data: {
      shop: null, // можна зберігати shop, якщо будеш його передавати з фронта
      email,
      answer,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders(),
  });
}
