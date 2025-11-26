// app._index.jsx
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, apiVersion } from "../shopify.server";

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

  return { meta };
};

export default function Index() {
  const { meta } = useLoaderData();

  return (
    <s-page heading={meta.appName}>
      {/* Hero / опис */}
      <s-section>
        <s-paragraph>
          Легка апка для зворотнього відліку через віджет <b>Countdown Timer</b>.
          Додавай блок у тему, міняй кольори і керуй показом.
        </s-paragraph>

        <s-stack direction="inline" gap="base">
          <s-link href="/app/settings">Відкрити Settings</s-link>
          <s-button
            href="https://shopify.dev/docs/apps"
            target="_blank"
            variant="tertiary"
          >
            Документація Shopify Apps
          </s-button>
        </s-stack>
      </s-section>

      {/* Версії / Build info */}
      <s-section
        heading="Версії"
        style={{
          paddingTop: "10px",
          paddingBottom: "10px",
          borderBottom: "2px solid #000",
        }}
      >
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="block" gap="tight">
            <s-paragraph>
              <b>App version:</b> {meta.version}
            </s-paragraph>
            <s-paragraph>
              <b>Shopify Admin API:</b> {meta.apiVersion}
            </s-paragraph>
            <s-paragraph>
              <b>Environment:</b> {meta.env}
            </s-paragraph>
            <s-paragraph>
              <b>Build time:</b> {meta.buildTime}
            </s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      {/* Правий сайдбар */}
      <s-section slot="aside" heading="Посилання">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/settings">Налаштування (Settings)</s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="/app/changes">Changelog</s-link>
          </s-list-item>
          <s-list-item>
            <s-link
              href="https://shopify.dev/docs/api/admin-graphql"
              target="_blank"
            >
              Admin GraphQL
            </s-link>
          </s-list-item>
          <s-list-item>
            <s-link href="https://www.prisma.io/docs" target="_blank">
              Prisma docs
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Підтримка">
        <s-paragraph>
          Питання/ідеї:{" "}
          <s-link href="mailto:support@vadertek.io">
            p.leiko@vadertek.com
          </s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
