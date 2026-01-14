import {
  Form,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getTenantPrisma } from "../tenant-db.server";

async function fetchShopTimezone(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query ShopTimezone {
        shop {
          ianaTimezone
        }
      }
      `,
    );
    const json = await response.json();
    return json?.data?.shop?.ianaTimezone || null;
  } catch (err) {
    console.error("Failed to fetch shop timezone", err);
    return null;
  }
}

function zonedTimeToUtc(localDateTime, timeZone) {
  if (!timeZone) return new Date(localDateTime);
  const [datePart, timePart] = String(localDateTime).split("T");
  if (!datePart || !timePart) return new Date(localDateTime);

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const tzDate = new Date(formatter.format(utcDate));
  const diff = utcDate.getTime() - tzDate.getTime();
  return new Date(utcDate.getTime() + diff);
}

function formatDateTimeForInput(isoDate, timeZone) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (!timeZone) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  let countdownEnd = null;
  let shopTimezone = null;

  try {
    shopTimezone = await fetchShopTimezone(admin);
    const countdownRecord = await prisma.countdownSetting.findUnique({
      where: { shop },
    });
    countdownEnd = countdownRecord?.endDate
      ? countdownRecord.endDate.toISOString()
      : null;
  } catch (e) {
    console.error("Failed to load timer settings from DB", e);
  }

  return { countdownEnd, shopTimezone };
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  const formData = await request.formData();
  const raw = formData.get("countdownEnd");

  if (!raw) {
    return {
      ok: false,
      message: "Будь ласка, вкажіть дату та час.",
    };
  }

  try {
    const shopTimezone = await fetchShopTimezone(admin);
    const isoValue = zonedTimeToUtc(raw, shopTimezone).toISOString();

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
      message: "Помилка збереження налаштувань.",
    };
  }
}

export default function TimerPage() {
  const { countdownEnd, shopTimezone } = useLoaderData();
  const actionData = useActionData();

  const defaultValue = formatDateTimeForInput(
    countdownEnd,
    shopTimezone || null,
  );

  return (
    <s-page heading="Таймер">
      <s-section>
        <s-card-section>
          <Form method="post">
            <s-vertical-stack gap="400">
              <h1>Таймер</h1>

              <s-vertical-stack gap="100">
                <s-text as="h2" variant="headingMd">
                  Дата завершення таймера
                </s-text>
                <s-text as="p" variant="bodySm">
                  Обери дату та час, до яких таймер буде рахувати. Якщо не
                  вказати — на вітрині буде стандартний відлік до нового року.
                </s-text>
              </s-vertical-stack>

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

              {countdownEnd && (
                <s-text as="p" variant="bodySm" tone="subdued">
                  Поточне значення:{" "}
                  {new Date(countdownEnd).toLocaleString(
                    undefined,
                    shopTimezone ? { timeZone: shopTimezone } : undefined,
                  )}
                </s-text>
              )}

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

                {actionData?.ok && (
                  <s-text as="span" variant="bodySm" tone="success">
                    Збережено.
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

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
