import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, apiVersion } from "../shopify.server";

/** Пускаємо тільки авторизованого адміна і віддаємо мету для Home */
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const meta = {
    appName: "Wheel of Fortune — VADERTEK corp.",
    version:
      process.env.APP_VERSION ||
      process.env.npm_package_version ||
      "dev",
    apiVersion: String(apiVersion || "unknown"),
    env: process.env.NODE_ENV || "development",
    buildTime: new Date().toISOString(),
  };

  // Мінімальний changelog (пізніше можна підміняти з БД)
  const changelog = [
    {
      date: "2025-02-24",
      title: "Release Alpha Version",
      items: ["Запуск апки в стор", "Активація в кастомайзі"],
    },
    {
      date: "2025-02-24",
      title: "Settings: ON/OFF",
      items: ["Додано тумблер увімкн./вимкн. віджета", "Збереження у Prisma"],
    },
    {
      date: "2025-02-23",
      title: "Початковий шаблон",
      items: ["Генерація продуктів через Admin GraphQL", "Початкова структура апки"],
    },
  ];

  return { meta, changelog };
};

export default function Home() {
  const { meta, changelog } = useLoaderData();

  return (
    <s-page heading={meta.appName}>
      {/* Hero / Опис */}
      <s-section>
        <s-paragraph>
          Легка апка для розіграшу знижок через віджет <b>Wheel of Fortune</b>.
          Керуйте показом колеса на вітрині, відстежуйте результати та інтегруйтеся з вашими
          інструментами маркетингу.
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
      <s-section heading="Версії">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="tight">
            <s-paragraph><b>App version:</b> {meta.version}</s-paragraph>
            <s-paragraph><b>Shopify Admin API:</b> {meta.apiVersion}</s-paragraph>
            <s-paragraph><b>Environment:</b> {meta.env}</s-paragraph>
            <s-paragraph><b>Build time:</b> {meta.buildTime}</s-paragraph>
          </s-stack>
        </s-box>
      </s-section>

      {/* Changelog */}
      <s-section heading="Зміни">
        <s-unordered-list>
          {changelog.map((entry) => (
            <s-list-item key={entry.date}>
              <s-heading>{entry.title} — <small>{entry.date}</small></s-heading>
              <s-unordered-list>
                {entry.items.map((t, i) => (
                  <s-list-item key={i}>{t}</s-list-item>
                ))}
              </s-unordered-list>
            </s-list-item>
          ))}
        </s-unordered-list>
      </s-section>

      {/* Корисні лінки / Support */}
      <s-section slot="aside" heading="Посилання">
        <s-unordered-list>
          <s-list-item>
            <s-link href="/app/settings">Налаштування (Settings)</s-link>
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
            <s-link
              href="https://www.prisma.io/docs"
              target="_blank"
            >
              Prisma docs
            </s-link>
          </s-list-item>
        </s-unordered-list>
      </s-section>

      <s-section slot="aside" heading="Підтримка">
        <s-paragraph>
          Питання/ідеї: <s-link href="mailto:support@vadertek.io">p.leiko@vadertek.io</s-link>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
