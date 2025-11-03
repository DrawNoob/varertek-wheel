import { useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

function SettingsPage() {
  const settings = useFetcher();

  return (
    <s-page heading="Налаштування колеса фортуни.">

    </s-page>
  );
}

export default SettingsPage;
export const headers = (h) => boundary.headers(h);
