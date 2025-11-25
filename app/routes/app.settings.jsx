// app/routes/app.settings.jsx
import {
  Form,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  let countdownEnd = null;

  try {
    const resp = await admin.graphql(`
      query GetCountdownEnd {
        shop {
          metafield(namespace: "vtr", key: "countdown_end") {
            value
          }
        }
      }
    `);

    const json = await resp.json();
    countdownEnd = json.data?.shop?.metafield?.value ?? null;
  } catch (e) {
    console.error("Failed to load countdown_end metafield", e);
  }

  return { countdownEnd };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const raw = formData.get("countdownEnd");

  if (!raw) {
    return {
      ok: false,
      message: "Оберіть дату та час перед збереженням.",
    };
  }

  try {
    // 1) Беремо shop id
    const shopResp = await admin.graphql(`
      query GetShopId {
        shop {
          id
        }
      }
    `);
    const shopJson = await shopResp.json();
    const shopId = shopJson.data?.shop?.id;

    if (!shopId) {
      console.error("No shop id");
      return { ok: false, message: "Не вдалося отримати ID магазину." };
    }

    // 2) Переводимо з datetime-local у ISO
    const isoValue = new Date(raw).toISOString();

    // 3) Ставимо metafield
    const setResp = await admin.graphql(
      `
      mutation SetCountdownEnd($ownerId: ID!, $value: String!) {
        metafieldsSet(
          metafields: [
            {
              namespace: "vtr"
              key: "countdown_end"
              type: "date_time"
              ownerId: $ownerId
              value: $value
            }
          ]
        ) {
          userErrors {
            field
            message
          }
        }
      }
    `,
      {
        variables: {
          ownerId: shopId,
          value: isoValue,
        },
      },
    );

    const setJson = await setResp.json();
    const errors = setJson.data?.metafieldsSet?.userErrors ?? [];

    if (errors.length) {
      console.error("metafieldsSet errors", errors);
      return {
        ok: false,
        message: errors[0]?.message || "Помилка при збереженні metafield.",
      };
    }

    return { ok: true };
  } catch (e) {
    console.error("Failed to set countdown_end metafield", e);
    return {
      ok: false,
      message: "Сталася помилка при зверненні до Shopify API.",
    };
  }
}

export default function SettingsPage() {
  const { countdownEnd } = useLoaderData();
  const actionData = useActionData();

  let defaultValue = "";
  if (countdownEnd) {
    try {
      // datetime-local → YYYY-MM-DDTHH:MM
      defaultValue = new Date(countdownEnd).toISOString().slice(0, 16);
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
                  вказати — за замовчуванням рахує до наступного Нового року.
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
                  Поточне значення:{" "}
                  {new Date(countdownEnd).toLocaleString()}
                </s-text>
              )}

              {/* Повідомлення про результат */}
              {actionData?.ok && (
                <s-text as="p" variant="bodySm" tone="success">
                  Збережено ✅
                </s-text>
              )}
              {actionData && actionData.ok === false && (
                <s-text as="p" variant="bodySm" tone="critical">
                  {actionData.message || "Не вдалося зберегти налаштування."}
                </s-text>
              )}

              {/* Кнопка */}
              <div style={{ marginTop: 8 }}>
                <s-button tone="success" submit>
                  Зберегти
                </s-button>
              </div>
            </s-vertical-stack>
          </Form>
        </s-card-section>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
