#!/usr/bin/env python3
"""Generate 9 Fracktal material pages from cf-nylon.html template."""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))

def rd(f):
    with open(os.path.join(BASE, f), encoding='utf-8') as fh:
        return fh.read()

def wr(f, c):
    with open(os.path.join(BASE, f), 'w', encoding='utf-8') as fh:
        fh.write(c)
    print(f'  OK  {f}')

TEMPLATE = rd('cf-nylon.html')

def replace_between(html, s_marker, e_marker, new_content):
    """Replace everything from s_marker (inclusive) up to e_marker (exclusive)."""
    s = html.index(s_marker)
    e = html.index(e_marker)
    return html[:s] + new_content + html[e:]

# ─── Shared helpers ───────────────────────────────────────────────────────────

ALL_MATS_REF = [
    ('cf-pa',        'cf-nylon_whitebg.png',  'CF-PA (Carbon Fiber Nylon)',  '/cf-nylon/'),
    ('nylon-pa12',   'nylon_whitebg.png',      'Nylon PA12',                  '/nylon/'),
    ('petg',         'petg_whitebg.png',       'PETG',                        '/pet-g-polyethylene-terephthalate-glycol/'),
    ('pla',          'pla_whitebg.png',        'PLA',                         '/pla/'),
    ('cf-petg',      'cf-petg_whitebg.png',    'CF-PETG',                     '/cf-petg/'),
    ('abs',          'abs_whitebg.png',        'ABS',                         '/abs-acrylonitrile-butadiene-styrene/'),
    ('polycarbonate','pc_whitebg.png',         'Polycarbonate (PC)',           '/polycarbonate/'),
    ('pc-abs',       'pc-abs_whitebg.png',     'PC-ABS',                      '/pc-abs/'),
    ('asa',          'asa_whitebg.png',        'ASA',                         '/asa/'),
    ('tpu-95a',      'tpu_whitebg.png',        'TPU 95A',                     '/tpu/'),
]

DROPDOWN_LABELS = {
    'cf-pa':        'CF-PA',
    'nylon-pa12':   'Nylon PA12',
    'petg':         'PETG',
    'pla':          'PLA',
    'cf-petg':      'CF-PETG',
    'abs':          'ABS',
    'polycarbonate':'Polycarbonate (PC)',
    'pc-abs':       'PC-ABS',
    'asa':          'ASA',
    'tpu-95a':      'TPU 95A',
}

# Scatter plot SVG circle positions (cx, cy, r)
SCATTER_POS = {
    'cf-pa':        (591, 65,  28),
    'nylon-pa12':   (359, 281, 26),
    'polycarbonate':(433, 96,  26),
    'petg':         (344, 320, 24),
    'abs':          (296, 251, 24),
    'pla':          (393, 349, 20),
    'tpu-95a':      (266, 336, 28),
    'cf-petg':      (409, 273, 24),
    'asa':          (319, 245, 24),
    'pc-abs':       (344, 204, 26),
}

# Tensile bar chart: material keys in chart order (top to bottom), their text, value
BAR_CHART_ORDER = [
    ('cf-pa',        'CF-PA',                 '82 MPa', 82),
    ('polycarbonate','Polycarbonate (PC)',     '62 MPa', 62),
    ('cf-petg',      'CF-PETG',               '58 MPa', 58),
    ('pla',          'PLA',                   '56 MPa', 56),
    ('nylon-pa12',   'Nylon PA12',            '50 MPa', 50),
    ('petg',         'PETG',                  '48 MPa', 48),
    ('pc-abs',       'PC-ABS',                '48 MPa', 48),
    ('abs',          'ABS',                   '38 MPa', 38),
    ('asa',          'ASA',                   '42 MPa', 42),
    ('tpu-95a',      'TPU 95A',               '28 MPa', 28),
]


def make_related_nav(exclude_key):
    """Build infinite-scroll related materials nav, excluding current material."""
    cards = [r for r in ALL_MATS_REF if r[0] != exclude_key]

    def card_html(key, img, name, url, with_id=True):
        mat_short = key.replace('-', '')[:6]
        id_attr = f' data-od-id="mat-{mat_short}"' if with_id else ''
        return (f'        <div class="mat-card has-img"{id_attr} data-material="{key}">'
                f'<img class="mat-img" src="{img}" alt="{name} filament spool" loading="lazy">'
                f'<div class="mat-body"><div class="name">{name}</div>'
                f'<div class="mat-card__btns">'
                f'<button class="mat-card__btn mat-card__btn--compare" onclick="compareMaterial(\'{key}\')">Compare</button>'
                f'<a class="mat-card__btn mat-card__btn--view" href="https://fracktal.in/materials{url}">View Material</a>'
                f'</div></div></div>\n')

    primary = ''.join(card_html(*r) for r in cards)
    dupes = ''.join(card_html(r[0], r[1], r[2], r[3], with_id=False) for r in cards)

    return f'''<!-- ===================== RELATED MATERIALS ===================== -->
<section class="section" id="related-materials" data-od-id="related-materials">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Compare</span>
      <h2>Related Materials</h2>
    </div>
    <div class="related-scroll-wrap">
      <nav class="related-scroll" aria-label="Related material pages">
{primary}{dupes}      </nav>
    </div>
  </div>
</section>

'''


def make_prop_cards(cards):
    """Build text-only key property cards using template class names."""
    html = ''
    for c in cards:
        cid = c['id']
        html += (f'      <div class="prop-card" data-od-id="prop-{cid}">\n'
                 f'        <div class="prop-body">\n'
                 f'          <div class="name">{c["name"]}</div>\n'
                 f'          <div class="val">{c["val"]}</div>\n'
                 f'          <div class="ctx">{c["ctx"]}</div>\n'
                 f'        </div>\n'
                 f'      </div>\n')
    return html


def make_app_tiles(tiles):
    """Build text-only application tiles using template class names."""
    html = ''
    for t in tiles:
        tid = t['id']
        sector = t['sector']
        items_html = ''.join(f'<li>{i}</li>' for i in t['items'])
        html += (f'      <div class="app-tile" data-od-id="app-{tid}">\n'
                 f'        <div class="tile-body">\n'
                 f'          <h3>{sector}</h3>\n'
                 f'          <ul>{items_html}</ul>\n'
                 f'        </div>\n'
                 f'      </div>\n')
    return html


def make_dfam_tips(tips):
    """Build text-only DfAM tip cards using template class names."""
    html = ''
    for t in tips:
        tid = t['id']
        html += (f'      <div class="tip-card" data-od-id="tip-{tid}">\n'
                 f'        <div class="tip-body">\n'
                 f'          <h3>{t["title"]}</h3>\n'
                 f'          <p>{t["body"]}</p>\n'
                 f'        </div>\n'
                 f'      </div>\n')
    return html


def make_bar_chart(primary_key):
    """Rebuild the tensile comparison bar chart SVG with the correct bar highlighted."""
    max_val = 82
    chart_w = 650
    label_w = 170
    bar_area = chart_w - label_w - 70
    svg_h = len(BAR_CHART_ORDER) * 42 + 30

    rows = ''
    for i, (key, label, val_str, val_num) in enumerate(BAR_CHART_ORDER):
        y = 20 + i * 42
        bar_w = int(bar_area * val_num / max_val)
        if key == primary_key:
            rect_fill = '#f25e50'
            text_fill = '#ffffff'
        else:
            rect_fill = '#5a5a5a'
            text_fill = 'rgba(255,255,255,0.78)'
        rows += f'  <text x="10" y="{y+17}" fill="{text_fill}" font-size="13" font-family="inherit">{label}</text>\n'
        rows += f'  <rect x="{label_w}" y="{y}" width="{bar_w}" height="28" rx="3" fill="{rect_fill}"/>\n'
        rows += f'  <text x="{label_w + bar_w + 8}" y="{y+17}" fill="{text_fill}" font-size="13" font-family="inherit">{val_str}</text>\n'

    return f'''<!-- ===================== TENSILE COMPARISON BAR CHART ===================== -->
<section class="section" id="tensile-chart" style="background:var(--dark);" data-od-id="tensile-chart">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Comparison</span>
      <h2>Tensile Strength vs Other Materials</h2>
      <p>ISO 527 / ASTM D638 values. Printed specimens at recommended settings.</p>
    </div>
    <div style="overflow-x:auto;">
      <svg viewBox="0 0 {chart_w} {svg_h}" style="width:100%;max-width:{chart_w}px;height:auto;display:block;" aria-label="Tensile strength bar chart" role="img">
{rows}      </svg>
    </div>
  </div>
</section>

'''


def make_decision_guide(mat):
    chk = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>'
    use_items = ''.join(f'<li><span class="ic">{chk}</span>{i}</li>' for i in mat['useItems'])
    avoid_items = ''.join(f'<li><span class="ic">{chk}</span>{i}</li>' for i in mat['avoidItems'])
    chk_red = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f25e50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>'
    x_white = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>'
    return f'''<!-- ===================== WHEN TO USE / AVOID ===================== -->
<section class="section" id="decision-guide" data-od-id="decision-guide">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Decision Guide</span>
      <h2>When to Use {mat['name']} — and When Not To</h2>
    </div>
    <div class="card-flex">
      <div class="decide-col decide--use" data-od-id="decide-use">
        <div class="decide-head">
          <span class="ic">{chk_red}</span>
          <h3>Use {mat['name']} when</h3>
        </div>
        <div class="decide-body"><ul>{use_items}</ul></div>
      </div>
      <div class="decide-col decide--avoid" data-od-id="decide-avoid">
        <div class="decide-head">
          <span class="ic">{x_white}</span>
          <h3>Avoid {mat['name']} when</h3>
        </div>
        <div class="decide-body"><ul>{avoid_items}</ul></div>
      </div>
    </div>
  </div>
</section>

'''


def make_dfam_section(mat):
    tips_html = make_dfam_tips(mat['dfamTips'])
    return f'''<!-- ===================== DfAM TIPS ===================== -->
<section class="section" id="dfam" style="background:var(--surface-soft);" data-od-id="dfam">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Design for Additive</span>
      <h2>DfAM Tips for {mat['name']}</h2>
      <p>Design rules that get the best performance from {mat['name']}.</p>
    </div>
    <div class="card-flex">
{tips_html}    </div>
  </div>
</section>

'''


