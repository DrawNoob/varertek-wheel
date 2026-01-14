import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getTenantPrisma } from "../tenant-db.server";

const MAX_TOOLTIP_ITEMS = 20;
const MAX_EVENTS_FOR_TOOLTIPS = 5000;
const MAX_EVENTS_FOR_SUMMARY = 20000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  const users = await prisma.userEvent.groupBy({
    by: ["email"],
    where: {
      shop,
      email: { not: null },
    },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: {
      _max: { createdAt: "desc" },
    },
  });

  const eventTypeCounts = await prisma.userEvent.groupBy({
    by: ["email", "eventType"],
    where: {
      shop,
      email: { not: null },
    },
    _count: { _all: true },
  });

  const recentEvents = await prisma.userEvent.findMany({
    where: {
      shop,
      email: { not: null },
    },
    select: {
      email: true,
      eventType: true,
      url: true,
      productHandle: true,
      eventData: true,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EVENTS_FOR_TOOLTIPS,
  });

  const tooltipData = recentEvents.reduce((acc, event) => {
    if (!event.email) return acc;
    if (!acc[event.email]) {
      acc[event.email] = {
        page_view: [],
        product_click: [],
        add_to_cart: [],
        button_click: [],
        product_type_purchase: [],
        product_type_paid: [],
      };
    }

    const target = acc[event.email][event.eventType];
    if (!target) return acc;

    let value = null;
    if (event.eventType === "product_click") {
      value = event.productHandle || event.url;
    } else if (
      event.eventType === "product_type_purchase" ||
      event.eventType === "product_type_paid"
    ) {
      const types = Array.isArray(event.eventData?.types) ? event.eventData.types : [];
      value = types.length ? types.join(", ") : event.url;
    } else if (event.eventType === "button_click") {
      value = event.eventData?.label || event.url;
    } else {
      value = event.url;
    }

    if (value && !target.includes(value) && target.length < MAX_TOOLTIP_ITEMS) {
      target.push(value);
    }

    return acc;
  }, {});

  const startDate = startOfDay(new Date());
  startDate.setDate(startDate.getDate() - 6);

  const summaryEvents = await prisma.userEvent.findMany({
    where: {
      shop,
      createdAt: { gte: startDate },
      eventType: {
        in: [
          "page_view",
          "add_to_cart",
          "button_click",
          "product_type_purchase",
          "product_type_paid",
        ],
      },
    },
    select: {
      createdAt: true,
      eventType: true,
      email: true,
      eventData: true,
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EVENTS_FOR_SUMMARY,
  });

  const totalsByType = {
    page_view: 0,
    add_to_cart: 0,
    button_click: 0,
    product_type_purchase: 0,
    product_type_paid: 0,
  };
  const totalsByDay = Array(7).fill(0);
  const dailyByType = Array.from({ length: 7 }, () => ({
    page_view: 0,
    add_to_cart: 0,
    button_click: 0,
    product_type_purchase: 0,
    product_type_paid: 0,
    productTypes: {},
    productTypesPaid: {},
  }));
  const uniqueUsers = new Set();
  const summaryTypeCounts = {};
  const summaryTypeCountsPaid = {};

  summaryEvents.forEach((event) => {
    if (totalsByType[event.eventType] !== undefined) {
      totalsByType[event.eventType] += 1;
    }

    const day = startOfDay(event.createdAt);
    const index = Math.floor((day.getTime() - startDate.getTime()) / DAY_MS);
    if (index >= 0 && index < totalsByDay.length) {
      totalsByDay[index] += 1;
      if (dailyByType[index] && dailyByType[index][event.eventType] !== undefined) {
        dailyByType[index][event.eventType] += 1;
      }

      if (event.eventType === "product_type_purchase") {
        const types = Array.isArray(event.eventData?.types) ? event.eventData.types : [];
        types.forEach((type) => {
          const key = String(type).trim().toLowerCase();
          if (!key) return;
          summaryTypeCounts[key] = (summaryTypeCounts[key] || 0) + 1;
          dailyByType[index].productTypes[key] =
            (dailyByType[index].productTypes[key] || 0) + 1;
        });
      }

      if (event.eventType === "product_type_paid") {
        const types = Array.isArray(event.eventData?.types) ? event.eventData.types : [];
        types.forEach((type) => {
          const key = String(type).trim().toLowerCase();
          if (!key) return;
          summaryTypeCountsPaid[key] = (summaryTypeCountsPaid[key] || 0) + 1;
          dailyByType[index].productTypesPaid[key] =
            (dailyByType[index].productTypesPaid[key] || 0) + 1;
        });
      }
    }

    if (event.email) {
      uniqueUsers.add(event.email);
    }
  });

  const labels = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + idx);
    return d.toISOString().slice(0, 10);
  });

  return {
    users,
    eventTypeCounts,
    tooltipData,
    summary: {
      totalEvents: summaryEvents.length,
      totalsByType,
      uniqueUsers: uniqueUsers.size,
      typeCounts: summaryTypeCounts,
      typeCountsPaid: summaryTypeCountsPaid,
    },
    chart: {
      labels,
      totalsByDay,
      dailyByType,
    },
  };
};

function formatEventType(type) {
  switch (type) {
    case "page_view":
      return "Перегляд сторінки";
    case "product_click":
      return "Клік по продукту";
    case "add_to_cart":
      return "Додав у кошик";
    case "button_click":
      return "Клік по кнопці";
    case "product_type_purchase":
      return "Checkout (типи)";
    case "product_type_paid":
      return "Оплачені покупки (типи)";
    default:
      return type;
  }
}

