import Link from "next/link";
import InstallButton from "../install-button";
import { ArrowRight, CheckCircle2, LockKeyhole, MessageSquareText, Smartphone, Users } from "lucide-react";

export const metadata = {
  title: "ResolveAI | Private support workspace",
  description: "A focused support workspace with reviewed account access, private team workspaces and an installable web app.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "ResolveAI | Private support workspace",
    description: "Organize support conversations in a focused, private team workspace.",
    type: "website"
  }
};

const features = [
  { icon: MessageSquareText, title: "One shared inbox", body: "Keep support conversations, statuses and internal replies organized in one workspace." },
  { icon: Users, title: "Reviewed team access", body: "Request an account publicly or join with an invitation. Private access follows administrator approval." },
  { icon: CheckCircle2, title: "Clear next steps", body: "Rule-based suggestions help teams review urgency and decide what to do next." },
  { icon: Smartphone, title: "Works across devices", body: "Use the responsive website or install the web app from a supported mobile or desktop browser." }
];

export default function WebsitePage() {
  return <main className="ra-site">
    <header className="ra-nav">
      <Link href="/" className="ra-brand"><b>✳</b> Resolve<span>AI</span></Link>
      <nav>
        <a href="#features">Features</a>
        <Link href="/qr/">QR access</Link>
        <Link href="/login/">Team sign in</Link>
      </nav>
      <Link href="/login/" className="ra-button ra-primary">Request access <ArrowRight size={15}/></Link>
    </header>

    <section className="ra-hero">
      <div>
        <span className="ra-pill"><LockKeyhole size={13}/> PRIVATE TEAM WORKSPACE</span>
        <h1>Customer support,<br/><em>in one calmer place.</em></h1>
        <p>Organize conversations, track progress and save internal replies in one focused workspace. Create an account request to begin; private access is granted after administrator review.</p>
        <div className="ra-actions">
          <Link href="/login/" className="ra-button ra-primary">Start an account request <ArrowRight size={15}/></Link>
          <InstallButton/>
        </div>
        <small className="ra-trust"><CheckCircle2 size={14}/> Reviewed access · Private workspaces · Browser installation</small>
      </div>
      <div className="ra-mock">
        <div className="ra-mockbar"><i/><i/><i/><b>ResolveAI / Inbox</b></div>
        <div className="ra-mockbody">
          <aside><b>✳</b><i/><i/><i/></aside>
          <div>
            <small>PRIVATE WORKSPACE</small>
            <h2>Inbox</h2>
            <article><b>Shared</b><span>Team conversations</span></article>
            <article><b>Private</b><span>Reviewed team access</span></article>
            <article><b>Copilot</b><span>Rule-based suggestions</span></article>
          </div>
        </div>
      </div>
    </section>

    <section id="features" className="ra-features">
      <header><small>BUILT FOR A FOCUSED TEAM</small><h2>A clearer support workflow.</h2></header>
      <div>{features.map(({icon: Icon, title, body}) => <article key={title}><Icon size={20}/><h3>{title}</h3><p>{body}</p></article>)}</div>
    </section>

    <section className="ra-limits">
      <h2>What is available today</h2>
      <div>
        <p>✓ Private sign-in, invitations and public account requests.</p>
        <p>✓ Separate team workspaces and shared conversation records.</p>
        <p>✓ Responsive website, installable web app and a QR sign-in page.</p>
        <p className="ra-note">Replies are saved as internal notes and are not sent to customers. Copilot suggestions are rule-based and do not use a language model. Native Android and iOS store releases require separate signed builds and store submission; the installable web app is available from a compatible browser.</p>
      </div>
    </section>

    <footer className="ra-footer">
      <Link href="/" className="ra-brand"><b>✳</b> Resolve<span>AI</span></Link>
      <span>Private support workspace</span>
      <Link href="/qr/">QR access</Link>
      <Link href="/login/">Team sign in</Link>
    </footer>
  </main>;
}