def make_printers_section(mat):
    snowflake_ok = mat.get('snowflakeOk', False)
    h2 = f"Printers Compatible with {mat['name']}"
    desc = mat['printerDesc']

    if snowflake_ok:
        compat_note = (f'    <div class="callout" data-od-id="printer-snowflake-note">\n'
                       f'      <span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>\n'
                       f'      <p><strong>Snowflake compatible:</strong> {mat["name"]} can also be printed on the Fracktal Snowflake open-frame desktop printer — no enclosure required.</p>\n'
                       f'    </div>')
    else:
        compat_note = (f'    <div class="callout callout--warn" data-od-id="printer-snowflake-note">\n'
                       f'      <span class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4M12 17h.01"></path></svg></span>\n'
                       f'      <p><strong>Not compatible:</strong> Snowflake and other open-frame printers without an enclosure cannot reliably print {mat["name"]}. {mat["snowflakeReason"]}</p>\n'
                       f'    </div>')

    return f'''<!-- ===================== COMPATIBLE FRACKTAL PRINTERS ===================== -->
<section class="section" id="compatible-printers" style="background:var(--surface-soft);" data-od-id="compatible-printers">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Fracktal Printers</span>
      <h2>{h2}</h2>
      <p>{desc}</p>
    </div>
    <div class="printer-scroll-wrap">
      <div class="printer-scroll">
        <a class="printer-card" href="https://fracktal.in/dragon/" data-od-id="printer-dragon">
          <img class="printer-card__img" src="dragon-3-4-view-2.png" alt="Fracktal Dragon 3D printer" loading="lazy" width="800" height="800">
          <div class="printer-card__body">
            <div class="printer-card__name">Dragon</div>
            <div class="printer-card__note">Enclosed FDM printer with all-metal hot-end and direct drive. Ready for engineering filaments.</div>
            <div class="printer-card__compat"><span class="compat-tag">Enclosed</span><span class="compat-tag">300 °C</span><span class="compat-tag">Direct drive</span></div>
            <span class="printer-card__link">View Specs</span>
          </div>
        </a>
        <a class="printer-card" href="https://fracktal.in/twin-dragon/" data-od-id="printer-twin-dragon">
          <img class="printer-card__img" src="twin-dragon-3-4-view-2.png" alt="Fracktal Twin Dragon 3D printer" loading="lazy" width="800" height="800">
          <div class="printer-card__body">
            <div class="printer-card__name">Twin Dragon</div>
            <div class="printer-card__note">Dual-chamber IDEX printer with independent direct-drive extruders. Supports dual-material prints.</div>
            <div class="printer-card__compat"><span class="compat-tag">Enclosed</span><span class="compat-tag">300 °C</span><span class="compat-tag">IDEX</span></div>
            <span class="printer-card__link">View Specs</span>
          </div>
        </a>
        <a class="printer-card" href="https://fracktal.in/julia/" data-od-id="printer-julia">
          <img class="printer-card__img" src="Julia-3-4-view.png" alt="Fracktal Julia 3D printer" loading="lazy" width="800" height="800">
          <div class="printer-card__body">
            <div class="printer-card__name">Julia</div>
            <div class="printer-card__note">Compact industrial FDM optimised for high-temperature engineering materials.</div>
            <div class="printer-card__compat"><span class="compat-tag">Enclosed</span><span class="compat-tag">High-Temp</span></div>
            <span class="printer-card__link">View Specs</span>
          </div>
        </a>
        <a class="printer-card" href="https://fracktal.in/volterra/" data-od-id="printer-volterra">
          <img class="printer-card__img" src="volterra-3-4-view-1.png" alt="Fracktal Volterra 3D printer" loading="lazy" width="800" height="800">
          <div class="printer-card__body">
            <div class="printer-card__name">Volterra</div>
            <div class="printer-card__note">Large-format enclosed system for production-grade engineering prints.</div>
            <div class="printer-card__compat"><span class="compat-tag">Enclosed</span><span class="compat-tag">Large Format</span></div>
            <span class="printer-card__link">View Specs</span>
          </div>
        </a>
      </div>
    </div>
{compat_note}
  </div>
</section>

'''


# ─── FRACKTAL_MATERIALS JS addition ──────────────────────────────────────────
# These 3 materials are missing from cf-nylon.html's FRACKTAL_MATERIALS object
EXTRA_MAT_JS = """  'cf-petg': {
    name: 'CF-PETG', color: '#a855f7',
    dims: [7, 7, 5, 5, 7, 7, 5, 7, 6],
    tensile: 58, hdt: 80, density: 1.32, printTemp: '245–260',
    url: '/cf-petg/'
  },
  'pc-abs': {
    name: 'PC-ABS', color: '#f97316',
    dims: [5, 6, 8, 7, 6, 6, 5, 4, 5],
    tensile: 48, hdt: 108, density: 1.12, printTemp: '260–270',
    url: '/pc-abs/'
  },
  'asa': {
    name: 'ASA', color: '#84cc16',
    dims: [4, 5, 7, 6, 6, 5, 6, 5, 7],
    tensile: 42, hdt: 98, density: 1.06, printTemp: '245–255',
    url: '/asa/'
  },"""


# ─── Material data ────────────────────────────────────────────────────────────

