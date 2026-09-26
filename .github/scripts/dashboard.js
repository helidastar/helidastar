// Draws the whole profile as one night-sky "console" card from live GitHub data.
// Usage: GITHUB_TOKEN=... node dashboard.js <user> <out.svg>
const fs = require('fs');

const [, , login, out = 'dashboard.svg'] = process.argv;

const P = {
  navy0: '#070b1f', navy1: '#0c1433', navy2: '#16275a', line: '#22346b',
  pink: '#ff8fc8', pinkSoft: '#ffd1ea', lav: '#b8a9ff', blue: '#8fa8ff', sky: '#c9d6ff',
  text: '#eef2ff', muted: '#8a97c4', dim: '#5a6a9c',
};
// stack bar colors, in order of usage
const LANG = ['#ff8fc8', '#b8a9ff', '#8fa8ff', '#ffd1ea', '#6fd3ff', '#d9c9ff', '#4f74c8', '#ff6fa8'];

const STACK = ['TypeScript', 'JavaScript', 'React', 'Next.js', 'Tailwind', 'Vite', 'Supabase', 'PostgreSQL', 'SQLite', 'Prisma', 'Vitest', 'Python', 'LLM Integration', 'RAG', 'C++', 'ESP32', 'C# / .NET', 'Figma'];

const PROJECTS = [
  { repo: 'SAGIP-AI', lang: 'TypeScript', body: ['ai-assisted emergency reporting', '+ incident prioritization'], planet: 'ring' },
  { repo: 'GARBO', lang: 'TypeScript', body: ['campus waste-management app', 'that rewards proper segregation'], planet: 'moon' },
  { repo: 'PestBlaster', lang: 'TypeScript', body: ['autonomous pest-detecting turret', 'that sprays organic deterrent'], planet: 'comet' },
];

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function load() {
  const { user } = await gql(`query($login:String!){user(login:$login){
    repositories(ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC,first:100){totalCount nodes{
      name stargazerCount forkCount primaryLanguage{name}
      languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
    contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}
  }}`, { login });

  const repos = user.repositories.nodes;
  const langs = {};
  for (const r of repos) for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;

  const cal = user.contributionsCollection.contributionCalendar;
  const lvl = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const weeks = cal.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, n: d.contributionCount, level: lvl[d.contributionLevel] })));

  // streaks (today not counting yet doesn't break the current streak)
  const days = weeks.flat();
  let longest = 0, run = 0;
  for (const d of days) { run = d.n > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  let current = 0, i = days.length - 1;
  if (days[i] && days[i].n === 0) i--;
  for (; i >= 0 && days[i].n > 0; i--) current++;

  return {
    repoCount: user.repositories.totalCount,
    stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
    total: cal.totalContributions,
    current, longest, weeks, langs,
    byName: Object.fromEntries(repos.map((r) => [r.name, r])),
  };
}

// ---------- drawing helpers ----------
let seed = 5;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const f1 = (n) => +n.toFixed(1);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sparkle = (r) => {
  const k = r * 0.28;
  return `M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r}Z`;
};
const label = (x, y, text, anchor = 'start') => `<text x="${x}" y="${y}" class="lbl" text-anchor="${anchor}">${esc(text)}</text>`;

function starfield(n, x0, y0, w, h) {
  let s = '';
  const cols = ['#ffffff', P.pinkSoft, P.sky, P.lav];
  for (let i = 0; i < n; i++) {
    const r = f1(0.4 + Math.pow(rnd(), 3) * 1.4);
    s += `<circle cx="${f1(x0 + rnd() * w)}" cy="${f1(y0 + rnd() * h)}" r="${r}" fill="${cols[i % 4]}" class="tw" style="animation-duration:${f1(2.5 + rnd() * 4)}s;animation-delay:-${f1(rnd() * 6)}s"/>`;
  }
  return s;
}

