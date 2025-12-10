// app/routes/proxy.vadertek-timer.jsx

import { prisma } from "../db.server";
import { unauthenticated } from "../shopify.server";

// Отримуємо shop із параметрів proxy
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
      const [countdownRecord, wheel] = await Promise.all([
        prisma.countdownSetting.findUnique({ where: { shop } }),
        prisma.wheelSetting.findUnique({ where: { shop } }),
      ]);

      endDate = countdownRecord?.endDate ?? null;

      if (wheel) {
        wheelSegments = [
          wheel.segment1,
          wheel.segment2,
          wheel.segment3,
          wheel.segment4,
          wheel.segment5,
          wheel.segment6,
        ];
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
  const shop = getShopFromRequest(request);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const intent = body.intent || null;

  // -------------------------------------------------------------------
  // 1️⃣ НОВИЙ INTENT → КОЛЕСО ФОРТУНИ (створення знижки)
  // -------------------------------------------------------------------
  if (intent === "wheelSpin") {
    const email = body.email?.trim() || null;

    if (!email || !shop) {
      return json({ ok: false, message: "Email required." }, 400);
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

    // Отримуємо налаштування wheel
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
    ];

    // Розрахунок рандому по шансам
    const total = segments.reduce((sum, s) => sum + (s.chance || 0), 0);

    if (total === 0) {
      return json({
        ok: false,
        message: "Шанси секторів = 0.",
      });
    }

    const rnd = Math.random() * total;
    let acc = 0;
    let winIndex = 0;

    for (let i = 0; i < segments.length; i++) {
      acc += segments[i].chance || 0;
      if (rnd <= acc) {
        winIndex = i;
        break;
      }
    }

    const chosen = segments[winIndex];

    // Генеруємо унікальний промокод
    const code = ("WHEEL-" + Math.random().toString(36).substring(2, 10)).toUpperCase();
    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------------
    // 2️⃣ СТВОРЕННЯ ЗНИЖКИ В SHOPIFY
    try {
      // Беремо offline-сесію по домену магазину
      const { admin } = await unauthenticated.admin(shop);


      // ----------------------------
      // FREE SHIPPING
      // ----------------------------
      if (chosen.discountType === "FREESHIP") {
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
                title: chosen.label || "Wheel – Free Shipping",
                code,
                startsAt: nowIso,
                customerSelection: { all: true },
                destination: { all: true },
                appliesOncePerCustomer: false,
              },
            },
          }
        );

        const jsonResp = await response.json();
        console.log("FreeShip GraphQL resp:", JSON.stringify(jsonResp));
        const errs = jsonResp?.data?.discountCodeFreeShippingCreate?.userErrors;

        if (errs?.length) {
          console.error("FreeShip errors:", errs);
          return json(
            {
              ok: false,
              message: `Помилка створення знижки: ${errs[0].message || "unknown error"}`,
            },
            200
          );
        }
      }

      // ----------------------------
      // PERCENT or FIXED AMOUNT
      // ----------------------------
      else {
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
                customerSelection: { all: true },
                customerGets: {
                  value: isPercent
                    ? { percentage: valueNumber / 100 } // Shopify хоче 0.15, а не 15
                    : {
                        discountAmount: {
                          amount: String(valueNumber),
                          appliesOnEachItem: false,
                        },
                      },
                  items: { all: true },
                },
                appliesOncePerCustomer: false,
              },
            },
          }
        );

        const jsonResp = await response.json();
        console.log("Basic discount GraphQL resp:", JSON.stringify(jsonResp));
        const errs = jsonResp?.data?.discountCodeBasicCreate?.userErrors;

        if (errs?.length) {
          console.error("Discount errors:", errs);
          return json(
            {
              ok: false,
              message: `Помилка створення знижки: ${errs[0].message || "unknown error"}`,
            },
            200
          );
        }
      }
    } catch (err) {
      console.error("Shopify discount create ERROR:", err);

      // Спробуємо витягнути хоч якийсь текст
      let msg = "Невідома помилка при створенні знижки.";
      if (err && typeof err === "object") {
        if (err.message) msg = err.message;
        else msg = String(err);
      } else if (err) {
        msg = String(err);
      }

      return json(
        {
          ok: false,
          message: `Помилка створення знижки (backend): ${msg}`,
        },
        200
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

  if (!answer || !shop) {
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