MATS = {

'nylon-pa12': dict(
    file='nylon.html',
    name='Nylon PA12',
    heroImg='NYLON-SPOOL.png',
    heroImgAlt='Fracktal Nylon PA12 filament spool on black background',
    title='Nylon PA12 Filament — Fracktal Works',
    metaDesc='Fracktal Nylon PA12 filament: tough, fatigue-resistant, low-friction engineering polymer. Print on Dragon, Twin Dragon, Julia or Volterra.',
    overline='FDM Material · Engineering Polymer',
    h1='Nylon PA12',
    descriptor='Tough, low-friction polyamide for moving parts, snap-fits, and wear-resistant mechanical components.',
    tags=['Engineering', 'Nylon', 'Low Friction', 'Fatigue Resistant', 'PA12'],
    heroTensile='50', heroHDT='78', heroDensity='1.01', heroPrintTemp='250–265',
    primaryKey='nylon-pa12',
    compareDefault='cf-pa',
    qrCategory='Engineering Polymer',
    qrBasePolymer='Polyamide 12 (PA12)',
    qrFiller='None',
    qrTensile='50 MPa', qrHDT='78 °C', qrDensity='1.01 g/cm³',
    qrMoisture='Hygroscopic — dry 70 °C / 12 h before printing',
    qrNozzleTemp='250–265 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Hardened steel or brass',
    qrBedTemp='70–80 °C', qrEnclosure='Recommended (helps adhesion)', qrPostProcess='Sand, drill, tap, acetone wipe',
    propCards=[
        dict(id='tensile',   name='Tensile Strength',  val='50 MPa',      ctx='Strong enough for structural brackets and load-bearing clips.'),
        dict(id='hdt',       name='Heat Deflection',   val='78 °C',        ctx='Safe for under-bonnet and industrial parts up to 70 °C continuous.'),
        dict(id='density',   name='Density',           val='1.01 g/cm³',  ctx='Lightest engineering polymer in the Fracktal range.'),
        dict(id='friction',  name='Friction (CoF)',    val='0.20–0.25',   ctx='Self-lubricating surface — ideal for gears, bearings, and slides.'),
        dict(id='elongation',name='Elongation at Break', val='25–35 %',      ctx='Absorbs impact and deformation without sudden fracture.'),
        dict(id='moisture',  name='Moisture Absorption',val='1.5 % (sat.)',ctx='Must be dried before printing; store in sealed container.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='240 °C', rec='250–265 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='60 °C',  rec='70–80 °C'),
        dict(icon='🏠', req='Enclosure',           min='Passive',rec='Heated (40–50 °C)'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Hardened Steel'),
        dict(icon='💨', req='Cooling Fan',         min='Off',    rec='Off or minimal'),
        dict(icon='🔄', req='Retraction',          min='Low',    rec='2–4 mm @ 40 mm/s'),
    ],
    machCallout='<strong>Drying is mandatory.</strong> Nylon PA12 is highly hygroscopic — wet filament causes bubbling, stringing, and weak layer adhesion. Dry at 70 °C for 12 h before printing and print from a dry box.',
    appTiles=[
        dict(id='auto',       sector='Automotive',        items=['Cable clips &amp; conduit holders','Sliding bushings','Engine bay brackets']),
        dict(id='industrial', sector='Industrial',        items=['Wear-resistant guides','Conveyor components','Machine snap-fits']),
        dict(id='consumer',   sector='Consumer / Sports', items=['Bicycle derailleur parts','Tool handles','Sports equipment clips']),
        dict(id='rd',         sector='R&amp;D / Prototyping', items=['Functional mechanical prototypes','Test jigs','Fatigue test specimens']),
    ],
    useItems=[
        'You need fatigue resistance and repeated flex cycles',
        'Low-friction sliding or bearing surfaces are required',
        'The part must resist moderate impact without brittle failure',
        'Weight reduction matters — lightest engineering option',
        'Print temperature ≤ 265 °C is required',
    ],
    avoidItems=[
        'Prolonged UV or outdoor exposure (use ASA instead)',
        'Operating temperature above 80 °C continuously (use PC)',
        'High dimensional precision with moisture-sensitive fit',
        'Very tight tolerances — Nylon absorbs moisture and expands',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.2 mm', body='PA12 needs at least 3 perimeters for structural benefit. Thinner walls flex unpredictably under load.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='Hygroscopic expansion can close tight holes after printing. Add 0.1–0.2 mm clearance on bore diameters.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 45°', body='PA12 bridges well but long unsupported overhangs sag. Use supports for faces beyond 45° from vertical.'),
        dict(id='dry',     icon='💧', title='Mandatory Pre-Drying', body='Dry at 70 °C for 12 h in a filament dryer or oven before printing. Store in sealed bags with desiccant — even between prints.'),
    ],
    printerDesc='Nylon PA12 requires an enclosed print environment and temperatures up to 265 °C. These Fracktal machines meet every requirement out of the box.',
    snowflakeOk=False,
    snowflakeReason='PA12 requires an enclosure to prevent warping and layer delamination.',
    ctaH2='Ready to print in Nylon PA12?',
    ctaP='Order Fracktal Nylon PA12 filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal Nylon PA12 Filament',
    schemaDesc='Polyamide 12 filament for FDM 3D printing — tough, low-friction engineering polymer.',
    schemaMaterial='Polyamide 12 (PA12)', schemaTensile='50', schemaHDT='78', schemaDensity='1.01', schemaPrintTemp='250-265',
    urlSlug='nylon', schemaUrl='https://fracktal.in/materials/nylon/',
),

'petg': dict(
    file='petg.html',
    name='PETG',
    heroImg='PETG-Spool.png',
    heroImgAlt='Fracktal PETG filament spool on black background',
    title='PETG Filament — Fracktal Works',
    metaDesc='Fracktal PETG filament: chemical-resistant, easy to print, tough general-purpose copolyester. Compatible with all Fracktal printers including Snowflake.',
    overline='FDM Material · General Purpose',
    h1='PETG',
    descriptor='Chemical-resistant copolyester balancing ease of printing with genuine mechanical toughness — the everyday workhorse.',
    tags=['General Purpose', 'Chemical Resistant', 'Easy Print', 'Copolyester', 'PETG'],
    heroTensile='48', heroHDT='70', heroDensity='1.27', heroPrintTemp='235–245',
    primaryKey='petg',
    compareDefault='cf-pa',
    qrCategory='General Purpose Copolyester',
    qrBasePolymer='Polyethylene Terephthalate Glycol (PETG)',
    qrFiller='None',
    qrTensile='48 MPa', qrHDT='70 °C', qrDensity='1.27 g/cm³',
    qrMoisture='Low — dry 65 °C / 4 h if stored unsealed',
    qrNozzleTemp='235–245 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass or hardened steel',
    qrBedTemp='70–85 °C', qrEnclosure='Optional (reduces stringing)', qrPostProcess='Sand, drill, light acetone polish',
    propCards=[
        dict(id='tensile',   name='Tensile Strength',  val='48 MPa',       ctx='Comparable to ABS with far better layer adhesion.'),
        dict(id='hdt',       name='Heat Deflection',   val='70 °C',         ctx='Suitable for most indoor applications; avoids hot car interiors.'),
        dict(id='density',   name='Density',           val='1.27 g/cm³',   ctx='Mid-range density — heavier than PLA, lighter than PC.'),
        dict(id='chem',      name='Chemical Resistance', val='Good',        ctx='Resists dilute acids, alkalis, and most common solvents.'),
        dict(id='elongation',name='Elongation at Break', val='20–30 %',     ctx='Ductile failure mode — bends before snapping.'),
        dict(id='moisture',  name='Moisture Absorption', val='0.2 % (sat.)',ctx='Low hygroscopicity — brief drying usually sufficient.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='230 °C', rec='235–245 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='65 °C',  rec='70–85 °C'),
        dict(icon='🏠', req='Enclosure',           min='Open',   rec='Optional enclosure'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass or hardened steel'),
        dict(icon='💨', req='Cooling Fan',         min='25 %',   rec='50–75 %'),
        dict(icon='🔄', req='Retraction',          min='3 mm',   rec='4–6 mm @ 45 mm/s'),
    ],
    machCallout='<strong>PEI bed with glue stick:</strong> PETG bonds very aggressively to PEI. Apply a thin glue stick layer as a release agent — otherwise you risk damaging the print surface when removing parts.',
    appTiles=[
        dict(id='mech',    sector='Mechanical / Structural', items=['General-purpose brackets','Enclosure panels','Structural supports']),
        dict(id='chem',    sector='Chemical / Lab',          items=['Chemical-resistant containers','Lab equipment components','Fluid contact parts']),
        dict(id='elec',    sector='Electronics',             items=['Translucent housings','Cable management clips','PCB enclosures']),
        dict(id='rd',      sector='R&amp;D / Prototyping',   items=['Functional fit-check models','Rapid iteration parts','Test fixtures']),
    ],
    useItems=[
        'You need chemical resistance for solvents or dilute acids',
        'Easy printing with minimal warping or cracking',
        'Parts will see moderate mechanical loads and impacts',
        'Semi-transparent or clear aesthetics are desirable',
        'A Snowflake desktop printer is the available machine',
    ],
    avoidItems=[
        'Operating temperature above 70 °C (use ABS or PC)',
        'Very high-stress or fatigue-critical structural parts (use Nylon)',
        'Surfaces that contact food or beverages (use food-grade alternatives)',
        'Parts requiring acetone vapour smoothing (use ABS)',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 0.8 mm', body='PETG layers bond well — 2 perimeters give a solid wall. Use 3+ for structural parts.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.2 mm', body='PETG expands slightly on cooling. Add 0.1 mm clearance on precision fits.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 50°', body='PETG bridges better than ABS. Use supports at 50° or beyond for critical surfaces.'),
        dict(id='bed',     icon='🛏️', title='PEI Bed — Use Glue Stick', body='PETG sticks too aggressively to bare PEI. A thin layer of glue stick prevents tearing when removing prints.'),
    ],
    printerDesc='PETG prints easily on any Fracktal machine, including the open-frame Snowflake desktop printer. No enclosure required.',
    snowflakeOk=True,
    snowflakeReason='',
    ctaH2='Ready to print in PETG?',
    ctaP='Order Fracktal PETG filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal PETG Filament',
    schemaDesc='PETG copolyester filament for FDM 3D printing — chemical-resistant general-purpose engineering material.',
    schemaMaterial='Polyethylene Terephthalate Glycol (PETG)', schemaTensile='48', schemaHDT='70', schemaDensity='1.27', schemaPrintTemp='235-245',
    urlSlug='pet-g-polyethylene-terephthalate-glycol', schemaUrl='https://fracktal.in/materials/petg/',
),

'pla': dict(
    file='pla.html',
    name='PLA',
    heroImg='PLA-SPool.png',
    heroImgAlt='Fracktal PLA filament spool on black background',
    title='PLA Filament — Fracktal Works',
    metaDesc='Fracktal PLA filament: easy to print, dimensionally accurate, ideal for prototypes, models and education. Runs on all Fracktal printers.',
    overline='FDM Material · Basic / Prototyping',
    h1='PLA',
    descriptor='The benchmark entry material — easiest to print, highest overhang tolerance, and best dimensional accuracy for concept models and display parts.',
    tags=['Easy Print', 'Prototyping', 'Educational', 'Biobased', 'PLA'],
    heroTensile='56', heroHDT='53', heroDensity='1.24', heroPrintTemp='200–215',
    primaryKey='pla',
    compareDefault='petg',
    qrCategory='Standard / Prototyping',
    qrBasePolymer='Polylactic Acid (PLA)',
    qrFiller='None',
    qrTensile='56 MPa', qrHDT='53 °C', qrDensity='1.24 g/cm³',
    qrMoisture='Low — dry 45 °C / 4 h if stored unsealed',
    qrNozzleTemp='200–215 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass',
    qrBedTemp='50–60 °C', qrEnclosure='Not required', qrPostProcess='Sand, prime, paint; not acetone-compatible',
    propCards=[
        dict(id='tensile',   name='Tensile Strength',  val='56 MPa',       ctx='Surprisingly strong in tension — good for static display parts.'),
        dict(id='hdt',       name='Heat Deflection',   val='53 °C',         ctx='Softens above 50 °C — avoid hot environments or direct sunlight.'),
        dict(id='density',   name='Density',           val='1.24 g/cm³',   ctx='Light and rigid — ideal for display models.'),
        dict(id='overhang',  name='Overhang Tolerance', val='Up to 55°',   ctx='Best overhang performance of all common FDM materials.'),
        dict(id='accuracy',  name='Dimensional Accuracy', val='±0.2 %',    ctx='Low shrinkage — excellent for precise fit-check prototypes.'),
        dict(id='moisture',  name='Moisture Absorption', val='0.5 % (sat.)',ctx='Store sealed; brittle printing is a sign of moisture uptake.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='195 °C', rec='200–215 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='50 °C',  rec='50–60 °C'),
        dict(icon='🏠', req='Enclosure',           min='Open',   rec='Not required'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass'),
        dict(icon='💨', req='Cooling Fan',         min='50 %',   rec='100 %'),
        dict(icon='🔄', req='Retraction',          min='3 mm',   rec='4–6 mm @ 50 mm/s'),
    ],
    machCallout='<strong>Maximum cooling fan:</strong> PLA benefits from full 100 % cooling. High airflow gives sharp overhangs, bridges, and fine details. Keep the enclosure open or off when printing PLA.',
    appTiles=[
        dict(id='proto',   sector='Rapid Prototyping', items=['Concept models','Form-check prototypes','Client presentation models']),
        dict(id='edu',     sector='Education',          items=['Teaching aids &amp; anatomical models','Architectural scale models','STEM project parts']),
        dict(id='consumer',sector='Consumer / Display', items=['Display items &amp; figurines','Art installations','Low-load decorative parts']),
        dict(id='rd',      sector='R&amp;D / Iteration', items=['Fast design-cycle iterations','Fit-check models','Sacrificial test prints']),
    ],
    useItems=[
        'You need the fastest, easiest print with minimal settings',
        'Dimensional accuracy and fine detail matter most',
        'The part will not see temperatures above 50 °C',
        'No mechanical stress or impact loading is expected',
        'You want the broadest printer compatibility, including Snowflake',
    ],
    avoidItems=[
        'Any load-bearing or impact-critical application',
        'Outdoor or UV-exposed environments (use ASA)',
        'Temperatures above 50 °C (hot car, near appliances — use PETG or ABS)',
        'Parts that need acetone smoothing or chemical post-processing',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 0.8 mm', body='PLA is rigid and brittle in thin sections. Use 2 perimeters minimum; 3 for anything that will be handled.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.0 mm', body='PLA prints with low shrinkage — minimal clearance adjustment needed. Add 0.05–0.1 mm for precision fits.'),
        dict(id='overhang',icon='📏', title='Excellent Overhang: Up to 55°', body='PLA with 100 % cooling gives the best overhang of any common FDM material. Design with confidence up to 55° from vertical.'),
        dict(id='heat',    icon='🌡️', title='Avoid Heat Loading', body='PLA softens at 50 °C — never use for parts near hot appliances, in cars, or under direct outdoor sun. Switch to PETG or ABS for those environments.'),
    ],
    printerDesc='PLA requires no enclosure and prints at the lowest temperatures — compatible with every Fracktal machine, including the open-frame Snowflake desktop printer.',
    snowflakeOk=True,
    snowflakeReason='',
    ctaH2='Ready to print in PLA?',
    ctaP='Order Fracktal PLA filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal PLA Filament',
    schemaDesc='PLA filament for FDM 3D printing — easy-to-print, dimensionally accurate prototyping material.',
    schemaMaterial='Polylactic Acid (PLA)', schemaTensile='56', schemaHDT='53', schemaDensity='1.24', schemaPrintTemp='200-215',
    urlSlug='pla', schemaUrl='https://fracktal.in/materials/pla/',
),

'cf-petg': dict(
    file='cf-petg.html',
    name='CF-PETG',
    heroImg='CF-PETG-SPool.png',
    heroImgAlt='Fracktal Carbon Fiber PETG filament spool on black background',
    title='CF-PETG (Carbon Fiber PETG) Filament — Fracktal Works',
    metaDesc='Fracktal CF-PETG filament: short-carbon-fiber reinforced copolyester for stiff, lightweight tooling jigs and drone frames. All-metal nozzle required.',
    overline='FDM Material · Engineering Composite',
    h1='Carbon Fiber PETG<br>(CF-PETG)',
    descriptor='Short-carbon-fiber reinforced PETG for stiff, dimensionally stable structural parts where chemical resistance matters.',
    tags=['Composite', 'Carbon Fiber', 'Stiff', 'Low Warp', 'CF-PETG'],
    heroTensile='58', heroHDT='80', heroDensity='1.32', heroPrintTemp='245–260',
    primaryKey='cf-petg',
    compareDefault='cf-pa',
    qrCategory='Engineering Composite',
    qrBasePolymer='Polyethylene Terephthalate Glycol (PETG)',
    qrFiller='Short-cut carbon fibre (~15 wt%)',
    qrTensile='58 MPa', qrHDT='80 °C', qrDensity='1.32 g/cm³',
    qrMoisture='Low — dry 65 °C / 4 h if stored unsealed',
    qrNozzleTemp='245–260 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Hardened steel (mandatory)',
    qrBedTemp='75–90 °C', qrEnclosure='Recommended', qrPostProcess='Sand, drill, tap; carbon dust — wear a mask',
    propCards=[
        dict(id='tensile',  name='Tensile Strength',  val='58 MPa',       ctx='15–20 % stronger than unfilled PETG in the print direction.'),
        dict(id='hdt',      name='Heat Deflection',   val='80 °C',         ctx='10 °C higher than unfilled PETG — improved thermal stability.'),
        dict(id='stiffness',name='Stiffness (Modulus)', val='4.5 GPa',       ctx='Twice as stiff as standard PETG — near-aluminium feel at low weight.'),
        dict(id='density',  name='Density',           val='1.32 g/cm³',   ctx='Denser than unfilled PETG but stiffer — better specific stiffness.'),
        dict(id='warp',     name='Warp / Shrinkage',  val='Very Low',      ctx='Carbon fibre restricts thermal contraction — excellent dimensional stability.'),
        dict(id='finish',   name='Surface Finish',    val='Matte / Textured', ctx='Carbon content gives a uniform matte texture — no extra treatment needed.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='240 °C', rec='245–260 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='70 °C',  rec='75–90 °C'),
        dict(icon='🏠', req='Enclosure',           min='Passive',rec='Recommended'),
        dict(icon='🔩', req='Nozzle Material',     min='Hardened steel', rec='Hardened steel 0.4 mm+'),
        dict(icon='💨', req='Cooling Fan',         min='25 %',   rec='50 %'),
        dict(icon='🔄', req='Retraction',          min='3 mm',   rec='4–5 mm @ 40 mm/s'),
    ],
    machCallout='<strong>Hardened steel nozzle is mandatory.</strong> Carbon fibre will abrade a brass nozzle within minutes of printing, causing diameter growth, stringing, and dimension drift. Never use brass with CF-PETG.',
    appTiles=[
        dict(id='tooling', sector='Tooling / Jigs',     items=['Assembly jigs &amp; fixtures','Go/no-go gauges','Welding locators']),
        dict(id='drone',   sector='Drone / Robotics',   items=['UAV frames &amp; arms','Robot chassis plates','Camera mounts']),
        dict(id='auto',    sector='Automotive',         items=['Interior mounting brackets','Sensor housings','Panel clips']),
        dict(id='rd',      sector='R&amp;D / Prototyping', items=['Reinforced structural prototypes','Stiffness-critical test parts','Lightweight mechanical parts']),
    ],
    useItems=[
        'High stiffness-to-weight ratio is the design requirement',
        'Chemical resistance needed alongside structural performance',
        'Dimensional stability under thermal cycling is critical',
        'Matte surface texture is acceptable or desirable',
        'You have a hardened steel nozzle',
    ],
    avoidItems=[
        'Brass nozzle only — will wear rapidly (use unfilled PETG instead)',
        'Parts needing smooth polished finish (surface is matte and textured)',
        'Very long slender spans — impact strength is lower than unfilled PETG',
        'Food contact applications',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.2 mm (3+ perimeters)', body='Fibre alignment benefit only appears at 3+ perimeters. Below that, you lose most of the stiffness advantage.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='CF-PETG has very low shrinkage but fibre bunching near small holes can reduce accuracy. Add 0.1 mm bore clearance.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 45°', body='Carbon fibre does not improve overhang — use supports beyond 45°. Keep unsupported spans under 30 mm.'),
        dict(id='nozzle',  icon='🔩', title='Hardened Steel Nozzle Required', body='Carbon fibres abrade brass nozzles in minutes. Use hardened steel (or ruby) and replace at first sign of wear.'),
    ],
    printerDesc='CF-PETG requires an all-metal hot-end with a hardened steel nozzle and reaches up to 260 °C. Dragon, Twin Dragon, Julia, and Volterra all meet these requirements.',
    snowflakeOk=False,
    snowflakeReason='CF-PETG requires temperatures above the Snowflake\'s rated hot-end range and needs a hardened steel nozzle.',
    ctaH2='Ready to print in CF-PETG?',
    ctaP='Order Fracktal CF-PETG filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal CF-PETG Filament',
    schemaDesc='Carbon fiber reinforced PETG filament for FDM 3D printing — stiff, chemically resistant engineering composite.',
    schemaMaterial='Carbon Fiber PETG Composite', schemaTensile='58', schemaHDT='80', schemaDensity='1.32', schemaPrintTemp='245-260',
    urlSlug='cf-petg', schemaUrl='https://fracktal.in/materials/cf-petg/',
),

'abs': dict(
    file='abs.html',
    name='ABS',
    heroImg='ABS-Spool.png',
    heroImgAlt='Fracktal ABS filament spool on black background',
    title='ABS Filament — Fracktal Works',
    metaDesc='Fracktal ABS filament: classic engineering thermoplastic with excellent post-processing, acetone smoothing and machining. Enclosed printer required.',
    overline='FDM Material · General Purpose Engineering',
    h1='ABS',
    descriptor='Classic engineering thermoplastic with high-impact resistance, excellent post-processability, and broad chemical compatibility.',
    tags=['Engineering', 'Post-Processable', 'Acetone Smoothing', 'Impact Resistant', 'ABS'],
    heroTensile='38', heroHDT='96', heroDensity='1.05', heroPrintTemp='235–245',
    primaryKey='abs',
    compareDefault='petg',
    qrCategory='General Purpose Engineering',
    qrBasePolymer='Acrylonitrile Butadiene Styrene (ABS)',
    qrFiller='None',
    qrTensile='38 MPa', qrHDT='96 °C', qrDensity='1.05 g/cm³',
    qrMoisture='Low — dry 60 °C / 4 h if stored unsealed',
    qrNozzleTemp='235–245 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass or hardened steel',
    qrBedTemp='95–110 °C', qrEnclosure='Required (prevents warping)', qrPostProcess='Acetone vapour smooth, sand, paint, drill, tap',
    propCards=[
        dict(id='tensile',   name='Tensile Strength',  val='38 MPa',       ctx='Lower than PETG in tension but tough under impact loading.'),
        dict(id='hdt',       name='Heat Deflection',   val='96 °C',         ctx='Handles 80–90 °C continuous — suitable for automotive interior parts.'),
        dict(id='density',   name='Density',           val='1.05 g/cm³',   ctx='Lightweight — second only to Nylon PA12 in the Fracktal range.'),
        dict(id='postproc',  name='Post-Processing',   val='Excellent',     ctx='Acetone vapour smoothing gives near-injection-moulded surface finish.'),
        dict(id='elongation',name='Elongation at Break', val='5–10 %',      ctx='Moderate ductility — can absorb sudden impacts without shattering.'),
        dict(id='machinability', name='Machinability', val='Very Good',     ctx='Drills, taps, and machines cleanly with standard tooling.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='230 °C', rec='235–245 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='95 °C',  rec='100–110 °C'),
        dict(icon='🏠', req='Enclosure',           min='Enclosed (required)', rec='Heated (45–55 °C)'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass or hardened steel'),
        dict(icon='💨', req='Cooling Fan',         min='Off',    rec='Off (warp risk)'),
        dict(icon='🔄', req='Retraction',          min='3 mm',   rec='4–5 mm @ 45 mm/s'),
    ],
    machCallout='<strong>Enclosure required.</strong> ABS warps severely on open-frame printers. A heated enclosure (45–55 °C) is mandatory. Turn off the cooling fan entirely — rapid cooling causes layer cracking.',
    appTiles=[
        dict(id='auto',    sector='Automotive',        items=['Interior panels &amp; trims','Dashboard components','Sensor brackets']),
        dict(id='elec',    sector='Electronics',       items=['Device enclosures &amp; housings','Connector bodies','PCB covers']),
        dict(id='consumer',sector='Consumer Products', items=['Tool casings','Appliance parts','Consumer product housings']),
        dict(id='rd',      sector='R&amp;D / Prototyping', items=['High-temp functional prototypes','Acetone-smoothed display parts','Machined finished parts']),
    ],
    useItems=[
        'Operating temperature up to 90 °C continuously',
        'Acetone vapour smoothing for near-injection-moulded finish',
        'Lightweight and machineable end-use parts',
        'Classic electronics and automotive enclosures',
        'Post-processing (sand, prime, paint) is part of the workflow',
    ],
    avoidItems=[
        'Open-frame printers without enclosure (warping is severe)',
        'Chemically aggressive environments (use PETG or PVDF)',
        'Outdoor / UV exposure (use ASA — direct ABS upgrade)',
        'High fatigue or snap-fit applications (use Nylon PA12)',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.0 mm', body='ABS shrinks during cooling — 2 minimum perimeters. Use 3 for anything structural or snap-fit.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='ABS shrinkage can close small holes. Add 0.1–0.2 mm to bore diameters.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 45°', body='Without cooling fan, overhang quality drops quickly. Design with supports beyond 45° from vertical.'),
        dict(id='acetone', icon='✨', title='Design for Acetone Smoothing', body='If smoothing is planned, add 0.2–0.3 mm to all dimensions — acetone removes material. Round all corners; acetone pooling ruins sharp internal edges.'),
    ],
    printerDesc='ABS requires a heated enclosure to prevent warping. Dragon, Twin Dragon, Julia, and Volterra all provide the enclosed environment ABS demands.',
    snowflakeOk=False,
    snowflakeReason='ABS requires a heated enclosed chamber to prevent warping. Open-frame printers cannot reliably print ABS.',
    ctaH2='Ready to print in ABS?',
    ctaP='Order Fracktal ABS filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal ABS Filament',
    schemaDesc='ABS filament for FDM 3D printing — classic engineering thermoplastic with acetone smoothing and excellent machinability.',
    schemaMaterial='Acrylonitrile Butadiene Styrene (ABS)', schemaTensile='38', schemaHDT='96', schemaDensity='1.05', schemaPrintTemp='235-245',
    urlSlug='abs-acrylonitrile-butadiene-styrene', schemaUrl='https://fracktal.in/materials/abs/',
),

'polycarbonate': dict(
    file='polycarbonate.html',
    name='Polycarbonate (PC)',
    heroImg='PC-Spool.png',
    heroImgAlt='Fracktal Polycarbonate PC filament spool on black background',
    title='Polycarbonate (PC) Filament — Fracktal Works',
    metaDesc='Fracktal Polycarbonate PC filament: highest heat resistance and impact strength in the Fracktal range. Requires 280–300 °C hot-end.',
    overline='FDM Material · High-Performance Engineering',
    h1='Polycarbonate<br>(PC)',
    descriptor='Highest impact resistance and heat deflection in the Fracktal range — the engineering choice when nothing else survives.',
    tags=['High Performance', 'Optical Grade', 'High-Temp', 'Impact Resistant', 'Polycarbonate'],
    heroTensile='62', heroHDT='134', heroDensity='1.20', heroPrintTemp='280–300',
    primaryKey='polycarbonate',
    compareDefault='cf-pa',
    qrCategory='High-Performance Engineering',
    qrBasePolymer='Polycarbonate (PC)',
    qrFiller='None',
    qrTensile='62 MPa', qrHDT='134 °C', qrDensity='1.20 g/cm³',
    qrMoisture='Moderate — dry 70 °C / 8 h before printing',
    qrNozzleTemp='280–300 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Hardened steel',
    qrBedTemp='100–120 °C', qrEnclosure='Required + heated chamber (65–75 °C)', qrPostProcess='Sand, drill, tap, polish to optical clarity',
    propCards=[
        dict(id='tensile',  name='Tensile Strength',   val='62 MPa',       ctx='Second only to CF-PA in the Fracktal range.'),
        dict(id='hdt',      name='Heat Deflection',    val='134 °C',        ctx='Highest HDT in the Fracktal range — survives under-bonnet automotive environments.'),
        dict(id='impact',   name='Impact Strength',    val='800+ J/m',      ctx='Near-unbreakable under sudden impact — chosen for safety shields.'),
        dict(id='density',  name='Density',            val='1.20 g/cm³',   ctx='Moderate weight for the level of performance delivered.'),
        dict(id='optical',  name='Optical Clarity',    val='Excellent (natural)',  ctx='Natural PC is optically clear — suitable for light pipes and lenses.'),
        dict(id='creep',    name='Creep Resistance',   val='Very High',     ctx='Holds dimensions under sustained load at elevated temperature.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='270 °C', rec='280–300 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='100 °C', rec='110–120 °C'),
        dict(icon='🏠', req='Enclosure',           min='Enclosed (required)', rec='Heated chamber 65–75 °C'),
        dict(icon='🏠', req='Chamber Temperature', min='55 °C',  rec='65–75 °C'),
        dict(icon='🔩', req='Nozzle Material',     min='Hardened steel', rec='Hardened steel'),
        dict(icon='💨', req='Cooling Fan',         min='Off',    rec='Off (delamination risk)'),
    ],
    machCallout='<strong>Heated chamber critical.</strong> PC delaminates between layers without a chamber temperature of 65–75 °C. Open-frame or passively enclosed printers will produce structurally weak prints. A 280–300 °C all-metal hot-end is also mandatory.',
    appTiles=[
        dict(id='safety',  sector='Safety &amp; Protection', items=['Protective shields &amp; barriers','Safety goggles &amp; lenses','Machine guards']),
        dict(id='auto',    sector='Automotive',              items=['Under-bonnet structural components','High-temp sensor housings','Interior structural brackets']),
        dict(id='elec',    sector='Electronics',             items=['High-impact device enclosures','LED light pipes','Electrical insulation parts']),
        dict(id='rd',      sector='R&amp;D / Prototyping',   items=['High-temperature functional prototypes','Load-bearing test specimens','Optical light-guide prototypes']),
    ],
    useItems=[
        'Continuous operating temperature above 100 °C',
        'Maximum impact resistance is the primary requirement',
        'Optical transparency in natural colour is needed',
        'Sustained load-bearing (creep resistance matters)',
        'Safety-critical applications with failure consequences',
    ],
    avoidItems=[
        'You only have an open-frame printer (delamination certain)',
        'Budget material for non-critical parts (use PETG or ABS)',
        'Chemically aggressive solvents — PC dissolves in ketones, esters',
        'UV-exposed outdoor applications (use ASA or UV-stabilised grades)',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.0 mm', body='PC needs 3 perimeters minimum for reliable layer-to-layer bonding. Thin walls tend to delaminate without a heated chamber.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='PC shrinks on cooling. Add 0.1–0.15 mm to bore diameters for press-fit or clearance holes.'),
        dict(id='chamber', icon='🌡️', title='Heated Chamber is Non-Negotiable', body='PC without a 65–75 °C chamber will delaminate. If your printer cannot maintain chamber temperature, switch to PC-ABS instead.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 40°', body='Without cooling fan, PC overhangs degrade quickly. Keep unsupported spans under 25 mm and stay inside 40°.'),
    ],
    printerDesc='Polycarbonate demands 280–300 °C nozzle temperature and a heated chamber at 65–75 °C. Dragon, Twin Dragon, Julia, and Volterra all meet these extreme requirements.',
    snowflakeOk=False,
    snowflakeReason='PC requires 280–300 °C — beyond Snowflake\'s rated temperature — and needs a heated enclosed chamber at 65–75 °C.',
    ctaH2='Ready to print in Polycarbonate?',
    ctaP='Order Fracktal Polycarbonate PC filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal Polycarbonate (PC) Filament',
    schemaDesc='Polycarbonate PC filament for FDM 3D printing — highest heat deflection and impact resistance in the Fracktal range.',
    schemaMaterial='Polycarbonate (PC)', schemaTensile='62', schemaHDT='134', schemaDensity='1.20', schemaPrintTemp='280-300',
    urlSlug='polycarbonate', schemaUrl='https://fracktal.in/materials/polycarbonate/',
),

'pc-abs': dict(
    file='pc-abs.html',
    name='PC-ABS',
    heroImg='PC-ABS-SPOOL.png',
    heroImgAlt='Fracktal PC-ABS blend filament spool on black background',
    title='PC-ABS Blend Filament — Fracktal Works',
    metaDesc='Fracktal PC-ABS filament: polycarbonate-ABS alloy combining PC strength and heat resistance with ABS processability. Ideal for device housings.',
    overline='FDM Material · Engineering Blend',
    h1='PC-ABS Blend',
    descriptor='Polycarbonate-ABS alloy delivering PC-level heat resistance and impact strength with ABS-level printability — the ideal balance for device housings.',
    tags=['Engineering Blend', 'Tough', 'High-Temp', 'Post-Processable', 'PC-ABS'],
    heroTensile='48', heroHDT='108', heroDensity='1.12', heroPrintTemp='260–270',
    primaryKey='pc-abs',
    compareDefault='abs',
    qrCategory='Engineering Blend',
    qrBasePolymer='Polycarbonate + ABS alloy',
    qrFiller='None',
    qrTensile='48 MPa', qrHDT='108 °C', qrDensity='1.12 g/cm³',
    qrMoisture='Low — dry 65 °C / 6 h before printing',
    qrNozzleTemp='260–270 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass or hardened steel',
    qrBedTemp='95–110 °C', qrEnclosure='Required + chamber recommended (55–65 °C)', qrPostProcess='Acetone smooth, sand, paint, drill, tap',
    propCards=[
        dict(id='tensile',  name='Tensile Strength',  val='48 MPa',        ctx='Matches PETG in tension, outperforms ABS under impact.'),
        dict(id='hdt',      name='Heat Deflection',   val='108 °C',         ctx='30 °C higher than ABS — suitable for automotive interiors.'),
        dict(id='impact',   name='Impact Strength',   val='High',           ctx='PC component delivers outstanding resistance to sudden impacts.'),
        dict(id='density',  name='Density',           val='1.12 g/cm³',    ctx='Lighter than pure PC — better specific mechanical performance.'),
        dict(id='postproc', name='Post-Processing',   val='Excellent',      ctx='Acetone smoothable like ABS; drills and taps cleanly.'),
        dict(id='printability', name='Printability',  val='Good',           ctx='Easier than pure PC — lower temps and reduced warping tendency.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='255 °C', rec='260–270 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='95 °C',  rec='100–110 °C'),
        dict(icon='🏠', req='Enclosure',           min='Enclosed (required)', rec='Heated chamber 55–65 °C'),
        dict(icon='🏠', req='Chamber Temperature', min='45 °C',  rec='55–65 °C'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass or hardened steel'),
        dict(icon='💨', req='Cooling Fan',         min='Off',    rec='Off or minimal'),
    ],
    machCallout='<strong>Heated chamber recommended.</strong> The PC component in PC-ABS benefits from a 55–65 °C chamber to ensure proper interlayer bonding and reduce warping. Prints are functional in a passively heated enclosure but chamber temp improves quality significantly.',
    appTiles=[
        dict(id='auto',    sector='Automotive',        items=['Dashboard &amp; interior frame components','Sensor &amp; camera housings','Air duct parts']),
        dict(id='elec',    sector='Electronics',       items=['Laptop &amp; tablet housings','Wearable device shells','Keyboard frames']),
        dict(id='industrial', sector='Industrial',     items=['Power tool housings','Machine guards','Industrial control panels']),
        dict(id='rd',      sector='R&amp;D / Prototyping', items=['Durable engineering prototypes','High-temp functional models','Post-processed display parts']),
    ],
    useItems=[
        'Heat resistance above 90 °C but you want easier printing than pure PC',
        'High impact resistance alongside good tensile strength',
        'Acetone smoothing or painting is part of the finishing workflow',
        'Consumer electronics or automotive housing applications',
        'Your printer has a heated chamber but not the 280+ °C needed for pure PC',
    ],
    avoidItems=[
        'Open-frame printers without any enclosure (warping is severe)',
        'Continuous temperature above 110 °C (use pure PC)',
        'Chemically aggressive environments — blends can be less resistant than pure PC',
        'Parts needing optical clarity (use pure PC natural)',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.0 mm', body='PC component improves layer bonding but requires 3 perimeters to activate this benefit. Thin walls remain a delamination risk.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='PC-ABS shrinks slightly more than pure ABS. Add 0.1–0.2 mm to bore diameters for close-tolerance fits.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 40°', body='Without cooling fan, overhang quality drops. Keep bridging spans under 25 mm and use supports beyond 40°.'),
        dict(id='acetone', icon='✨', title='Acetone Smoothing Works', body='PC-ABS responds to acetone vapour smoothing like ABS. Add 0.2–0.3 mm to surfaces you plan to smooth, and round sharp internal corners.'),
    ],
    printerDesc='PC-ABS requires 260–270 °C and a heated enclosure. Dragon, Twin Dragon, Julia, and Volterra all meet these requirements — a chamber-heated run significantly improves part quality.',
    snowflakeOk=False,
    snowflakeReason='PC-ABS requires temperatures of 260–270 °C and an enclosed heated chamber to prevent warping and delamination.',
    ctaH2='Ready to print in PC-ABS?',
    ctaP='Order Fracktal PC-ABS filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal PC-ABS Blend Filament',
    schemaDesc='PC-ABS alloy filament for FDM 3D printing — combines polycarbonate heat resistance with ABS processability.',
    schemaMaterial='Polycarbonate-ABS Alloy', schemaTensile='48', schemaHDT='108', schemaDensity='1.12', schemaPrintTemp='260-270',
    urlSlug='pc-abs', schemaUrl='https://fracktal.in/materials/pc-abs/',
),

'asa': dict(
    file='asa.html',
    name='ASA',
    heroImg='ASA-SPOOL.png',
    heroImgAlt='Fracktal ASA filament spool on black background',
    title='ASA Filament — Fracktal Works',
    metaDesc='Fracktal ASA filament: UV-stable outdoor-grade thermoplastic with ABS-like printability. Ideal for exterior automotive parts and outdoor enclosures.',
    overline='FDM Material · Engineering / Outdoor',
    h1='ASA',
    descriptor='UV-stable, weather-resistant thermoplastic — the outdoor-grade ABS upgrade that holds colour and structure under direct sunlight.',
    tags=['UV Resistant', 'Outdoor Grade', 'Weather Resistant', 'ABS Alternative', 'ASA'],
    heroTensile='42', heroHDT='98', heroDensity='1.06', heroPrintTemp='245–255',
    primaryKey='asa',
    compareDefault='abs',
    qrCategory='Engineering / Outdoor Grade',
    qrBasePolymer='Acrylonitrile Styrene Acrylate (ASA)',
    qrFiller='None',
    qrTensile='42 MPa', qrHDT='98 °C', qrDensity='1.06 g/cm³',
    qrMoisture='Low — dry 60 °C / 4 h if stored unsealed',
    qrNozzleTemp='245–255 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass or hardened steel',
    qrBedTemp='90–110 °C', qrEnclosure='Required (prevents warping)', qrPostProcess='Sand, prime, UV-clear coat for extra outdoor life',
    propCards=[
        dict(id='tensile',   name='Tensile Strength',  val='42 MPa',       ctx='Slightly stronger than ABS in tension; similar feel and machinability.'),
        dict(id='hdt',       name='Heat Deflection',   val='98 °C',         ctx='Handles 80–90 °C continuous — reliable for outdoor summer temperatures.'),
        dict(id='uv',        name='UV Resistance',     val='Excellent',     ctx='The acrylate monomer absorbs UV — colour and surface intact after 1 000+ h outdoor exposure.'),
        dict(id='density',   name='Density',           val='1.06 g/cm³',   ctx='Near-identical to ABS — same weight-class for design comparisons.'),
        dict(id='impact',    name='Impact Resistance', val='Good',          ctx='Comparable to ABS — handles mechanical shock in outdoor environments.'),
        dict(id='weather',   name='Weatherability',    val='Excellent',     ctx='Resists rain, humidity, temperature cycling without surface crazing.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='240 °C', rec='245–255 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='90 °C',  rec='95–110 °C'),
        dict(icon='🏠', req='Enclosure',           min='Enclosed (required)', rec='Heated (45–55 °C)'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass or hardened steel'),
        dict(icon='💨', req='Cooling Fan',         min='Off',    rec='Off (warp risk)'),
        dict(icon='🔄', req='Retraction',          min='3 mm',   rec='4–5 mm @ 45 mm/s'),
    ],
    machCallout='<strong>Enclosure required — cooling fan off.</strong> Like ABS, ASA warps without a heated enclosure. Keep the cooling fan off throughout the print. ASA also benefits from a brim or raft for large flat parts.',
    appTiles=[
        dict(id='outdoor',  sector='Outdoor / Garden',   items=['Garden equipment parts','Outdoor signage &amp; markers','Weatherproof enclosures']),
        dict(id='auto',     sector='Automotive',         items=['Mirror housings','Exterior sensor brackets','Door handle covers']),
        dict(id='marine',   sector='Marine',             items=['Boat deck fittings','Navigation light housings','Bilge hardware']),
        dict(id='industrial', sector='Industrial',       items=['Outdoor junction boxes','Weather station housings','UV-stable industrial labels']),
    ],
    useItems=[
        'Parts will be exposed to UV light or direct sunlight',
        'Outdoor weather resistance (rain, humidity, thermal cycling)',
        'ABS-like printability with an enclosure-equipped printer',
        'You need acetone smoothing or machining capability',
        'Automotive exterior components requiring colour stability',
    ],
    avoidItems=[
        'Open-frame printers — warps like ABS without enclosure',
        'Highest-strength structural parts (use Nylon or PC)',
        'Continuous temperatures above 100 °C (use PC or PC-ABS)',
        'Food contact applications',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.0 mm', body='ASA behaves like ABS in terms of print geometry. Use 3 perimeters for structural outdoor parts.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='ASA has similar shrinkage to ABS. Add 0.1–0.15 mm to bore diameters for close-tolerance fits.'),
        dict(id='overhang',icon='📏', title='Max Overhang: 45°', body='Without cooling fan, overhang quality is limited. Use supports beyond 45° from vertical.'),
        dict(id='uv',      icon='☀️', title='Add UV Clear Coat for Extended Life', body='ASA is inherently UV-resistant but a clear UV-protective topcoat further extends outdoor life to 5+ years and protects paint finishes applied over it.'),
    ],
    printerDesc='ASA requires a heated enclosure to prevent warping, similar to ABS but at slightly higher temperatures. Dragon, Twin Dragon, Julia, and Volterra are all compatible.',
    snowflakeOk=False,
    snowflakeReason='ASA requires a heated enclosed chamber to prevent warping. Open-frame printers cannot reliably print ASA.',
    ctaH2='Ready to print in ASA?',
    ctaP='Order Fracktal ASA filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal ASA Filament',
    schemaDesc='ASA filament for FDM 3D printing — UV-stable outdoor-grade engineering thermoplastic.',
    schemaMaterial='Acrylonitrile Styrene Acrylate (ASA)', schemaTensile='42', schemaHDT='98', schemaDensity='1.06', schemaPrintTemp='245-255',
    urlSlug='asa', schemaUrl='https://fracktal.in/materials/asa/',
),

'tpu-95a': dict(
    file='tpu.html',
    name='TPU 95A',
    heroImg='TPU-SPOOL.png',
    heroImgAlt='Fracktal TPU 95A flexible filament spool on black background',
    title='TPU 95A Flexible Filament — Fracktal Works',
    metaDesc='Fracktal TPU 95A filament: 95 Shore A flexible thermoplastic polyurethane for gaskets, bumpers and vibration dampeners. Direct drive extruder required.',
    overline='FDM Material · Flexible / Elastomer',
    h1='TPU 95A',
    descriptor='Shore 95A thermoplastic polyurethane — flexible, tear-resistant, and abrasion-resistant for seals, gaskets, and protective housings.',
    tags=['Flexible', 'Elastomer', 'Abrasion Resistant', '95A Shore', 'TPU'],
    heroTensile='28', heroHDT='60', heroDensity='1.21', heroPrintTemp='225–235',
    primaryKey='tpu-95a',
    compareDefault='nylon-pa12',
    qrCategory='Flexible / Elastomeric',
    qrBasePolymer='Thermoplastic Polyurethane (TPU)',
    qrFiller='None',
    qrTensile='28 MPa', qrHDT='60 °C', qrDensity='1.21 g/cm³',
    qrMoisture='Moderate — dry 60 °C / 8 h before printing',
    qrNozzleTemp='225–235 °C', qrNozzleDia='≥ 0.4 mm', qrNozzleMat='Brass',
    qrBedTemp='30–50 °C', qrEnclosure='Not required', qrPostProcess='Sand, trim with knife; solvent bonding possible',
    propCards=[
        dict(id='flexibility', name='Flexibility',      val='Shore 95A',    ctx='Firm but compressible — bends under load and returns without set.'),
        dict(id='abrasion',    name='Abrasion Resistance', val='Excellent',  ctx='Outperforms rigid polymers in sliding/wear contact.'),
        dict(id='tensile',     name='Tensile Strength', val='28 MPa',        ctx='Lower in tension than rigid materials but excellent in elongation.'),
        dict(id='elongation',  name='Elongation at Break', val='400–600 %',  ctx='Stretches extensively before failure — ideal for seals and covers.'),
        dict(id='hdt',         name='Heat Deflection',  val='60 °C',         ctx='Softens above 55 °C — avoid extended elevated-temp applications.'),
        dict(id='tear',        name='Tear Resistance',  val='High',          ctx='Resists tearing and notch propagation unlike most rigid plastics.'),
    ],
    machRows=[
        dict(icon='🌡️', req='Nozzle Temperature', min='220 °C', rec='225–235 °C'),
        dict(icon='🛏️', req='Bed Temperature',    min='30 °C',  rec='40–50 °C'),
        dict(icon='🏠', req='Enclosure',           min='Open',   rec='Not required'),
        dict(icon='🔄', req='Extruder',            min='Direct drive',rec='Direct drive (Bowden not recommended)'),
        dict(icon='🔩', req='Nozzle Material',     min='Brass',  rec='Brass 0.4–0.6 mm'),
        dict(icon='💨', req='Cooling Fan',         min='25 %',   rec='50–75 %'),
    ],
    machCallout='<strong>Direct drive extruder required.</strong> TPU 95A is too soft and flexible for Bowden tubes — the filament buckles and jams in the gap between tube and nozzle. Disable or minimise retraction (≤ 1 mm, ≤ 25 mm/s) to prevent buckling inside the drive gear.',
    appTiles=[
        dict(id='seals',   sector='Seals &amp; Gaskets',    items=['Custom O-rings &amp; seals','Compression gaskets','Weatherstrip profiles']),
        dict(id='consumer',sector='Consumer / Protective',  items=['Phone cases &amp; bumpers','Grip covers','Wearable straps']),
        dict(id='industrial', sector='Industrial',          items=['Vibration dampening mounts','Flexible hose connectors','Cable strain reliefs']),
        dict(id='rd',      sector='R&amp;D / Prototyping',  items=['Flexible functional prototypes','Compliant mechanism tests','Soft gripper fingers']),
    ],
    useItems=[
        'Flexibility and elasticity are the primary design requirement',
        'Abrasion-resistant surfaces in sliding or wear contact',
        'Seals, gaskets, or O-rings with custom geometry',
        'Protective bumpers or cases that absorb impact',
        'Your machine has a direct drive extruder',
    ],
    avoidItems=[
        'Bowden extruder setups — filament jams in the tube gap',
        'Continuous use above 55 °C (TPU softens; use silicone instead)',
        'High-load structural parts — low tensile modulus',
        'Very fine detail — flexible materials struggle with overhangs',
    ],
    dfamTips=[
        dict(id='wall',    icon='📐', title='Wall Thickness ≥ 1.2 mm for Stiffness', body='For structural zones within a TPU part (that should NOT flex), use 4+ perimeters. Thin walls flex everywhere.'),
        dict(id='holes',   icon='⭕', title='Min Hole Diameter: 1.5 mm', body='TPU can compress and close small holes when assembled. Add 0.2–0.3 mm clearance to any bore that must remain open under compression.'),
        dict(id='bridge',  icon='📏', title='Max Bridge Span: 8 mm', body='Flexible filament sags quickly on bridges. Keep unsupported spans under 8 mm or add supports. Long overhangs become drooping surfaces.'),
        dict(id='retract', icon='🔄', title='Disable or Minimise Retraction', body='Retraction causes TPU to buckle inside the drive gear. Set retraction to ≤ 1 mm at ≤ 25 mm/s. Print speed ≤ 30 mm/s for consistent results.'),
    ],
    printerDesc='TPU 95A needs a direct drive extruder and moderate temperatures. Dragon, Twin Dragon, Julia, and Volterra all use direct drive — and TPU can also run on the Snowflake desktop printer.',
    snowflakeOk=True,
    snowflakeReason='',
    ctaH2='Ready to print in TPU 95A?',
    ctaP='Order Fracktal TPU 95A filament — available in 500 g and 1 kg spools.',
    schemaName='Fracktal TPU 95A Flexible Filament',
    schemaDesc='TPU 95A flexible filament for FDM 3D printing — Shore 95A elastomer for gaskets, bumpers and vibration dampening.',
    schemaMaterial='Thermoplastic Polyurethane 95A (TPU 95A)', schemaTensile='28', schemaHDT='60', schemaDensity='1.21', schemaPrintTemp='225-235',
    urlSlug='tpu', schemaUrl='https://fracktal.in/materials/tpu/',
),

}  # end MATS


