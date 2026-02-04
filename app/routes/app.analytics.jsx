import { useState } from "react";
import { Form, useLoaderData, useLocation, useRouteError } from "react-router";
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
function parseDayParam(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function parseMonthParam(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, month: m };
}

function buildRange(url) {
  const range = url.searchParams.get("range") || "7d";
  const monthParam = url.searchParams.get("month");
  const dayParam = url.searchParams.get("day");
  const today = startOfDay(new Date());

  if (range === "day") {
    const chosen = parseDayParam(dayParam) || today;
    const start = startOfDay(chosen);
    const end = new Date(start.getTime() + DAY_MS);
    return {
      range,
      dayParam: dayParam || start.toISOString().slice(0, 10),
      monthParam: monthParam || today.toISOString().slice(0, 7),
      start,
      end,
      days: 1,
      label: `день ${start.toISOString().slice(0, 10)}`,
    };
  }

  if (range === "month") {
    const chosen = parseMonthParam(monthParam) || {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
    const start = new Date(chosen.year, chosen.month - 1, 1);
    const end = new Date(chosen.year, chosen.month, 1);
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS);
    const label = `місяць ${String(chosen.year)}-${String(chosen.month).padStart(2, "0")}`;
    return {
      range,
      dayParam: dayParam || today.toISOString().slice(0, 10),
      monthParam: monthParam || `${chosen.year}-${String(chosen.month).padStart(2, "0")}`,
      start,
      end,
      days,
      label,
    };
  }

  if (range === "30d") {
    const start = new Date(today.getTime() - (30 - 1) * DAY_MS);
    const end = new Date(today.getTime() + DAY_MS);
    return {
      range,
      dayParam: dayParam || today.toISOString().slice(0, 10),
      monthParam: monthParam || today.toISOString().slice(0, 7),
      start,
      end,
      days: 30,
      label: "30 днів",
    };
  }

  const start = new Date(today.getTime() - (7 - 1) * DAY_MS);
  const end = new Date(today.getTime() + DAY_MS);
  return {
    range: "7d",
    dayParam: dayParam || today.toISOString().slice(0, 10),
    monthParam: monthParam || today.toISOString().slice(0, 7),
    start,
    end,
    days: 7,
    label: "7 днів",
  };
}

