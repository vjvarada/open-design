# Fracktal Materials Database — Source of Truth

> **Purpose**: Single authoritative dataset for ALL Fracktal material pages.  
> **Scope**: 7 materials shown in the related-materials slider on the CF-PA page.  
> **Standards**: ASTM D638 (tensile), ASTM D790 (flexural), ASTM D256 (Izod impact, notched), ASTM D648 (HDT @ 0.455 MPa).  
> **Orientation**: FDM XY (flat) unless noted. Values are **typical** for well-printed FDM parts — real values vary ±10–15% with print settings.  
> **Last updated**: 2026-07-14

---

## Data Issues Found in Current CF-PA Page

| Issue | Current Value | Correct Value | Explanation |
|-------|-------------|---------------|-------------|
| **Specific Stiffness** | 78 GPa·cm³/g (claims "exceeds Al 6061") | **~6.0 GPa·cm³/g** | Physically impossible. Al 6061 = 25.6. To get 78, polymer needs E=85.8 GPa — no polymer composite exists above ~15 GPa. CF-PA does NOT exceed aluminum in specific stiffness. |
| **Scatter X-axis label** | "Impact Strength ASTM D638 [MPa]" | Should be **"Impact Strength ASTM D256 [kJ/m²]"** or **"Tensile Strength ASTM D638 [MPa]"** | ASTM D638 is tensile, not impact. The scatter plot shows a mix of impact and tensile — needs a clear axis. |
| **Scatter circle positions** | CF-PA at ~164°C HDT | Should match stated 140°C | Circle Y positions are hardcoded, not data-driven. |
| **Nylon tensile** | 55 MPa | **48–52 MPa** (typical for unfilled PA12 FDM) | Slightly high; 50 MPa is more representative. |
| **ABS HDT** | 98°C | **95–100°C** | Reasonable but on high end. |

---

## Material 1: CF-PA (Carbon Fiber Nylon PA12)

**Category**: Engineering Composite · Short-fibre CF (15–20% wt) in PA12 matrix  
**Fracktal SKU**: CF-PA filament, 1.75 mm ±0.05 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard | Note |
|----------|-------|------|----------|------|
| Tensile Strength (ultimate) | 78–88 | MPa | ASTM D638 | Typical: 82 MPa |
| Tensile Modulus | 5,500–7,500 | MPa | ASTM D638 | ~6.5 GPa |
| Flexural Strength | 120–140 | MPa | ASTM D790 | |
| Flexural Modulus | 5,800–7,200 | MPa | ASTM D790 | ~6.5 GPa |
| **Specific Stiffness** | **5.9** | GPa·cm³/g | Flexural Modulus / Density | Does NOT exceed Al 6061 (25.6) |
| Izod Impact (notched) | 3.5–6.0 | kJ/m² | ASTM D256 | ~45 J/m equivalent |
| Elongation at Break | 2.0–5.0 | % | ASTM D638 | Brittle failure mode |
| Hardness | 78–82 | Shore D | | |

### Thermal Properties

| Property | Value | Unit | Standard | Note |
|----------|-------|------|----------|------|
| **HDT @ 0.455 MPa** | **138–155** | °C | ASTM D648 | Typical: 145 °C |
| HDT @ 1.82 MPa | 100–125 | °C | ASTM D648 | |
| Vicat Softening | 165–175 | °C | ASTM D1525 | |
| Glass Transition (Tg) | 45–55 | °C | DSC | PA12 matrix |
| Melting Point (Tm) | 175–180 | °C | DSC | PA12 |
| CTE | 35–50 | µm/m·°C | | Low CTE due to CF |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.08–1.12 | g/cm³ |
| Moisture Absorption (24h) | 0.8–1.4 | % |
| Moisture Absorption (saturated) | 1.5–2.5 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 260 | 270–285 | °C |
| Bed Temperature | 80 | 100–110 | °C |
| Chamber Temperature | — | 45–60 (if available) | °C |
| Print Speed | 30 | 40–60 | mm/s |
| Nozzle Diameter | 0.4 | ≥0.6 (0.8 preferred) | mm |
| Nozzle Material | Hardened steel | Hardened steel / Ruby / Carbide | |
| Bed Surface | PEI | Garolite G10 / PEI + glue stick | |
| Enclosure | Recommended | Fully enclosed + temp-controlled | |
| Drying | 70°C / 6h | 80°C / 8–12h | |
| Retraction (direct drive) | ≤1.0 | 0.5–0.8 | mm |
| Part Cooling Fan | OFF / 0–10% | OFF for layer adhesion | |