# ─── QR section generator ─────────────────────────────────────────────────────

def make_qr_section(mat):
    return f'''<!-- ===================== MACHINE-READABLE QUICK REFERENCE ===================== -->
<div class="wrap">
  <section class="quickref" id="specifications" aria-label="Material quick reference" data-od-id="quick-reference">
    <h2>Quick Reference</h2>
    <dl>
      <dt>Material properties</dt>
      <div class="qr-item"><span class="k">Category</span><dd>{mat['qrCategory']}</dd></div>
      <div class="qr-item"><span class="k">Base Polymer</span><dd>{mat['qrBasePolymer']}</dd></div>
      <div class="qr-item"><span class="k">Filler</span><dd>{mat['qrFiller']}</dd></div>
      <div class="qr-item"><span class="k">Tensile Strength</span><dd>{mat['qrTensile']}</dd></div>
      <div class="qr-item"><span class="k">Heat Deflection (HDT)</span><dd>{mat['qrHDT']}</dd></div>
      <div class="qr-item"><span class="k">Density</span><dd>{mat['qrDensity']}</dd></div>
      <div class="qr-item"><span class="k">Moisture Sensitivity</span><dd>{mat['qrMoisture']}</dd></div>
      <div class="qr-item"><span class="k">Nozzle Temp</span><dd>{mat['qrNozzleTemp']}</dd></div>
      <div class="qr-item"><span class="k">Nozzle Diameter</span><dd>{mat['qrNozzleDia']}</dd></div>
      <div class="qr-item"><span class="k">Nozzle Material</span><dd>{mat['qrNozzleMat']}</dd></div>
      <div class="qr-item"><span class="k">Bed Temperature</span><dd>{mat['qrBedTemp']}</dd></div>
      <div class="qr-item"><span class="k">Enclosure</span><dd>{mat['qrEnclosure']}</dd></div>
      <div class="qr-item"><span class="k">Post-Processing</span><dd>{mat['qrPostProcess']}</dd></div>
    </dl>
  </section>
</div>

'''


