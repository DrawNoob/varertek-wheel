import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return {
    shop: session.shop,
  };
};

export default function SettingsPage() {
  const { shop } = useLoaderData();
  const customizeUrl = `https://${shop}/admin/themes/current/editor`;

  return (
    <s-page heading="Загальні налаштування">
      <s-section>
        <s-card-section>
          <div style={{ marginBottom: "12px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 4px 0" }}>
              Налаштування теми
            </h2>
            <p style={{ fontSize: "14px", color: "#6B7280", margin: 0 }}>
              Відкрийте редактор теми, щоб додати блоки застосунку та змінити їх стилі.
            </p>
          </div>

          <a
            href={customizeUrl}
            target="_top"
            rel="noreferrer"
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
              textDecoration: "none",
            }}
          >
            Відкрити Customize
          </a>
        </s-card-section>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
