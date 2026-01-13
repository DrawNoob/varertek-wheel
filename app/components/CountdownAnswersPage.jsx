import { Form } from "react-router";

export function CountdownAnswersPage({ rows }) {
  return (
    <s-page heading="Відповіді та знижки">
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
                {rows.map((r) => (
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
      </s-section>
    </s-page>
  );
}