# ─── Hero section generator ────────────────────────────────────────────────────

def make_hero_section(mat):
    tags_html = ''.join(f'\n          <span class="tag">{t}</span>' for t in mat['tags'])
    return f'''<!-- ===================== HERO ===================== -->
<header class="hero" id="overview" data-od-id="hero">
  <div class="wrap">
    <div class="hero__inner">
      <div class="hero__content">
        <span class="overline">{mat['overline']}</span>
        <h1>{mat['h1']}</h1>
        <p class="hero__descriptor">{mat['descriptor']}</p>
        <div class="hero__tags">{tags_html}
        </div>
        <div class="hero__specs" data-od-id="hero-specs">
          <div class="spec-inline"><div class="k">Tensile Strength</div><div class="v">{mat['heroTensile']} <small>MPa</small></div></div>
          <div class="spec-inline"><div class="k">Heat Deflection</div><div class="v">{mat['heroHDT']} <small>°C</small></div></div>
          <div class="spec-inline"><div class="k">Density</div><div class="v">{mat['heroDensity']} <small>g/cm³</small></div></div>
          <div class="spec-inline"><div class="k">Print Temp</div><div class="v">{mat['heroPrintTemp']} <small>°C</small></div></div>
        </div>
      </div>
      <div class="hero__img-wrap">
        <img src="{mat['heroImg']}" alt="{mat['heroImgAlt']}" loading="eager" width="1152" height="896">
      </div>
    </div>
  </div>
</header>

'''


