// app/routes/app.customers.jsx
import { useLoaderData, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export async function loader({ request }) {
  await authenticate.admin(request);

  try {
    const rows = await prisma.countdownAnswer.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { rows };
  } catch {
    return { rows: [] };
  }
}

export default function CustomerPage() {
  const { rows } = useLoaderData();

  return (
    <s-page heading="Відповіді на countdown (Так / Ні)">
      <s-section>
        <s-card-section>
          <strong>Всього записів: {rows.length}</strong>
        </s-card-section>
        <s-divider />
        <s-card-section>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Відповідь</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Коли</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Девайс</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{r.email || "—"}</td>
                    <td style={{ padding: 8 }}>
                      {r.answer === "yes"
                        ? "ТАК"
                        : r.answer === "no"
                        ? "НІ"
                        : r.answer || "—"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: 8 }}>{r.deviceType || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 12, color: "#666" }}>
                      Поки порожньо.
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

// Shopify boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
export const headers = (h) => boundary.headers(h);
