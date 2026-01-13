import { authenticate } from "../shopify.server";
import shopify from "../shopify.server";
import { prisma } from "../db.server";

function uniq(items) {
  return Array.from(new Set(items));
}

function asProductGid(id) {
  return `gid://shopify/Product/${id}`;
}

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!payload || !Array.isArray(payload.line_items)) {
    return new Response();
  }

  const lineItems = payload.line_items;
  const directTypes = [];
  const productIdsToFetch = [];

  lineItems.forEach((item) => {
    const rawType =
      typeof item.product_type === "string" ? item.product_type.trim() : "";
    if (rawType) {
      directTypes.push(rawType);
      return;
    }

    if (item.product_id) {
      productIdsToFetch.push(item.product_id);
    }
  });

  const productTypeById = {};
  const uniqueProductIds = uniq(productIdsToFetch);

  if (uniqueProductIds.length && session) {
    try {
      const client = new shopify.api.clients.Graphql({ session });
      const query = `#graphql
        query GetProductTypes($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              productType
            }
          }
        }
      `;

      const response = await client.request(query, {
        variables: { ids: uniqueProductIds.map(asProductGid) },
      });

      const nodes = response?.data?.nodes || [];
      nodes.forEach((node) => {
        if (!node?.id) return;
        const id = node.id.split("/").pop();
        const type = typeof node.productType === "string" ? node.productType.trim() : "";
        if (id && type) {
          productTypeById[id] = type;
        }
      });
    } catch (err) {
      console.error("ORDERS_PAID product type fetch failed", err);
    }
  }

  const fetchedTypes = lineItems
    .map((item) => {
      if (!item.product_id) return "";
      return productTypeById[item.product_id] || "";
    })
    .filter(Boolean);

  const types = uniq([...directTypes, ...fetchedTypes]);
  const email = payload.email || payload.customer?.email || "non-logged-in";
  const orderId = payload.id || null;
  const url = payload.order_status_url || `https://${shop}/admin/orders/${orderId}`;

  try {
    await prisma.userEvent.create({
      data: {
        shop,
        email,
        eventType: "product_type_paid",
        url,
        deviceType: null,
        eventData: {
          types,
          orderId,
          orderName: payload.name || null,
        },
      },
    });
  } catch (err) {
    console.error("ORDERS_PAID analytics DB error", err);
  }

  return new Response();
};