# ─── Machine requirements section ─────────────────────────────────────────────

def make_mach_section(mat):
    rows_html = ''
    for r in mat['machRows']:
        rows_html += (f'          <tr><td><span class="req-icon">'
                      f'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>'
                      f'</span>{r["req"]}</td><td>{r["min"]}</td><td class="rec">{r["rec"]}</td></tr>\n')
    alert_svg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path></svg>'
    return f'''<!-- ===================== MACHINE REQUIREMENTS ===================== -->
<section class="section" id="machine-requirements" style="background:var(--surface-soft);" data-od-id="machine-requirements">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Printer Compatibility</span>
      <h2>Machine Requirements</h2>
      <p>Hard thresholds for reliable {mat['name']} output — check your printer meets these before loading the filament.</p>
    </div>
    <div class="table-scroll">
      <table class="req-table">
        <thead>
          <tr><th>Requirement</th><th>Minimum Spec</th><th>Recommended</th></tr>
        </thead>
        <tbody>
{rows_html}        </tbody>
      </table>
    </div>
    <div class="callout" data-od-id="hotend-callout">
      <span class="ic">{alert_svg}</span>
      <p>{mat['machCallout']}</p>
    </div>
  </div>
</section>

'''


# ─── Applications section ──────────────────────────────────────────────────────