function planet(kind, x, y) {
  if (kind === 'ring') return `<g transform="translate(${x} ${y})"><circle r="10" fill="${P.lav}"/><ellipse rx="18" ry="5" fill="none" stroke="${P.pink}" stroke-width="1.3" transform="rotate(-18)"><animateTransform attributeName="transform" type="rotate" values="-18;-8;-18" dur="6s" repeatCount="indefinite"/></ellipse></g>`;
  if (kind === 'moon') return `<g transform="translate(${x} ${y})"><circle r="9" fill="${P.lav}"/><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/><circle cx="17" r="2.8" fill="${P.pink}"/></g></g>`;
  return `<g transform="translate(${x} ${y})"><g><animateTransform attributeName="transform" type="translate" values="3 -2;-3 2;3 -2" dur="5s" repeatCount="indefinite"/><line x1="4" y1="-4" x2="20" y2="-14" stroke="${P.pink}" stroke-width="2" stroke-linecap="round" opacity=".45"/><circle r="4.5" fill="${P.pink}"/></g></g>`;
}

function projectCard(p, r, i) {
  const W = 290, H = 140;
  const lang = (r.primaryLanguage && r.primaryLanguage.name) || p.lang || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
text{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif}
.small{font-size:12px}
.ptitle{font:italic 20px Georgia,'Times New Roman',serif;fill:${P.text}}
.tw{animation:tw 4s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:1}}
.in{animation:in 1s ease-out both}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
</style>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.navy1}"/><stop offset="1" stop-color="${P.navy0}"/></linearGradient>
<radialGradient id="blob"><stop offset="0" stop-color="${[P.pink, P.lav, P.blue][i]}" stop-opacity=".18"/><stop offset="1" stop-color="${[P.pink, P.lav, P.blue][i]}" stop-opacity="0"/></radialGradient>
<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#c)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<ellipse cx="${W - 40}" cy="30" rx="110" ry="70" fill="url(#blob)"/>
${starfield(22, 0, 0, W, H)}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${P.line}"/>
${planet(p.planet, W - 34, 34)}
<g class="in">
<text x="20" y="38" class="ptitle">${esc(p.repo)}</text>
${p.body.map((l, k) => `<text x="20" y="${63 + k * 17}" class="small" fill="${P.muted}">${esc(l)}</text>`).join('')}
<circle cx="24" cy="${H - 24}" r="4" fill="${[P.pink, P.lav, P.blue][i]}"/>
<text x="34" y="${H - 20}" class="small" fill="${P.muted}">${esc(lang)}</text>
<text x="${W - 20}" y="${H - 20}" text-anchor="end" class="small" fill="${P.dim}">✦ ${r.stargazerCount || 0}   ·   ${r.forkCount || 0} forks</text>
</g>
</svg>`;
}

function render(d) {
  const W = 900, M = 52, IW = W - M * 2;
  let y = 0, body = '', css = '';

  // --- header ---
  body += `<g class="in">
