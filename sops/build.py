#!/usr/bin/env python3
"""RDOS SOP catalog builder (Dolphin Apps edition).

Source of truth: sops/source/<SOP ID>.md, one file per SOP, in this repo.
Pages are served by Dolphin Apps at /SOP. Nobody edits the generated files.

  python3 sops/build.py web     source -> src/sop-content/ (catalog.ts, pages/*.html, sop-doc.css)
  python3 sops/build.py lint    report parse problems, open [EDIT] blanks and Rebuild notes
  python3 sops/build.py export  standalone public HTML catalog + zip in sops/dist/ (for other teams)

Run `web` after every source change, then commit sops/source and src/sop-content together.
Suggestions from the site are reviewed at /SOP/suggestions; see sops/README.md.
"""
import html, json, os, re, sys, glob, zipfile, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SOPS = os.path.join(ROOT, "source")
APP = os.path.dirname(ROOT)
WEB_OUT = os.path.join(APP, "src", "sop-content")
_t = datetime.date.today()
TODAY = f"{_t:%b} {_t.day}, {_t.year}"
# Effective date for SOPs whose source has no "date:" line (the first-draft date). Set date: in the source when a version changes.
DEFAULT_DATE = "Nov 21, 2026"

DEPTS = [
    ("Start Here", "How the manual works and how to change it"),
    ("Shop & Safety", "Keeping the shop safe, clean and accounted for"),
    ("Machines", "Every machine, and how parts get made"),
    ("Design", "CAD standards and recurring builds"),
    ("Electrical & Software", "Batteries, wiring and robot software"),
    ("Build Season", "From kickoff to a robot that's ready"),
    ("Competition", "Running an event weekend"),
    ("Events & Volunteering", "Hosting and serving at FIRST events"),
    ("Business", "Funding, sponsors, families and awards"),
    ("Media & Outreach", "Telling our story and serving the community"),
    ("People & Program", "Selection, training, recognition and records"),
]
STYLE_INFO = {
    "Procedure": "Step-by-step instructions",
    "Phase-gate": "Stages with entry and exit checks",
    "Checklist": "Tick-through checklist",
    "Workflow": "Hand-offs between roles",
    "Playbook": "How we run a recurring situation",
    "Standard": "Rules and conventions",
}
ROLE_TAGS = {"team rule": "r", "student": "a", "operator": "a", "lead": "m", "officer": "m", "mentor": "x"}
SPECIAL = {"at a glance", "sources", "revision history", "rebuild notes"}
CALLOUTS = {"DANGER": "d", "WARNING": "w", "CAUTION": "c", "NOTICE": "n", "TIP": "tip"}
FIELD_MAP = {
    "sop id": "id", "title": "title", "department": "dept", "sop style": "style", "version": "version",
    "effective date": "date", "owner": "owner", "approver": "approver", "applies to": "applies",
    "audience": "audience", "status": "status", "summary": "summary", "reference link": "link",
}
FIELD_ORDER = [("SOP ID", "id"), ("Title", "title"), ("Department", "dept"), ("SOP style", "style"),
               ("Version", "version"), ("Effective date", "date"), ("Owner", "owner"), ("Approver", "approver"),
               ("Applies to", "applies"), ("Audience", "audience"), ("Status", "status"),
               ("Reference link", "link"), ("Summary", "summary")]


# ---------------------------------------------------------------- parsing
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def full_id(i):
    i = i.strip()
    return i if i.startswith("RDOS-SOP-") else "RDOS-SOP-" + i


def short_id(i):
    return i.replace("RDOS-SOP-", "")


def unescape_md(s):
    return re.sub(r"\\([\\\[\]#`*_|\-.+!(){}<>~=])", r"\1", s)


def strip_wrap_bold(s):
    s = s.strip()
    m = re.fullmatch(r"\*\*(.+?)\*\*", s)
    return m.group(1).strip() if m else s


def normalize_line(line):
    """Undo Google's Markdown quirks for one line, keep inline **bold**."""
    raw = line.rstrip("\n")
    # list markers keep their indentation meaning only as "list"
    s = raw.strip()
    if not s:
        return ""
    s = s.replace(" ", " ")
    # headings: '## **Title**' -> '## Title'
    m = re.match(r"^(#{1,6})\s+(.*)$", s)
    if m:
        return m.group(1) + " " + strip_wrap_bold(unescape_md(m.group(2)))
    if s.startswith("|"):
        # keep escaped pipes inside cells as a placeholder
        s = s.replace("\\|", "\u0001")
        return unescape_md(s)
    s = unescape_md(s)
    # '1.  text' -> '1. text'
    s = re.sub(r"^(\d+)\.\s+", r"\1. ", s)
    s = re.sub(r"^[*•]\s+", "- ", s)
    # leading bold label that Google wrapped: '**WARNING:** x' handled at block level
    return s


def split_cells(row):
    row = row.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    return [c.strip().replace("\u0001", "|") for c in row.split("|")]


def is_sep_row(cells):
    return all(re.fullmatch(r":?-{1,}:?", c or "-") for c in cells)


def lead_label(text, labels):
    """Return (label, rest) if text starts with LABEL: (optionally bold)."""
    m = re.match(r"^\*\*([A-Z][A-Z ]*?):\*\*\s*(.*)$", text) or re.match(r"^\*\*([A-Z][A-Z ]*?)\*\*:\s*(.*)$", text) \
        or re.match(r"^([A-Z][A-Z ]*?):\s*(.*)$", text)
    if m and m.group(1).strip() in labels:
        return m.group(1).strip(), m.group(2).strip()
    return None, text


