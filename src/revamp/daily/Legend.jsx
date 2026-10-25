// "?" terms explainer for the Contact page. Text copied word for word from the live Queue legend (App.jsx).
import React from "react";

export default function Legend() {
  return (
    <div className="card">
      <div className="body" style={{ display: "grid", gap: 6 }}>
        <div><b>DSLD</b> — Days Since Last Deposit. Higher = longer since they funded.</div>
        <div><b>Lifetime PNL</b> — the player's net result. Negative = they've lost overall = your highest-value customer.</div>
        <div><b>Tier 3 vs Tier V</b> — Tier 3 = VVIP 1–3 (volume). Tier V = VVIP 4–7 (top whales, personal handling).</div>
        <div><b>♛ Whale</b> — top-value Tier V player. Handle personally, never a generic blast.</div>
        <div><b>FRAGILE</b> — reactivated in the last 14 days. Soften everything: smaller ask, warmer tone.</div>
      </div>
    </div>
  );
}
