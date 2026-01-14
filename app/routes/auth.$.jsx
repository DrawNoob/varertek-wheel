import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, registerWebhooks } from "../shopify.server";
import { ensureTenantDatabase } from "../tenant-db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await registerWebhooks({ session });
  try {
    await ensureTenantDatabase(session.shop);
  } catch (err) {
    console.error("Failed to ensure tenant DB", err);
  }

  return null;
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