def parse(text):
    lines = [normalize_line(l) for l in text.splitlines()]
    meta, sections, cur, pre = {}, [], None, []
    title_line = None
    for l in lines:
        if l.startswith("# ") and title_line is None and cur is None:
            title_line = l[2:].strip()
            continue
        if l.startswith("## "):
            cur = {"title": l[3:].strip(), "lines": []}
            sections.append(cur)
            continue
        if cur is None:
            pre.append(l)
        else:
            cur["lines"].append(l)
    # metadata from front matter or SOP card table
    for l in pre:
        if not l:
            continue
        if l.startswith("|"):
            cells = split_cells(l)
            if len(cells) >= 2 and not is_sep_row(cells):
                k = strip_wrap_bold(cells[0]).lower()
                if k in FIELD_MAP:
                    meta[FIELD_MAP[k]] = strip_wrap_bold(cells[1])
            continue
        m = re.match(r"^([a-z_]+):\s*(.*)$", l)
        if m and m.group(1) in {"id", "title", "dept", "style", "owner", "audience", "summary", "link",
                                "version", "date", "status", "approver", "applies"}:
            meta[m.group(1)] = m.group(2).strip()
    if title_line and "title" not in meta:
        meta["title"] = title_line.split("·", 1)[-1].strip()
    meta.setdefault("version", "0.1")
    meta.setdefault("date", DEFAULT_DATE)
    meta.setdefault("status", "Draft")
    meta.setdefault("approver", "Cody Eves")
    meta.setdefault("applies", "Teams 5199 & 9271")
    meta.setdefault("audience", "Public")
    meta.setdefault("style", "Procedure")
    meta["id"] = full_id(meta.get("id", "UNKNOWN"))
    for s in sections:
        s["blocks"] = blocks(s["lines"])
        s["key"] = clean_h3(s["title"]).lower()
        s["anchor"] = slug(clean_h3(s["title"]))
    return {"meta": meta, "sections": sections}


def blocks(lines):
    out, i = [], 0
    n = len(lines)
    while i < n:
        l = lines[i]
        if not l:
            i += 1
            continue
        if l.startswith("### "):
            out.append({"t": "h3", "text": l[4:].strip()})
            i += 1
            continue
        if l.startswith("|"):
            rows = []
            while i < n and lines[i].startswith("|"):
                cells = split_cells(lines[i])
                if not is_sep_row(cells):
                    rows.append(cells)
                i += 1
            rows = [r for r in rows if any(c.strip() for c in r)]
            if rows:
                head = [strip_wrap_bold(c) for c in rows[0]]
                out.append({"t": "table", "head": head, "rows": rows[1:]})
            continue
        if re.match(r"^\d+\.\s", l):
            items = []
            while i < n and re.match(r"^\d+\.\s", lines[i]):
                items.append(re.sub(r"^\d+\.\s", "", lines[i]).strip())
                i += 1
            out.append({"t": "ol", "items": items})
            continue
        if l.startswith("- "):
            items = []
            while i < n and lines[i].startswith("- "):
                items.append(lines[i][2:].strip())
                i += 1
            checks = [it for it in items if re.match(r"^\[\s?[xX ]?\s?\]", it)]
            if checks and len(checks) == len(items):
                out.append({"t": "check", "items": [re.sub(r"^\[\s?[xX ]?\s?\]\s*", "", it) for it in items]})
            else:
                out.append({"t": "ul", "items": items})
            continue
        label, rest = lead_label(l, {"CARD", "CARD NO"})
        if label:
            items = []
            i += 1
            while i < n and (lines[i].startswith("- ") or not lines[i]):
                if lines[i]:
                    items.append(lines[i][2:].strip())
                i += 1
            out.append({"t": "card", "no": label == "CARD NO", "title": strip_wrap_bold(rest), "items": items})
            continue
        label, rest = lead_label(l, set(CALLOUTS) | {"EDITOR NOTE"})
        if label == "EDITOR NOTE":
            i += 1
            continue
        if label:
            out.append({"t": "callout", "kind": label, "text": rest})
            i += 1
            continue
        if re.match(r"^\*?EDITOR NOTE", l):
            i += 1
            continue
        out.append({"t": "p", "text": l})
        i += 1
    return out


# ---------------------------------------------------------------- inline rendering
class Ctx:
    def __init__(self, sections, sop_ids, href):
        self.anchors = {s["key"]: s["anchor"] for s in sections}
        for s in sections:
            for b in s["blocks"]:
                if b["t"] == "h3":
                    self.anchors.setdefault(clean_h3(b["text"]).lower(), slug(clean_h3(b["text"])))
        self.sop_ids = sop_ids
        # href: function SOP ID -> link target
        self.href = href
        self.warnings = []


def clean_h3(t):
    return re.sub(r"\s*\[[^\]]+\]\s*$", "", t).strip()


def inline(text, ctx):
    t = html.escape(text, quote=False)
    # links [text](url)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", t)
    t = re.sub(r"`([^`]+)`", r'<span class="lcd">\1</span>', t)
    t = re.sub(r"\(#(\d+)\)", r'<span class="callno">\1</span>', t)

    def tag(m):
        inner = m.group(1).strip()
        low = inner.lower()
        if low.startswith("edit:"):
            return f'<span class="blank" title="To be completed">{inner[5:].strip()}</span>'
        if low.startswith("source:"):
            return f'<span class="tag t">{inner[7:].strip()}</span>'
        if low in ROLE_TAGS:
            return f'<span class="tag {ROLE_TAGS[low]}">{inner}</span>'
        return m.group(0)
    t = re.sub(r"\[([^\]\[]{1,200})\]", tag, t)

    def see(m):
        name = m.group(1).strip()
        a = ctx.anchors.get(name.lower())
        if a:
            return f'(see <a href="#{a}">{name}</a>)'
        if not name.startswith("RDOS-SOP-"):
            ctx.warnings.append(f"unmatched reference: (see {name})")
        return m.group(0)
    t = re.sub(r"\(see ([^)]+)\)", see, t)

    def sopref(m):
        sid = m.group(0)
        if sid in ctx.sop_ids:
            return f'<a class="sopref" href="{ctx.href(sid)}">{sid}</a>'
        return sid
    t = re.sub(r"RDOS-SOP-[A-Z]+-\d{3}", sopref, t)
    return t


def strip_lead_marker(item):
    for mk, cls in (("KEY:", "key"), ("STOP:", "key"), ("GO:", "go")):
        if item.startswith(mk):
            return cls, item[len(mk):].strip()
        if item.startswith(f"**{mk}**"):
            return cls, item[len(mk) + 4:].strip()
    return "", item