### Design Guidelines

| Guideline | Value |
|-----------|-------|
| Min. wall thickness | 1.5 mm (3+ perimeters) |
| Min. hole diameter | 2.0 mm |
| Min. internal fillet radius | 1.0 mm |
| Max. self-supporting overhang | 40° from vertical |
| Max. horizontal bridge | 10 mm |
| Shrinkage | 0.2–0.5% |
| Clearance (moving parts) | ≥0.5 mm |
| Post-anneal | 80°C / 90 min → ~40% residual stress reduction |

### Radar Scores (0–10, derived from measured data)

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **9** | 82 MPa — top of FDM materials |
| Flexural Modulus | **9** | 6.5 GPa — stiffest FDM polymer |
| Impact Resistance | **4** | 4.5 kJ/m² — brittle, CF reduces toughness |
| Heat Resistance | **9** | 145°C HDT — among highest for FDM |
| Chemical Resistance | **8** | PA12 base — good oil/fuel resistance |
| Dimensional Stability | **9** | Very low warp, CF controls shrinkage |
| Surface Finish | **4** | Matte, slightly rough, layer lines visible |
| Ease of Printing | **4** | Needs enclosure, drying, hardened nozzle |
| Cost Efficiency | **3** | ₹4,500–5,500/kg — premium |

### Indian Market Reference Price
₹4,500–5,500 / kg (CF-filled PA12, 1.75 mm)

---

## Material 2: Nylon PA12 (Unfilled)

**Category**: Engineering · Polyamide 12  
**Fracktal SKU**: PA12 filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 46–54 | MPa | ASTM D638 |
| Tensile Modulus | 1,500–2,000 | MPa | ASTM D638 |
| Flexural Strength | 55–70 | MPa | ASTM D790 |
| Flexural Modulus | 1,300–1,800 | MPa | ASTM D790 |
| Specific Stiffness | 1.5 | GPa·cm³/g | |
| Izod Impact (notched) | 5.0–12.0 | kJ/m² | ASTM D256 |
| Elongation at Break | 15–45 | % | ASTM D638 |
| Hardness | 70–75 | Shore D | |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 72–85 | °C | ASTM D648 |
| HDT @ 1.82 MPa | 48–58 | °C | ASTM D648 |
| Melting Point (Tm) | 175–180 | °C | DSC |
| Glass Transition (Tg) | 42–50 | °C | DSC |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.00–1.03 | g/cm³ |
| Moisture Absorption (24h) | 1.0–1.8 | % |
| Moisture Absorption (saturated) | 2.5–4.0 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 240 | 250–270 | °C |
| Bed Temperature | 60 | 80–100 | °C |
| Print Speed | 30 | 40–65 | mm/s |
| Nozzle Diameter | 0.4 | 0.4–0.6 | mm |
| Nozzle Material | — | Hardened steel (optional, no abrasive fill) | |
| Bed Surface | PEI | Garolite G10 / PEI + PVA glue | |
| Enclosure | Recommended | Enclosed (warp control) | |
| Drying | 70°C / 6h | 80°C / 8–12h (mandatory — highly hygroscopic) | |
| Retraction (direct drive) | 0.8 | 1.0–1.5 | mm |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **6** | 50 MPa |
| Flexural Modulus | **5** | 1.6 GPa |
| Impact Resistance | **8** | 8 kJ/m² — tough, ductile |
| Heat Resistance | **5** | 78°C HDT |
| Chemical Resistance | **7** | Good oil/solvent resistance |
| Dimensional Stability | **5** | Moderate warp, hygroscopic |
| Surface Finish | **5** | Semi-gloss, can be smooth |
| Ease of Printing | **5** | Needs drying, enclosure helps |
| Cost Efficiency | **5** | ₹2,800–3,500/kg |

