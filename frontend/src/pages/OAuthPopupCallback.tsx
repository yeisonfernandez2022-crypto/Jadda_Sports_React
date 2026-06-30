import { useEffect } from "react";

export default function OAuthPopupCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const user = params.get("user");
    const photo = params.get("photo");

    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth-success", user, photo },
        window.location.origin
      );
    }
    window.close();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        color: "#64748b",
      }}
    >
      Autenticando...
    </div>
  );
}