# ---------------------------------------------------------------- page rendering
CSS = open(os.path.join(ROOT, "sop.css"), encoding="utf-8").read()


def render_blocks(blks, ctx, state):
    out = []
    i = 0
    while i < len(blks):
        b = blks[i]
        t = b["t"]
        if t == "h3":
            txt = b["text"]
            gm = re.match(r"^(Gate|Phase|Stage)\s+(\d+)\s*:\s*(.*)$", txt)
            if gm:
                # gate card: gather until next h3
                j = i + 1
                inner = []
                while j < len(blks) and blks[j]["t"] != "h3":
                    inner.append(blks[j])
                    j += 1
                anchor = slug(clean_h3(txt))
                gstate = dict(state, step=0)
                body = render_blocks(inner, ctx, gstate)
                state["check"] = gstate["check"]
                out.append(f'<div class="gate" id="{anchor}"><div class="ghead"><span class="gnum"><em>{gm.group(2)}</em></span>'
                           f'<div><small>{gm.group(1)} {gm.group(2)}</small><h3>{inline(gm.group(3), ctx)}</h3></div></div>'
                           f'<div class="gbody">{body}</div></div>')
                i = j
                continue
            nxt = blks[i + 1]["t"] if i + 1 < len(blks) else None
            anchor = slug(clean_h3(txt))
            if nxt == "ol":
                out.append(f'<p class="phase" id="{anchor}">{inline(txt, ctx)}</p>')
            else:
                out.append(f'<h3 id="{anchor}">{inline(txt, ctx)}</h3>')
            i += 1
            continue
        if t == "p":
            cls = ' class="intro"' if state.get("first_p") else ""
            state["first_p"] = False
            out.append(f"<p{cls}>{inline(b['text'], ctx)}</p>")
        elif t == "callout":
            k = b["kind"]
            cls = CALLOUTS[k]
            label = "TIP" if k == "TIP" else k
            out.append(f'<div class="hz {cls}"><div>{label}</div><p>{inline(b["text"], ctx)}</p></div>')
        elif t == "ol":
            start = state["step"] + 1
            lis = []
            for it in b["items"]:
                cls, body = strip_lead_marker(it)
                state["step"] += 1
                lis.append(f'<li{f" class={chr(34)}{cls}{chr(34)}" if cls else ""}>{inline(body, ctx)}</li>')
            out.append(f'<ol class="steps" start="{start}" style="counter-reset:s {start - 1}">' + "".join(lis) + "</ol>")
        elif t == "ul":
            items = b["items"]
            labeled = [re.match(r"^\*\*(.+?):?\*\*:?\s*(.*)$", it) for it in items]
            if len(items) >= 2 and all(labeled):
                cards = "".join(f'<div class="pk"><b>{inline(m.group(1).rstrip(":"), ctx)}</b><p>{inline(m.group(2), ctx)}</p></div>'
                                for m in labeled)
                out.append(f'<div class="panel">{cards}</div>')
            else:
                cls = ' class="cols"' if len(items) >= 7 and max(len(x) for x in items) < 90 else ""
                out.append(f"<ul{cls}>" + "".join(f"<li>{inline(x, ctx)}</li>" for x in items) + "</ul>")
        elif t == "check":
            state["check"] += 1
            cid = f"ck{state['check']}"
            n = len(b["items"])
            lis = "".join(f'<li><label><input type="checkbox"><span>{inline(x, ctx)}</span></label></li>' for x in b["items"])
            out.append(f'<div class="check" data-check="{cid}"><ul>{lis}</ul>'
                       f'<div class="meter" aria-live="polite"><div class="big"><span class="cnt">0</span>/{n}</div>'
                       f'<div class="bar"><i></i></div><p class="msg">Work down the list.</p>'
                       f'<button type="button" class="reset">Clear</button></div></div>')
        elif t == "card":
            # group consecutive cards
            group = [b]
            while i + 1 < len(blks) and blks[i + 1]["t"] == "card":
                i += 1
                group.append(blks[i])
            cards = []
            for c in group:
                lis = "".join(f"<li>{inline(x, ctx)}</li>" for x in c["items"])
                cards.append(f'<div class="fact{" no" if c["no"] else ""}"><h3>{inline(c["title"], ctx)}</h3><ul>{lis}</ul></div>')
            out.append(f'<div class="facts n{min(len(group),3)}">' + "".join(cards) + "</div>")
        elif t == "table":
            head = b["head"]
            stack = len(head) >= 3
            ths = "".join(f"<th>{inline(h, ctx)}</th>" for h in head)
            trs = []
            for r in b["rows"]:
                r = (r + [""] * len(head))[:len(head)]
                tds = "".join(f'<td data-l="{html.escape(strip_wrap_bold(head[k]))}">{inline(c, ctx)}</td>' for k, c in enumerate(r))
                trs.append(f"<tr>{tds}</tr>")
            out.append(f'<div class="scroll"><table{" class=" + chr(34) + "stack" + chr(34) if stack else ""}><thead><tr>{ths}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>')
        i += 1
    return "\n".join(out)


def render_rail(sec, ctx, dept):
    items, foot = [], []
    for b in sec["blocks"]:
        if b["t"] == "ol":
            items += b["items"]
        elif b["t"] == "p":
            foot.append(b["text"])
    sts = []
    for k, it in enumerate(items, 1):
        m = re.match(r"^\*\*(.+?):?\*\*:?\s*(.*)$", it)
        name, desc = (m.group(1).rstrip(":"), m.group(2)) if m else (it, "")
        sm = re.search(r"\(see ([^)]+)\)\s*$", desc)
        href = None
        if sm:
            href = ctx.anchors.get(sm.group(1).strip().lower())
            if not href:
                ctx.warnings.append(f"unmatched station link: {sm.group(1)}")
            desc = desc[:sm.start()].strip()
        gate = re.match(r"^(Gate|Phase|Stage)\s+(\d+)$", name.strip())
        label = gate.group(2) if gate else str(k)
        stop = re.search(r"shut down|lock up", name, re.I)
        dotcls = "dot" + (" stop" if stop and k == len(items) else "") + (" gate" if gate else "")
        tagname = "a" if href else "div"
        hattr = f' href="#{href}"' if href else ""
        sts.append(f'<{tagname} class="st"{hattr}><span class="{dotcls}"><em>{label}</em></span><b>{inline(name, ctx)}</b><small>{inline(desc, ctx)}</small></{tagname}>')
    cols = min(max(len(items), 1), 8)
    blade = " blade" if dept == "Machines" else ""
    f = "".join(f'<p class="foot">{inline(x, ctx)}</p>' for x in foot)
    return (f'<section class="route band" aria-labelledby="route-h"><div class="wrap">'
            f'<h2 id="route-h">At a glance</h2>'
            f'<div class="track{blade}" style="--cols:{cols}">{"".join(sts)}</div>{f}</div></section>')


