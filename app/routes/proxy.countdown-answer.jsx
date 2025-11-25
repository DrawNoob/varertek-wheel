// app/routes/proxy.countdown-answer.jsx
import { prisma } from "../db.server";
import { authenticate } from "../shopify.server";

export async function action({ request }) {
  const { session } = await authenticate.public.appProxy(request);

  const body = await request.json().catch(() => ({}));
  const email = body.email || null;
  const answer = body.answer || null;

  if (!answer) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.countdownAnswer.create({
    data: {
      shop: session?.shop,
      email,
      answer,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
