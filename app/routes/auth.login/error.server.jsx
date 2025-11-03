// app/routes/auth.login/error.server.jsx

// це очікує твій route.jsx
export function loginErrorMessage(error) {
  // можна потім розумніше розпарсити, але для початку так
  return "Authentication failed. Please try again.";
}

// це стандартний ErrorBoundary, щоб Remix не падав
export function ErrorBoundary() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Authentication error</h2>
      <p>Something went wrong during Shopify auth.</p>
    </div>
  );
}