### Indian Market Reference Price
₹2,800–3,500 / kg

---

## Material 3: PLA (Polylactic Acid)

**Category**: Basic · Biodegradable thermoplastic  
**Fracktal SKU**: PLA filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 50–62 | MPa | ASTM D638 |
| Tensile Modulus | 3,200–3,700 | MPa | ASTM D638 |
| Flexural Strength | 80–97 | MPa | ASTM D790 |
| Flexural Modulus | 2,800–3,500 | MPa | ASTM D790 |
| Specific Stiffness | 2.5 | GPa·cm³/g | |
| Izod Impact (notched) | 2.5–4.5 | kJ/m² | ASTM D256 |
| Elongation at Break | 3–6 | % | ASTM D638 |
| Hardness | 80–85 | Shore D | |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 50–56 | °C | ASTM D648 |
| HDT @ 1.82 MPa | 45–52 | °C | ASTM D648 |
| Glass Transition (Tg) | 55–62 | °C | DSC |
| Melting Point (Tm) | 150–165 | °C | DSC |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.23–1.25 | g/cm³ |
| Moisture Absorption (24h) | 0.2–0.5 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 190 | 200–220 | °C |
| Bed Temperature | 0 (unheated OK) | 50–60 | °C |
| Print Speed | 40 | 50–80 | mm/s |
| Nozzle Diameter | 0.2 | 0.4 | mm |
| Nozzle Material | — | Brass / any | |
| Bed Surface | Blue tape | PEI / glass + glue stick | |
| Enclosure | Not needed | Open frame OK | |
| Drying | 45°C / 4h | Only if brittle | |
| Part Cooling Fan | ON 100% | Essential | |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **5** | 56 MPa |
| Flexural Modulus | **6** | 3.2 GPa — surprisingly stiff |
| Impact Resistance | **2** | 3.5 kJ/m² — brittle |
| Heat Resistance | **2** | 53°C HDT — deforms in a hot car |
| Chemical Resistance | **3** | Poor — attacked by many solvents |
| Dimensional Stability | **8** | Very low warp |
| Surface Finish | **9** | Glossy, excellent |
| Ease of Printing | **10** | Easiest material to print |
| Cost Efficiency | **9** | ₹1,000–1,500/kg |

### Indian Market Reference Price
₹1,000–1,500 / kg

---

## Material 4: PETG (Polyethylene Terephthalate Glycol)

**Category**: General Purpose · Copolyester  
**Fracktal SKU**: PETG filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 44–52 | MPa | ASTM D638 |
| Tensile Modulus | 1,900–2,300 | MPa | ASTM D638 |
| Flexural Strength | 65–76 | MPa | ASTM D790 |
| Flexural Modulus | 1,800–2,200 | MPa | ASTM D790 |
| Specific Stiffness | 1.6 | GPa·cm³/g | |
| Izod Impact (notched) | 6.0–10.0 | kJ/m² | ASTM D256 |
| Elongation at Break | 12–25 | % | ASTM D638 |
| Hardness | 72–78 | Shore D | |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 65–74 | °C | ASTM D648 |
| HDT @ 1.82 MPa | 60–66 | °C | ASTM D648 |
| Glass Transition (Tg) | 76–82 | °C | DSC |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.26–1.28 | g/cm³ |
| Moisture Absorption (24h) | 0.3–0.6 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 225 | 235–250 | °C |
| Bed Temperature | 60 | 70–85 | °C |
| Print Speed | 30 | 40–65 | mm/s |
| Nozzle Diameter | 0.4 | 0.4–0.6 | mm |
| Nozzle Material | — | Brass / hardened steel (optional) | |
| Bed Surface | PEI | PEI / glass + glue stick (release agent recommended) | |
| Enclosure | Not needed | Open frame OK | |
| Drying | 55°C / 4h | 65°C / 4–6h (moderately hygroscopic) | |
| Retraction (direct drive) | 1.0 | 1.5–2.5 | mm |
| Part Cooling Fan | 30–50% | 50% — too much cooling hurts layer adhesion | |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **5** | 48 MPa |
| Flexural Modulus | **5** | 2.0 GPa |
| Impact Resistance | **7** | 8 kJ/m² — tough, ductile |
| Heat Resistance | **4** | 70°C HDT |
| Chemical Resistance | **7** | Good acid/alkali resistance |
| Dimensional Stability | **6** | Moderate — less warp than ABS |
| Surface Finish | **7** | Glossy, slight stringing |
| Ease of Printing | **8** | Easy, forgiving |
| Cost Efficiency | **8** | ₹1,400–2,000/kg |

