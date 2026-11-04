import Link from "next/link";
import { ArrowLeft, LifeBuoy, RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="rx-offline-page">
      <div className="rx-offline-glow" aria-hidden="true"/>
      <header className="rx-offline-brand">
        <span><LifeBuoy size={19}/></span>
        <b>Resolve<span>AI</span></b>
      </header>
      <section className="rx-offline-card">
        <div className="rx-offline-icon"><WifiOff size={27}/></div>
        <span className="rx-section-kicker">CONNECTION INTERRUPTED</span>
        <h1>You're offline<br/><em>for the moment.</em></h1>
        <p>ResolveAI cannot reach the network right now. Your workspace data is protected. Check your connection, then try loading the page again.</p>
        <a href="/" className="rx-offline-retry"><RefreshCw size={15}/> Try again</a>
        <Link href="/website/" className="rx-offline-home"><ArrowLeft size={14}/> Back to ResolveAI website</Link>
      </section>
      <footer className="rx-offline-footer">ResolveAI · Private support workspace</footer>
    </main>
  );
}
