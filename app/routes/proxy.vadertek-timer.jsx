// app/routes/proxy.vadertek-timer.jsx

import { prisma } from "../db.server";

// Shopify app proxy завжди додає ?shop=... до URL
function getShopFromRequest(request) {
  const url = new URL(request.url);
  return url.searchParams.get("shop");
}

// GET /proxy/vadertek-timer  → для таймера (дати)
export async function loader({ request }) {
  const shop = getShopFromRequest(request);

  let endDate = null;

  if (!shop) {
    console.error("APP PROXY LOADER: no shop param");
  } else {
    try {
      const record = await prisma.countdownSetting.findUnique({
        where: { shop },
      });

      console.log("APP PROXY LOADER: shop =", shop, "record =", record);

      endDate = record?.endDate ?? null;
    } catch (e) {
      console.error("APP PROXY LOADER DB error", e);
    }
  }

  return new Response(JSON.stringify({ endDate }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /proxy/vadertek-timer  → відповіді ТАК/НІ
export async function action({ request }) {
  const shop = getShopFromRequest(request);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = body.email || null;
  const answer = body.answer || null;
  const deviceType = body.device_type || null;

  if (!answer || !shop) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await prisma.countdownAnswer.create({
      data: {
        shop,
        email,
        answer,
        deviceType,
      },
    });
  } catch (e) {
    console.error("APP PROXY ACTION DB error", e);
    // все одно вертаємо 200, щоб не сипати юзеру помилок
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
