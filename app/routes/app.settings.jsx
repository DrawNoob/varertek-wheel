// app.routes/app.settings.jsx
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async () => {
  return {};
};

export const action = async () => {
  return {};
};

export const headers = (h) => boundary.headers(h);

export default function SettingsPage() {
  return (
    <s-page heading="Налаштування">
      <s-section>
        <s-paragraph>
          Тут поки що немає налаштувань.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
