// node design/blender/laptop-screen/dash.cjs <playwright> <out.png> [http://localhost:3000]
//
// Screen texture for the laptop of home section 06 (atlas_laptop.blend,
// material LT_Screen). MacBook Pro 14" display: 3024 x 1964 px = 1512 x 982
// CSS px at @2x. The picture is composed like a real screen: a 32 pt menu
// bar (the notch height; the notch itself is geometry in Blender), a slim
// browser toolbar, and the live /dashboard below it.
//
// The render sits on a PUBLIC page:
//  - guest key names (src/lib/key-names.ts): no «VPN» / «Обход»;
//  - every key / subscription link is masked with bullets in the DOM before
//    the shot (no domain, no path), QR and manual-copy blocks are removed,
//    and the mocked link itself is a dummy — nothing real can leak.
const { chromium } = require(process.argv[2]);
const OUT = process.argv[3];
const BASE = process.argv[4] || 'http://localhost:3000';
const W = 1512, H = 982, BAR = 32, TOOL = 38;
const MASK = '••••••••••••';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H - BAR - TOOL }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('cookie_consent', '1'); localStorage.setItem('passkey-prompt-dismissed', String(Date.now())); localStorage.setItem('atlas_welcome_dismissed', String(Date.now())); } catch {}
    try { Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true }); } catch {}
  });
  await ctx.addCookies([{ name: 'session', value: 'Zk3vQ8pL2mX9rT5wN7yB4cD6fH1jK0aS8uE3iO5gV2q', url: BASE }]);
  const data = { email: 'anna@example.com', daysLeft: 27, hoursLeft: 5, minutesLeft: 10, isExpired: false, subscriptionEnd: new Date(Date.now() + 27 * 864e5).toISOString(), vpnKey: null, xrayUuid: null, subToken: null, telegramLinked: true, telegramLinkToken: 't', referralCode: 'ANNA42', subscriptionPlan: 'plus', referrals: 7, paidReferrals: 4, balance: 1250.5, cashbackPercent: 10, loyaltyTier: 'Стартовый', isAdmin: false, subscriptionUrl: 'https://example.invalid/masked', happCryptoLink: null, bypassSubscriptionUrl: null };
  await ctx.route('**/api/user/subscription', (r) => r.fulfill({ json: { success: true, data } }));
  await ctx.route('**/api/user/bypass', (r) => r.fulfill({ json: { success: true, data: null } }));
  await ctx.route('**/api/auth/passkey/check', (r) => r.fulfill({ json: { success: true, data: { hasPasskey: true } } }));
  await ctx.route('**/api/user/marketing-consent', (r) => r.fulfill({ json: { success: true, data: { consent: false } } }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3500);
  await p.addStyleTag({ content: 'nextjs-portal, .b-top, [class*="ios-sheet"], [class*="ov-"], .ak-reveal, .ak-qr, .ak-fallback { display: none !important; } *{animation-play-state:paused!important; caret-color: transparent !important}' });
  const report = await p.evaluate((MASK) => {
    // 1. Guest key names.
    const fix = (s) => s
      .replace('Улучшенные серверы для обхода блокировок.', 'Отдельные улучшенные серверы на случай, когда основной подключается плохо.')
      .replace(/Основной VPN/g, 'Основной').replace(/основной VPN/g, 'основной').replace(/«Обход»/g, '«Усиленный»').replace(/Обход/g, 'Усиленный')
      .replace(/для обхода блокировок/gi, 'для стабильной связи').replace(/\s*VPN\b/g, '');
    // 2. Key fields: bullets only — the strip had «host/…» + animated dots.
    document.querySelectorAll('.ak-key-strip').forEach((s) => { s.innerHTML = ''; const t = document.createElement('span'); t.textContent = MASK; t.style.letterSpacing = '0.12em'; s.appendChild(t); });
    document.querySelectorAll('.ak-reveal, .ak-qr, .ak-fallback').forEach((n) => n.remove());
    // 3. Belt and braces: any other text that looks like a link.
    const LINK = /(https?:\/\/\S+|[a-z0-9-]+\.(?:dev|uk|ru|com|invalid|io|net)\/\S*|\bsub\.[a-z0-9.-]+|atlassecure|happ:\/\/\S+)/gi;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, links = 0;
    while ((n = w.nextNode())) {
      const f = fix(n.nodeValue);
      const t = f.replace(LINK, MASK);
      if (t !== f) links++;
      if (t !== n.nodeValue) n.nodeValue = t;
    }
    document.querySelectorAll('input, textarea').forEach((i) => { if (i.value.replace(LINK, MASK) !== i.value) { i.value = MASK; links++; } });
    const txt = document.body.innerText;
    return {
      linksReplaced: links,
      vpnLeft: (txt.match(/VPN|[Оо]бход/g) || []).length,
      linkLeft: (txt.match(/https?:|atlassecure|qodev\.dev\/|\/sub\/|example\.invalid/g) || []).length,
      qrLeft: document.querySelectorAll('.ak-qr svg, svg[shape-rendering="crispEdges"]').length,
      strips: document.querySelectorAll('.ak-key-strip').length,
    };
  }, MASK);
  console.log('mask report', JSON.stringify(report));
  if (report.vpnLeft || report.linkLeft || report.qrLeft) throw new Error('unmasked content left on the page');
  await p.waitForTimeout(300);
  const page = await p.screenshot({ type: 'png' });

  // Compose the screen: menu bar + browser toolbar + page. No brand marks.
  const c = await ctx.newPage();
  await c.setViewportSize({ width: W, height: H });
  const img = 'data:image/png;base64,' + page.toString('base64');
  const now = new Date();
  const clock = now.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.$/, '').replace(/,/g, '') + '  ' + now.toTimeString().slice(0, 5);
  await c.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box;margin:0}
    body{width:${W}px;height:${H}px;overflow:hidden;background:#fff;font:500 13px/1 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;color:#1d1d1f}
    .bar{height:${BAR}px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(#e9ebf0,#e3e5ea);}
    .bar .l,.bar .r{display:flex;align-items:center;gap:20px}
    .bar b{font-weight:700}
    .ico{display:inline-block}
    .tool{height:${TOOL}px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#f4f4f6;border-bottom:1px solid #dcdce0}
    .tl{display:flex;gap:8px}.tl i{width:12px;height:12px;border-radius:50%;display:block}
    .tl i:nth-child(1){background:#ff5f57}.tl i:nth-child(2){background:#febc2e}.tl i:nth-child(3){background:#28c840}
    .nav{display:flex;gap:14px;color:#8a8a8e;font-size:15px}
    .url{flex:0 1 460px;margin:0 auto;height:26px;border-radius:8px;background:#e6e6ea;display:flex;align-items:center;justify-content:center;gap:6px;color:#3a3a3c;font-size:13px}
    .sp{width:120px}
    img{display:block;width:${W}px;height:${H - BAR - TOOL}px}
  </style></head><body>
    <div class="bar">
      <div class="l"><b>Браузер</b><span>Файл</span><span>Правка</span><span>Вид</span><span>История</span><span>Закладки</span><span>Окно</span><span>Справка</span></div>
      <div class="r">
        <svg class="ico" width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 11.2 6.2 8.8a3.3 3.3 0 0 1 4.6 0zM3.9 6.5a6.5 6.5 0 0 1 9.2 0l-1.2 1.2a4.8 4.8 0 0 0-6.8 0zM1.5 4.1a9.9 9.9 0 0 1 14 0l-1.2 1.2a8.2 8.2 0 0 0-11.6 0z" fill="#1d1d1f"/></svg>
        <svg class="ico" width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="#1d1d1f" opacity=".45"/><rect x="2" y="2" width="16" height="8" rx="1.6" fill="#1d1d1f"/><rect x="23.6" y="4" width="1.6" height="4" rx=".8" fill="#1d1d1f" opacity=".45"/></svg>
        <svg class="ico" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.3" fill="none" stroke="#1d1d1f" stroke-width="1.6"/><path d="m9.2 9.2 3.4 3.4" stroke="#1d1d1f" stroke-width="1.6" stroke-linecap="round"/></svg>
        <span>${clock}</span>
      </div>
    </div>
    <div class="tool">
      <div class="tl"><i></i><i></i><i></i></div>
      <div class="nav"><span>‹</span><span>›</span></div>
      <div class="url"><svg width="9" height="11" viewBox="0 0 9 11"><rect x=".5" y="4.5" width="8" height="6" rx="1.3" fill="#8a8a8e"/><path d="M2.3 4.6V3.2a2.2 2.2 0 0 1 4.4 0v1.4" fill="none" stroke="#8a8a8e" stroke-width="1.2"/></svg>qodev.dev</div>
      <div class="sp"></div>
    </div>
    <img src="${img}">
  </body></html>`);
  await c.waitForTimeout(300);
  await c.screenshot({ path: OUT, type: 'png' });
  await b.close();
  console.log('ok', OUT, errs.slice(0, 5));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