### Indian Market Reference Price
₹1,400–2,000 / kg

---

## Material 5: ABS (Acrylonitrile Butadiene Styrene)

**Category**: General Purpose · Engineering thermoplastic  
**Fracktal SKU**: ABS filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 33–42 | MPa | ASTM D638 |
| Tensile Modulus | 1,900–2,500 | MPa | ASTM D638 |
| Flexural Strength | 58–72 | MPa | ASTM D790 |
| Flexural Modulus | 1,800–2,400 | MPa | ASTM D790 |
| Specific Stiffness | 2.0 | GPa·cm³/g | |
| Izod Impact (notched) | 15–25 | kJ/m² | ASTM D256 |
| Elongation at Break | 5–25 | % | ASTM D638 |
| Hardness | 68–74 | Shore D | |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 93–100 | °C | ASTM D648 |
| HDT @ 1.82 MPa | 82–92 | °C | ASTM D648 |
| Glass Transition (Tg) | 100–110 | °C | DSC |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.03–1.07 | g/cm³ |
| Moisture Absorption (24h) | 0.3–0.8 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 220 | 235–250 | °C |
| Bed Temperature | 95 | 100–110 | °C |
| Print Speed | 30 | 40–60 | mm/s |
| Nozzle Diameter | 0.4 | 0.4–0.6 | mm |
| Nozzle Material | — | Brass / any | |
| Bed Surface | Kapton / ABS slurry | PEI / Kapton + ABS slurry | |
| Enclosure | Strongly recommended | Fully enclosed (warp prevention) | |
| Drying | 60°C / 4h | 70°C / 4–6h | |
| Part Cooling Fan | OFF / 0–20% | OFF for layer adhesion | |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **4** | 38 MPa |
| Flexural Modulus | **5** | 2.1 GPa |
| Impact Resistance | **7** | 20 kJ/m² — tough |
| Heat Resistance | **6** | 96°C HDT |
| Chemical Resistance | **5** | Limited — attacked by ketones, esters |
| Dimensional Stability | **4** | Significant warp without enclosure |
| Surface Finish | **6** | Matte, can be acetone-smoothed |
| Ease of Printing | **5** | Warp/fumes — needs enclosure |
| Cost Efficiency | **8** | ₹1,200–1,800/kg |

### Indian Market Reference Price
₹1,200–1,800 / kg

---

## Material 6: TPU 95A (Thermoplastic Polyurethane)

