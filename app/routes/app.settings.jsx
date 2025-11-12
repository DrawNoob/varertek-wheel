// app.routes/app.settings.jsx
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import TimerSettings from "../components/TimerSettings.jsx";

// loader
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const resp = await admin.graphql(`
    {
      shop {
        metafield(namespace: "vtr", key: "countdown_end") {
          value
          type
        }
      }
    }
  `);
  const json = await resp.json();

  return {
    endDate: json.data.shop.metafield?.value || null,
  };
};


// action
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const endDateLocal = form.get("endDate"); 
  const endDateIso = new Date(endDateLocal).toISOString(); 

  const shopResp = await admin.graphql(`{ shop { id } }`);
  const shopJson = await shopResp.json();
  const shopId = shopJson.data.shop.id;

  const write = await admin.graphql(
    `
      mutation SetCountdown($metafields: [MetafieldsSetInput!]!) {
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
            namespace: "vtr",                 
            key: "countdown_end",
            type: "date_time",              
            value: endDateIso,
          },
        ],
      },
    }
  );

  const writeJson = await write.json();
  const errs = writeJson.data.metafieldsSet.userErrors;

  return { ok: !errs?.length, endDate: endDateIso };
};



export const headers = (h) => boundary.headers(h);

export default function SettingsPage() {
  const { endDate } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <s-page heading="Налаштування таймера (Countdown Timer)">
      <fetcher.Form method="post">
        <TimerSettings initialEndDate={endDate} fetcher={fetcher} />
      </fetcher.Form>
    </s-page>
  );
}
