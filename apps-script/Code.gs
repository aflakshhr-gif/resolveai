/**
 * ResolveAI password-reset email bridge.
 *
 * Deploy this project as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Configure Script Properties:
 *   RESOLVEAI_SHARED_SECRET     - random secret shared with Cloudflare Worker
 *   RESOLVEAI_ALLOWED_ORIGINS   - comma-separated exact HTTPS origins, e.g.
 *     https://resolveai.aflakshhr.workers.dev,
 *     https://feature-unit-membership-approval-resolveai.aflakshhr.workers.dev
 *
 * This endpoint is public by necessity, but accepts requests only with the
 * shared secret. It sends mail only to a syntactically valid recipient and
 * only for reset URLs hosted on explicitly allowed ResolveAI origins.
 */

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedSecret = props.getProperty("RESOLVEAI_SHARED_SECRET") || "";
    if (expectedSecret.length < 40) {
      return jsonResponse({ ok: false, error: "Mailer is not configured." });
    }

    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    if (!raw || raw.length > 12000) {
      return jsonResponse({ ok: false, error: "Invalid request." });
    }

    const payload = JSON.parse(raw);
    const providedSecret = typeof payload.secret === "string" ? payload.secret : "";
    if (!constantTimeEquals(expectedSecret, providedSecret)) {
      return jsonResponse({ ok: false, error: "Unauthorized." });
    }

    const recipient = typeof payload.to === "string" ? payload.to.trim() : "";
    if (!isValidEmail(recipient)) {
      return jsonResponse({ ok: false, error: "Invalid recipient." });
    }

    const resetUrl = typeof payload.reset_url === "string" ? payload.reset_url : "";
    if (!isAllowedResetUrl(resetUrl, props.getProperty("RESOLVEAI_ALLOWED_ORIGINS") || "")) {
      return jsonResponse({ ok: false, error: "Invalid reset URL." });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonResponse({ ok: false, error: "Daily email quota exhausted." });
    }

    const textBody =
      "A password reset was requested for your ResolveAI account.\n\n" +
      "Create a new password using this one-time link (valid for 30 minutes):\n" +
      resetUrl +
      "\n\nIf you did not request this change, you can ignore this email.";

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">' +
      "<h2>Reset your ResolveAI password</h2>" +
      "<p>We received a request to create a new password for your ResolveAI account.</p>" +
      '<p><a href="' + escapeHtml(resetUrl) +
      '" style="display:inline-block;padding:12px 18px;background:#172033;color:#fff;text-decoration:none;border-radius:8px">Create a new password</a></p>' +
      "<p>This link expires in 30 minutes and can be used once. If you did not request this change, you can ignore this email.</p>" +
      "</div>";

    MailApp.sendEmail({
      to: recipient,
      subject: "Reset your ResolveAI password",
      body: textBody,
      htmlBody: htmlBody,
      name: "ResolveAI"
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    // Do not log the request body, secret, recipient, or reset token.
    console.error("ResolveAI mailer failed: " + (err && err.name ? err.name : "Error"));
    return jsonResponse({ ok: false, error: "Email delivery failed." });
  }
}

function isValidEmail(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

function isAllowedResetUrl(value, configuredOrigins) {
  if (typeof value !== "string" || value.length > 1200) return false;
  const match = value.match(/^(https:\\/\\/[^/?#]+)\\/login\\/\\?reset_token=([A-Za-z0-9_-]{32,128})$/);
  if (!match) return false;

  const allowed = configuredOrigins
    .split(",")
    .map(function (origin) { return origin.trim().replace(/\\/$/, ""); })
    .filter(function (origin) { return /^https:\\/\\/[A-Za-z0-9.-]+$/.test(origin); });

  return allowed.indexOf(match[1]) !== -1;
}

function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
