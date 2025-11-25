// app/routes/app.customers.jsx
import { Form, useLoaderData, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CountdownAnswersPage } from "../components/CountdownAnswersPage"; // ← новий компонент

export async function loader({ request }) {
  await authenticate.admin(request);

  try {
    const rows = await prisma.countdownAnswer.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { rows };
  } catch {
    return { rows: [] };
  }
}

export async function action({ request }) {
  await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const idStr = formData.get("id");
    const id = Number(idStr);

    if (idStr && !Number.isNaN(id)) {
      try {
        await prisma.countdownAnswer.delete({
          where: { id },
        });
      } catch (err) {
        console.error("Failed to delete countdownAnswer", err);
      }
    }
  }

  return null;
}

export default function CustomerPageRoute() {
  const { rows } = useLoaderData();
  return <CountdownAnswersPage rows={rows} />;
}

// Shopify boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
export const headers = (h) => boundary.headers(h);