def page(doc, ctx, catalog_href, base_url=None, public=False):
    m = doc["meta"]
    secs = [s for s in doc["sections"] if s["key"] not in SPECIAL]
    glance = next((s for s in doc["sections"] if s["key"] == "at a glance"), None)
    sources = next((s for s in doc["sections"] if s["key"] == "sources"), None)
    revs = next((s for s in doc["sections"] if s["key"] == "revision history"), None)
    toc = "".join(f'<a href="#{s["anchor"]}">{html.escape(clean_h3(s["title"]))}</a>' for s in secs)
    body = []
    for n, s in enumerate(secs, 1):
        state = {"step": 0, "check": 0, "first_p": True}
        state["check"] = n * 10
        tt = s["title"]
        tm = re.match(r"^(.*?)\s*(\[[^\]]+\])\s*$", tt)
        tag = ""
        if tm:
            tt, tag = tm.group(1), " " + inline(tm.group(2), ctx)
        alt = " alt" if n % 2 == 1 else ""
        body.append(f'<section id="{s["anchor"]}" class="band{alt}"><div class="wrap">'
                    f'<h2><span class="n">{n:02d}</span>{inline(tt, ctx)}{tag}</h2>'
                    f'{render_blocks(s["blocks"], ctx, state)}</div></section>')
    rail = render_rail(glance, ctx, m.get("dept")) if glance else ""
    first = secs[0]["anchor"] if secs else ""
    chk = next((s["anchor"] for s in secs if any(b["t"] == "check" for b in s["blocks"])), None)
    pills = [f'<a class="pill" href="#{chk or first}">{"Start the checklist" if chk else "Start reading"}</a>']
    if m.get("link") and "|" in m["link"]:
        lt, lu = [x.strip() for x in m["link"].split("|", 1)]
        pills.append(f'<a class="pill o" href="{html.escape(lu)}">{html.escape(lt)}</a>')
    pills.append(f'<a class="pill o" href="{catalog_href}">All SOPs</a>')
    if base_url and not public:
        pills.append(f'<a class="pill o edit" href="{base_url}">Edit the base copy</a>')
    status = m.get("status", "Draft")
    badges = f'<span class="badge {slug(status)}">{html.escape(status)}</span>'
    if m.get("audience", "").lower() == "internal":
        badges += '<span class="badge internal">Internal only</span>'
    src_items = ""
    if sources:
        for b in sources["blocks"]:
            if b["t"] in ("ul", "ol"):
                src_items += "".join(f"<li>{inline(x, ctx)}</li>" for x in b["items"])
    if not src_items:
        src_items = '<li><a href="https://robotdolphins.org/index.php/program-handbook/">Robot Dolphin Family Program Handbook</a></li>'
    rev_html = ""
    if revs:
        rows = [b for b in revs["blocks"] if b["t"] == "table"]
        if rows:
            rev_html = render_blocks(rows, ctx, {"step": 0, "check": 0, "first_p": False})
    last_rev = f'v{html.escape(m.get("version"))} · {html.escape(m.get("date"))} · {html.escape(status)}'
    blanks = len(re.findall(r'class="blank"', "".join(body) + rail))
    blank_note = f'<p class="blanknote">{blanks} item{"s" if blanks != 1 else ""} on this page still need{"s" if blanks == 1 else ""} to be filled in. They are marked in yellow.</p>' if blanks else ""
    style = m.get("style", "Procedure")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(m['title'])} · {m['id']}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
{site_header(catalog_href)}
<section class="hero">
 <div class="wrap">
  <p class="eyebrow">{html.escape(m.get('dept', ''))} SOP · Team 5199 · Team 9271</p>
  <div class="badges">{badges}<span class="badge style" title="{html.escape(STYLE_INFO.get(style, ''))}">{html.escape(style)}</span></div>
  <h1>{html.escape(m['title'])}</h1>
  <p class="sub">{inline(m.get('summary', ''), ctx)}</p>
  <div class="pills">{''.join(pills)}</div>
  <dl class="ctl">
   <div><dt>SOP</dt><dd>{m['id']}</dd></div>
   <div><dt>Version</dt><dd>{html.escape(m.get('version'))} · {html.escape(m.get('date'))}</dd></div>
   <div><dt>Owner</dt><dd>{html.escape(m.get('owner', ''))}</dd></div>
   <div><dt>Applies to</dt><dd>{html.escape(m.get('applies'))}</dd></div>
  </dl>
  {blank_note}
 </div>
</section>
<nav class="toc" aria-label="Sections"><div class="wrap">{toc}</div></nav>
{rail}
{''.join(body)}
{f'<section class="band revs"><div class="wrap"><details><summary>Revision history</summary>{rev_html}</details></div></section>' if rev_html else ''}
<footer class="sfoot">
 <div class="wrap">
  <div>
   <h4>Team 5199: Robot Dolphins from Outer Space</h4>
   <p>Part of the Robot Dolphin Family with Team 9271, the Electromechanical Porpoises from the Upper Atmosphere. Other teams are welcome to copy and adapt this SOP.</p>
  </div>
  <div><h4>Sources</h4><ul>{src_items}</ul></div>
  <div>
   <h4>About this page</h4>
   <ul><li><a href="{catalog_href}">SOP catalog</a></li><li><a href="https://robotdolphins.org/">robotdolphins.org</a></li></ul>
   <p style="margin-top:12px">{last_rev}<br>Approver: {html.escape(m.get('approver', ''))}</p>
   <p class="gen">Generated from the approved source. Suggest changes at apps.robotdolphins.org/SOP (RDOS-SOP-ORG-000).</p>
  </div>
 </div>
 <div class="copy">Copyright © 2026 Team 5199: Robot Dolphins from Outer Space. All rights reserved.</div>
