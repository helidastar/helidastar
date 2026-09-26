// Draws each project as a small celestial card (night + day variants, transparent).
// Usage: GITHUB_TOKEN=... node project-cards.js <owner> <outDir>
const fs = require('fs');

const [, , owner, out = '.'] = process.argv;

// fallback text is used for private repos or when the API is unavailable
const projects = [
  { repo: 'SAGIP-AI', title: 'SAGIP-AI', body: 'ai-assisted emergency reporting and incident prioritization, ranked on a live map', lang: 'TypeScript', planet: 'ring' },
  { repo: 'GARBO', title: 'GARBO', body: 'campus waste-management app that rewards students for segregating properly', lang: 'TypeScript', planet: 'moon' },
  { repo: 'Reflect.ly', title: 'Reflect.ly', body: 'full-stack journaling app', lang: 'JavaScript', planet: 'comet', private: true },
];

const themes = {
  night: { border: '#243a6b', fill: '#7aa2ff', fillOp: 0.05, title: '#eef2ff', body: '#aebbe0', meta: '#8fa8ff', planet: '#b8a9ff', accent: '#ff8fc8', star: '#ffd1ea' },
  day: { border: '#cdd6ee', fill: '#2f5aa8', fillOp: 0.04, title: '#16275a', body: '#4a5a8a', meta: '#3d63c4', planet: '#7a5cff', accent: '#d6428f', star: '#2f5aa8' },
};
const langColor = { TypeScript: '#3178c6', JavaScript: '#f1e05a', 'C#': '#178600' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const lines = [''];
  for (const w of text.split(' ')) {
    const cur = lines[lines.length - 1];
    if ((cur + ' ' + w).trim().length > max) lines.push(w);
    else lines[lines.length - 1] = (cur + ' ' + w).trim();
  }
  return lines.slice(0, 2);
}

function planet(kind, t) {
  if (kind === 'ring') {
    return `<g transform="translate(360 40)">
<circle r="11" fill="${t.planet}" opacity=".9"/>
<ellipse rx="20" ry="5.5" fill="none" stroke="${t.accent}" stroke-width="1.4" transform="rotate(-18)"><animateTransform attributeName="transform" type="rotate" values="-18;-10;-18" dur="6s" repeatCount="indefinite"/></ellipse>
</g>`;
  }
  if (kind === 'moon') {
    return `<g transform="translate(360 40)">
<circle r="10" fill="${t.planet}" opacity=".9"/>
<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite"/><circle cx="19" r="3" fill="${t.accent}"/></g>
</g>`;
  }
  return `<g transform="translate(360 40)">
<g><animateTransform attributeName="transform" type="translate" values="4 -3;-4 3;4 -3" dur="5s" repeatCount="indefinite"/>
<line x1="4" y1="-4" x2="22" y2="-16" stroke="${t.accent}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
<circle r="5" fill="${t.accent}"/></g>
</g>`;
}

function card(p, t) {
  const W = 400, H = 130;
  const lines = wrap(p.body, 46);
  const meta = [`<circle cx="24" cy="${H - 22}" r="5" fill="${langColor[p.lang] || t.meta}"/><text x="35" y="${H - 18}" class="m">${esc(p.lang || '')}</text>`];
  if (!p.private) meta.push(`<text x="${W - 24}" y="${H - 18}" class="m" text-anchor="end">✦ ${p.stars ?? 0}</text>`);
  else meta.push(`<text x="${W - 24}" y="${H - 18}" class="m" text-anchor="end">private repo</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
.t{font:italic 22px Georgia,'Times New Roman',serif;fill:${t.title}}
.b{font:13px 'Segoe UI','Helvetica Neue',Arial,sans-serif;fill:${t.body}}
.m{font:12px 'Segoe UI','Helvetica Neue',Arial,sans-serif;fill:${t.meta}}
.tw{animation:tw 3.5s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.2}50%{opacity:.9}}
.in{animation:in 1s ease-out both}@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.fill}" fill-opacity="${t.fillOp}" stroke="${t.border}"/>
<circle cx="300" cy="22" r="1" fill="${t.star}" class="tw"/><circle cx="330" cy="78" r=".8" fill="${t.star}" class="tw" style="animation-delay:-1.2s"/><circle cx="385" cy="92" r="1" fill="${t.star}" class="tw" style="animation-delay:-2.1s"/>
${planet(p.planet, t)}
<g class="in">
<text x="24" y="42" class="t">${esc(p.title)}</text>
${lines.map((l, i) => `<text x="24" y="${68 + i * 18}" class="b">${esc(l)}</text>`).join('')}
${meta.join('')}
</g>
</svg>`;
}

async function enrich(p) {
  if (p.private) return p;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${p.repo}`, {
      headers: process.env.GITHUB_TOKEN ? { Authorization: `bearer ${process.env.GITHUB_TOKEN}` } : {},
    });
    if (!res.ok) return p;
    const r = await res.json();
    return { ...p, stars: r.stargazers_count, lang: r.language || p.lang };
  } catch {
    return p;
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const p of await Promise.all(projects.map(enrich))) {
    for (const [name, t] of Object.entries(themes)) {
      fs.writeFileSync(`${out}/project-${p.repo.toLowerCase().replace(/\W+/g, '-')}-${name}.svg`, card(p, t));
    }
  }
  console.log(`wrote ${projects.length} project cards to ${out}`);
})();
