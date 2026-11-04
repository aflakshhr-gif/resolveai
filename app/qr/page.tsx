"use client";

import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Check, Copy, Printer } from "lucide-react";
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

  return <main className="ra-qr">
    <header>
      <Link href="/" className="ra-brand"><b>✳</b> Resolve<span>AI</span></Link>
      <Link href="/"><ArrowLeft size={15}/> Website</Link>
    </header>
    <section>
      <small>PRIVATE TEAM ACCESS</small>
      <h1>Open ResolveAI on your phone</h1>
      <p>Scan this code with your phone camera to open the secure sign-in page. New users can request an account; private workspace access requires administrator approval. Existing teammates can sign in or use their invitation link.</p>
      <div className="ra-code">
        <QRCodeSVG value={TARGET} size={240} level="H" includeMargin title="ResolveAI sign-in QR code"/>
      </div>
      <div className="ra-url">
        <span>{TARGET}</span>
        <button type="button" onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>}</button>
      </div>
      <div className="ra-actions">
        <button className="ra-button ra-primary" type="button" onClick={() => window.print()}><Printer size={15}/> Print QR</button>
        <InstallButton/>
      </div>
      <aside>
        <b>Install the web app after opening</b>
        <p>Android: browser menu → Install app. iPhone: Share → Add to Home Screen. The QR opens the web sign-in page; it does not install a native app from an app store.</p>
      </aside>
      <Link href="/login/" className="ra-direct">Continue to team sign in</Link>
    </section>
    <footer>Share this QR only with people who should request or receive access to the private workspace.</footer>
  </main>;
}