</footer>
<script>{JS}</script>
</body>
</html>
"""


def site_header(home):
    return f"""<header class="site">
 <div class="wrap">
  <a class="logo" href="https://robotdolphins.org/"><i>5199</i><span>ROBOT<br>DOLPHINS</span></a>
  <nav class="menu" aria-label="robotdolphins.org">
   <a href="https://robotdolphins.org/">Home</a>
   <a href="https://robotdolphins.org/index.php/about-us/">About</a>
   <a href="https://robotdolphins.org/index.php/robots/">Team</a>
   <a href="{home}">SOP Catalog</a>
   <a href="https://robotdolphins.org/index.php/support/">Support</a>
   <a href="https://robotdolphins.org/index.php/contact-join/">Contact/Join</a>
  </nav>
 </div>
</header>"""


JS = """
document.querySelectorAll('.check').forEach(box=>{
 const boxes=[...box.querySelectorAll('input')],cnt=box.querySelector('.cnt'),fill=box.querySelector('.bar i'),msg=box.querySelector('.msg'),meter=box.querySelector('.meter');
 const update=()=>{const n=boxes.filter(b=>b.checked).length,done=n===boxes.length;cnt.textContent=n;fill.style.width=(n/boxes.length*100)+'%';meter.classList.toggle('done',done);
  msg.textContent=done?'All clear.':n?(boxes.length-n)+' left.':'Work down the list.';};
 boxes.forEach(b=>b.addEventListener('change',update));box.querySelector('.reset').addEventListener('click',()=>{boxes.forEach(b=>b.checked=false);update();});update();
});
"""


# ---------------------------------------------------------------- catalog
def catalog(docs, public, base_urls):
    by_dept = {}
    for d in docs:
        by_dept.setdefault(d["meta"].get("dept", "Other"), []).append(d)
    chapters, total, approved, blanks_total = [], 0, 0, 0
    order = [x[0] for x in DEPTS] + sorted(set(by_dept) - {x[0] for x in DEPTS})
    desc = dict(DEPTS)
    nav = []
    ch = 0
    for dept in order:
        items = by_dept.get(dept)
        if not items:
            continue
        ch += 1
        cards = []
        for d in sorted(items, key=lambda x: x["meta"]["id"]):
            m = d["meta"]
            total += 1
            st = m.get("status", "Draft")
            approved += st.lower() == "approved"
            b = d["blanks"]
            blanks_total += b
            internal = m.get("audience", "").lower() == "internal"
            meta_bits = f'<span class="badge {slug(st)}">{html.escape(st)}</span><span class="badge style">{html.escape(m.get("style", ""))}</span>'
            if internal:
                meta_bits += '<span class="badge internal">Internal</span>'
            if b:
                meta_bits += f'<span class="badge blanks">{b} to fill</span>'
            edit = ""
            if not public and base_urls.get(m["id"]):
                edit = f'<a class="editlink" href="{base_urls[m["id"]]}">Base copy</a>'
            search = html.escape(" ".join([m["id"], m["title"], m.get("summary", ""), dept, m.get("style", "")]).lower())
            cards.append(f'<article class="sop" data-s="{search}" data-style="{html.escape(m.get("style", ""))}">'
                         f'<a class="cover" href="sops/{m["id"]}.html"><small>{m["id"]}</small><h3>{html.escape(m["title"])}</h3>'
                         f'<p>{html.escape(m.get("summary", ""))}</p></a><div class="meta">{meta_bits}{edit}</div></article>')
        nav.append(f'<a href="#{slug(dept)}">{html.escape(dept)}</a>')
        chapters.append(f'<section class="chapter band{" alt" if ch % 2 == 0 else ""}" id="{slug(dept)}"><div class="wrap">'
                        f'<header class="chead"><span class="cnum">{ch:02d}</span><div><h2>{html.escape(dept)}</h2>'
                        f'<p>{html.escape(desc.get(dept, ""))}</p></div></header>'
                        f'<div class="grid">{"".join(cards)}</div></div></section>')
    styles = "".join(f'<button type="button" class="chip" data-style="{k}">{k}</button>' for k in STYLE_INFO)
    legend = "".join(f'<div class="pk"><b>{k}</b><p>{v}</p></div>' for k, v in STYLE_INFO.items())
    edition = "Public edition" if public else "Team edition · includes internal SOPs and base-copy links"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Robot Dolphin Operations Manual · SOP Catalog</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body class="catalog">
{site_header('index.html')}
<section class="hero">
 <div class="wrap">
  <p class="eyebrow">Operations Manual · Team 5199 · Team 9271</p>
  <h1>How the Robot Dolphins run</h1>
  <p class="sub">Every process our team runs, written down so any member, or any team, can run it the same way. Start with RDOS-SOP-ORG-000 to see how the manual works and how to change it.</p>
  <div class="pills"><a class="pill" href="sops/RDOS-SOP-ORG-000.html">How this manual works</a><a class="pill o" href="#{slug(order[1]) if len(order) > 1 else ''}">Browse the chapters</a></div>
  <dl class="ctl">
   <div><dt>SOPs</dt><dd>{total}</dd></div>
   <div><dt>Chapters</dt><dd>{ch}</dd></div>
   <div><dt>Approved</dt><dd>{approved}</dd></div>
   <div><dt>Blanks to fill</dt><dd>{blanks_total}</dd></div>
  </dl>
  <p class="edition">{edition} · built {TODAY}</p>
 </div>
</section>
<nav class="toc" aria-label="Chapters"><div class="wrap">{''.join(nav)}</div></nav>
<section class="band finder"><div class="wrap">
 <label class="search"><span>Find an SOP</span><input id="q" type="search" placeholder="Try battery, scouting, sponsor, CNC…" autocomplete="off"></label>
 <div class="chips"><button type="button" class="chip on" data-style="">All styles</button>{styles}</div>
 <p id="none" hidden>No SOPs match that search.</p>
</div></section>
{''.join(chapters)}
<section class="band"><div class="wrap"><h2>SOP styles</h2><p class="intro">Each SOP uses the style that fits the work.</p><div class="panel">{legend}</div></div></section>
<footer class="sfoot">
 <div class="wrap">
  <div><h4>Team 5199: Robot Dolphins from Outer Space</h4><p>Part of the Robot Dolphin Family with Team 9271. Other teams are welcome to copy and adapt any SOP in this manual.</p></div>
  <div><h4>Start here</h4><ul><li><a href="sops/RDOS-SOP-ORG-000.html">How this manual works</a></li><li><a href="https://robotdolphins.org/index.php/program-handbook/">Program Handbook</a></li></ul></div>
  <div><h4>Quick links</h4><ul><li><a href="https://robotdolphins.org/">Home</a></li><li><a href="https://robotdolphins.org/index.php/contact-join/">Contact/Join</a></li></ul></div>
 </div>
 <div class="copy">Copyright © 2026 Team 5199: Robot Dolphins from Outer Space. All rights reserved.</div>
</footer>
<script>
const q=document.getElementById('q'),cards=[...document.querySelectorAll('.sop')],chips=[...document.querySelectorAll('.chip')];let st='';
function f(){{const v=q.value.trim().toLowerCase();let shown=0;cards.forEach(c=>{{const ok=(!v||c.dataset.s.includes(v))&&(!st||c.dataset.style===st);c.hidden=!ok;shown+=ok;}});
document.querySelectorAll('.chapter').forEach(s=>s.hidden=!s.querySelector('.sop:not([hidden])'));document.getElementById('none').hidden=shown>0;}}
q.addEventListener('input',f);chips.forEach(c=>c.addEventListener('click',()=>{{chips.forEach(x=>x.classList.remove('on'));c.classList.add('on');st=c.dataset.style;f();}}));
</script>
</body>
</html>
"""


