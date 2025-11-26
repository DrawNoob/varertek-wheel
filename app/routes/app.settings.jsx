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

  try {
    const record = await prisma.countdownSetting.findUnique({
      where: { shop },
    });

    countdownEnd = record?.endDate ? record.endDate.toISOString() : null;
  } catch (e) {
    console.error("Failed to load countdown setting from DB", e);
  }

  return { countdownEnd };
}

// ----------------------
//        ACTION
// ----------------------
export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
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
  const { countdownEnd } = useLoaderData();
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
      <s-section>
        <s-card-section>
          <Form method="post">
            <s-vertical-stack gap="400">
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
    </s-page>
  );
}

// Shopify boundaries
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
