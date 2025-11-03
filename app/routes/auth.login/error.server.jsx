export function ErrorBoundary() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Authentication error</h2>
      <p>Something went wrong during Shopify auth.</p>
    </div>
  );
}
