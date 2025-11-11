// app.routes/app.settings.jsx
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import TimerSettings from "../components/TimerSettings.jsx";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const resp = await admin.graphql(`
    {
      shop {
        id
        metafield(namespace: "vt", key: "countdown_end") {
          value
        }
      }
    }
  `);
  const json = await resp.json();

  return {
    endDate: json.data.shop.metafield?.value || null,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const endDate = form.get("endDate");

  const shopResp = await admin.graphql(`{ shop { id } }`);
  const shopJson = await shopResp.json();
  const shopId = shopJson.data.shop.id;

  const write = await admin.graphql(
    `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "vt",
            key: "countdown_end",
            type: "single_line_text_field",
            value: endDate,
          },
        ],
      },
    }
  );

  const writeJson = await write.json();
  const errs = writeJson.data.metafieldsSet.userErrors;

  return {
    ok: !errs?.length,
    endDate,
  };
};

export const headers = (h) => boundary.headers(h);

export default function SettingsPage() {
  const { endDate } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <s-page heading="Налаштування таймера (Countdown Timer)">
      {/* одна форма, всередині все керується */}
      <fetcher.Form method="post">
        <TimerSettings initialEndDate={endDate} fetcher={fetcher} />
      </fetcher.Form>
    </s-page>
  );
}
