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
  await ctx.addCookies([{ name: 'session', value: 'test-user', url: BASE }]);
  const data = { email: 'anna@example.com', daysLeft: 27, hoursLeft: 5, minutesLeft: 10, isExpired: false, subscriptionEnd: new Date(Date.now() + 27 * 864e5).toISOString(), vpnKey: null, xrayUuid: null, subToken: null, telegramLinked: true, telegramLinkToken: 't', referralCode: 'ANNA42', subscriptionPlan: 'plus', referrals: 7, paidReferrals: 4, balance: 1250.5, cashbackPercent: 10, loyaltyTier: 'Стартовый', isAdmin: false, subscriptionUrl: 'https://qodev.dev/sub/abc', happCryptoLink: null, bypassSubscriptionUrl: null };
  await ctx.route('**/api/user/subscription', (r) => r.fulfill({ json: { success: true, data } }));
  await ctx.route('**/api/user/bypass', (r) => r.fulfill({ json: { success: true, data: null } }));
  await ctx.route('**/api/auth/passkey/check', (r) => r.fulfill({ json: { success: true, data: { hasPasskey: true } } }));
  await ctx.route('**/api/user/marketing-consent', (r) => r.fulfill({ json: { success: true, data: { consent: false } } }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3500);
  await p.addStyleTag({ content: 'nextjs-portal, .b-top, .ak-tabbar, [class*="ios-sheet"], [class*="ov-"] { display: none !important; } *{animation-play-state:paused!important}' });
  // Public page: guest key names (src/lib/key-names.ts) — no «VPN» / «Обход» in the picture.
  await p.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const fix = (s) => s.replace(/Основной VPN/g, 'Основной').replace(/основной VPN/g, 'основной').replace(/«Обход»/g, '«Усиленный»').replace(/Обход/g, 'Усиленный').replace(/\s*VPN\b/g, '');
    let n; while ((n = w.nextNode())) { const t = fix(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  });
  await p.waitForTimeout(300);
  const left = await p.evaluate(() => (document.body.innerText.match(/VPN|Обход/g) || []).length);
  console.log('VPN/Обход left in visible text:', left);
  await p.screenshot({ path: process.argv[3] });
  await b.close();
  console.log('ok', errs.slice(0, 5));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
