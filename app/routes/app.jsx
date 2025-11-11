// app/routes/app.jsx
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// ---- SERVER LOADER ----
export async function loader({ request }) {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
}

// ---- CLIENT LOADER (дзеркалим серверний) ----
export const clientLoader = loader;

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/customers">Customers</s-link>
        <s-link href="/app/settings">Settings</s-link>
        <s-link href="/app/changes">Changes</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify хоче boundary для правильних заголовків
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (h) => boundary.headers(h);
