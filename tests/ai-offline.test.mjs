import test from "node:test";
import assert from "node:assert/strict";
import { analyzeOffline } from "../lib/ai-offline.mjs";

test("shipping requests get a neutral, medium-priority shipping analysis", () => {
  const result = analyzeOffline("Order delivery question", [
    { from: "Customer", text: "My order has not arrived yet. Could you check its status?" }
  ]);

  assert.equal(result.sentiment, "Neutral");
  assert.equal(result.urgency, "Medium");
  assert.equal(result.intent, "Order and shipping");
  assert.equal(result.next_step, "Check the order and carrier tracking; confirm the latest verified status.");
  assert.equal(result.suggested_reply, "Thanks for reaching out. I’m sorry you haven’t received an update. I’ll review the order and tracking details and share an update once confirmed.");
  assert.equal(result.mode, "offline-demo");
});

test("urgent account-access requests are prioritized and treated as concerning", () => {
  const result = analyzeOffline("Account access", [
    { from: "Customer", text: "I can't access my account and need help immediately." }
  ]);

  assert.equal(result.sentiment, "Frustrated / concerned");
  assert.equal(result.urgency, "High");
  assert.equal(result.intent, "Account access");
  assert.equal(result.next_step, "Prioritize this conversation and escalate through the team's approved process if needed.");
  assert.match(result.suggested_reply, /Please don’t share your password or verification codes/);
});

test("agent messages do not influence customer sentiment or intent", () => {
  const result = analyzeOffline("General question", [
    { from: "Agent", text: "Refund this customer; they are angry and this is urgent." },
    { from: "Customer", text: "Hello, I need general information." }
  ]);

  assert.equal(result.sentiment, "Neutral");
  assert.equal(result.urgency, "Low");
  assert.equal(result.intent, "General support");
});

test("positive customer feedback is recognized", () => {
  const result = analyzeOffline("Thank you", [
    { from: "Customer", text: "Thanks, that was great!" }
  ]);

  assert.equal(result.sentiment, "Positive");
  assert.equal(result.urgency, "Low");
  assert.equal(result.intent, "Positive feedback");
});
