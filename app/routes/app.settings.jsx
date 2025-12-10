// app/routes/app.settings.jsx
import {
  Form,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

// ----------------------
//        LOADER
// ----------------------
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let countdownEnd = null;
  let wheelSetting = null;

  try {
    const [countdownRecord, wheel] = await Promise.all([
      prisma.countdownSetting.findUnique({
        where: { shop },
      }),
      prisma.wheelSetting.findUnique({
        where: { shop },
      }),
    ]);

    countdownEnd = countdownRecord?.endDate
      ? countdownRecord.endDate.toISOString()
      : null;

    wheelSetting = wheel || null;
  } catch (e) {
    console.error("Failed to load settings from DB", e);
  }

  return { countdownEnd, wheelSetting };
}


// ----------------------
//        ACTION
// ----------------------
// ----------------------
//        ACTION
// ----------------------
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  // ─────────────────────────────
  // 1) ЗБЕРЕГТИ НАЛАШТУВАННЯ КОЛЕСА
  // ─────────────────────────────
  if (intent === "saveWheel") {
    const buildSegment = (i) => ({
      label: formData.get(`s${i}_label`) || "",
      chance: Number(formData.get(`s${i}_chance`) || 0),
      discountType: formData.get(`s${i}_dtype`) || "PERCENT",
      discountValue: Number(formData.get(`s${i}_dvalue`) || 0),
    });

    const payload = {
      segment1: buildSegment(1),
      segment2: buildSegment(2),
      segment3: buildSegment(3),
      segment4: buildSegment(4),
      segment5: buildSegment(5),
      segment6: buildSegment(6),
    };

    try {
      await prisma.wheelSetting.upsert({
        where: { shop },
        update: payload,
        create: { shop, ...payload },
      });

      return { okWheel: true };
    } catch (e) {
      console.error("Failed to save wheel settings to DB", e);
      return {
        okWheel: false,
        messageWheel: "Сталася помилка при збереженні налаштувань колеса.",
      };
    }
  }

  // ─────────────────────────────
  // 2) ЗБЕРЕГТИ ДАТУ ТАЙМЕРА (СТАРА ЛОГІКА)
  // ─────────────────────────────
  const raw = formData.get("countdownEnd");

  if (!raw) {
    return {
      ok: false,
      message: "Оберіть дату та час перед збереженням.",
    };
  }

  try {
    const isoValue = new Date(raw).toISOString();

    await prisma.countdownSetting.upsert({
      where: { shop },
      update: { endDate: isoValue },
      create: { shop, endDate: isoValue },
    });

    return { ok: true };
  } catch (e) {
    console.error("Failed to save countdown setting to DB", e);
    return {
      ok: false,
      message: "Сталася помилка при записі в базу даних.",
    };
  }
}