def make_apps_section(mat):
    tiles_html = make_app_tiles(mat['appTiles'])
    return f'''<!-- ===================== APPLICATIONS ===================== -->
<section class="section" id="applications" data-od-id="applications">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Where It Is Used</span>
      <h2>Applications — By Industry</h2>
    </div>
    <div class="card-flex">
{tiles_html}    </div>
  </div>
</section>

'''


# ─── Key properties section ───────────────────────────────────────────────────

def make_props_section(mat):
    cards_html = make_prop_cards(mat['propCards'])
    return f'''<!-- ===================== KEY PROPERTIES GRID ===================== -->
<section class="section" id="key-properties" data-od-id="key-properties">
  <div class="wrap">
    <div class="sec-head">
      <span class="overline">Measured Properties</span>
      <h2>Key Properties</h2>
      <p>Engineering values with context that decides whether {mat['name']} is the right choice for your application.</p>
    </div>
    <div class="card-flex">
{cards_html}    </div>
  </div>
</section>

'''


# ─── CTA section ──────────────────────────────────────────────────────────────

def make_cta_section(mat):
    return f'''<!-- ===================== CTA ===================== -->
<section class="cta" id="cta" data-od-id="cta">
  <div class="wrap">
    <h2>{mat['ctaH2']}</h2>
    <p>{mat['ctaP']}</p>
    <div class="cta__btns">
      <a class="btn btn--primary" href="https://fracktal.in/shop/">Shop Now</a>
      <a class="btn btn--outline" href="https://fracktal.in/materials/">All Materials</a>
    </div>
  </div>
</section>

'''