**Category**: Flexible · Elastomer  
**Fracktal SKU**: TPU 95A filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 24–34 | MPa | ASTM D638 |
| Tensile Modulus | 25–50 | MPa | ASTM D638 |
| Flexural Modulus | 30–80 | MPa | ASTM D790 (essentially no flexural rigidity) |
| Specific Stiffness | 0.04 | GPa·cm³/g | — |
| Izod Impact (notched) | **NB** (No Break) | — | ASTM D256 — too tough to measure |
| Elongation at Break | 400–650 | % | ASTM D638 |
| Hardness | 93–97 | Shore A | (Shore 95A nominal) |
| Abrasion Resistance | 25–35 | mm³ | ISO 4649 |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 55–68 | °C | ASTM D648 |
| Vicat Softening | 90–110 | °C | ASTM D1525 |
| Glass Transition (Tg) | −40 to −30 | °C | DSC |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.19–1.23 | g/cm³ |
| Moisture Absorption (24h) | 0.5–1.5 | % |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 215 | 225–240 | °C |
| Bed Temperature | 0 (unheated OK) | 40–60 | °C |
| Print Speed | 15 | 20–35 | mm/s (slow — flexible filament) |
| Nozzle Diameter | 0.4 | 0.4–0.6 | mm |
| Nozzle Material | — | Brass / any | |
| Bed Surface | Blue tape | PEI / glass + glue stick | |
| Enclosure | Not needed | Open frame OK | |
| Drying | 55°C / 4h | 65°C / 4–6h (hygroscopic!) | |
| Retraction | Disable or ≤0.5 mm | Direct drive preferred | |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **3** | 28 MPa |
| Flexural Modulus | **1** | ~50 MPa — essentially zero stiffness |
| Impact Resistance | **10** | No Break — absorbs all impact |
| Heat Resistance | **3** | 60°C HDT |
| Chemical Resistance | **8** | Excellent oil/grease/fuel resistance |
| Dimensional Stability | **3** | Flexible, deforms under load |
| Surface Finish | **6** | Matte, rubber-like |
| Ease of Printing | **4** | Slow, needs direct drive, stringy |
| Cost Efficiency | **6** | ₹2,000–2,800/kg |

### Indian Market Reference Price
₹2,000–2,800 / kg

---

## Material 7: Polycarbonate (PC)

**Category**: Engineering · High-performance thermoplastic  
**Fracktal SKU**: PC filament, 1.75 mm

### Mechanical Properties (ASTM, FDM XY)

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| Tensile Strength (ultimate) | 55–70 | MPa | ASTM D638 |
| Tensile Modulus | 2,100–2,600 | MPa | ASTM D638 |
| Flexural Strength | 85–100 | MPa | ASTM D790 |
| Flexural Modulus | 2,100–2,500 | MPa | ASTM D790 |
| Specific Stiffness | 1.9 | GPa·cm³/g | |
| Izod Impact (notched) | 50–85 | kJ/m² | ASTM D256 (~700 J/m) — very high |
| Elongation at Break | 5–15 | % | ASTM D638 |
| Hardness | 78–83 | Shore D | |

### Thermal Properties

| Property | Value | Unit | Standard |
|----------|-------|------|----------|
| HDT @ 0.455 MPa | 128–140 | °C | ASTM D648 |
| HDT @ 1.82 MPa | 120–130 | °C | ASTM D648 |
| Glass Transition (Tg) | 143–150 | °C | DSC |
| Vicat Softening | 140–150 | °C | ASTM D1525 |

### Physical Properties

| Property | Value | Unit |
|----------|-------|------|
| Density | 1.18–1.22 | g/cm³ |
| Moisture Absorption (24h) | 0.15–0.35 | % |
| Light Transmission | 85–91 | % (natural/clear grade) |

### Print Parameters

| Parameter | Min | Recommended | Unit |
|-----------|-----|-------------|------|
| Nozzle Temperature | 265 | 280–310 | °C |
| Bed Temperature | 80 | 100–120 | °C |
| Chamber Temperature | — | 60–80 (critical for layer adhesion) | °C |
| Print Speed | 25 | 30–50 | mm/s |
| Nozzle Diameter | 0.4 | 0.4–0.6 | mm |
| Nozzle Material | — | Hardened steel (optional, no abrasive fill) | |
| Bed Surface | PEI | PEI / BuildTak + adhesive | |
| Enclosure | **Required** | Fully enclosed + actively heated | |
| Drying | 80°C / 4h | **120°C / 4–6h (mandatory!)** — hydrolyses if wet | |
| Retraction (direct drive) | 0.8 | 1.0–1.5 | mm |
| Part Cooling Fan | OFF | OFF — any cooling causes delamination | |

