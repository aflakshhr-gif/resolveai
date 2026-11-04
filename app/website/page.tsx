import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Inbox,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import InstallButton from "../install-button";

export const metadata = {
  title: "ResolveAI | A calmer support workspace",
  description:
    "Keep customer-support conversations organized in a private team workspace, with clear statuses, internal notes and practical next steps.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "ResolveAI | A calmer support workspace",
    description:
      "A focused, private workspace for organizing support conversations and team follow-through.",
    type: "website",
  },
};

const features = [
  {
    icon: Inbox,
    number: "01",
    title: "One focused inbox",
    body: "Bring support conversations into a shared view, so the team can see what needs attention.",
  },
  {
    icon: Activity,
    number: "02",
    title: "Clear conversation status",
    body: "Track progress with simple states and keep the next action visible to the team.",
  },
  {
    icon: MessageSquareText,
    number: "03",
    title: "Useful internal context",
    body: "Save internal notes alongside a conversation without presenting them as customer-delivered replies.",
  },
  {
    icon: ShieldCheck,
    number: "04",
    title: "Private team access",
    body: "Account requests and invitations are reviewed before a member can enter the private workspace.",
  },
];

const steps = [
  {
    number: "01",
    title: "Read the full context",
    body: "Open a conversation and review its history in one place.",
  },
  {
    number: "02",
    title: "Keep the status current",
    body: "Make ownership and progress easier for the team to understand.",
  },
  {
    number: "03",
    title: "Leave a useful handoff",
    body: "Add an internal note so the next teammate has the context they need.",
  },
];