# ─── JSON-LD ──────────────────────────────────────────────────────────────────

def make_jsonld(mat):
    return f'''<!-- ===================== STRUCTURED DATA ===================== -->
    <script type="application/ld+json">
    {{
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "{mat['schemaName']}",
      "description": "{mat['schemaDesc']}",
      "brand": {{
        "@type": "Brand",
        "name": "Fracktal Works"
      }},
      "manufacturer": {{
        "@type": "Organization",
        "name": "Fracktal Works",
        "url": "https://fracktal.in"
      }},
      "material": "{mat['schemaMaterial']}",
      "url": "{mat['schemaUrl']}",
      "additionalProperty": [
        {{"@type": "PropertyValue", "name": "Tensile Strength", "value": "{mat['schemaTensile']} MPa"}},
        {{"@type": "PropertyValue", "name": "Heat Deflection Temperature", "value": "{mat['schemaHDT']} °C"}},
        {{"@type": "PropertyValue", "name": "Density", "value": "{mat['schemaDensity']} g/cm³"}},
        {{"@type": "PropertyValue", "name": "Print Temperature", "value": "{mat['schemaPrintTemp']} °C"}}
      ]
    }}
    </script>
'''


# ─── Radar dropdown update ────────────────────────────────────────────────────

def make_compare_dropdown(primary_key):
    """Build dropdown options excluding the primary material; cf-pa first if not primary."""
    order = ['cf-pa', 'nylon-pa12', 'petg', 'pla', 'abs', 'tpu-95a', 'polycarbonate', 'cf-petg', 'asa', 'pc-abs']
    options = ''
    selected_done = False
    for k in order:
        if k == primary_key:
            continue
        label = DROPDOWN_LABELS[k]
        sel = ''
        if not selected_done:
            sel = ' selected=""'
            selected_done = True
        options += f'              <option value="{k}"{sel}>{label}</option>\n'
    return options.rstrip()


# ─── Scatter plot update ──────────────────────────────────────────────────────

def update_scatter(html, primary_key, mat):
    """Activate the correct scatter circle, mat-btn, and material-desc for the primary material."""
    # Deactivate CF-PA: remove 'active' class and restore grey fill
    html = html.replace(
        'class="scatter-circle mat-cf-pa active"',
        'class="scatter-circle mat-cf-pa"'
    )
    html = html.replace(
        'class="scatter-circle mat-cf-pa" cx="591" cy="65" r="28" fill="#f25e50"',
        'class="scatter-circle mat-cf-pa" cx="591" cy="65" r="28" fill="rgba(150,150,150,0.7)"'
    )
    # Deactivate CF-PA mat-btn
    html = html.replace(
        'class="mat-btn mat-active" data-material="cf-pa"',
        'class="mat-btn" data-material="cf-pa"'
    )

    if primary_key != 'cf-pa':
        cx, cy, r = SCATTER_POS[primary_key]
        # Activate primary circle
        html = html.replace(
            f'class="scatter-circle mat-{primary_key}" cx="{cx}" cy="{cy}" r="{r}" fill="rgba(150,150,150,0.7)"',
            f'class="scatter-circle mat-{primary_key} active" cx="{cx}" cy="{cy}" r="{r}" fill="#f25e50"'
        )
        # Activate mat-btn
        html = html.replace(
            f'class="mat-btn" data-material="{primary_key}"',
            f'class="mat-btn mat-active" data-material="{primary_key}"'
        )
        # Update material-desc
        html = html.replace(
            '<div id="material-desc">Carbon fiber reinforced nylon optimized for high strength to weight ratio, stiffness, and heat resistance. Best for structural applications requiring thermal stability above 80°C.</div>',
            f'<div id="material-desc">{mat.get("scatterDesc", mat["descriptor"])}</div>'
        )

    return html


# ─── Main generation function ──────────────────────────────────────────────────

def generate_page(key, mat):
    html = TEMPLATE

    # 1. Title
    html = re.sub(r'<title>.*?</title>', f'<title>{mat["title"]}</title>', html)

    # 2. Meta description
    html = re.sub(r'<meta name="description" content=".*?">', f'<meta name="description" content="{mat["metaDesc"]}">', html)

    # 3. HERO section
    html = replace_between(html,
        '<!-- ===================== HERO ===================== -->',
        '<!-- ===================== MACHINE-READABLE QUICK REFERENCE ===================== -->',
        make_hero_section(mat))

    # 4. QR section
    html = replace_between(html,
        '<!-- ===================== MACHINE-READABLE QUICK REFERENCE ===================== -->',
        '<!-- ===================== RADAR / PROPERTY PROFILE ===================== -->',
        make_qr_section(mat))

    # 5. Radar PRIMARY_KEY
    html = html.replace("const PRIMARY_KEY = 'cf-pa';", f"const PRIMARY_KEY = '{mat['primaryKey']}';")

    # 6. Radar compare dropdown
    new_opts = make_compare_dropdown(key)
    # Replace the <select> content
    html = re.sub(
        r'(<select id="compare-material" class="compare-dropdown">).*?(</select>)',
        lambda m: m.group(1) + '\n' + new_opts + '\n              ' + m.group(2),
        html, flags=re.DOTALL
    )

    # 7. Radar legend — "This material" label
    html = re.sub(
        r'<span class="lbl">CF-PA</span>(\s*<span class="sub">This material</span>)',
        f'<span class="lbl">{mat["name"]}</span>\\1',
        html
    )

    # 8. Initial updateRadar call (second occurrence — at bottom of radar section)
    html = re.sub(r"updateRadar\('[a-z0-9\-]+'\);", f"updateRadar('{mat['compareDefault']}');", html, count=1)

    # 9. Add extra materials to FRACKTAL_MATERIALS JS if needed
    if key in ('cf-petg', 'asa', 'pc-abs'):
        html = html.replace("  'polycarbonate': {", EXTRA_MAT_JS + "\n  'polycarbonate': {")

    # 10. KEY PROPERTIES section
    html = replace_between(html,
        '<!-- ===================== KEY PROPERTIES GRID ===================== -->',
        '<!-- ===================== MACHINE REQUIREMENTS ===================== -->',
        make_props_section(mat))

    # 11. MACHINE REQUIREMENTS section
    html = replace_between(html,
        '<!-- ===================== MACHINE REQUIREMENTS ===================== -->',
        '<!-- ===================== APPLICATIONS ===================== -->',
        make_mach_section(mat))

    # 12. APPLICATIONS section
    html = replace_between(html,
        '<!-- ===================== APPLICATIONS ===================== -->',
        '<!-- ===================== TENSILE COMPARISON BAR CHART ===================== -->',
        make_apps_section(mat))

    # 13. TENSILE BAR CHART
    html = replace_between(html,
        '<!-- ===================== TENSILE COMPARISON BAR CHART ===================== -->',
        '<!-- ===================== MATERIAL COMPARISON SCATTER ===================== -->',
        make_bar_chart(key))

    # 14. SCATTER PLOT — activate correct circle/button
    html = update_scatter(html, key, mat)

    # 15. DECISION GUIDE
    html = replace_between(html,
        '<!-- ===================== WHEN TO USE / AVOID ===================== -->',
        '<!-- ===================== DfAM TIPS ===================== -->',
        make_decision_guide(mat))

    # 16. DfAM TIPS
    html = replace_between(html,
        '<!-- ===================== DfAM TIPS ===================== -->',
        '<!-- ===================== COMPATIBLE FRACKTAL PRINTERS ===================== -->',
        make_dfam_section(mat))

    # 17. COMPATIBLE PRINTERS
    html = replace_between(html,
        '<!-- ===================== COMPATIBLE FRACKTAL PRINTERS ===================== -->',
        '<!-- ===================== RELATED MATERIALS ===================== -->',
        make_printers_section(mat))

    # 18. RELATED MATERIALS
    html = replace_between(html,
        '<!-- ===================== RELATED MATERIALS ===================== -->',
        '<!-- ===================== CTA ===================== -->',
        make_related_nav(key))

    # 19. CTA
    html = replace_between(html,
        '<!-- ===================== CTA ===================== -->',
        '<!-- ===================== STRUCTURED DATA ===================== -->',
        make_cta_section(mat))

    # 20. JSON-LD
    html = replace_between(html,
        '<!-- ===================== STRUCTURED DATA ===================== -->',
        '</body>',
        make_jsonld(mat))

    # 21. Fix "Julia Advanced" → "Julia" (printer name)
    html = html.replace('Julia Advanced', 'Julia')

    return html


# ─── Run ──────────────────────────────────────────────────────────────────────

print('Generating Fracktal material pages ...')
for key, mat in MATS.items():
    try:
        page = generate_page(key, mat)
        wr(mat['file'], page)
    except Exception as e:
        print(f'  FAIL  {mat["file"]}  -- ERROR: {e}')
        import traceback; traceback.print_exc()

print('\nDone -- 9 pages generated.')