function buildCompareRange(range) {
  if (range.range === "day") {
    const end = new Date(range.start);
    const start = new Date(end.getTime() - DAY_MS);
    return { start, end };
  }

  if (range.range === "month") {
    const end = new Date(range.start);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return { start, end };
  }

  const end = new Date(range.start);
  const start = new Date(end.getTime() - range.days * DAY_MS);
  return { start, end };
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);
  const url = new URL(request.url);
  const range = buildRange(url);
  const compareEnabled = url.searchParams.get("compare") === "1";
  const productTypeFilter = url.searchParams.get("productType") || "";
  const summaryEventTypes = [
    "page_view",
    "product_click",
    "add_to_cart",
    "button_click",
    "product_type_purchase",
    "product_type_paid",
  ];

  const users = await prisma.userEvent.groupBy({
    by: ["email"],
    where: {
      shop,
      createdAt: { gte: range.start, lt: range.end },
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
      createdAt: { gte: range.start, lt: range.end },
      email: { not: null },
    },
    _count: { _all: true },
  });

  const recentEvents = await prisma.userEvent.findMany({
    where: {
      shop,
      createdAt: { gte: range.start, lt: range.end },
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
        page_view: {},
        product_click: {},
        add_to_cart: {},
        button_click: {},
        product_type_purchase: {},
        product_type_paid: {},
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

    if (value) {
      if (target[value]) {
        target[value] += 1;
      } else if (Object.keys(target).length < MAX_TOOLTIP_ITEMS) {
        target[value] = 1;
      }
    }

    return acc;
  }, {});

  const summaryEvents = await prisma.userEvent.findMany({
    where: {
      shop,
      createdAt: { gte: range.start, lt: range.end },
      eventType: { in: summaryEventTypes },
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

  let compareSummary = null;
  if (compareEnabled) {
    const compareRange = buildCompareRange(range);
    const compareEvents = await prisma.userEvent.findMany({
      where: {
        shop,
        createdAt: { gte: compareRange.start, lt: compareRange.end },
        eventType: { in: summaryEventTypes },
      },
      select: {
        eventType: true,
        email: true,
      },
      take: MAX_EVENTS_FOR_SUMMARY,
    });
    const compareTotalsByType = {
      page_view: 0,
      product_click: 0,
      add_to_cart: 0,
      button_click: 0,
      product_type_purchase: 0,
      product_type_paid: 0,
    };
    const compareUsers = new Set();

    compareEvents.forEach((event) => {
      if (compareTotalsByType[event.eventType] !== undefined) {
        compareTotalsByType[event.eventType] += 1;
      }
      if (event.email) {
        compareUsers.add(event.email);
      }
    });

    compareSummary = {
      totalEvents: compareEvents.length,
      totalsByType: compareTotalsByType,
      uniqueUsers: compareUsers.size,
    };
  }
  const topProductClicks = await prisma.userEvent.groupBy({
    by: ["productHandle"],
    where: {
      shop,
      createdAt: { gte: range.start, lt: range.end },
      eventType: "product_click",
      productHandle: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { productHandle: "desc" } },
    take: 50,
  });

  let topProducts = [];
  if (topProductClicks.length && admin) {
    const queryParts = topProductClicks.map((row, idx) => {
      let handle = String(row.productHandle || "");
      try {
        handle = decodeURIComponent(handle);
      } catch {}
      handle = handle.replace(/"/g, "\\\"");
      return `p${idx}: productByHandle(handle: "${handle}") { id title handle productType onlineStoreUrl featuredImage { url altText } legacyResourceId }`;
    });
    const query = `#graphql
      query TopProducts {
        ${queryParts.join("\n")}
      }
    `;

    try {
      const response = await admin.graphql(query);
      const jsonResp = await response.json();
      const data = jsonResp?.data || {};
      topProducts = topProductClicks.map((row, idx) => {
        const product = data[`p${idx}`];
        const legacyId = product?.legacyResourceId;
        let handle = row.productHandle;
        try {
          handle = decodeURIComponent(String(handle || ""));
        } catch {}
        return {
          handle,
          title: product?.title || row.productHandle,
          productType: product?.productType || "",
          imageUrl: product?.featuredImage?.url || null,
          imageAlt: product?.featuredImage?.altText || "",
          adminUrl: legacyId ? `https://${shop}/admin/products/${legacyId}` : null,
          previewUrl: product?.onlineStoreUrl || null,
          storefrontUrl: handle ? `https://${shop}/products/${handle}` : null,
          clicks: row._count?._all || 0,
        };
      });
    } catch (err) {
      console.error("Failed to load product info", err);
      topProducts = topProductClicks.map((row) => ({
        handle: row.productHandle,
        title: row.productHandle,
        productType: "",
        imageUrl: null,
        imageAlt: "",
        adminUrl: null,
        previewUrl: null,
        storefrontUrl: row.productHandle
          ? `https://${shop}/products/${row.productHandle}`
          : null,
        clicks: row._count?._all || 0,
      }));
    }
  } else {
    topProducts = topProductClicks.map((row) => ({
      handle: row.productHandle,
      title: row.productHandle,
      productType: "",
      imageUrl: null,
      imageAlt: "",
      adminUrl: null,
      previewUrl: null,
      storefrontUrl: row.productHandle
        ? `https://${shop}/products/${row.productHandle}`
        : null,
      clicks: row._count?._all || 0,
    }));
  }
  if (productTypeFilter) {
    topProducts = topProducts
      .filter((product) => product.productType === productTypeFilter)
      .sort((a, b) => b.clicks - a.clicks);
  }

  let productTypes = [];
  if (admin) {
    try {
      const typesQuery = `#graphql
        query ProductTypes {
          shop {
            productTypes(first: 250) {
              edges { node }
            }
          }
        }
      `;
      const response = await admin.graphql(typesQuery);
      const jsonResp = await response.json();
      productTypes =
        jsonResp?.data?.shop?.productTypes?.edges
          ?.map((edge) => edge?.node)
          ?.filter(Boolean) || [];
    } catch (err) {
      console.error("Failed to load product types", err);
      productTypes = [];
    }
  }

  const totalsByType = {
    page_view: 0,
    product_click: 0,
    add_to_cart: 0,
    button_click: 0,
    product_type_purchase: 0,
    product_type_paid: 0,
  };
  const totalsByDay = Array(range.days).fill(0);
  const dailyByType = Array.from({ length: range.days }, () => ({
    page_view: 0,
    product_click: 0,
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
    const index = Math.floor((day.getTime() - range.start.getTime()) / DAY_MS);
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

  const labels = Array.from({ length: range.days }, (_, idx) => {
    const d = new Date(range.start);
    d.setDate(range.start.getDate() + idx);
    return d.toISOString().slice(0, 10);
  });

  return {
    users,
    eventTypeCounts,
    tooltipData,
    topProducts,
    productTypes,
    productTypeFilter,
    range: {
      type: range.range,
      label: range.label,
      day: range.dayParam,
      month: range.monthParam,
    },
    summary: {
      totalEvents: summaryEvents.length,
      totalsByType,
      uniqueUsers: uniqueUsers.size,
      typeCounts: summaryTypeCounts,
      typeCountsPaid: summaryTypeCountsPaid,
      compareEnabled,
      compareSummary,
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
      return "Checkout (Типи)";
    case "product_type_paid":
      return "Оплачені покупки (Типи)";
    default:
      return type;
  }
}

function displayEmail(email) {
  if (!email || email === "non-logged-in") return "non-logged-in";
  if (email.length <= 12) return email;
  return `12:${email.slice(0, 10)}`;
}

function formatDateLabel(isoDate) {
  const parts = String(isoDate).split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}.${parts[1]}`;
}

export default function AnalyticsPage() {
  const {
    users,
    eventTypeCounts,
    tooltipData,
    summary,
    chart,
    range,
    topProducts,
    productTypes,
    productTypeFilter,
  } = useLoaderData();
  const location = useLocation();
  const [rangeType, setRangeType] = useState(range.type);
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
    const items = tooltipData?.[email]?.[eventType] || {};
    const entries = Object.entries(items);
    if (entries.length === 0) return "";
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([item, count]) => {
        try {
          const url = new URL(item);
          const decodedPath = decodeURIComponent(url.pathname);
          const decodedSearch = url.search ? decodeURIComponent(url.search) : "";
          return `${url.hostname}${decodedPath}${decodedSearch} ( ${count} )`;
        } catch {
          try {
            return `${decodeURIComponent(item)} ( ${count} )`;
          } catch {
            return `${item} ( ${count} )`;
          }
        }
      })
      .join("\n");
  };
  const buildProductTypeHref = (type) => {
    const params = new URLSearchParams(location.search);
    if (type) {
      params.set("productType", type);
    } else {
      params.delete("productType");
    }
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  };

  const maxValue = Math.max(1, ...chart.totalsByDay);
  const width = 1200;
  const height = 180;
  const padding = 30;
  const denom = Math.max(1, chart.totalsByDay.length - 1);
  const points = chart.totalsByDay.map((value, idx) => {
    const breakdown = chart.dailyByType?.[idx] || {
      page_view: 0,
      product_click: 0,
      add_to_cart: 0,
      button_click: 0,
      product_type_purchase: 0,
      product_type_paid: 0,
      productTypes: {},
      productTypesPaid: {},
    };
    const x = padding + (idx / denom) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y, value, label: chart.labels[idx], breakdown };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  const summaryTypeEntries = Object.entries(summary.typeCounts || {})
    .sort((a, b) => b[1] - a[1]);
  const summaryPaidTypeEntries = Object.entries(summary.typeCountsPaid || {})
    .sort((a, b) => b[1] - a[1]);
  const displayProducts = Array.from({ length: 8 }, (_, idx) => topProducts[idx] || null);
  const renderCompareValue = (current, previous) => {
    if (!summary.compareSummary) return null;
    if (typeof current !== "number" || typeof previous !== "number") return null;
    const color =
      previous < current ? "#ef4444" : previous > current ? "#16a34a" : "#6b7280";
    const diff = current - previous;
    const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
    const diffColor = diff > 0 ? "#16a34a" : diff < 0 ? "#ef4444" : "#6b7280";
    return (
      <span style={{ fontSize: 12, marginLeft: 18 }}>
        | {previous} |
        <span style={{ marginLeft: 12, color: diffColor }}>
          ({diffLabel})
        </span>
      </span>
);
  };
  const selectStyle = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    backgroundColor: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "4px 32px 6px 10px",
    fontSize: 13,
    lineHeight: "18px",
    color: "#111827",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20' fill='%236b7280'><path d='M5.5 7.5 10 12l4.5-4.5' stroke='%236b7280' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "12px",
  };
const inputStyle = {
    backgroundColor: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 13,
    lineHeight: "18px",
    color: "#111827",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };
  return (
    <s-page heading="Analytics">
      <s-section>
        <s-card-section>
          <Form method="get">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "flex-end",
              }}
            >
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                  Період
                </label>
                <select
                  name="range"
                  value={rangeType}
                  onChange={(event) => setRangeType(event.target.value)}
                  style={selectStyle}
                >
                  <option value="7d">7 днів</option>
                  <option value="30d">30 днів</option>
                  <option value="month">Конкретний місяць</option>
                  <option value="day">Конкретний день</option>
                </select>
              </div>

              <label
                style={{
                  fontSize: 12,
                  display: "inline-flex",
                  gap: 6,
                  alignItems: "center",
                  marginLeft: "auto",
                  order: 99,
                }}
              >
                <input
                  type="checkbox"
                  name="compare"
                  value="1"
                  defaultChecked={summary.compareEnabled}
                />
                Порівняння за цей самий період
              </label>

              {rangeType === "month" && (
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    Місяць
                  </label>
                  <input
                    type="month"
                    name="month"
                    defaultValue={range.month}
                    style={inputStyle}
                  />
                </div>
              )}

              {rangeType === "day" && (
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    День
                  </label>
                  <input
                    type="date"
                    name="day"
                    defaultValue={range.day}
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <button
                  type="submit"
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid #d0d0d0",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Показати
                </button>
              </div>
            </div>
          </Form>
        </s-card-section>
      </s-section>

      <s-section>
        <s-card-section>
          <strong>Загальна аналітика за {range.label}</strong>
        </s-card-section>
        <s-card-section>
          <div
            style={{
              display: "grid",
              marginTop: 20,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Всього подій</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.totalEvents}
                {renderCompareValue(summary.totalEvents, summary.compareSummary?.totalEvents)}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Перегляди сторінки</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.totalsByType.page_view}
                {renderCompareValue(
                  summary.totalsByType.page_view,
                  summary.compareSummary?.totalsByType.page_view,
                )}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Клiк по продукту</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.totalsByType.product_click}
                {renderCompareValue(
                  summary.totalsByType.product_click,
                  summary.compareSummary?.totalsByType.product_click,
                )}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Додавання у кошик</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.totalsByType.add_to_cart}
                {renderCompareValue(
                  summary.totalsByType.add_to_cart,
                  summary.compareSummary?.totalsByType.add_to_cart,
                )}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Кліки по кнопках</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.totalsByType.button_click}
                {renderCompareValue(
                  summary.totalsByType.button_click,
                  summary.compareSummary?.totalsByType.button_click,
                )}
              </div>
            </div>
            <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Користувачі</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {summary.uniqueUsers}
                {renderCompareValue(summary.uniqueUsers, summary.compareSummary?.uniqueUsers)}
              </div>
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
                        {`Перегляд сторінки: ${point.breakdown.page_view}\nКлік по продукту: ${point.breakdown.product_click}\nДодав у кошик: ${point.breakdown.add_to_cart}\nКлік по кнопці: ${point.breakdown.button_click}\nCheckout (Типи): ${point.breakdown.product_type_purchase}\nPaid (Типи) ${point.breakdown.product_type_paid}\n${checkoutTypeLines}\n${paidTypeLines}`}
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <strong>Найпопулярніші продукти:</strong>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <a
                href={buildProductTypeHref("")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: productTypeFilter ? "#fff" : "#111827",
                  color: productTypeFilter ? "#111827" : "#fff",
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                Всі типи
              </a>
              {productTypes.map((type) => (
                <a
                  key={type}
                  href={buildProductTypeHref(type)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #e5e7eb",
                    background: productTypeFilter === type ? "#111827" : "#fff",
                    color: productTypeFilter === type ? "#fff" : "#111827",
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  {type}
                </a>
              ))}
            </div>
          </div>
        </s-card-section>
        <s-card-section>
          <div style={{ marginTop: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, minmax(90px, 1fr))",
                gap: "10px",
              }}
            >
              {displayProducts.map((product, idx) => {
                if (!product) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      style={{
                        border: "1px dashed #e5e7eb",
                        borderRadius: 10,
                        padding: 10,
                        background: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          borderRadius: 8,
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#9ca3af",
                          fontSize: 11,
                        }}
                      >
                        No data
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
                        Clicks: 0
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={product.handle || `product-${idx}`}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <a
                      href={product.previewUrl || product.storefrontUrl || product.adminUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          background: "#f3f4f6",
                          borderRadius: 8,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.imageAlt || product.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>No image</span>
                      )}
                    </div>
                  </a>
                  <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>
                    Clicks: {product.clicks}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </s-card-section>
      </s-section>

      <s-section>
        <s-card-section>
          <strong>Користувачі: {users.length}</strong>
        </s-card-section>
        <s-divider />
        <s-card-section>
          <div style={{ overflowX: "auto", marginTop: 20 }}>
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
