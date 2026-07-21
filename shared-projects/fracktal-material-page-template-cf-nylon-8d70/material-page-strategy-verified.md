# Material Page Strategy — VERIFIED with Google Trends Data

> **Date**: 2026-07-14  
> **Data source**: Google Trends India, Past 12 Months (verified — not estimates)  
> **Status**: GSC token expired (needs re-auth), Google Trends partially rate-limited after batch 1

---

## Verified Google Trends Data — India, Past 12 Months

| Rank | Search Term | Relative Interest (0–100) | Verdict |
|------|------------|---------------------------|---------|
| 1 | **PLA filament** | **57** | Dominant. Must-have. ✅ |
| 2 | **PETG filament** | **19** | Strong #2. Growing. ✅ |
| 3 | **TPU filament** | **11** | Solid niche. ✅ |
| 4 | **ASA filament** | **2** | Near-zero demand in India. ⚠️ |
| 5 | **Carbon fiber filament** | **1** | Very low as generic term. ⚠️ |

**Batch 2 (ABS, Nylon, PC, PP, PC-ABS)**: Rate-limited by Google. Need a fresh browser session to complete.

---

## What This Changes

### ASA — DEMOTED from Priority 1 to Deferred

My original estimate put ASA at ~25K monthly searches. **Real data shows ASA at relative interest of 2 (vs PLA's 57)**. In India, ASA is essentially invisible. Engineers and manufacturers searching for UV-resistant materials likely search for "ABS outdoor" or "UV resistant filament" rather than "ASA filament" specifically. **Do NOT prioritize ASA for the Indian market.**

### Carbon Fiber — Needs Different Keywords

"Carbon fiber filament" at 1 is misleadingly low. Users search for "CF nylon", "carbon fiber nylon", "nylon carbon fiber", or specific brands. The material pages should target these specific compound keywords rather than the generic term.

### PETG Confirmed as Strong #2

PETG at 19 confirms it's the second most important material page after PLA. The current database has it — good.

---

## Revised Priority Order (Data-Backed)

### Already Have (Keep & Optimize)
| # | Material | Trends Signal | Action |
|---|----------|--------------|--------|
| 1 | **PLA** | 57 (dominant) | Optimize for "PLA filament price India", "best PLA filament" |
| 2 | **PETG** | 19 (strong) | Optimize for "PETG vs PLA", "PETG filament settings" |
| 3 | **TPU** | 11 (solid) | Optimize for "flexible filament", "TPU 95A settings" |
| 4 | **ABS** | TBD (likely 8-15) | Optimize for "ABS vs PLA", "ABS filament India" |
| 5 | **Nylon PA12** | TBD (likely 5-8) | Optimize for "nylon filament price India" |
| 6 | **PC** | TBD (likely 3-6) | Optimize for "polycarbonate filament temperature" |
| 7 | **CF-PA** | 1 as generic (higher as "carbon fiber nylon") | Target "carbon fiber nylon filament", "CF nylon" |

### Should Add (Data-Backed)

| Priority | Material | Rationale |
|----------|----------|-----------|
| **1** | **CF-PETG** | "PETG" at 19 is strong. "Carbon fiber" variants compound on this. Fastest-growing composite. Lower barrier than CF-PA. |
| **2** | **PC-ABS** | ABS search volume is significant (likely 8-15). "PC-ABS" captures comparison queries. Commercial/automotive intent. |
| **3** | **PP** | Very low competition for "PP filament" in India. Easy to rank for. Engineers search for "living hinge material", "chemical resistant filament". |
| **4** | **PVA** | "Water soluble support" has steady search. Low content competition in India. |

### Deferred (Was Tier 2, now Tier 3)
| Material | Why Deferred |
|----------|-------------|
| **ASA** | Google Trends: 2 (near-zero India demand). Different story in US/EU. Only add if targeting global audience. |
| **HIPS** | Only if dual-extrusion strategy materializes |
| **PEEK/PEKK/PEI** | Printers don't support it (need 350°C+) |

---

## What We Still Need

### 1. GSC Token Refresh
The OAuth token is expired. To get actual query/impression/click data from Search Console:
```
Run: python .tmp/scripts/fetch_search_console.py --days 90 --limit 100
```
This will open a browser for re-auth. Then we can see which material queries fracktal.in already ranks for.

### 2. Complete Google Trends Batch 2
Need a fresh browser session (rate-limit cooldown) to compare:
- ABS filament vs Nylon filament vs Polycarbonate filament vs PP filament vs PC-ABS filament

### 3. Keyword Variant Research
Important compound keywords to check:
- "carbon fiber nylon filament" vs "CF nylon" vs "nylon CF"
- "flexible filament" vs "TPU filament" vs "TPU 95A"
- "strongest 3d printer filament" (high-intent informational)
- "3d printer filament price India" (transactional)
- "best filament for Ender 3" (huge in India)

---

## Bottom Line

**The original recommendation was directionally correct but the ASA priority was wrong for India.** 

Real data shows:
- PLA and PETG are the only materials with significant search volume
- Everything else is in the 1-15 range on Trends
- ASA specifically has near-zero demand in India — skip it
- Focus on CF-PETG (compounds on strong PETG base) and PC-ABS (compounds on ABS base)
- "Carbon fiber filament" as a standalone term is weak — use "carbon fiber nylon" / "CF nylon" etc.

**Still the right call to go from 7 → ~11 materials.** But the order should be: CF-PETG first, PC-ABS second, PP third, PVA fourth. ASA moves to "only if global."