# ---------------------------------------------------------------- commands
def load_docs():
    docs = []
    for p in sorted(glob.glob(os.path.join(SOPS, "*.md"))):
        d = parse(open(p, encoding="utf-8").read())
        d["path"] = p
        docs.append(d)
    return docs


def cmd_export():
    docs = load_docs()
    base_urls = {}
    ids = {d["meta"]["id"] for d in docs}
    report = []
    for public in (True,):
        out = os.path.join(ROOT, "dist", "public")
        os.makedirs(os.path.join(out, "sops"), exist_ok=True)
        for f in glob.glob(os.path.join(out, "sops", "*.html")):
            os.remove(f)
        keep = [d for d in docs if not (public and d["meta"].get("audience", "").lower() == "internal")]
        kept_ids = {d["meta"]["id"] for d in keep}
        for d in keep:
            ctx = Ctx(d["sections"], kept_ids, lambda s: f"{s}.html")
            htm = page(d, ctx, "../index.html", base_urls.get(d["meta"]["id"]), public)
            d["blanks"] = htm.count('class="blank"')
            open(os.path.join(out, "sops", d["meta"]["id"] + ".html"), "w", encoding="utf-8").write(htm)
            if True:
                for w in ctx.warnings:
                    report.append(f"{d['meta']['id']}: {w}")
        open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(catalog(keep, public, base_urls))
    zp = os.path.join(ROOT, "dist", "RDOS-SOP-Catalog-public.zip")
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        pub = os.path.join(ROOT, "dist", "public")
        for base, _, files in os.walk(pub):
            for f in files:
                full = os.path.join(base, f)
                z.write(full, os.path.relpath(full, pub))
    print(f"exported public SOPs -> {os.path.join(ROOT, 'dist', 'public')}, {zp}")
    print("\n".join(report) if report else "no link warnings")


def cmd_lint():
    for d in load_docs():
        m = d["meta"]
        problems = []
        for k in ("id", "title", "dept", "style", "owner", "summary"):
            if not m.get(k):
                problems.append(f"missing {k}")
        if m.get("dept") not in dict(DEPTS):
            problems.append(f"unknown department {m.get('dept')}")
        if m.get("style") not in STYLE_INFO:
            problems.append(f"unknown style {m.get('style')}")
        notes = [s for s in d["sections"] if s["key"] == "rebuild notes"]
        for s in notes:
            for b in s["blocks"]:
                if b["t"] in ("ul", "ol"):
                    for it in b["items"]:
                        if it.strip() not in ("(none)", ""):
                            problems.append(f"REBUILD NOTE: {it}")
        blanks = len(re.findall(r"\[EDIT:", open(d["path"], encoding="utf-8").read()))
        print(f"{m['id']:<22} {len(d['sections']):>2} sections  {blanks:>2} blanks  " + ("; ".join(problems) or "ok"))


# ---------------------------------------------------------------- Dolphin Apps web build
def dept_slug(dept):
    return slug(dept.replace("&", " "))


def web_href(docs_by_id):
    def href(sid):
        d = docs_by_id.get(sid)
        dept = d["meta"].get("dept", "Other") if d else "Other"
        return f"/SOP/{dept_slug(dept)}/{short_id(sid)}"
    return href


def plain(text):
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1", text)
    t = re.sub(r"\[EDIT:\s*([^\]]+)\]", r"\1", t)
    t = re.sub(r"\[(Source:[^\]]+|Team rule|Student|Operator|Lead|Officer|Mentor)\]", "", t, flags=re.I)
    t = t.replace("**", "").replace("`", "")
    return re.sub(r"\s+", " ", t).strip()


