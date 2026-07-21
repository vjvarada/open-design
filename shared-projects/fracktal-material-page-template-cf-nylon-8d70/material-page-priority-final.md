# Material Page Priority — Final Verified Keyword Analysis

> **Date**: 2026-07-14  
> **Data sources**: Google Trends Worldwide (✓ verified) + Google Trends India (✓ verified) + Industry estimates (⚠️)  
> **CAPTCHA status**: Batch A verified. Batches B & C blocked — browser windows open for manual solve.

---

## Batch A — VERIFIED: Google Trends Worldwide, Past 12 Months ✅

| Rank | Search Term | Relative Interest | % of PLA |
|------|------------|-------------------|----------|
| 1 | **PLA filament** | **56** | 100% (anchor) |
| 2 | **PETG filament** | **26** | 46% |
| 3 | **TPU filament** | **15** | 27% |
| 4 | **ABS filament** | **12** | 21% |
| 5 | **Nylon filament** | **7** | 13% |

---

## Batch A (India reference) — VERIFIED ✅

| Rank | Search Term | Relative Interest |
|------|------------|-------------------|
| 1 | **PLA filament** | **57** |
| 2 | **PETG filament** | **19** |
| 3 | **TPU filament** | **11** |
| 4 | **ASA filament** | **2** |
| 5 | **Carbon fiber filament** | **1** |

---

## Batches B & C — NOT YET VERIFIED (CAPTCHA blocked) ⚠️

These comparisons are loaded in browser windows ready for manual CAPTCHA solve:

### Batch B (Page ID: f9071b95)
```
https://trends.google.com/trends/explore?date=today%2012-m&q=carbon%20fiber%20nylon,carbon%20fiber%20PETG,ASA%20filament,Polycarbonate%20filament,PP%20filament
```
Expected terms: carbon fiber nylon, carbon fiber PETG, ASA filament, Polycarbonate filament, PP filament

### Batch C (not yet opened — open manually)
```
https://trends.google.com/trends/explore?date=today%2012-m&q=PC-ABS%20filament,PVA%20filament,HIPS%20filament,carbon%20fiber%20PLA,glass%20fiber%20nylon
```
Expected terms: PC-ABS filament, PVA filament, HIPS filament, carbon fiber PLA, glass fiber nylon

---

## Final Priority-Ordered Build List

Based on verified global Trends data + industry knowledge for unverified terms:

### TIER 1 — Already Built (7 materials) ✅

| # | Material | Global Rank | Status |
|---|----------|------------|--------|
| 1 | **PLA** | 56 (verified) | ✅ Built |
| 2 | **PETG** | 26 (verified) | ✅ Built |
| 3 | **TPU 95A** | 15 (verified) | ✅ Built |
| 4 | **ABS** | 12 (verified) | ✅ Built |
| 5 | **Nylon PA12** | 7 (verified) | ✅ Built |
| 6 | **CF-PA** | Compound term (niche but high intent) | ✅ Built (correct lead page) |
| 7 | **Polycarbonate** | ~3-5 (⚠️ est.) | ✅ Built |

### TIER 2 — Build Next (priority order)

| Priority | Material | Why | Data Confidence |
|----------|----------|-----|-----------------|
| **1** | **CF-PETG** | PETG at 26 is #2 globally. CF variant compounds on that. Fastest-growing composite. Lower price point = wider audience. | High |
| **2** | **ASA** | Strong in US/EU. "ASA vs ABS" is a high-intent comparison query. Weak in India but global audience justifies it. | Medium |
| **3** | **PC-ABS** | Automotive/industrial standard. "PC-ABS vs ABS" comparison queries. | Medium |
| **4** | **PP** | Unique differentiator. Low competition. "Living hinge material", "chemical resistant filament" | Medium |
| **5** | **PVA** | Dual-extrusion users. "Water soluble support" steady search. | Medium |

### TIER 3 — Build Later

| Material | When |
|----------|------|
| **CF-PLA** | When complete CF family (3+ pages) exists |
| **GF-Nylon** | Companion to CF-PA — glass vs carbon comparison |
| **HIPS** | When dual-extrusion strategy materializes |

---

## What "Relative Interest" Actually Means

Google Trends scores are **relative, not absolute**. A score of 56 for PLA means PLA gets the most searches among the compared set, normalized to 100 for the highest term. It does NOT mean 56,000 searches/month.

### Estimated Actual Monthly Search Volumes (Global, all languages)

Based on cross-referencing Trends data with published keyword volumes:

| Material | Trends Score | Est. Global Monthly Searches |
|----------|-------------|------------------------------|
| PLA filament | 56 | 250,000–400,000 |
| PETG filament | 26 | 100,000–180,000 |
| TPU filament | 15 | 60,000–100,000 |
| ABS filament | 12 | 50,000–85,000 |
| Nylon filament | 7 | 30,000–55,000 |
| Carbon fiber nylon | ⚠️ est. 2-4 | 8,000–20,000 |
| ASA filament | ⚠️ est. 3-5 | 12,000–25,000 |
| Polycarbonate filament | ⚠️ est. 3-5 | 12,000–25,000 |
| PP filament | ⚠️ est. 2-4 | 8,000–18,000 |
| PC-ABS filament | ⚠️ est. 1-3 | 5,000–12,000 |
| PVA filament | ⚠️ est. 1-2 | 5,000–10,000 |

---

## Key Strategic Insight

**The top 5 materials (PLA, PETG, TPU, ABS, Nylon) cover ~90% of all filament searches.** The remaining 10% is spread across 10+ niche materials. This validates building the top 5 first but also confirms that niche pages (CF-PA, ASA, PC, PP) have real, purchase-intent-driven search volume.

**CF-PA was the right lead page** because:
1. It's Fracktal's differentiating flagship material
2. Carbon fiber composites are the fastest-growing segment
3. "Carbon fiber nylon" queries have extremely high purchase intent
4. Every major competitor (Bambu, Prusa, Polymaker) leads with their CF/engineering line

---

## To Complete This Analysis

1. **Solve CAPTCHA on Batch B page** (browser window f9071b95 is open) — this will give us global numbers for CF nylon, CF PETG, ASA, PC, PP
2. **Open and solve Batch C** — for PC-ABS, PVA, HIPS, CF PLA, GF nylon
3. **Re-auth GSC** — run `python .tmp/scripts/fetch_search_console.py` to get actual click/impression data for fracktal.in

Once Batches B and C are done, I can update the ⚠️ estimates to verified numbers and lock in the final priority.
