// Renders the last year of contributions as a twinkling star chart.
// Usage: GITHUB_TOKEN=... node star-chart.js <user> <outDir>
//        node star-chart.js --demo <outDir>   (random data, for previewing)
// Writes star-chart-night.svg and star-chart-day.svg with transparent backgrounds.
const fs = require('fs');

const [, , user, out = '.'] = process.argv;

const themes = {
  night: { colors: ['#4a4290', '#8f7df0', '#b8a9ff', '#e4ddff', '#ffe9a8'], dust: '#ffffff', lbl: '#8f86c9', cap: '#d9d1ff', tail: '#ffffff' },
  day: { colors: ['#cfc8ee', '#a08cf5', '#7a5cff', '#4b2fc9', '#d19a00'], dust: '#7a5cff', lbl: '#7a70b5', cap: '#3b2f80', tail: '#7a5cff' },
};

async function fetchWeeks(login) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const cal = json.data.user.contributionsCollection.contributionCalendar;
  const lvl = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  return {
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, n: d.contributionCount, level: lvl[d.contributionLevel] }))),
  };
}

function demoWeeks() {
  const weeks = [];
  let total = 0;
  const start = new Date(Date.now() - 52 * 7 * 864e5);
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 864e5).toISOString().slice(0, 10);
      const r = Math.random();
      const level = r < 0.45 ? 0 : r < 0.7 ? 1 : r < 0.85 ? 2 : r < 0.95 ? 3 : 4;
      total += level * 2;
      days.push({ date, n: level * 2, level });
    }
    weeks.push(days);
  }
  return { total, weeks };
}

// four-point sparkle centered on 0,0 with radius r
const sparkle = (r) => {
  const k = r * 0.28;
  return `M0,${-r} Q${k},${-k} ${r},0 Q${k},${k} 0,${r} Q${-k},${k} ${-r},0 Q${-k},${-k} 0,${-r}Z`;
};

function render({ total, weeks }, t) {
  const cell = 17, left = 52, top = 58;
  const W = left * 2 + weeks.length * cell - 6, H = top + 7 * cell + 48;
  const { colors } = t;
  const sizes = [1.3, 3.2, 4.4, 5.6, 7];
  let body = '', seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // faint background dust
  for (let i = 0; i < 70; i++) {
    body += `<circle cx="${(rnd() * W).toFixed(1)}" cy="${(rnd() * H).toFixed(1)}" r="${(0.3 + rnd() * 0.6).toFixed(1)}" fill="${t.dust}" opacity="${(0.15 + rnd() * 0.3).toFixed(2)}"/>`;
  }

  // month labels
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let lastMonth = -1, lastIdx = -9;
  weeks.forEach((w, i) => {
    const m = new Date(w[0].date).getUTCMonth();
    if (m !== lastMonth && i - lastIdx > 2 && i < weeks.length - 2) {
      body += `<text x="${left + i * cell}" y="${top - 16}" class="lbl">${months[m]}</text>`;
      lastMonth = m; lastIdx = i;
    }
  });

  weeks.forEach((w, i) => {
    w.forEach((d) => {
      const row = new Date(d.date).getUTCDay();
      const x = left + i * cell + cell / 2 - 3, y = top + row * cell + cell / 2 - 3;
      const tip = `<title>${d.n} contribution${d.n === 1 ? '' : 's'} on ${d.date}</title>`;
      if (d.level === 0) {
        body += `<circle cx="${x}" cy="${y}" r="${sizes[0]}" fill="${colors[0]}">${tip}</circle>`;
      } else {
        const dur = (2.5 + rnd() * 3.5).toFixed(1), del = (rnd() * 5).toFixed(1);
        body += `<g transform="translate(${x} ${y})"><path d="${sparkle(sizes[d.level])}" fill="${colors[d.level]}" class="tw" style="animation-duration:${dur}s;animation-delay:-${del}s"${d.level === 4 ? ' filter="url(#g)"' : ''}/>${tip}</g>`;
      }
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>
.tw{animation:tw 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes tw{0%,100%{opacity:.55;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
.lbl{font:11px 'Segoe UI','Helvetica Neue',Arial,sans-serif;fill:${t.lbl};letter-spacing:1px}
.cap{font:italic 14px Georgia,'Times New Roman',serif;fill:${t.cap}}
.shoot{animation:shoot 11s linear infinite;opacity:0}
@keyframes shoot{0%{transform:translate(0,0);opacity:0}2%{opacity:1}8%{transform:translate(-300px,120px);opacity:0}100%{opacity:0}}
</style>
<defs>
<linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.tail}"/><stop offset="1" stop-color="${t.tail}" stop-opacity="0"/></linearGradient>
<filter id="g" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
${body}
<g class="shoot"><line x1="${W - 120}" y1="18" x2="${W - 40}" y2="-14" stroke="url(#tail)" stroke-width="1.4" stroke-linecap="round"/></g>
<text x="${left - 3}" y="${H - 20}" class="cap">${total} stars mapped this year</text>
<g transform="translate(${W - left - 128} ${H - 25})">
<text x="-10" y="4" class="lbl" text-anchor="end">dim</text>
${[0, 1, 2, 3, 4].map((l, i) => l === 0
    ? `<circle cx="${i * 24}" cy="0" r="${sizes[0]}" fill="${colors[0]}"/>`
    : `<path transform="translate(${i * 24} 0)" d="${sparkle(sizes[l])}" fill="${colors[l]}"/>`).join('')}
<text x="${4 * 24 + 14}" y="4" class="lbl">bright</text>
</g>
</svg>`;
}

(async () => {
  const data = user === '--demo' ? demoWeeks() : await fetchWeeks(user);
  fs.mkdirSync(out, { recursive: true });
  for (const [name, t] of Object.entries(themes)) fs.writeFileSync(`${out}/star-chart-${name}.svg`, render(data, t));
  console.log(`wrote star charts to ${out} (${data.total} contributions)`);
})().catch((e) => { console.error(e); process.exit(1); });