export default function WebsitePage() {
  return (
    <main className="rx-site">
      <div className="rx-ambient rx-ambient-one" aria-hidden="true" />
      <div className="rx-ambient rx-ambient-two" aria-hidden="true" />

      <header className="rx-nav rx-shell">
        <Link href="/" className="rx-brand" aria-label="ResolveAI home">
          <span className="rx-brand-mark">
            <Sparkles size={19} strokeWidth={2.2} />
          </span>
          <span className="rx-brand-word">Resolve<span>AI</span></span>
        </Link>

        <nav className="rx-nav-links" aria-label="Main navigation">
          <a href="#features">Platform</a>
          <a href="#workflow">How it works</a>
          <a href="#access">Security</a>
        </nav>

        <div className="rx-nav-actions">
          <Link href="/login/" className="rx-nav-login">Sign in</Link>
          <Link href="/login/" className="rx-button rx-button-dark rx-nav-cta">
            Request access <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>

      <section className="rx-hero rx-shell">
        <div className="rx-hero-copy">
          <div className="rx-eyebrow">
            <span className="rx-eyebrow-pulse" />
            PRIVATE SUPPORT WORKSPACE
          </div>
          <h1>
            Support that feels
            <span> more in control.</span>
          </h1>
          <p className="rx-hero-description">
            A considered workspace for the conversations behind great support.
            Keep context close, progress visible and your team working from the same place.
          </p>

          <div className="rx-hero-actions">
            <Link href="/login/" className="rx-button rx-button-primary">
              Request team access <ArrowRight size={17} />
            </Link>
            <a href="#product-preview" className="rx-button rx-button-quiet">
              Explore the workspace
            </a>
          </div>

          <div className="rx-trust-row">
            <span><CheckCircle2 size={15} /> Reviewed team access</span>
            <i />
            <span><LockKeyhole size={15} /> Private workspace</span>
          </div>
        </div>

        <div className="rx-visual" id="product-preview">
          <div className="rx-visual-halo" aria-hidden="true" />
          <div className="rx-product-window">
            <div className="rx-window-bar">
              <div className="rx-window-dots"><i /><i /><i /></div>
              <div className="rx-window-address"><LockKeyhole size={10} /> app.resolveai / inbox</div>
              <span className="rx-window-live"><span /> Workspace</span>
            </div>

            <div className="rx-app-screen" dir="ltr">
              <aside className="rx-app-rail">
                <div className="rx-app-symbol"><Sparkles size={16} /></div>
                <div className="rx-rail-item active"><Inbox size={16} /></div>
                <div className="rx-rail-item"><Users size={16} /></div>
                <div className="rx-rail-item"><Workflow size={16} /></div>
                <div className="rx-rail-spacer" />
                <div className="rx-rail-avatar">R</div>
              </aside>

              <div className="rx-app-main">
                <div className="rx-app-heading">
                  <div>
                    <small>TEAM WORKSPACE</small>
                    <h2>Inbox</h2>
                  </div>
                  <span className="rx-team-chip"><span /> Private</span>
                </div>

                <div className="rx-app-panels">
                  <section className="rx-preview-list" aria-label="Illustrative conversation list">
                    <div className="rx-list-title">
                      <b>Conversations</b>
                      <span>Recent</span>
                    </div>
                    <article className="rx-preview-thread selected">
                      <span className="rx-preview-avatar avatar-teal">JM</span>
                      <div><b>Jamie Morgan</b><small>Account access</small><em>Open</em></div>
                    </article>
                    <article className="rx-preview-thread">
                      <span className="rx-preview-avatar avatar-sand">AS</span>
                      <div><b>Alex Stone</b><small>Order question</small><em className="state-wait">Waiting</em></div>
                    </article>
                    <article className="rx-preview-thread">
                      <span className="rx-preview-avatar avatar-blue">TR</span>
                      <div><b>Taylor Reed</b><small>Billing details</small><em className="state-done">Resolved</em></div>
                    </article>
                  </section>

                  <section className="rx-preview-conversation" aria-label="Illustrative conversation">
                    <div className="rx-conversation-heading">
                      <span className="rx-preview-avatar avatar-teal">JM</span>
                      <div><b>Jamie Morgan</b><small>Account access · Today</small></div>
                      <span className="rx-status-open">Open</span>
                    </div>
                    <div className="rx-message-stack">
                      <div className="rx-message rx-message-in">
                        Hi, I need a little help getting back into my account.
                      </div>
                      <div className="rx-message rx-message-out">
                        <span className="rx-draft-tag">UNSENT DRAFT · NOT DELIVERED</span>
                        Of course. I’ll review the details and follow up.
                      </div>
                      <div className="rx-internal-note">
                        <span><LockKeyhole size={11} /> INTERNAL NOTE</span>
                        Check the account history before the next handoff.
                      </div>
                    </div>
                    <div className="rx-composer">
                      <span>Internal note</span>
                      <span className="rx-composer-action">Add note</span>
                    </div>
                  </section>

                  <aside className="rx-preview-insights">
                    <div className="rx-insight-head"><Sparkles size={13} /> Copilot</div>
                    <small>RULE-BASED GUIDANCE</small>
                    <div className="rx-insight-card">
                      <span className="rx-insight-icon"><Activity size={13} /></span>
                      <b>Review context</b>
                      <p>Check recent account activity.</p>
                    </div>
                    <div className="rx-insight-card">
                      <span className="rx-insight-icon soft"><CheckCircle2 size={13} /></span>
                      <b>Next step</b>
                      <p>Leave a clear internal handoff.</p>
                    </div>
                    <div className="rx-insight-foot">Suggestions are rule-based</div>
                  </aside>
                </div>
              </div>
            </div>
          </div>

          <div className="rx-float-card">
            <span className="rx-float-icon"><ShieldCheck size={17} /></span>
            <span><b>Team-only by design</b><small>Access follows approval</small></span>
          </div>
          <div className="rx-visual-caption">A preview of the ResolveAI workspace</div>
        </div>
      </section>

      <section className="rx-assurance">
        <div className="rx-shell rx-assurance-inner">
          <span>BUILT AROUND THE WORK</span>
          <div><Inbox size={17} /> Shared conversation view</div>
          <div><Activity size={17} /> Visible progress</div>
          <div><LockKeyhole size={17} /> Reviewed access</div>
        </div>
      </section>

      <section id="features" className="rx-section rx-features rx-shell">
        <div className="rx-section-heading">
          <div>
            <span className="rx-section-kicker">THE WORKSPACE</span>
            <h2>Less scattered.<br /><span>More considered.</span></h2>
          </div>
          <p>
            The essentials for a team that needs a reliable view of its support work,
            without adding noise or pretending every task is automated.
          </p>
        </div>

        <div className="rx-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="rx-feature-card" key={feature.number}>
                <div className="rx-feature-top">
                  <span className="rx-feature-icon"><Icon size={19} /></span>
                  <small>{feature.number}</small>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <span className="rx-feature-line" />
              </article>
            );
          })}
        </div>
      </section>

      <section id="workflow" className="rx-workflow-section">
        <div className="rx-shell rx-workflow-layout">
          <div className="rx-workflow-copy">
            <span className="rx-section-kicker">A SIMPLE RHYTHM</span>
            <h2>Keep the work moving,<br /><span>one clear step at a time.</span></h2>
            <p>
              ResolveAI gives the team a shared place to understand a conversation,
              update its progress and leave useful context for the next person.
            </p>
            <div className="rx-steps">
              {steps.map((step) => (
                <div className="rx-step" key={step.number}>
                  <span>{step.number}</span>
                  <div><b>{step.title}</b><p>{step.body}</p></div>
                </div>
              ))}
            </div>
          </div>

          <div className="rx-workflow-art" aria-label="Illustration of a team handoff">
            <div className="rx-workflow-glow" />
            <div className="rx-flow-card rx-flow-card-main">
              <div className="rx-flow-card-head"><span className="rx-flow-icon"><MessageSquareText size={17} /></span><span>CONVERSATION</span><i>Open</i></div>
              <b>Account access question</b>
              <p>Context stays with the conversation.</p>
              <div className="rx-flow-divider" />
              <div className="rx-flow-note"><LockKeyhole size={14} /><span><b>Internal note</b><small>Handoff context saved for the team</small></span><CheckCircle2 size={15} /></div>
            </div>
            <div className="rx-flow-card rx-flow-card-mini">
              <span className="rx-mini-check"><CheckCircle2 size={16} /></span>
              <span><b>Status updated</b><small>Progress is visible to the team</small></span>
            </div>
            <div className="rx-orbit rx-orbit-one" />
            <div className="rx-orbit rx-orbit-two" />
          </div>
        </div>
      </section>

      <section id="access" className="rx-access-section">
        <div className="rx-shell rx-access-card">
          <div className="rx-access-copy">
            <span className="rx-section-kicker rx-kicker-light">PRIVATE BY DEFAULT</span>
            <h2>A shared workspace.<br /><span>Not an open door.</span></h2>
            <p>
              New teammates can request an account. Access to private team areas
              follows an administrator review, keeping the workspace for the people
              who are meant to use it.
            </p>
            <Link href="/login/" className="rx-button rx-button-light">
              Request team access <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="rx-access-visual">
            <div className="rx-access-orb"><LockKeyhole size={34} /></div>
            <div className="rx-access-list">
              <div><CheckCircle2 size={16} /><span>Account request received</span></div>
              <div><CheckCircle2 size={16} /><span>Administrator review</span></div>
              <div><CheckCircle2 size={16} /><span>Private workspace access</span></div>
            </div>
            <span className="rx-access-caption">A considered path into the team</span>
          </div>
        </div>
      </section>

      <section className="rx-install-section rx-shell">
        <div className="rx-install-icon"><Smartphone size={23} /></div>
        <div className="rx-install-copy">
          <span className="rx-section-kicker">READY WHEN YOU ARE</span>
          <h2>Your workspace, a tap away.</h2>
          <p>Use ResolveAI in your browser or install the web app on a supported device.</p>
        </div>
        <div className="rx-install-action"><InstallButton /></div>
      </section>

      <footer className="rx-footer">
        <div className="rx-shell rx-footer-inner">
          <Link href="/" className="rx-brand">
            <span className="rx-brand-mark"><Sparkles size={18} /></span>
            <span className="rx-brand-word">Resolve<span>AI</span></span>
          </Link>
          <span className="rx-footer-note">A calmer workspace for support teams.</span>
          <div className="rx-footer-links">
            <Link href="/qr/">QR access</Link>
            <Link href="/login/">Team sign in</Link>
            <a href="#features">Platform</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
