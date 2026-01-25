import { useMemo, useState } from "react";
import { Form } from "react-router";

export function CountdownAnswersPage({ rows }) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  const goToPage = (nextPage) => {
    const target = Math.min(Math.max(1, nextPage), totalPages);
    setPage(target);
  };

  return (
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
                <th style={{ textAlign: "left", padding: 8 }}>Приз</th>
                <th style={{ textAlign: "left", padding: 8 }}>Код</th>
                <th style={{ textAlign: "left", padding: 8 }}>Коли</th>
                <th style={{ textAlign: "left", padding: 8 }}>Девайс</th>
                <th style={{ textAlign: "left", padding: 8 }}>Дія</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{r.email || "-"}</td>
                  <td style={{ padding: 8 }}>
                    {r.answer === "yes"
                      ? "Так"
                      : r.answer === "no"
                      ? "Ні"
                      : r.answer || "-"}
                  </td>
                  <td style={{ padding: 8 }}>{r.discountCode || "-"}</td>
                  <td style={{ padding: 8 }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: 8 }}>{r.deviceType || "-"}</td>
                  <td style={{ padding: 8 }}>
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={r.id} />

                      <button
                        type="submit"
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        <s-button tone="critical" variant="plain">
                          Видалити
                        </s-button>
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                    Поки нема даних.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </s-card-section>
              <br />
      {rows.length > PAGE_SIZE && (
        <s-card-section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#6B7280", fontSize: 13 }}>
              Сторінка {safePage} з {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                style={{
                  border: "1px solid #E5E7EB",
                  background: safePage <= 1 ? "#F3F4F6" : "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: safePage <= 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                }}
              >
                Назад
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNumber = idx + 1;
                const isActive = pageNumber === safePage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => goToPage(pageNumber)}
                    style={{
                      border: "1px solid #E5E7EB",
                      background: isActive ? "#111827" : "#FFFFFF",
                      color: isActive ? "#FFFFFF" : "#111827",
                      padding: "4px 10px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                style={{
                  border: "1px solid #E5E7EB",
                  background: safePage >= totalPages ? "#F3F4F6" : "#FFFFFF",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: safePage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 12,
                }}
              >
                Далі
              </button>
            </div>
          </div>
        </s-card-section>
      )}
    </s-section>
  );
}
