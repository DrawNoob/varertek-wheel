// app/routes/proxy.vadertek-timer.jsx

import { getTenantPrisma } from "../tenant-db.server";
import { authenticate } from "../shopify.server";

// Отримуємо shop із параметрів proxy (fallback)
function getShopFromRequest(request) {
  const url = new URL(request.url);
  return url.searchParams.get("shop");
}

// ------------------------------------------------------------
// GET → повертає countdown + wheelSegments для фронта
// ------------------------------------------------------------
export async function loader({ request }) {
  const shop = getShopFromRequest(request);

  let endDate = null;
  let wheelSegments = null;

  if (!shop) {
    console.error("APP PROXY LOADER: no shop param");
  } else {
    try {
      const prisma = await getTenantPrisma(shop);
      const [countdownRecord, wheel] = await Promise.all([
        prisma.countdownSetting.findUnique({ where: { shop } }),
        prisma.wheelSetting.findUnique({ where: { shop } }),
      ]);

      endDate = countdownRecord?.endDate ?? null;

      if (wheel) {
        const rawSegments = [
          wheel.segment1,
          wheel.segment2,
          wheel.segment3,
          wheel.segment4,
          wheel.segment5,
          wheel.segment6,
        ];
        wheelSegments = rawSegments.filter((segment) => segment?.enabled !== false);
      }
    } catch (e) {
      console.error("APP PROXY LOADER DB error", e);
    }
  }

  return new Response(JSON.stringify({ endDate, wheelSegments }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ------------------------------------------------------------
// POST → логіка відповіді + wheelSpin
// ------------------------------------------------------------
export async function action({ request }) {
  // ОФІЦІЙНА АВТЕНТИФІКАЦІЯ ДЛЯ APP PROXY
  let admin, session;

  try {
    const ctx = await authenticate.public.appProxy(request);
    admin = ctx.admin;
    session = ctx.session;
  } catch (err) {
    console.error("authenticate.public.appProxy ERROR:", err);
    return json(
      {
        ok: false,
        message:
          "Не вдалося автентифікувати запит проксі (appProxy). Перевір налаштування app proxy в адмінці.",
      },
      200,
    );
  }

  // shop беремо з session, якщо є; інакше fallback з query
  const shop = session?.shop || getShopFromRequest(request);

  if (!shop) {
    console.error("APP PROXY ACTION: no shop (session or query)");
    return json(
      { ok: false, message: "Не вдалося визначити магазин (shop)." },
      200,
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const intent = body.intent || null;
  const prisma = await getTenantPrisma(shop);
  // -------------------------------------------------------------------
  // 0) Track analytics events (page views, product clicks, add to cart)
  // -------------------------------------------------------------------
  if (intent === "trackEvent") {
    const eventType = String(body.eventType || "");
    const email = body.email?.trim() || "non-logged-in";
    const url = body.url ? String(body.url) : null;
    const productHandle = body.productHandle ? String(body.productHandle) : null;
    const deviceType = body.device_type || null;

    if (!eventType || !url) {
      return json({ ok: false }, 400);
    }

    try {
      await prisma.userEvent.create({
        data: {
          shop,
          email,
          eventType,
          url,
          productHandle,
          deviceType,
          eventData: body.eventData || null,
        },
      });
    } catch (e) {
      console.error("APP PROXY ANALYTICS DB error", e);
    }

    return json({ ok: true });
  }

  // -------------------------------------------------------------------
  // 1️⃣ НОВИЙ INTENT → КОЛЕСО ФОРТУНИ (створення знижки)
  // -------------------------------------------------------------------
  if (intent === "wheelSpin") {
    const email = body.email?.trim() || null;
    const emailRegex =
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}$/i;

    if (!email) {
      return json({ ok: false, message: "Email required." }, 400);
    }
    if (!emailRegex.test(email)) {
      return json(
        { ok: false, message: "Введіть коректний email." },
        400,
      );
    }

    // Перевірка на дубль — уже отримував код
    const existing = await prisma.countdownAnswer.findFirst({
      where: { shop, email, discountCode: { not: null } },
    });

    if (existing) {
      return json({
        ok: false,
        message: "Цей email вже використовував колесо.",
      });
    }

    // РћС‚СЂРёРјСѓС”РјРѕ РЅР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ wheel
    const wheel = await prisma.wheelSetting.findUnique({ where: { shop } });

    if (!wheel) {
      return json({
        ok: false,
        message: "Колесо не налаштовано.",
      });
    }

    const segments = [
      wheel.segment1,
      wheel.segment2,
      wheel.segment3,
      wheel.segment4,
      wheel.segment5,
      wheel.segment6,
    ].filter((segment) => segment?.enabled !== false);

    if (!segments.length) {
      return json({
        ok: false,
        message: "Нема активних секторів для колеса.",
      });
    }

    // Розрахунок рандому по шансам
    const invalidChance = segments.some(
      (segment) => !Number.isFinite(segment.chance) || segment.chance < 0,
    );
    if (invalidChance) {
      return json({
        ok: false,
        message: "Некоректні значення шансів. Має бути число >= 0.",
      });
    }

    const total = segments.reduce((sum, s) => sum + (s.chance || 0), 0);

    if (total === 0) {
      return json({
        ok: false,
        message: "Шанси секторів = 0.",
      });
    }
    if (Math.abs(total - 100) > 0.0001) {
      return json({
        ok: false,
        message: "Сума шансів має дорівнювати 100%.",
      });
    }
    const rnd = Math.random() * total;
    let acc = 0;
    let winIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      acc += segments[i].chance || 0;
      if (rnd < acc) {
        winIndex = i;
        break;
      }
    }

    const chosen = segments[winIndex];

    // Генеруємо унікальний промокод
    const code = (
      "CHERIE-" + Math.random().toString(36).substring(2, 10)
    ).toUpperCase();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // -------------------------------------------------------------------
    // 2️⃣ СТВОРЕННЯ ЗНИЖКИ В SHOPIFY ЧЕРЕЗ admin.graphql
    // -------------------------------------------------------------------
    if (!admin) {
      console.error(
        "No admin client from authenticate.public.appProxy. Is app installed on this shop?",
      );
      return json(
        {
          ok: false,
          message:
            "Помилка: admin API недоступний для цього магазину. Перевір, що аппка встановлена.",
        },
        200,
      );
    }

    try {
      if (chosen.discountType === "FREESHIP") {
        // ----------------------------
        // FREE SHIPPING
        // ----------------------------
        const response = await admin.graphql(
          `#graphql
          mutation discountCodeFreeShippingCreate($discount: DiscountCodeFreeShippingInput!) {
            discountCodeFreeShippingCreate(freeShippingCodeDiscount: $discount) {
              codeDiscountNode { id }
              userErrors { field code message }
            }
          }
        `,
          {
            variables: {
              discount: {
                title: chosen.label || "Wheel - Free Shipping",
                code,
                startsAt: nowIso,
                endsAt: expiresAt,
                customerSelection: { all: true },
                destination: { all: true },
                appliesOncePerCustomer: true,
                usageLimit: 1,
              },
            },
          },
        );

        const jsonResp = await response.json();
        console.log(
          "FreeShip GraphQL resp:",
          JSON.stringify(jsonResp, null, 2),
        );
        const errs =
          jsonResp?.data?.discountCodeFreeShippingCreate?.userErrors;

        if (errs?.length) {
          console.error("FreeShip errors:", errs);
          return json(
            {
              ok: false,
              message: `Помилка створення знижки: ${
                errs[0].message || "unknown error"
              }`,
            },
            200,
          );
        }
      } else {
        // ----------------------------
        // PERCENT or FIXED AMOUNT
        // ----------------------------
        const isPercent = chosen.discountType === "PERCENT";
        const valueNumber = Number(chosen.discountValue || 0);

        const response = await admin.graphql(
          `#graphql
          mutation discountCodeBasicCreate($discount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $discount) {
              codeDiscountNode { id }
              userErrors { field code message }
            }
          }
        `,
          {
            variables: {
              discount: {
                title: chosen.label || "Wheel discount",
                code,
                startsAt: nowIso,
                endsAt: expiresAt,
                customerSelection: { all: true },
                customerGets: {
                  value: isPercent
                    ? { percentage: valueNumber / 100 } // 15% → 0.15
                    : {
                        discountAmount: {
                          amount: String(valueNumber),
                          appliesOnEachItem: false,
                        },
                      },
                  items: { all: true },
                },
                appliesOncePerCustomer: true,
                usageLimit: 1,
              },
            },
          },
        );

        const jsonResp = await response.json();
        console.log(
          "Basic discount GraphQL resp:",
          JSON.stringify(jsonResp, null, 2),
        );
        const errs =
          jsonResp?.data?.discountCodeBasicCreate?.userErrors;

        if (errs?.length) {
          console.error("Discount errors:", errs);
          return json(
            {
              ok: false,
              message: `Помилка створення знижки: ${
                errs[0].message || "unknown error"
              }`,
            },
            200,
          );
        }
      }
    } catch (err) {
      console.error("Shopify discount create ERROR:", err);
      return json(
        {
          ok: false,
          message:
            "Помилка створення знижки (backend): " +
            String(err?.message || err),
        },
        200,
      );
    }

    // -------------------------------------------------------------------
    // 3️⃣ ЗАПИСАТИ В БД (щоб знати що email вже грав)
    // -------------------------------------------------------------------
    await prisma.countdownAnswer.create({
      data: {
        shop,
        email,
        answer: chosen.label,
        discountCode: code,
        deviceType: body.device_type || null,
      },
    });

    // -------------------------------------------------------------------
    // 4️⃣ ВІДПОВІДЬ ДЛЯ ФРОНТА
    // -------------------------------------------------------------------
    return json({
      ok: true,
      result: {
        label: chosen.label,
        code,
        index: winIndex,
      },
    });
  }

  // -------------------------------------------------------------------
  // 2️⃣ СТАРИЙ INTENT → Відповідь Yes/No (Countdown popup)
  // -------------------------------------------------------------------
  const email = body.email || null;
  const answer = body.answer || null;
  const deviceType = body.device_type || null;

  if (!answer) {
    return json({ ok: false }, 400);
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
  }

  return json({ ok: true });
}

// Helper
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}