### Radar Scores

| Axis | Score | Basis |
|------|-------|-------|
| Tensile Strength | **6** | 62 MPa |
| Flexural Modulus | **6** | 2.3 GPa |
| Impact Resistance | **9** | 65 kJ/m² — extremely tough |
| Heat Resistance | **8** | 134°C HDT |
| Chemical Resistance | **5** | Limited — attacked by many solvents |
| Dimensional Stability | **5** | High warp without heated chamber |
| Surface Finish | **5** | Can be glossy but layer lines visible |
| Ease of Printing | **3** | Very difficult — needs 300°C+, enclosure, drying |
| Cost Efficiency | **4** | ₹3,200–4,500/kg |

### Indian Market Reference Price
₹3,200–4,500 / kg

---

## Summary Comparison Table

| Property | CF-PA | Nylon PA12 | PLA | PETG | ABS | TPU 95A | PC |
|----------|-------|------------|-----|------|-----|---------|-----|
| **Tensile (MPa)** | 82 | 50 | 56 | 48 | 38 | 28 | 62 |
| **Flex Mod (GPa)** | 6.5 | 1.6 | 3.2 | 2.0 | 2.1 | 0.05 | 2.3 |
| **HDT 0.455MPa (°C)** | 145 | 78 | 53 | 70 | 96 | 60 | 134 |
| **Izod Impact (kJ/m²)** | 4.5 | 8.0 | 3.5 | 8.0 | 20 | NB | 65 |
| **Density (g/cm³)** | 1.10 | 1.01 | 1.24 | 1.27 | 1.05 | 1.21 | 1.20 |
| **Elongation (%)** | 3 | 30 | 4 | 18 | 15 | 500 | 10 |
| **Print Temp (°C)** | 270–285 | 250–270 | 200–220 | 235–250 | 235–250 | 225–240 | 280–310 |
| **Bed Temp (°C)** | 100–110 | 80–100 | 50–60 | 70–85 | 100–110 | 40–60 | 100–120 |
| **Enclosure** | Yes | Recommended | No | No | Strongly rec. | No | **Required** |
| **Drying** | 80°C/8h | 80°C/8h | Optional | 65°C/4h | 70°C/4h | 65°C/4h | **120°C/4h** |
| **Hardened Nozzle** | Required | Optional | No | No | No | No | Optional |
| **₹/kg (India)** | 4,500–5,500 | 2,800–3,500 | 1,000–1,500 | 1,400–2,000 | 1,200–1,800 | 2,000–2,800 | 3,200–4,500 |

---

## Radar Scores Matrix (0–10)

Used for the 9-axis radar chart on all material pages.  
Axes: [Tensile, Flexural, Impact, Heat, Chemical, Dimensional, Surface, Ease, Cost]

| Material | Tensile | Flexural | Impact | Heat | Chemical | Dimensional | Surface | Ease | Cost |
|----------|---------|----------|--------|------|----------|-------------|---------|------|------|
| **CF-PA** | 9 | 9 | 4 | 9 | 8 | 9 | 4 | 4 | 3 |
| **Nylon PA12** | 6 | 5 | 8 | 5 | 7 | 5 | 5 | 5 | 5 |
| **PLA** | 5 | 6 | 2 | 2 | 3 | 8 | 9 | 10 | 9 |
| **PETG** | 5 | 5 | 7 | 4 | 7 | 6 | 7 | 8 | 8 |
| **ABS** | 4 | 5 | 7 | 6 | 5 | 4 | 6 | 5 | 8 |
| **TPU 95A** | 3 | 1 | 10 | 3 | 8 | 3 | 6 | 4 | 6 |
| **PC** | 6 | 6 | 9 | 8 | 5 | 5 | 5 | 3 | 4 |

