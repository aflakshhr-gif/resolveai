export default function OfflinePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f8fc", color: "#252d40", fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 420, textAlign: "center", background: "#fff", border: "1px solid #eceef3", borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: 36, color: "#635bff" }}>✳</div>
        <h1>You're offline</h1>
        <p style={{ color: "#737d90", lineHeight: 1.6 }}>ResolveAI cannot reach the network right now. Check your connection and try again.</p>
        <a href="/" style={{ color: "#635bff", fontWeight: 700 }}>Try again</a>
      </section>
    </main>
  );
}
