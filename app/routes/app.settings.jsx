import { useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function SettingsPage() {
  return (
    <s-page heading="Settings">
      <s-section>
        <s-card-section>
          Налаштування тимчасово порожні.
        </s-card-section>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
