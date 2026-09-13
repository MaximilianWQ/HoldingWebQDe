// node design/blender/iphone-screens/dash.cjs <playwright> <out.png> [http://localhost:3000]
// Fresh dashboard capture for the /install-ios phone screen: 440x894 CSS px
// (iPhone 17 Pro Max 440x956 pt minus the 62 pt top safe area), DPR 2.
const { chromium } = require(process.argv[2]);
const BASE = process.argv[4] || 'http://localhost:3000';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 440, height: 894 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  await p.addStyleTag({ content: 'nextjs-portal, .b-top, .ak-tabbar, [class*="ios-sheet"], [class*="ov-"], .ak-reveal, .ak-qr, .ak-fallback { display: none !important; } *{animation-play-state:paused!important}' });
  // Public page: guest key names (src/lib/key-names.ts) — no «VPN» / «Обход» in the picture;
  // every key / subscription link is masked with bullets (no domain, no path), QR removed.
  // Same masking as design/blender/laptop-screen/dash.cjs.
  const MASK = '••••••••••••';
  const report = await p.evaluate((MASK) => {
    const fix = (s) => s
      .replace('Улучшенные серверы для обхода блокировок.', 'Отдельные улучшенные серверы на случай, когда основной подключается плохо.')
      .replace(/Основной VPN/g, 'Основной').replace(/основной VPN/g, 'основной').replace(/«Обход»/g, '«Усиленный»').replace(/Обход/g, 'Усиленный')
      .replace(/для обхода блокировок/gi, 'для стабильной связи').replace(/\s*VPN\b/g, '');
    document.querySelectorAll('.ak-key-strip').forEach((s) => { s.innerHTML = ''; const t = document.createElement('span'); t.textContent = MASK; t.style.letterSpacing = '0.12em'; s.appendChild(t); });
    document.querySelectorAll('.ak-reveal, .ak-qr, .ak-fallback').forEach((n) => n.remove());
    const LINK = /(https?:\/\/\S+|[a-z0-9-]+\.(?:dev|uk|ru|com|invalid|io|net)\/\S*|\bsub\.[a-z0-9.-]+|atlassecure|happ:\/\/\S+)/gi;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n, links = 0;
    while ((n = w.nextNode())) {
      const f = fix(n.nodeValue);
      const t = f.replace(LINK, MASK);
      if (t !== f) links++;
      if (t !== n.nodeValue) n.nodeValue = t;
    }
    const txt = document.body.innerText;
    return {
      linksReplaced: links,
      vpnLeft: (txt.match(/VPN|[Оо]бход/g) || []).length,
      linkLeft: (txt.match(/https?:|atlassecure|qodev\.dev\/|\/sub\/|example\.invalid/g) || []).length,
      qrLeft: document.querySelectorAll('.ak-qr svg').length,
      strips: document.querySelectorAll('.ak-key-strip').length,
    };
  }, MASK);
  console.log('mask report', JSON.stringify(report));
  if (report.vpnLeft || report.linkLeft || report.qrLeft) throw new Error('unmasked content left on the page');
  await p.waitForTimeout(300);
  await p.screenshot({ path: process.argv[3] });
  await b.close();
  console.log('ok', errs.slice(0, 5));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