### Key Changes from Current Page
- **CF-PA Impact**: Changed from 7→**4** (CF reinforcement makes nylon brittle; Izod drops from ~8 to ~4.5 kJ/m²)
- **CF-PA Surface**: Changed from 6→**4** (CF-filled parts have matte, rough, abrasive surface)
- **TPU Flexural**: Changed from 2→**1** (TPU has essentially zero flexural rigidity — ~0.05 GPa vs 1.6+ GPa for others)
- **Nylon Impact**: Changed from 8→**8** (correct — unfilled nylon is very tough, but CF-PA is brittle)
- **PC Chemical**: Changed from 5→**5** (correct — PC has poor chemical resistance)

---

## Scatter Plot Data: HDT vs Impact Strength

For the 2D scatter plot (X = Izod Impact kJ/m², Y = HDT °C @ 0.455 MPa):

| Material | HDT (°C) | Impact (kJ/m²) | Bubble Size |
|----------|----------|-----------------|-------------|
| CF-PA | 145 | 4.5 | Large |
| Nylon PA12 | 78 | 8.0 | Medium |
| PLA | 53 | 3.5 | Small |
| PETG | 70 | 8.0 | Medium |
| ABS | 96 | 20 | Large |
| TPU 95A | 60 | 100* | Large |
| PC | 134 | 65 | Medium |

*TPU does not break in Izod (NB); plotted at 100 kJ/m² for visualization. X-axis scale should cap at ~80 for readability, with TPU marked as "No Break."

---

## Scatter Plot Data: HDT vs Tensile Strength

Alternative 2D scatter (X = Tensile Strength MPa, Y = HDT °C):

| Material | HDT (°C) | Tensile (MPa) |
|----------|----------|---------------|
| CF-PA | 145 | 82 |
| Nylon PA12 | 78 | 50 |
| PLA | 53 | 56 |
| PETG | 70 | 48 |
| ABS | 96 | 38 |
| TPU 95A | 60 | 28 |
| PC | 134 | 62 |

**Recommendation**: Label the scatter X-axis as "Tensile Strength ASTM D638 [MPa]" (which matches the data values) OR as "Izod Impact Strength ASTM D256 [kJ/m²]" (which would need different scale). The current hybrid doesn't work — choose one property and label it correctly.

---

## Bar Chart Reference Values

For horizontal bar charts comparing all materials:

### Tensile Strength (MPa) — ASTM D638
| CF-PA | Nylon PA12 | PLA | PETG | ABS | TPU 95A | PC |
|-------|------------|-----|------|-----|---------|-----|
| 82 | 50 | 56 | 48 | 38 | 28 | 62 |

### Heat Deflection Temperature (°C) — ASTM D648 @ 0.455 MPa
| CF-PA | Nylon PA12 | PLA | PETG | ABS | TPU 95A | PC |
|-------|------------|-----|------|-----|---------|-----|
| 145 | 78 | 53 | 70 | 96 | 60 | 134 |

### Flexural Modulus (GPa) — ASTM D790
| CF-PA | Nylon PA12 | PLA | PETG | ABS | TPU 95A | PC |
|-------|------------|-----|------|-----|---------|-----|
| 6.5 | 1.6 | 3.2 | 2.0 | 2.1 | 0.05 | 2.3 |

---

## Notes on Data Sources & Methodology

1. **ASTM standards** are for injection-molded specimens. FDM XY values are typically 70–90% of injection-molded values depending on print quality, layer adhesion, and orientation.
2. **HDT values** are at the 0.455 MPa (66 psi) load — the standard reference for comparing FDM materials. At 1.82 MPa (264 psi), values drop 10–35°C.
3. **Impact strength** (Izod notched) is notoriously variable in FDM — layer adhesion dominates. Values assume optimal print settings.
4. **Indian pricing** is approximate market reference (July 2026). Actual prices vary by brand, volume, and distributor.
5. **CF-PA data** is based on 15–20% short-carbon-fibre-filled PA12. Higher fibre loading (25–30%) increases stiffness but further reduces impact strength.
6. **Specific stiffness** = Flexural Modulus / Density. This is the correct formula; the current page value of 78 for CF-PA is erroneous.