function displayEmail(email) {
  if (!email || email === "non-logged-in") return "non-logged-in";
  if (email.length <= 12) return email;
  return `hash:${email.slice(0, 8)}`;
}

function formatDateLabel(isoDate) {
  const parts = String(isoDate).split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}`;
}

export default function AnalyticsPage() {
  const { users, eventTypeCounts, tooltipData, summary, chart } = useLoaderData();
  const countsByEmail = eventTypeCounts.reduce((acc, row) => {
    const email = row.email;
    if (!acc[email]) acc[email] = [];
    acc[email].push({
      type: row.eventType,
      count: row._count?._all || 0,
    });
    return acc;
  }, {});

  const eventOrder = [
    "page_view",
    "product_click",
    "add_to_cart",
    "button_click",
    "product_type_purchase",
    "product_type_paid",
  ];

  const tooltipFor = (email, eventType) => {
    const items = tooltipData?.[email]?.[eventType] || [];
    if (items.length === 0) return "";
    return items
      .map((item) => {
        try {
          const url = new URL(item);
          const decodedPath = decodeURIComponent(url.pathname);
          const decodedSearch = url.search ? decodeURIComponent(url.search) : "";
          return `${url.hostname}${decodedPath}${decodedSearch}`;
        } catch {
          try {
            return decodeURIComponent(item);
          } catch {
            return item;
          }
        }
      })
      .join("\n");
  };

  const maxValue = Math.max(1, ...chart.totalsByDay);
  const width = 700;
  const height = 180;
  const padding = 30;
  const points = chart.totalsByDay.map((value, idx) => {
    const breakdown = chart.dailyByType?.[idx] || {
      page_view: 0,
      add_to_cart: 0,
      button_click: 0,
      product_type_purchase: 0,
      product_type_paid: 0,
      productTypes: {},
      productTypesPaid: {},
    };
    const x = padding + (idx / (chart.totalsByDay.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y, value, label: chart.labels[idx], breakdown };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  const summaryTypeEntries = Object.entries(summary.typeCounts || {})
    .sort((a, b) => b[1] - a[1]);
  const summaryPaidTypeEntries = Object.entries(summary.typeCountsPaid || {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <s-page heading="Analytics">
      <s-section>
        <s-card-section>
          <strong>Загальна аналітика за 7 днів</strong>
        </s-card-section>
        <s-card-section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Всього подій</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.totalEvents}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Перегляди сторінки</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.totalsByType.page_view}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Додавання у кошик</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.totalsByType.add_to_cart}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Кліки по кнопках</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.totalsByType.button_click}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Користувачі</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.uniqueUsers}</div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Типи покупок (checkout)
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {summaryTypeEntries.length > 0
                  ? summaryTypeEntries
                      .map(([type, count]) => `${type}: ${count}`)
                      .join(", ")
                  : "-"}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Типи покупок (paid)
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {summaryPaidTypeEntries.length > 0
                  ? summaryPaidTypeEntries
                      .map(([type, count]) => `${type}: ${count}`)
                      .join(", ")
                  : "-"}
              </div>
            </div>
          </div>
        </s-card-section>
        <s-card-section>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 200 }}>
              <polyline
                points={linePoints}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
              />
              {points.map((point, idx) => {
                const checkoutTypeEntries = Object.entries(point.breakdown.productTypes || {});
                const checkoutTypeLines = checkoutTypeEntries.length
                  ? `Типи (checkout):\n${checkoutTypeEntries
                      .map(([type, count]) => `${type}: ${count}`)
                      .join("\\n")}`
                  : "Типи (checkout): -";

                const paidTypeEntries = Object.entries(point.breakdown.productTypesPaid || {});
                const paidTypeLines = paidTypeEntries.length
                  ? `Типи (paid):\n${paidTypeEntries
                      .map(([type, count]) => `${type}: ${count}`)
                      .join("\\n")}`
                  : "Типи (paid): -";

                return (
                  <g key={idx}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill="#2563eb"
                      style={{ cursor: "pointer" }}
                    >
                      <title>
                        {`Перегляд сторінки: ${point.breakdown.page_view}\nДодав у кошик: ${point.breakdown.add_to_cart}\nКлік по кнопці: ${point.breakdown.button_click}\nCheckout (типи): ${point.breakdown.product_type_purchase}\nPaid (типи): ${point.breakdown.product_type_paid}\n${checkoutTypeLines}\n${paidTypeLines}`}
                      </title>
                    </circle>
                    <text
                      x={point.x}
                      y={height - padding + 24}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b7280"
                    >
                      {formatDateLabel(point.label)}
                    </text>
                  </g>
                );
              })}
              <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" />
              <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" />
            </svg>
          </div>
        </s-card-section>
      </s-section>

      <s-section>
        <s-card-section>
          <strong>Користувачі: {users.length}</strong>
        </s-card-section>
        <s-divider />
        <s-card-section>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Події</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Остання</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Які події</th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.email} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{displayEmail(row.email)}</td>
                    <td style={{ padding: 8 }}>{row._count?._all || 0}</td>
                    <td style={{ padding: 8 }}>
                      {row._max?.createdAt
                        ? new Date(row._max.createdAt).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {(countsByEmail[row.email] || []).length > 0
                        ? [...(countsByEmail[row.email] || [])]
                            .sort((a, b) => {
                              return (
                                eventOrder.indexOf(a.type) -
                                eventOrder.indexOf(b.type)
                              );
                            })
                            .map((entry) => (
                              <div key={entry.type}>
                                <span title={tooltipFor(row.email, entry.type)}>
                                  {formatEventType(entry.type)}: {entry.count}
                                </span>
                              </div>
                            ))
                        : "-"}
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 12, color: "#666" }}>
                      Поки нема даних.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </s-card-section>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
