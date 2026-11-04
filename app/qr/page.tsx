"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Check, Copy, LockKeyhole, Printer, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import InstallButton from "../install-button";

const TARGET = "https://resolveai.aflakshhr.workers.dev/login/";

export default function QrPage() {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(TARGET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="rx-qr-page">
      <header className="rx-qr-header">
        <Link href="/website/" className="rx-brand">
          <span className="rx-brand-mark"><Sparkles size={18}/></span>
          <span className="rx-brand-word">Resolve<span>AI</span></span>
        </Link>
        <Link href="/website/" className="rx-qr-back"><ArrowLeft size={15}/> Back to website</Link>
      </header>

      <section className="rx-qr-grid">
        <div className="rx-qr-copy">
          <div className="rx-auth-kicker"><span/> PRIVATE TEAM ACCESS</div>
          <h1>Bring your team<br/><em>closer to the work.</em></h1>
          <p>Scan the code with your phone camera to open the secure ResolveAI sign-in page. Existing teammates can sign in, and new users can request an account for administrator review.</p>

          <div className="rx-qr-benefits">
            <div><span><LockKeyhole size={17}/></span><div><b>Secure sign-in</b><small>Opens the official ResolveAI login page.</small></div></div>
            <div><span><ShieldCheck size={17}/></span><div><b>Reviewed access</b><small>Private workspace access follows approval.</small></div></div>
            <div><span><Smartphone size={17}/></span><div><b>Installable web app</b><small>Add ResolveAI to your device from a supported browser.</small></div></div>
          </div>
          <Link href="/login/" className="rx-qr-direct">Continue in this browser <ArrowRight size={15}/></Link>
        </div>

        <div className="rx-qr-card">
          <div className="rx-qr-card-head">
            <div><span className="rx-section-kicker">SCAN TO OPEN</span><h2>ResolveAI access</h2></div>
            <span className="rx-qr-shield"><LockKeyhole size={18}/></span>
          </div>
          <div className="rx-qr-code-frame">
            <div className="rx-qr-corner rx-corner-tl"/><div className="rx-qr-corner rx-corner-tr"/><div className="rx-qr-corner rx-corner-bl"/><div className="rx-qr-corner rx-corner-br"/>
            <QRCodeSVG value={TARGET} size={244} level="H" includeMargin title="ResolveAI sign-in QR code"/>
          </div>
          <div className="rx-qr-scan-label"><span/> Ready to scan with your camera</div>
          <div className="rx-qr-url">
            <div><small>SECURE SIGN-IN ADDRESS</small><span>{TARGET}</span></div>
            <button type="button" onClick={copy} aria-label="Copy sign-in link">{copied ? <Check size={16}/> : <Copy size={16}/>}</button>
          </div>
          {copied && <div className="rx-qr-copied" role="status">Link copied to clipboard.</div>}
          <div className="rx-qr-actions">
            <button className="rx-qr-print" type="button" onClick={() => window.print()}><Printer size={15}/> Print QR</button>
            <InstallButton/>
          </div>
          <div className="rx-qr-note">
            <b>Install after opening</b>
            <p>Android: browser menu → Install app. iPhone: Share → Add to Home Screen. This QR opens the web sign-in page; it does not install a native app from an app store.</p>
          </div>
        </div>
      </section>

      <footer className="rx-qr-footer">
        <span>ResolveAI · Private support workspace</span>
        <span>Share this code only with people who should request or receive access.</span>
      </footer>
    </main>
  );
}
