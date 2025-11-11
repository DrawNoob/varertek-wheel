// app.changes.jsx
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, apiVersion } from "../shopify.server";
import { changelog } from "../data/changelog";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const meta = {
    appName: "Countdown Timer — VADERTEK corp.",
    version:
      process.env.APP_VERSION ||
      process.env.npm_package_version ||
      "dev",
    apiVersion: String(apiVersion || "unknown"),
    env: process.env.NODE_ENV || "development",
    buildTime: new Date().toISOString(),
  };

  return { meta, changelog };
};

export default function Changes() {
  const { meta, changelog } = useLoaderData();

  return (
    <s-page heading={`${meta.appName} — Changelog`}>
      <s-section
        heading="Зміни"
        style={{
          paddingTop: "10px",
          paddingBottom: "10px",
          borderBottom: "2px solid #000",
        }}
      >
        <s-unordered-list>
          {changelog.map((entry) => (
            <s-list-item key={entry.date}>
              <s-heading style={{ marginBottom: "4px" }}>
                <small
                  style={{
                    background: "#000",
                    color: "#fff",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    marginRight: "6px",
                  }}
                >
                  {entry.date}
                </small>
                {entry.title}
              </s-heading>
              <s-unordered-list>
                {entry.items.map((t, i) => (
                  <s-list-item key={i}>{t}</s-list-item>
                ))}
              </s-unordered-list>
              <div
                style={{
                  width: "100%",
                  paddingTop: "10px",
                  paddingBottom: "10px",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    background: "black",
                    marginTop: "8px",
                    marginBottom: "8px",
                  }}
                ></div>
              </div>
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
