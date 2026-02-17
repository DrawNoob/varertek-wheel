import {
  Form,
  useActionData,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getTenantPrisma } from "../tenant-db.server";
import { CountdownAnswersPage } from "../components/CountdownAnswersPage";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  let wheelSetting = null;
  let rows = [];

  try {
    const [wheel, answers] = await Promise.all([
      prisma.wheelSetting.findUnique({
        where: { shop },
      }),
      prisma.countdownAnswer.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    wheelSetting = wheel || null;
    rows = answers;
  } catch (e) {
    console.error("Failed to load wheel settings or answers", e);
  }

  return { wheelSetting, rows };
}

export async function action({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const idStr = formData.get("id");
    const id = Number(idStr);

    if (idStr && !Number.isNaN(id)) {
      try {
        await prisma.countdownAnswer.deleteMany({
          where: { id, shop },
        });
      } catch (err) {
        console.error("Failed to delete countdownAnswer", err);
      }
    }

    return null;
  }

  if (intent !== "saveWheel") {
    return null;
  }

  const normalizeDiscountType = (rawType) => {
    if (rawType === "FIXED") return "FIXED";
    return "PERCENT";
  };

  const buildSegment = (i) => ({
    enabled: formData.get(`s${i}_enabled`) === "on",
    label: formData.get(`s${i}_label`) || "",
    chance: Number(formData.get(`s${i}_chance`) || 0),
    discountType: normalizeDiscountType(formData.get(`s${i}_dtype`)),
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

  const enabledSegments = Object.values(payload).filter(
    (segment) => segment?.enabled !== false,
  );
  const invalidChance = enabledSegments.some(
    (segment) => !Number.isFinite(segment.chance) || segment.chance < 0,
  );
  const totalChance = enabledSegments.reduce(
    (sum, segment) => sum + (segment.chance || 0),
    0,
  );

  if (!enabledSegments.length) {
    return {
      okWheel: false,
      messageWheel: "Увімкніть хоча б один сектор.",
    };
  }

  if (invalidChance) {
    return {
      okWheel: false,
      messageWheel: "Шанс має бути числом >= 0.",
    };
  }

  if (Math.abs(totalChance - 100) > 0.0001) {
    return {
      okWheel: false,
      messageWheel: "Сума шансів має дорівнювати 100%.",
    };
  }

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
      messageWheel: "Помилка збереження налаштувань колеса.",
    };
  }
}

export default function WheelPage() {
  const { wheelSetting, rows } = useLoaderData();
  const actionData = useActionData();
  const handleExport = async () => {
    const qs = window.location.search || "";
    const url = `/app/wheel/export${qs}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      console.error("Export CSV failed", res.status);
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    link.download = `wheel-wins-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(link.href);
  };

  return (
    <s-page heading="Колесо фортуни">
      <s-section>
        <s-card-section>
          <div style={{ marginBottom: "16px" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "4px" }}>
              Колесо фортуни
            </h1>
          </div>

          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              background: "#F9FAFB",
            }}
          >
            <h2
              style={{
                fontSize: "12px",
                fontWeight: 600,
                margin: "0 0 4px 0",
                color: "#111827",
              }}
            >
              Як це працює
            </h2>
            <p style={{ fontSize: "10px", margin: "0 0 2px 0", color: "#374151" }}>
              1. Покупець вводить email і крутить колесо один раз.
            </p>
            <p style={{ fontSize: "10px", margin: "0 0 2px 0", color: "#374151" }}>
              2. Система визначає виграш за вашими шансами секторів і видає промокод.
            </p>
            <p style={{ fontSize: "10px", margin: "0 0 10px 0", color: "#374151" }}>
              3. Щоб знижка спрацювала, у checkout покупець має використати той самий email.
            </p>

            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                margin: "0 0 4px 0",
                color: "#111827",
              }}
            >
              Важливо перед збереженням
            </p>
            <p style={{ fontSize: "10px", margin: "0 0 2px 0", color: "#374151" }}>
              - Увімкніть щонайменше 1 сектор.
            </p>
            <p style={{ fontSize: "10px", margin: "0 0 2px 0", color: "#374151" }}>
              - Сума шансів увімкнених секторів має дорівнювати 100%.
            </p>
            <p style={{ fontSize: "10px", margin: "0 0 2px 0", color: "#374151" }}>
              - Для кожного сектору заповніть назву виграшу, тип і розмір знижки.
            </p>
            <p style={{ fontSize: "10px", margin: 0, color: "#374151" }}>
              - Стилі елемента змінюються в Customize теми після додавання блоку на сайт.
            </p>
          </div>
          <div style={{ marginBottom: "16px" }}>
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
                    <label style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        name={`s${i}_enabled`}
                        defaultChecked={seg.enabled !== false}
                        style={{ marginRight: 6 }}
                      />
                      Включено
                    </label>
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

                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: "0 0 45%" }}>
                        <label style={{ fontSize: 12 }}>Тип знижки</label>
                        <select
                          name={`s${i}_dtype`}
                          defaultValue={
                            seg.discountType === "FIXED" ? "FIXED" : "PERCENT"
                          }
                          style={{
                            width: "93%",
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid #D1D5DB",
                            marginTop: 2,
                            fontSize: 13,
                          }}
                        >
                          <option value="PERCENT">% на товари</option>
                          <option value="FIXED">Фіксована сума на товари</option>
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

            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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

                {actionData?.okWheel && (
                  <s-text as="span" variant="bodySm" tone="success">
                    Збережено.
                  </s-text>
                )}
                {actionData?.okWheel === false && (
                  <s-text as="span" variant="bodySm" tone="critical">
                    {actionData.messageWheel || "Помилка збереження колеса."}
                  </s-text>
                )}
              </div>
            </div>
          </Form>

        </s-card-section>
      </s-section>

      <s-section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>
            Відповіді та знижки
          </h2>
          <button
            type="button"
            onClick={handleExport}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 14px",
              borderRadius: "8px",
              border: "1px solid #111827",
              cursor: "pointer",
              backgroundColor: "#ffffff",
              color: "#111827",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            Export CSV
          </button>
        </div>
        <CountdownAnswersPage rows={rows} />
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);

