/**
 * ResolveAI email bridge for password recovery and new-account verification.
 *
 * Deploy as a Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Script Properties:
 *   RESOLVEAI_SHARED_SECRET
 *   RESOLVEAI_ALLOWED_ORIGINS
 *
 * The public endpoint requires a long random secret. It only sends two fixed
 * transactional message types and accepts links on explicitly allowed origins.
 * Do not log request bodies, secrets, recipient addresses, or one-time tokens.
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

    const type = typeof payload.type === "string" ? payload.type : "";
    const actionUrl = typeof payload.action_url === "string" ? payload.action_url : "";
    if (!isAllowedActionUrl(actionUrl, type, props.getProperty("RESOLVEAI_ALLOWED_ORIGINS") || "")) {
      return jsonResponse({ ok: false, error: "Invalid action URL." });
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonResponse({ ok: false, error: "Daily email quota exhausted." });
    }

    let subject;
    let textBody;
    let htmlBody;
    if (type === "password_reset") {
      subject = "Reset your ResolveAI password";
      textBody =
        "A password reset was requested for your ResolveAI account.\n\n" +
        "Create a new password using this one-time link (valid for 30 minutes):\n" +
        actionUrl +
        "\n\nIf you did not request this change, you can ignore this email.";
      htmlBody =
        '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">' +
        "<h2>Reset your ResolveAI password</h2>" +
        "<p>We received a request to create a new password for your ResolveAI account.</p>" +
        '<p><a href="' + escapeHtml(actionUrl) +
        '" style="display:inline-block;padding:12px 18px;background:#172033;color:#fff;text-decoration:none;border-radius:8px">Create a new password</a></p>' +
        "<p>This link expires in 30 minutes and can be used once. If you did not request this change, you can ignore this email.</p>" +
        "</div>";
    } else if (type === "email_verification") {
      subject = "Verify your ResolveAI email";
      textBody =
        "Verify your email address for ResolveAI using this one-time link (valid for 24 hours):\n" +
        actionUrl +
        "\n\nIf you did not create a ResolveAI account, you can ignore this email.";
      htmlBody =
        '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">' +
        "<h2>Verify your email address</h2>" +
        "<p>Confirm this email address to finish creating your ResolveAI account.</p>" +
        '<p><a href="' + escapeHtml(actionUrl) +
        '" style="display:inline-block;padding:12px 18px;background:#172033;color:#fff;text-decoration:none;border-radius:8px">Verify email address</a></p>' +
        "<p>This link expires in 24 hours and can be used once. If you did not create a ResolveAI account, you can ignore this email.</p>" +
        "</div>";
    } else {
      return jsonResponse({ ok: false, error: "Unsupported message type." });
    }

    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: textBody,
      htmlBody: htmlBody,
      name: "ResolveAI"
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("ResolveAI mailer failed: " + (err && err.name ? err.name : "Error"));
    return jsonResponse({ ok: false, error: "Email delivery failed." });
  }
}

function isValidEmail(value) {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedActionUrl(value, type, configuredOrigins) {
  if (typeof value !== "string" || value.length > 1200) return false;
  const match = value.match(/^(https:\/\/[^/?#]+)\/login\/\?([a-z_]+)=([A-Za-z0-9_-]{32,128})$/);
  if (!match) return false;

  const expectedParameter = type === "password_reset"
    ? "reset_token"
    : type === "email_verification"
      ? "verify_token"
      : "";
  if (!expectedParameter || match[2] !== expectedParameter) return false;

  const allowed = configuredOrigins
    .split(",")
    .map(function (origin) { return origin.trim().replace(/\/$/, ""); })
    .filter(function (origin) { return /^https:\/\/[A-Za-z0-9.-]+$/.test(origin); });

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