// ----------------------
//       COMPONENT
// ----------------------
export default function SettingsPage() {
  const { countdownEnd, wheelSetting } = useLoaderData();
  const actionData = useActionData();


  let defaultValue = "";
  if (countdownEnd) {
    try {
      const d = new Date(countdownEnd);
      const pad = (n) => String(n).padStart(2, "0");

      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const minutes = pad(d.getMinutes());

      defaultValue = `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      defaultValue = "";
    }
  }

  return (
    <s-page heading="Налаштування таймера">
      {/* БЛОК 1 — ТАЙМЕР */}
      <s-section>
        <s-card-section>
          <Form method="post">
            <s-vertical-stack gap="400">
              {/* Тайтл секції */}
              <h1>
                Таймер
              </h1>

              {/* Заголовок + опис */}
              <s-vertical-stack gap="100">
                <s-text as="h2" variant="headingMd">
                  Дата завершення таймера
                </s-text>
                <s-text as="p" variant="bodySm">
                  Обери дату та час, до яких таймер буде рахувати. Якщо не
                  вказати — на вітрині буде стандартний відлік до нового року.
                </s-text>
              </s-vertical-stack>

              {/* Інпут дати */}
              <div>
                <s-text as="span" variant="bodyMd">
                  Дата та час
                </s-text>
                <div style={{ marginTop: 8, maxWidth: 260 }}>
                  <input
                    type="datetime-local"
                    name="countdownEnd"
                    defaultValue={defaultValue}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d0d0d0",
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              {/* Поточне значення */}
              {countdownEnd && (
                <s-text as="p" variant="bodySm" tone="subdued">
                  Поточне значення: {new Date(countdownEnd).toLocaleString()}
                </s-text>
              )}

              {/* Кнопка + повідомлення справа */}
              <div
                style={{
                  marginTop: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <button
                  type="submit"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: "#008060",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  Зберегти
                </button>

                {/* Повідомлення справа */}
                {actionData?.ok && (
                  <s-text as="span" variant="bodySm" tone="success">
                    Збережено ✅
                  </s-text>
                )}
                {actionData?.ok === false && (
                  <s-text as="span" variant="bodySm" tone="critical">
                    {actionData.message}
                  </s-text>
                )}
              </div>
            </s-vertical-stack>
          </Form>
        </s-card-section>
      </s-section>

      {/* БЛОК 2 — КОЛЕСО ФОРТУНИ */}
      <s-section>
        <s-card-section>
          <div style={{ marginBottom: "16px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>
              Колесо фортуни
            </h1>
            <p style={{ fontSize: "14px", color: "#6B7280" }}>
              Налаштування секторів: назва виграшу, шанс випадіння та знижка.
            </p>
          </div>

          <Form method="post">
            <input type="hidden" name="intent" value="saveWheel" />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => {
                const segKey = `segment${i}`;
                const seg = wheelSetting?.[segKey] || {};

                return (
                  <div
                    key={i}
                    style={{
                      background: "#F9FAFB",
                      border: "1px solid #E5E7EB",
                      borderRadius: "12px",
                      padding: "14px",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      Сектор {i}
                    </h3>

                    <p
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                        marginBottom: "10px",
                      }}
                    >
                      Параметри виграшу для сектору {i}.
                    </p>

                    {/* Назва */}
                    <label style={{ fontSize: 12 }}>Назва (label)</label>
                    <input
                      type="text"
                      name={`s${i}_label`}
                      defaultValue={seg.label || ""}
                      style={{
                        width: "93%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        marginTop: 2,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    />

                    {/* Шанс */}
                    <label style={{ fontSize: 12 }}>Шанс випадіння (%)</label>
                    <input
                      type="number"
                      name={`s${i}_chance`}
                      min="0"
                      max="100"
                      defaultValue={
                        typeof seg.chance === "number" ? seg.chance : ""
                      }
                      style={{
                        width: "93%",
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid #D1D5DB",
                        marginTop: 2,
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    />

                    {/* Тип + значення */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: "0 0 45%" }}>
                        <label style={{ fontSize: 12 }}>Тип знижки</label>
                        <select
                          name={`s${i}_dtype`}
                          defaultValue={seg.discountType || "PERCENT"}
                          style={{
                            width: "93%",
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #D1D5DB",
                            marginTop: 2,
                            fontSize: 13,
                          }}
                        >
                          <option value="PERCENT">% від суми</option>
                          <option value="FIXED">Фіксована сума</option>
                          <option value="FREESHIP">Безкоштовна доставка</option>
                      </select>

                      </div>

                      <div style={{ flex: "1 1 55%" }}>
                        <label style={{ fontSize: 12 }}>Розмір знижки</label>
                        <input
                          type="number"
                          name={`s${i}_dvalue`}
                          defaultValue={
                            typeof seg.discountValue === "number"
                              ? seg.discountValue
                              : ""
                          }
                          style={{
                            width: "86%",
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #D1D5DB",
                            marginTop: 2,
                            fontSize: 13,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


            {/* Кнопка + повідомлення справа */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <button
                type="submit"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: "#008060",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Зберегти налаштування колеса
              </button>

              {/* Статус збереження саме для колеса */}
              {actionData?.okWheel && (
                <s-text as="span" variant="bodySm" tone="success">
                  Збережено налаштування колеса ✅
                </s-text>
              )}
              {actionData?.okWheel === false && (
                <s-text as="span" variant="bodySm" tone="critical">
                  {actionData.messageWheel || "Помилка при збереженні колеса."}
                </s-text>
              )}
            </div>

          </Form>
        </s-card-section>
      </s-section>


    </s-page>
  );
}

// Shopify boundaries
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
