# VVIP Code → Imessage Console — integration spec (DRAFT)

**Status: not built.** Prepared so it can be wired quickly once the Imessage Console side is ready.
Nothing in the retention console depends on this — the campaign runs manually without it.

**Owner (our side):** ATL · groupb-tracker retention console
**Owner (their side):** AI Team · Imessage Console

---

## 1. What we are trying to do

Every campaign day the retention console already works out **which team is on**, **which tier**, and
**exactly which players** are in the pool — split into two code groups. Today someone downloads two
CSVs per brand and uploads them to BO by hand.

We want the console to hand that list straight to the Imessage Console, and for the Imessage Console
to send the announcement. No CSV, no manual upload.

**We provide the audience. You own the message, branding, languages and delivery.**

---

## 2. Sequence

| Time (MYT) | What happens | Who |
|---|---|---|
| 15:00 (prev day) | Player feed lands, snapshot stamped | existing |
| 00:00 | Auto-create: rotation decides team + tier, pool split per brand | us |
| 00:01 | Push audience per brand → your Lists | **new** |
| 00:05 | Trigger broadcast → you send | **new** |
| all day | CS verifies RM100+ deposit, releases the code | us |

The 5-minute gap is deliberate — it gives the push time to fail loudly before anything sends.

**Pool freshness:** the pool is drawn from the previous day's 15:00 snapshot, so it is about 9 hours
old at send time. That is fine for tier membership, which does not change intraday.

---

## 3. 🔴 The one rule that cannot bend

**The broadcast must NOT contain the redeem code.**

The promotion is *deposit RM100+, then claim a code worth up to RM18*. The code is released by CS
only after they verify the deposit. If the blast carries the code, the RM100 gate disappears and
anyone can redeem without depositing.

The message should say *what is available*, not *what the code is*. Something like:
"Deposit RM100 today and claim your surprise code — up to RM18 credit."

Every player in the audience already has a code assigned on our side. They just cannot have it yet.

---

## 4. What we send

One audience per **brand**, per **day**. On a typical day that is 4–5 brands for the scheduled team.

Two directions are possible. **Pull is probably easier for you** — pick whichever suits.

### Option A — we push to you

```
POST {imessage_base}/api/lists/replace
Authorization: Bearer {token you issue us}
Content-Type: application/json

{
  "list_key":  "vvip-code-2026-07-26-BM69",
  "bo":        "ZYRA-BO",
  "brand":     "BM69",
  "promo":     "vvip-code",
  "event_date":"2026-07-26",
  "tier":      "V",
  "members":   [ { "uid": "10000001" }, { "uid": "10000002" } ]
}
```

Then:

```
POST {imessage_base}/api/broadcasts
{
  "slot":      "vvip-code",
  "list_key":  "vvip-code-2026-07-26-BM69",
  "send_at":   "2026-07-26T00:05:00+08:00"
}
```

### Option B — you pull from us

We expose a read-only endpoint; you fetch on your own schedule.

```
GET https://groupb-tracker-api.viprtn.workers.dev/api/rtn/campaign/audience
      ?date=2026-07-26&brand=BM69
Authorization: Bearer {token we issue you}

200 {
  "event_date": "2026-07-26",
  "brand":      "BM69",
  "bo":         "ZYRA-BO",
  "tier":       "V",
  "promo":      "vvip-code",
  "count":      149,
  "uids":       ["10000001", "10000002", "..."]
}
```

Or without `brand`, to get every brand scheduled that day in one call.

`replace` semantics either way: the list for a given `list_key` is the whole audience for that day.
Re-sending it must overwrite, not append.

---

## 5. Identity

We key on **uid**, the same number BO's *Target Type → Users* upload uses. Confirmed formats from
live data:

| Brand | uid length | Example |
|---|---|---|
| BM69 | 8 | `10000001` |
| HOT321 | 5–6 | `100180` |
| RM68 | 5–6 | `114629` |
| SK69 | 5–6 | `131470` |
| JK32 | 2–8 | `12` … `32635563` |

**Send them as strings, never as numbers.** JK32 has 2-digit uids and some tooling will strip or
reformat them. No padding, no scientific notation.

**Brands with no uid are excluded automatically.** All TC brands (LPK777, ACE33, JOM99, PP96,
SPIN321, MY36) plus OMG67 ship no uid, so they can never appear in a VVIP Code audience — the
console refuses to build a pool for them.

**Question for you:** do your Lists key on the same uid, or on a username / internal id? If it is a
different key we need a mapping before any of this works.

---

## 6. Coordination with your existing slots

Your Content tab already runs **Top 10 P&L**, **Top 20 DP**, **LTV** and **Grace Period**. A VIP
could land in several on the same morning.

The campaign proposal (§6) has department-wide coordination rules to prevent double-crediting the
same deposit. Before we go live we need to know:

- What do **Thresholds** actually enforce — max sends per player per day, per week?
- If a player is already in Top 10 P&L today, does VVIP Code get suppressed, queued, or sent anyway?
- Who wins if two promos target the same player?

Someone receiving three promo messages before breakfast is worse than receiving none.

---

## 7. Failure handling

- **Push fails** → we retry twice, then log and alert. **No broadcast is triggered.** A campaign day
  with no blast is recoverable; a blast to the wrong audience is not.
- **Partial push** → treat the list as invalid. Do not send a half audience.
- **Broadcast trigger fails** → the audience is already stored, so it can be sent manually from your
  UI. We will still have the CSV path as a fallback.
- **We send the same list twice** → must be idempotent on `list_key`. Second push replaces, and does
  not double-send.

---

## 8. What we need from you

1. Is there an API to create/replace a **List**? If yes, the endpoint and payload shape.
2. Can a **Broadcast** be triggered by API, or only from the UI?
3. What identifier do your Lists key on — uid, username, or something else?
4. Auth method: bearer token, IP allowlist, signed request?
5. What do **Thresholds** enforce, and how would VVIP Code interact with the existing four slots?
6. Do you prefer **push** (option A) or **pull** (option B)?
7. Can a slot be created for **vvip-code**, per BO (ZYRA-BO only), with EN / ZH / MS variants?
8. Is there a sandbox or test list we can push to without sending anything real?

---

## 9. Our side — what is already done

- Pool selection, crypto shuffle and 50/50 split: **live**
- Per-brand UID lists with no overlap, enforced by a database constraint: **live**
- Rotation calendar deciding team + tier per day: **live**
- 00:00 auto-create of draft events: **live, switched off until go-live**
- CSV export in BO's `user_id` format: **live**
- Code release with deposit verification and attribution: **live**

The only new work on our side is the push (or the pull endpoint) and the trigger. Small, once
questions 1–6 are answered.

## Related

- [[VVIP_CODE_CONTENT_BRIEF]] — copy brief
- [[REDEEM_CODE_FLOOR_SOP]] — floor SOP
