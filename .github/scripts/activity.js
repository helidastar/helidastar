// Draws GitHub's "activity overview" cross (commits / issues / PRs / code review) as an SVG.
// Usage: GITHUB_TOKEN=... node activity.js <user> <outdir>
// Writes <outdir>/activity.svg (light) and <outdir>/activity-dark.svg
const fs = require('fs');
const path = require('path');

const [, , login, outDir = '.'] = process.argv;

async function load() {
  if (process.env.FAKE) return JSON.parse(process.env.FAKE);
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($login:String!){user(login:$login){contributionsCollection{
        totalCommitContributions totalIssueContributions
        totalPullRequestContributions totalPullRequestReviewContributions}}}`,
      variables: { login },
    }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  const c = json.data.user.contributionsCollection;
  return {
    commits: c.totalCommitContributions,
    issues: c.totalIssueContributions,
    prs: c.totalPullRequestContributions,
    reviews: c.totalPullRequestReviewContributions,
  };
}

const THEMES = {
  light: { line: '#216e39', fill: '#40c463', dot: '#ffffff', text: '#57606a', bg: 'none' },
  dark: { line: '#26a641', fill: '#39d353', dot: '#0d1117', text: '#8b949e', bg: 'none' },
};

function render(d, t) {
  const total = d.commits + d.issues + d.prs + d.reviews || 1;
  const pct = (n) => Math.round((n / total) * 100);
  const W = 420, H = 300, cx = W / 2, cy = H / 2, R = 95;
  // each arm's point sits proportionally out from the center, like github's
  const r = (n) => Math.max(4, (n / total) * R);
  const pts = {
    top: [cx, cy - r(d.reviews)],
    right: [cx + r(d.issues), cy],
    bottom: [cx, cy + r(d.prs)],
    left: [cx - r(d.commits), cy],
  };
  const poly = [pts.top, pts.right, pts.bottom, pts.left].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  const dot = ([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${t.dot}" stroke="${t.line}" stroke-width="2"/>`;
  const lbl = (x, y, a, n, name) =>
    `<text x="${x}" y="${y}" text-anchor="${a}" fill="${t.text}"><tspan x="${x}">${pct(n)}%</tspan><tspan x="${x}" dy="16">${name}</tspan></text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<style>text{font:12px -apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif}</style>
<rect width="${W}" height="${H}" rx="6" fill="${t.bg}"/>
<g stroke="${t.line}" stroke-width="2" stroke-linecap="round">
<line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}"/>
<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}"/>
</g>
<polygon points="${poly}" fill="${t.fill}" fill-opacity=".55" stroke="${t.fill}" stroke-width="4" stroke-linejoin="round"/>
${dot(pts.top)}${dot(pts.right)}${dot(pts.bottom)}${dot(pts.left)}
${lbl(cx, cy - R - 26, 'middle', d.reviews, 'Code review')}
${lbl(cx + R + 12, cy - 4, 'start', d.issues, 'Issues')}
${lbl(cx, cy + R + 18, 'middle', d.prs, 'Pull requests')}
${lbl(cx - R - 12, cy - 4, 'end', d.commits, 'Commits')}
</svg>`;
}

(async () => {
  const d = await load();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'activity.svg'), render(d, THEMES.light));
  fs.writeFileSync(path.join(outDir, 'activity-dark.svg'), render(d, THEMES.dark));
  console.log('activity:', d);
})().catch((e) => { console.error(e); process.exit(1); });
