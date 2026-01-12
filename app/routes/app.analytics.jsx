import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

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

  return {
    users,
    eventTypeCounts,
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
    default:
      return type;
  }
}

export default function AnalyticsPage() {
  const { users, eventTypeCounts } = useLoaderData();
  const countsByEmail = eventTypeCounts.reduce((acc, row) => {
    const email = row.email;
    if (!acc[email]) acc[email] = [];
    acc[email].push({
      type: row.eventType,
      count: row._count?._all || 0,
    });
    return acc;
  }, {});

  return (
    <s-page heading="Analytics">
      <s-section>
        <s-card-section>
          <strong>Користувачi: {users.length}</strong>
        </s-card-section>
        <s-divider />
        <s-card-section>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Подii</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Остання</th>
                  <th style={{ textAlign: "left", padding: 8 }}>
                    Якi подii
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((row) => (
                  <tr key={row.email} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{row.email}</td>
                    <td style={{ padding: 8 }}>{row._count?._all || 0}</td>
                    <td style={{ padding: 8 }}>
                      {row._max?.createdAt
                        ? new Date(row._max.createdAt).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {(countsByEmail[row.email] || []).length > 0
                        ? (countsByEmail[row.email] || []).map((entry) => (
                            <div key={entry.type}>
                              {formatEventType(entry.type)}: {entry.count}
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