def fragment(doc, ctx):
    """The body of one SOP page for Dolphin Apps. No <html>, header, scripts or styles:
    the app supplies the chrome, the styles (sop-doc.css) and the checklist behaviour."""
    m = doc["meta"]
    dept = m.get("dept", "Other")
    secs = [s for s in doc["sections"] if s["key"] not in SPECIAL]
    glance = next((s for s in doc["sections"] if s["key"] == "at a glance"), None)
    sources = next((s for s in doc["sections"] if s["key"] == "sources"), None)
    revs = next((s for s in doc["sections"] if s["key"] == "revision history"), None)
    toc = "".join(f'<a href="#{s["anchor"]}">{html.escape(clean_h3(s["title"]))}</a>' for s in secs)
    body = []
    for n, s in enumerate(secs, 1):
        state = {"step": 0, "check": n * 10, "first_p": True}
        tt = s["title"]
        tm = re.match(r"^(.*?)\s*(\[[^\]]+\])\s*$", tt)
        tag = ""
        if tm:
            tt, tag = tm.group(1), " " + inline(tm.group(2), ctx)
        alt = " alt" if n % 2 == 1 else ""
        body.append(f'<section id="{s["anchor"]}" class="band{alt}"><div class="wrap">'
                    f'<h2><span class="n">{n:02d}</span>{inline(tt, ctx)}{tag}</h2>'
                    f'{render_blocks(s["blocks"], ctx, state)}</div></section>')
    rail = render_rail(glance, ctx, dept).replace('<section class="route band"', '<section id="at-a-glance" class="route band"', 1) if glance else ""
    first = secs[0]["anchor"] if secs else ""
    chk = next((s["anchor"] for s in secs if any(b["t"] == "check" for b in s["blocks"])), None)
    pills = [f'<a class="pill" href="#{chk or first}">{"Start the checklist" if chk else "Start reading"}</a>']
    if m.get("link") and "|" in m["link"]:
        lt, lu = [x.strip() for x in m["link"].split("|", 1)]
        pills.append(f'<a class="pill o" href="{html.escape(lu)}">{html.escape(lt)}</a>')
    pills.append(f'<a class="pill o" href="/SOP/{dept_slug(dept)}">All {html.escape(dept)} SOPs</a>')
    status = m.get("status", "Draft")
    style = m.get("style", "Procedure")
    badges = (f'<span class="badge {slug(status)}">{html.escape(status)}</span>'
              f'<span class="badge style" title="{html.escape(STYLE_INFO.get(style, ""))}">{html.escape(style)}</span>')
    src_items = ""
    if sources:
        for b in sources["blocks"]:
            if b["t"] in ("ul", "ol"):
                src_items += "".join(f"<li>{inline(x, ctx)}</li>" for x in b["items"])
    if not src_items:
        src_items = '<li><a href="https://robotdolphins.org/index.php/program-handbook/">Robot Dolphin Family Program Handbook</a></li>'
    rev_html = ""
    if revs:
        rows = [b for b in revs["blocks"] if b["t"] == "table"]
        if rows:
            rev_html = render_blocks(rows, ctx, {"step": 0, "check": 0, "first_p": False})
    blanks = len(re.findall(r'class="blank"', "".join(body) + rail))
    blank_note = (f'<p class="blanknote">{blanks} item{"s" if blanks != 1 else ""} on this page still '
                  f'need{"s" if blanks == 1 else ""} to be filled in. They are marked in yellow.</p>') if blanks else ""
    revs_html = (f'<section id="revision-history" class="band revs"><div class="wrap"><details><summary>Revision history</summary>'
                 f'{rev_html}</details></div></section>') if rev_html else ""
    out = f"""<section id="summary" class="hero"><div class="wrap">
<p class="eyebrow">{html.escape(dept)} SOP · Team 5199 · Team 9271</p>
<div class="badges">{badges}</div>
<h1>{html.escape(m['title'])}</h1>
<p class="sub">{inline(m.get('summary', ''), ctx)}</p>
<div class="pills">{''.join(pills)}</div>
<dl class="ctl"><div><dt>SOP</dt><dd>{m['id']}</dd></div><div><dt>Version</dt><dd>{html.escape(m.get('version'))} · {html.escape(m.get('date'))}</dd></div><div><dt>Owner</dt><dd>{html.escape(m.get('owner', ''))}</dd></div><div><dt>Applies to</dt><dd>{html.escape(m.get('applies'))}</dd></div></dl>
{blank_note}
</div></section>
<nav class="toc" aria-label="Sections"><div class="wrap">{toc}</div></nav>
{rail}
{''.join(body)}
{revs_html}
<footer class="sfoot"><div class="wrap">
<div><h4>Copy this SOP</h4><p>Team 5199 and Team 9271 publish this manual so other teams can copy and adapt it. Change the names, numbers and blanks to fit your shop.</p></div>
<div><h4>Sources</h4><ul>{src_items}</ul></div>
<div><h4>About this page</h4><p>v{html.escape(m.get('version'))} · {html.escape(m.get('date'))} · {html.escape(status)}<br>Owner: {html.escape(m.get('owner', ''))} · Approver: {html.escape(m.get('approver', ''))}</p><p class="gen">Generated from the approved source. To change it, use Suggest an edit (see <a class="sopref" href="{ctx.href('RDOS-SOP-ORG-000')}">RDOS-SOP-ORG-000</a>).</p></div>
</div></footer>
"""
    return out, blanks