<text x="${W / 2}" y="112" text-anchor="middle" class="name" fill="url(#shimmer)">charity ricabo</text>
<text x="${W / 2}" y="148" text-anchor="middle" class="cap" fill="${P.pink}" letter-spacing="5">UI/UX DESIGNER  ·  FULL-STACK DEVELOPER</text>
<text x="${W / 2}" y="176" text-anchor="middle" class="small" fill="${P.muted}" letter-spacing="2">computer engineering student</text>
<text x="${W / 2}" y="198" text-anchor="middle" class="small" fill="${P.dim}" letter-spacing="1">github.com/${esc(login)}</text>
</g>`;
  y = 240;

  // --- stack pills ---
  // pills wrap into centered rows of roughly equal width
  const gap = 10, rows = [[]];
  const pillW = (s) => s.length * 7.2 + 26;
  const allW = STACK.reduce((a, s) => a + pillW(s) + gap, 0);
  const target = allW / Math.ceil(allW / (IW - 40));
  let rowW = 0;
  STACK.forEach((s, i) => {
    const w = pillW(s);
    if (rowW + w / 2 > target && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rows[rows.length - 1].push({ s, w, i });
    rowW += w + gap;
  });
  body += `<g class="in" style="animation-delay:.2s">`;
  rows.forEach((row) => {
    let px = (W - (row.reduce((a, p) => a + p.w, 0) + gap * (row.length - 1))) / 2;
    for (const { s, w, i } of row) {
      const c = [P.pink, P.lav, P.blue][i % 3];
      body += `<rect x="${f1(px)}" y="${y - 17}" width="${f1(w)}" height="26" rx="13" fill="${c}" fill-opacity=".08" stroke="${c}" stroke-opacity=".55"/>`;
      body += `<text x="${f1(px + w / 2)}" y="${y + 1}" text-anchor="middle" class="pill" fill="${P.text}">${esc(s)}</text>`;
      px += w + gap;
    }
    y += 36;
  });
  body += `</g>`;
  y += 4;

  // --- stats row ---
  body += `<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${P.line}"/>`;
  const stats = [
    [d.total, 'CONTRIBUTIONS', P.pink], [d.repoCount, 'PUBLIC REPOS', P.lav], [d.stars, 'STARS', P.blue],
    [d.current, 'CURRENT STREAK', P.pink], [d.longest, 'LONGEST STREAK', P.lav],
  ];
  const sw = IW / stats.length;
  body += `<ellipse cx="${W / 2}" cy="${y + 55}" rx="300" ry="42" fill="url(#blobPink)" class="pulse"/>`;
  body += `<g class="in" style="animation-delay:.35s">`;
  stats.forEach(([n, l, c], i) => {
    const cx = M + sw * i + sw / 2;
    body += `<text x="${cx}" y="${y + 58}" text-anchor="middle" class="num">${n}</text>`;
    body += `<text x="${cx}" y="${y + 80}" text-anchor="middle" class="tiny" fill="${c}" letter-spacing="2">${l}</text>`;
  });
  body += `</g>`;
  y += 108;
  body += `<line x1="${M}" y1="${y}" x2="${W - M}" y2="${y}" stroke="${P.line}"/>`;
  y += 40;

  // --- stack analytics ---
  const langs = Object.entries(d.langs).sort((a, b) => b[1] - a[1]);
  const sum = langs.reduce((s, [, v]) => s + v, 0) || 1;
  // anything under 1% gets folded into "other" so the legend stays readable
  const top = langs.filter(([, v]) => v / sum >= 0.01).slice(0, 7);
  const rest = sum - top.reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push(['other', rest]);
  body += `<g class="in" style="animation-delay:.5s">${label(M, y, 'STACK ANALYTICS')}`;
  y += 18;
  let bx = M;
  body += `<clipPath id="barclip"><rect x="${M}" y="${y}" width="${IW}" height="8" rx="4"/></clipPath><g clip-path="url(#barclip)">`;
  top.forEach(([, v], i) => {
    const w = (v / sum) * IW;
    body += `<rect x="${f1(bx)}" y="${y}" width="${f1(w + 0.5)}" height="8" fill="${LANG[i % LANG.length]}"/>`;
    bx += w;
  });
  body += `<rect x="${M}" y="${y}" width="80" height="8" fill="url(#sheen)"><animate attributeName="x" values="${M - 80};${W - M};${W - M}" keyTimes="0;.5;1" dur="6s" repeatCount="indefinite"/></rect></g>`;
  y += 34;
  const colW = IW / 4;
  top.forEach(([name, v], i) => {
    const lx = M + (i % 4) * colW, ly = y + Math.floor(i / 4) * 24;
    body += `<circle cx="${lx + 5}" cy="${ly - 4}" r="4.5" fill="${LANG[i % LANG.length]}"/>`;
    body += `<text x="${lx + 16}" y="${ly}" class="small" fill="${P.text}">${esc(name)} <tspan fill="${P.dim}">${((v / sum) * 100).toFixed(1)}%</tspan></text>`;
  });
  body += `</g>`;
  y += Math.ceil(top.length / 4) * 24 + 30;

  // --- constellation activity ---
  body += `<g class="in" style="animation-delay:.65s">${label(M, y, 'CONSTELLATION ACTIVITY')}${label(W - M, y, `${d.total} contributions · last year`, 'end')}`;
  y += 24;
  const cell = IW / d.weeks.length, colors = ['#1d2c5c', '#4f74c8', P.blue, P.lav, P.pink], sizes = [1.5, 3.6, 4.8, 6, 7.4];
  body += `<ellipse cx="${W / 2}" cy="${y + cell * 3.5}" rx="330" ry="70" fill="url(#blobBlue)" class="pulse" style="animation-delay:-2s"/>`;
  // every active day, in date order, becomes a stop on the comet's flight
  const stops = [];
  d.weeks.forEach((w, i) => w.forEach((day) => {
    const cx = f1(M + i * cell + cell / 2), cy = f1(y + new Date(day.date).getUTCDay() * cell + cell / 2);
    const tip = `<title>${day.n} on ${day.date}</title>`;
    if (!day.level) body += `<circle cx="${cx}" cy="${cy}" r="${sizes[0]}" fill="${colors[0]}">${tip}</circle>`;
    else stops.push({ x: cx, y: cy, day, tip });
  }));

  // comet timeline: fly for FLY seconds, hold the lit sky, fade, repeat
  const LOOP = 13, FLY = 7, FADE_AT = 88;
  if (stops.length) {
    // smooth catmull-rom flight path, sampled so length (and therefore timing) is exact
    const pts = [{ x: M - 30, y: y + cell * 3.5 }, ...stops];
    const flight = [pts[0]], at = [0];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let s = 1; s <= 10; s++) {
        const t = s / 10, t2 = t * t, t3 = t2 * t;
        const c = (a, b, e, g) => 0.5 * (2 * b + (-a + e) * t + (2 * a - 5 * b + 4 * e - g) * t2 + (-a + 3 * b - 3 * e + g) * t3);
        flight.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) });
      }
      at.push(flight.length - 1);
    }
    const cum = [0];
    for (let i = 1; i < flight.length; i++) cum.push(cum[i - 1] + Math.hypot(flight[i].x - flight[i - 1].x, flight[i].y - flight[i - 1].y));
    const L = cum[cum.length - 1];
    const pathD = 'M' + flight.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' L');
    const flyPct = (FLY / LOOP) * 100;
    const pct = (n) => +n.toFixed(2);
    // time per hop grows with sqrt(distance): long empty stretches zip by, clusters get savored
    const hopLen = stops.map((_, i) => cum[at[i + 1]] - cum[at[i]]);
    const hopW = hopLen.map((l) => Math.sqrt(l) + 1.5), totalW = hopW.reduce((a, b) => a + b, 0);
    const tAt = [0];
    hopW.forEach((w) => tAt.push(tAt[tAt.length - 1] + w / totalW));
    const stopPct = tAt.map((t) => pct(t * flyPct));

    // constellation wake: drawn in lockstep with the comet (both move at constant speed)
    css += `@keyframes wake{${stopPct.map((p, i) => `${p}%{stroke-dashoffset:${f1(L - cum[at[i]])};opacity:.55}`).join('')}${FADE_AT}%{stroke-dashoffset:0;opacity:.35}100%{stroke-dashoffset:0;opacity:0}}`;
    body += `<path d="${pathD}" fill="none" stroke="url(#wakeGrad)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f1(L)}" style="animation:wake ${LOOP}s linear infinite"/>`;

    stops.forEach((s, i) => {
      const hit = stopPct[i + 1];
      const lvl = s.day.level;
      // star waits dim, flares when the comet arrives, stays lit, then fades with the loop
      css += `@keyframes f${i}{0%,${hit}%{opacity:.16;transform:scale(.55)}${pct(hit + 0.6)}%{opacity:1;transform:scale(2.1)}${pct(hit + 3)}%,${FADE_AT}%{opacity:1;transform:scale(1)}100%{opacity:.16;transform:scale(.55)}}`;
      css += `@keyframes r${i}{0%,${hit}%{opacity:0;transform:scale(.2)}${pct(hit + 0.4)}%{opacity:.9;transform:scale(.6)}${pct(hit + 4)}%,100%{opacity:0;transform:scale(2.6)}}`;
      body += `<g transform="translate(${s.x} ${s.y})">
<circle r="5" fill="none" stroke="${colors[lvl]}" stroke-width="1" vector-effect="non-scaling-stroke" class="fx" style="animation:r${i} ${LOOP}s linear infinite"/>
<g class="fx" style="animation:f${i} ${LOOP}s ease-out infinite"><path d="${sparkle(sizes[lvl])}" fill="${colors[lvl]}" class="tw2" style="animation-duration:${f1(2.5 + rnd() * 3.5)}s;animation-delay:-${f1(rnd() * 5)}s"${lvl >= 3 ? ' filter="url(#glow)"' : ''}/></g>${s.tip}</g>`;
    });

    // the comet itself
    const endKey = +(FLY / LOOP).toFixed(4);
    const kp = at.map((a) => +(cum[a] / L).toFixed(4)).concat(1).join(';');
    const kt = tAt.map((t) => +(t * endKey).toFixed(4)).concat(1).join(';');
    const motion = (begin = 0) => `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.02;${endKey};${+(endKey + 0.03).toFixed(4)};1" dur="${LOOP}s" begin="${begin}s" repeatCount="indefinite"/>
<animateMotion path="${pathD}" rotate="auto" keyPoints="${kp}" keyTimes="${kt}" calcMode="linear" dur="${LOOP}s" begin="${begin}s" repeatCount="indefinite"/>`;
    // stardust trailing the comet
    [[0.12, 1.6, P.pinkSoft, 0.8], [0.24, 1.2, P.lav, 0.6], [0.38, 0.9, P.sky, 0.45], [0.55, 0.7, P.pink, 0.3]].forEach(([lag, r, c, o]) => {
      body += `<g opacity="0">${motion(lag)}<circle cy="${f1((rnd() - 0.5) * 6)}" r="${r}" fill="${c}" fill-opacity="${o}"/></g>`;
    });
    body += `<g opacity="0">
${motion()}
<line x1="-80" y1="0" x2="0" y2="0" stroke="url(#cometTail)" stroke-width="4.4" stroke-linecap="round"/>
<circle r="10" fill="url(#cometHalo)"/>
<circle r="3.6" fill="#ffffff" filter="url(#glow)"/>
</g>`;
  }
  body += `</g>`;
  y += cell * 7 + 44;

  body += `<text x="${W / 2}" y="${y}" text-anchor="middle" class="tiny" fill="${P.dim}" letter-spacing="3">AUTO-UPDATED FROM GITHUB  ·  EVERY 12 HOURS</text>`;
  const H = y + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
