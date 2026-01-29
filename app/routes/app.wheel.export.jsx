import { authenticate } from "../shopify.server";
import { getTenantPrisma } from "../tenant-db.server";

export async function loader({ request }) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const prisma = await getTenantPrisma(shop);

  const rows = await prisma.countdownAnswer.findMany({
    where: {
      shop,
      discountCode: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = ["email", "answer", "discountCode", "deviceType", "createdAt"];
  const lines = rows.map((row) => [
    row.email || "",
    row.answer || "",
    row.discountCode || "",
    row.deviceType || "",
    row.createdAt
      ? new Date(row.createdAt).toISOString().slice(0, 16).replace("T", " ")
      : "",
  ]);

  const escapeCsv = (value) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const delimiter = ";";
  const csv = [header, ...lines]
    .map((line) => line.map(escapeCsv).join(delimiter))
    .join("\n");
  const bom = "\uFEFF";

  return new Response(bom + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wheel-wins-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
