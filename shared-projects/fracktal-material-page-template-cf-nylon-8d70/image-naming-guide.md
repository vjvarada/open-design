# Fracktal CF-PA Page Image Naming & Alt Text Guide

## Images to Rename

### Hero Section
| Current Name | New Name | Alt Text | Context |
|---|---|---|---|
| `mri3rr4e-hf_20260712_180301_53a4721b-603e-4519-a584-1978cad4046e.png` | `fracktal-cf-pa-hero-matte-finish.png` | Carbon fiber nylon (CF-PA) 3D printed part — matte composite finish, soft-edged blend on black background | Main hero image at top |

### Properties Section (Technical Images)
| Current Name | New Name | Alt Text | Context |
|---|---|---|---|
| `mri0yp3t-hf_20260712_163709_e5ffa702-da92-48b0-b990-4ece1e90eaa7.png` | `fracktal-cf-pa-dry-box-humidity.png` | CF-PA filament dry box with hygrometer showing low humidity | Moisture management property |
| `mrhy7scq-hf_20260712_152004_2011de7e-94dd-4225-b44a-23da53abb061.png` | `fracktal-fdm-printer-cf-pa-printing.png` | FDM 3D printer in motion building CF-PA part | Printing capability/process |

### Applications Section (Industry Tiles)
| Current Name | New Name | Alt Text | Context |
|---|---|---|---|
| `mrht67of-hf_20260712_130640_701bb76e-aaa3-4d1e-aeb0-e14ab5c5376c.png` | `fracktal-cf-pa-aerospace-drone-frame.png` | Matte black carbon-fiber nylon 3D printed drone frame component — aerospace and defence application | Aerospace/defence application |
| `mri468o1-image.png` | `fracktal-cf-pa-electronics-enclosure.png` | Black carbon-fiber-reinforced nylon 3D printed structural electronics enclosure with internal circuit board | Electronics/enclosure application |

### Design Tips Section (Technical Diagrams)
| Current Name | New Name | Alt Text | Context |
|---|---|---|---|
| `mri6nzjk-hf_20260712_192441_d6871fa6-f485-41f1-82bf-62554b925730.png` | `fracktal-cf-pa-design-tip-wall-thickness.png` | Technical diagram indicating minimum wall thickness for CF-PA structural parts | Design tip: wall thickness |
| `mri6smfx-hf_20260712_192822_43ebd6af-5649-4d6d-bc1d-699a90e1c5e8.png` | `fracktal-cf-pa-design-tip-hole-diameter.png` | Technical diagram showing the minimum printable hole diameter for carbon fibre nylon parts | Design tip: hole diameter |
| `hf_20260713_160403_609968bb-c347-4341-b561-94cc152592a3.png` | `fracktal-cf-pa-design-tip-corner-fillet.png` | Technical diagram comparing a sharp internal corner with stress concentration versus a filleted corner | Design tip: corner fillet |
| `mri6nenr-hf_20260712_192411_8ddce9d0-80bb-4f80-968d-71b83e746e82.png` | `fracktal-cf-pa-design-tip-heat-treatment.png` | Technical diagram of post-anneal heat treatment cycle for CF-PA parts | Design tip: heat treatment |
| `mri6rkar-hf_20260712_192537_c1ec3c10-716f-483e-a8a8-1f0fa7e9980e.png` | `fracktal-cf-pa-design-tip-shrinkage-tolerance.png` | Technical diagram of caliper measuring shrinkage tolerance on a CF-PA 3D printed part for assembly fit | Design tip: shrinkage tolerance |
| `mri5vv5w-hf_20260712_190250_8a0910eb-ee1c-4cdb-b4d3-743c9bb09636.png` | `fracktal-cf-pa-design-tip-clearance-gap.png` | Technical diagram showing minimum 0.5 mm clearance gap between two moving or mating CF-PA 3D printed parts | Design tip: clearance gap |
| `mri5ys31-hf_20260712_190510_450f4efa-ffab-4630-a459-95596f328a1b.png` | `fracktal-cf-pa-design-tip-overhang-angle.png` | Technical diagram showing the maximum 40 degree self-supporting overhang angle from vertical for CF-PA 3D printed walls | Design tip: overhang angle |
| `mri63tsg-hf_20260712_190859_ea3c12e1-a710-4b17-8dd6-f1926f659067.png` | `fracktal-cf-pa-design-tip-bridge-span.png` | Technical diagram showing the maximum 10 mm unsupported horizontal bridge span for CF-PA 3D printed parts | Design tip: bridge span |

## Already Good Names (Keep As-Is)
- `petg-hero.png` → Keep (used in materials comparison section)
- `tpu-hero.png` → Keep (used in materials comparison section)
- `nylon-hero.png` → Keep (used in materials comparison section)
- `polycarbonate-hero.png` → Keep (used in materials comparison section)
- `abs-hero.png` → Keep (used in materials comparison section)
- `pla-hero-v3.png` → Keep (used in materials comparison section)
- `rnd-prototyping-hero.png` → Keep (used in applications section)
- `automotive-end-use-part.jpg` → Keep (already descriptive)
- `sports-performance-part.jpg` → Keep (already descriptive)
- `mri73898-Fracktal-Logo.png` → Rename to `fracktal-logo.png` (brand asset)

## Naming Convention Applied
Format: `fracktal-[material/feature]-[section/type]-[descriptor].png`
- **Material**: cf-pa, fdm-printer
- **Section**: hero, properties, design-tip, applications
- **Type**: technical diagram, screenshot, test-photo
- **Descriptor**: specific feature (wall-thickness, drone-frame, etc.)

## Notes
- All alt text already exists in the HTML
- These images need to be uploaded to WordPress with the new filenames
- Design tip diagrams (8 images) should be organized in a `/design-tips/` folder
- Application images (2 images) should be organized in an `/applications/` folder