text{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif}
.lbl{font-size:11px;font-weight:600;letter-spacing:3px;fill:${P.blue}}
.cap{font-size:13px;font-weight:600}
.small{font-size:12px}
.tiny{font-size:9.5px;font-weight:600}
.pill{font-size:12px;font-weight:600}
.num{font-size:30px;font-weight:700;fill:${P.text}}
.name{font:italic 56px Georgia,'Times New Roman',serif}
.ptitle{font:italic 19px Georgia,'Times New Roman',serif;fill:${P.text}}
.tw{animation:tw 4s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.2}50%{opacity:1}}
.tw2{animation:tw2 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes tw2{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
.pulse{animation:pulse 7s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
.in{animation:in 1.2s ease-out both}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.moon{animation:bob 7s ease-in-out infinite}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.shoot{animation:shoot 9s linear infinite;opacity:0}
@keyframes shoot{0%{transform:translate(0,0);opacity:0}2%{opacity:1}9%{transform:translate(-380px,170px);opacity:0}100%{opacity:0}}
a text{cursor:pointer}
.fx{transform-box:fill-box;transform-origin:center}
${css}
</style>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.navy1}"/><stop offset=".5" stop-color="${P.navy0}"/><stop offset="1" stop-color="${P.navy1}"/></linearGradient>
<radialGradient id="blobPink"><stop offset="0" stop-color="${P.pink}" stop-opacity=".22"/><stop offset="1" stop-color="${P.pink}" stop-opacity="0"/></radialGradient>
<radialGradient id="blobLav"><stop offset="0" stop-color="${P.lav}" stop-opacity=".28"/><stop offset="1" stop-color="${P.lav}" stop-opacity="0"/></radialGradient>
<radialGradient id="blobBlue"><stop offset="0" stop-color="#3d63c4" stop-opacity=".3"/><stop offset="1" stop-color="#3d63c4" stop-opacity="0"/></radialGradient>
<radialGradient id="moonglow"><stop offset="0" stop-color="${P.pink}" stop-opacity=".45"/><stop offset="1" stop-color="${P.pink}" stop-opacity="0"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.pinkSoft}"/><stop offset="1" stop-color="${P.pinkSoft}" stop-opacity="0"/></linearGradient>
<linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${P.text}"/><stop offset=".44" stop-color="${P.text}"/><stop offset=".5" stop-color="${P.pink}"/><stop offset=".56" stop-color="${P.lav}"/><stop offset=".62" stop-color="${P.text}"/><stop offset="1" stop-color="${P.text}"/>
<animateTransform attributeName="gradientTransform" type="translate" values="-1 0;1 0;1 0" keyTimes="0;.45;1" dur="7s" repeatCount="indefinite"/>
</linearGradient>
<linearGradient id="wakeGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.blue}"/><stop offset=".5" stop-color="${P.lav}"/><stop offset="1" stop-color="${P.pink}"/></linearGradient>
<linearGradient id="cometTail" gradientUnits="userSpaceOnUse" x1="-80" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${P.pink}" stop-opacity="0"/><stop offset=".7" stop-color="${P.pink}" stop-opacity=".6"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<radialGradient id="cometHalo"><stop offset="0" stop-color="${P.pinkSoft}" stop-opacity=".9"/><stop offset="1" stop-color="${P.pink}" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<mask id="crescent"><rect x="700" y="0" width="200" height="200" fill="#fff"/><circle cx="802" cy="62" r="22" fill="#000"/></mask>
<clipPath id="card"><rect width="${W}" height="${H}" rx="22"/></clipPath>
</defs>
<g clip-path="url(#card)">
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<ellipse cx="260" cy="120" rx="260" ry="110" fill="url(#blobLav)" class="pulse"/>
<ellipse cx="660" cy="150" rx="240" ry="100" fill="url(#blobPink)" class="pulse" style="animation-delay:-3.5s"/>
${starfield(130, 0, 0, W, H)}
<g class="moon"><circle cx="794" cy="70" r="60" fill="url(#moonglow)" class="pulse"/><circle cx="794" cy="70" r="22" fill="${P.pinkSoft}" mask="url(#crescent)"/></g>
<g class="shoot"><line x1="760" y1="24" x2="830" y2="-8" stroke="url(#tail)" stroke-width="1.6" stroke-linecap="round"/></g>
<g class="shoot" style="animation-delay:4.5s"><line x1="420" y1="30" x2="480" y2="3" stroke="url(#tail)" stroke-width="1.2" stroke-linecap="round"/></g>
<g stroke="${P.lav}" stroke-opacity=".5" stroke-width="1.5" fill="none">
<path d="M22 44 V22 H44"/><path d="M${W - 44} ${H - 22} H${W - 22} V${H - 44}"/>
</g>
${body}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="22" fill="none" stroke="${P.line}"/>
</svg>`;
}

(async () => {
  const data = await load();
  fs.writeFileSync(out, render(data));
  const dir = require('path').dirname(out);
  PROJECTS.forEach((p, i) => fs.writeFileSync(`${dir}/project-${p.repo.toLowerCase()}.svg`, projectCard(p, data.byName[p.repo] || {}, i)));
  console.log(`wrote ${out}: ${data.total} contributions, ${data.repoCount} repos, ${data.stars} stars, streak ${data.current}/${data.longest}`);
})().catch((e) => { console.error(e); process.exit(1); });
