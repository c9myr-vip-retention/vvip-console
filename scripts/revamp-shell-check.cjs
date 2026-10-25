// Local smoke test for the revamp shell. NO production calls: every request to the Worker is answered by fake data.
// Usage:  npm run build && npx vite preview --port 4173 &
//         node scripts/revamp-shell-check.cjs <outdir> <admin|agent> <1|0|off> "Contact,Tasks,Settings"
// Needs Playwright (PLAYWRIGHT_PATH or a global install) and Chromium (CHROMIUM_PATH, default /opt/pw-browsers/chromium).
// Writes one 1440px screenshot per sidebar item, prints console errors (404s on /api/work/* are expected: not deployed).
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const S = process.argv[2];
const role = process.argv[3] || 'admin';
const flag = process.argv[4] ?? '1';
const pages = (process.argv[5] || '').split(',').filter(Boolean);
const START = 'http://localhost:' + (process.env.PORT||4173) + '/' + (flag === 'off' ? '' : `?revamp=${flag}`);
const API = 'https://groupb-tracker-api.viprtn.workers.dev';
const BR = ['LPK777','ACE33','BM69','HOT321','RM68','SK69','JK32','ZAS36'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const day = (n) => new Date(Date.UTC(2026,9,21) - n*86400000).toISOString().slice(0,10);
const rows = [];
BR.forEach((b) => { for (let i = 0; i < 70; i++) {
  const ts = i % 5 === 0 ? 'V' : '3'; const dsld = [0,0,1,2,3,5,8,9,15,16,31,40][Math.floor(rnd()*12)];
  const dep = dsld === 0 ? Math.round(rnd()*4000) : 0; const wl = Math.round((rnd()-0.5)*6000);
  const key = (['LPK777','ACE33'].includes(b) ? 'u' : '9') + b.toLowerCase() + i;
  rows.push({ snapshot_date: day(0), player_key: key, brand: b, tier_segment: ts, uid: ['LPK777','ACE33'].includes(b) ? '' : key, username: 'user_' + key,
    entry_date: day(60), tier: 'Tier ' + (ts==='V'?7:3), daily_deposit: dep, daily_deposit_count: dep?1:0, daily_withdraw: 0, monthly_deposit: dep*10, monthly_withdraw: 0,
    lifetime_deposit: 50000+i*100, lifetime_withdraw: Math.round(rnd()*60000), bet: 3000, valid_bet: dsld>6?100:2000, win_loss: wl,
    last_deposit_date: day(dsld), pnl: null, group_name: '', status: 'active' }); } });
const me = role === 'admin'
  ? { username:'aldo', role:'admin', manage_users:1, can_edit:1, can_delete:1, on_leaderboard:0, team:null }
  : { username:'sara', role:'agent', manage_users:0, can_edit:1, can_delete:1, on_leaderboard:1, team:'B' };
const contacts = rows.slice(0, 30).map((r, i) => ({ snapshot_date: day(0), player_key: r.player_key, brand: r.brand, tier_segment: r.tier_segment, assigned_to: i%2?'sara':'daniel', status: i%3?'ASSIGNED':'CONTACTED' }));
const board = { snapshot_date: day(0), synced_at: day(0)+' 06:55:00', rows, contacts,
  health: BR.map((b) => ({ brand: b, last_fed: b==='SK69'?day(1):day(0), newest_dep: day(0) })),
  team: [{username:'aldo',role:'admin',on_leaderboard:0},{username:'sara',role:'agent',on_leaderboard:1},{username:'daniel',role:'agent',on_leaderboard:1}], telegram: [], cooling: [], reactivation: [] };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('session_token', 'x'));
  const page = await ctx.newPage();
  const errs = [], unknown = new Set();
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.route(API + '/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const json = (o, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (p === '/api/me') return json(me);
    if (p === '/api/rtn/dates') return json([0,1,2,3,7,8].map((n) => ({ snapshot_date: day(n) })));
    if (p === '/api/rtn/board') return json(board);
    if (p === '/api/work/tasks') return role === 'agent' ? json({ tasks: [{ id:1, assignee:'sara', status:'pending', due_date: day(2) }, { id:2, assignee:'sara', status:'progress', due_date: day(-3) }] }) : json({ error: 'not deployed' }, 404);
    if (p.startsWith('/api/work/')) return json({ error: 'not deployed' }, 404);
    if (p === '/api/users') return json([{id:1,username:'aldo',role:'admin',can_edit:1,can_delete:1,on_leaderboard:0,manage_users:1,team:null},{id:2,username:'sara',role:'agent',can_edit:1,can_delete:1,on_leaderboard:1,manage_users:0,team:'B'}]);
    if (p === '/api/logout') return json({ ok: true });
    unknown.add(req.method() + ' ' + p); return json([]);
  });
  await page.goto(START); await page.waitForTimeout(1500);
  if (process.env.CLICK) { await page.locator('.bcard', { hasText: process.env.CLICK }).click(); await page.waitForTimeout(400); console.log('active nav after brand click:', await page.locator('.nav.on').innerText()); await page.locator('.topbar .csb').click(); await page.waitForTimeout(200); await page.keyboard.type('C'); await page.keyboard.press('Enter'); await page.waitForTimeout(500); console.log('team now:', await page.locator('.topbar .csb').innerText()); await page.locator('.nav', {hasText:'Dashboard'}).click(); await page.waitForTimeout(500); console.log('cards on Team C:', await page.locator('.bcard').count()); }
  const out = (n) => `${S}/${role}-${flag}-${n}.png`;
  await page.screenshot({ path: out('home') });
  for (const k of pages) {
    const label = k.split(':')[1] || k; const sel = k.split(':')[0];
    await page.locator('.nav', { hasText: new RegExp('^\\W*' + sel) }).first().click().catch(() => errs.push('no nav ' + sel));
    await page.waitForTimeout(700); await page.screenshot({ path: out(label.replace(/\W+/g,'_')) });
  }
  console.log('console errors:', JSON.stringify(errs, null, 1)); console.log('unknown api:', [...unknown].join(' | '));
  const hs = await page.evaluate(() => { const m = document.querySelector('.main'); return m ? { sw: m.scrollWidth, cw: m.clientWidth } : null; });
  const dump = await page.evaluate(() => ({ css: [...document.querySelectorAll('style')].map(x=>x.textContent).join('').length, html: document.getElementById('root').innerHTML.length, h: document.getElementById('root').innerHTML })); require('fs').writeFileSync(S+'/dom-'+(process.env.PORT||4173)+'.html', dump.h); console.log('dom', dump.css, dump.html);
  console.log('main scroll', JSON.stringify(hs));
  await browser.close();
})();