def scope_css(css, scope=".sop-doc"):
    """Prefix every selector so the SOP styles only apply inside the SOP page."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = css.replace('Poppins,"Helvetica Neue",Arial,sans-serif', "var(--font-heading)").replace("Poppins,sans-serif", "var(--font-heading)")
    css = css.replace("background:#fff", "background:var(--bg)")
    out, i = [], 0
    while i < len(css):
        j = css.find("{", i)
        if j < 0:
            break
        head = css[i:j].strip()
        if head.startswith("@media") or head.startswith("@supports"):
            depth, k = 1, j + 1
            while depth:
                depth += {"{": 1, "}": -1}.get(css[k], 0)
                k += 1
            out.append(head + "{" + scope_css(css[j + 1:k - 1], scope) + "}")
            i = k
            continue
        k = css.find("}", j)
        sels = []
        for s in head.split(","):
            s = s.strip()
            if s in (":root", "html", "body"):
                sels.append(scope)
            elif s.startswith("body"):
                sels.append(scope + s[4:])
            else:
                sels.append(f"{scope} {s}")
        out.append(",".join(sels) + "{" + css[j + 1:k].strip() + "}")
        i = k + 1
    return "\n".join(out)


APP_CSS = """
/* Dolphin Apps additions: fit the page under the app bar and undo Tailwind's resets. */
.sop-doc{font:400 16px/1.6 var(--font-sans);color:var(--text);background:var(--bg);--sop-top:64px;overflow-x:clip}
.sop-doc ul{list-style:disc}
.sop-doc ol{list-style:decimal}
.sop-doc ol.steps,.sop-doc .check ul,.sop-doc .sfoot ul{list-style:none}
.sop-doc .eyebrow,.sop-doc .hero .sub,.sop-doc .pill,.sop-doc button{font-family:var(--font-sans)}
.sop-doc section[id],.sop-doc .gate,.sop-doc h3[id],.sop-doc .phase[id]{scroll-margin-top:calc(var(--sop-top) + 64px)}
.sop-doc nav.toc{top:var(--sop-top)}
.sop-doc .meter{top:calc(var(--sop-top) + 70px)}
.sop-doc .sfoot{border-top:1px solid var(--line)}
.sop-doc.suggesting [data-a]{cursor:text;border-radius:4px;transition:box-shadow .12s,background-color .12s}
.sop-doc.suggesting [data-a]:hover{box-shadow:0 0 0 2px rgb(70 127 247/.45);background-color:rgb(70 127 247/.06)}
.sop-doc.suggesting a,.sop-doc.suggesting label{cursor:text}
.sop-doc [data-sugg]{box-shadow:inset 3px 0 0 #f2a81b;background-color:rgb(255 205 0/.10)}
.sop-doc .sugg-flash{animation:sopflash 1.6s ease-out}
@keyframes sopflash{0%,40%{box-shadow:0 0 0 3px #f2a81b;background-color:rgb(255 205 0/.28)}100%{box-shadow:0 0 0 0 transparent}}
@media print{.sop-doc nav.toc{display:none}}
"""


def cmd_web():
    docs = load_docs()
    public = [d for d in docs if d["meta"].get("audience", "").lower() != "internal"]
    by_id = {d["meta"]["id"]: d for d in public}
    href = web_href(by_id)
    pages = os.path.join(WEB_OUT, "pages")
    os.makedirs(pages, exist_ok=True)
    for f in glob.glob(os.path.join(pages, "*.html")):
        os.remove(f)
    warnings, entries = [], []
    for d in sorted(public, key=lambda x: x["meta"]["id"]):
        m = d["meta"]
        ctx = Ctx(d["sections"], set(by_id), href)
        frag, blanks = fragment(d, ctx)
        open(os.path.join(pages, short_id(m["id"]) + ".html"), "w", encoding="utf-8").write(frag)
        warnings += [f"{m['id']}: {w}" for w in ctx.warnings]
        secs = [clean_h3(s["title"]) for s in d["sections"] if s["key"] not in SPECIAL]
        entries.append({
            "id": m["id"], "shortId": short_id(m["id"]), "title": m["title"], "dept": m.get("dept", "Other"),
            "deptSlug": dept_slug(m.get("dept", "Other")), "style": m.get("style", "Procedure"),
            "summary": plain(m.get("summary", "")), "status": m.get("status", "Draft"),
            "version": m.get("version"), "date": m.get("date"), "owner": m.get("owner", ""),
            "approver": m.get("approver", ""), "applies": m.get("applies", ""), "blanks": blanks, "sections": secs,
        })
    present = {e["dept"] for e in entries}
    depts = [{"slug": dept_slug(n), "name": n, "blurb": b, "number": k}
             for k, (n, b) in enumerate([x for x in DEPTS if x[0] in present], 1)]
    for extra in sorted(present - {x[0] for x in DEPTS}):
        depts.append({"slug": dept_slug(extra), "name": extra, "blurb": "", "number": len(depts) + 1})
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    ts = (
        "// Generated by sops/build.py web. Do not edit by hand: change sops/source and rebuild.\n"
        "export type SopDepartment = { slug: string; name: string; blurb: string; number: number };\n"
        "export type SopEntry = {\n  id: string;\n  shortId: string;\n  title: string;\n  dept: string;\n  deptSlug: string;\n"
        "  style: string;\n  summary: string;\n  status: string;\n  version: string;\n  date: string;\n  owner: string;\n"
        "  approver: string;\n  applies: string;\n  blanks: number;\n  sections: string[];\n};\n\n"
        f"export const sopBuiltAt = {json.dumps(stamp)};\n\n"
        f"export const sopStyles: Record<string, string> = {json.dumps(STYLE_INFO, indent=2)};\n\n"
        f"export const sopDepartments: SopDepartment[] = {json.dumps(depts, indent=2, ensure_ascii=False)};\n\n"
        f"export const sopCatalog: SopEntry[] = {json.dumps(entries, indent=2, ensure_ascii=False)};\n"
    )
    open(os.path.join(WEB_OUT, "catalog.ts"), "w", encoding="utf-8").write(ts)
    css = ("/* Generated by sops/build.py web from sops/sop.css. Do not edit by hand. */\n"
           + scope_css(CSS) + "\n" + APP_CSS)
    open(os.path.join(WEB_OUT, "sop-doc.css"), "w", encoding="utf-8").write(css)
    skipped = len(docs) - len(public)
    print(f"web: {len(entries)} SOPs in {len(depts)} departments -> {os.path.relpath(WEB_OUT, APP)}"
          + (f" ({skipped} internal SOP{'s' if skipped != 1 else ''} left out)" if skipped else ""))
    print("\n".join(warnings) if warnings else "no link warnings")


if __name__ == "__main__":
    cmds = {"web": cmd_web, "lint": cmd_lint, "export": cmd_export}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        sys.exit("usage: python3 sops/build.py web|lint|export")
    cmds[sys.argv[1]]()

