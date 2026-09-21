/**
 * Гул серверной — синтезом в браузере, без единого аудиофайла.
 *
 * ПОЧЕМУ НЕ ФАЙЛ. Петля на тридцать секунд весит 250–400 КБ — вдвое
 * больше всего набора рендеров стойки. Кроме веса: сток в проекте
 * запрещён, у петли слышен шов, а громкость гула должна расти по мере
 * сборки — файлу такое не поручишь.
 *
 * ИЗ ЧЕГО СОБРАН ЗВУК. Настоящая серверная — это два слоя:
 *   · охлаждение помещения, низ 63–250 Гц: коричневый шум под
 *     фильтром низких частот;
 *   · вентиляторы машин: 5–7 лопаток при 2000–6000 об/мин дают
 *     166–700 Гц, плюс частота прохождения лопаток около 720 Гц.
 * Полосы взяты НЕСОИЗМЕРИМЫМИ (236 и 347 Гц, а не круглые 240 и 360):
 * круглые дают чистую квинту, и железо начинает звучать аккордом.
 *
 * ПОЛИТИКА АВТОЗАПУСКА. Контекст создаётся только внутри обработчика
 * нажатия — созданный раньше приходит в состоянии `suspended`, и звука
 * не будет. Поэтому `startHum()` зовётся из обработчика, а не из
 * эффекта.
 */

export interface Hum {
  /** 0 — стойка пуста, 1 — собрана. Управляет громкостью и яркостью. */
  setLoad(v: number): void;
  /** Вне кадра — глушим, но не рвём. */
  setAudible(v: boolean): void;
  /** Щелчок защёлки. */
  click(): void;
  /** Разгон при запуске стойки. */
  spinUp(): void;
  stop(): void;
}

/** Громкость гула в собранном виде. Линейный гейн ≈ −16 dBFS. */
const MAX_GAIN = 0.15;

type Ctx = AudioContext & { webkitAudioContext?: never };

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Коричневый шум: интеграл белого. Коэффициент подобран так,
      // чтобы дорожка не уползала в постоянную составляющую.
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = white;
    }
  }
  return buf;
}

export function startHum(): Hum {
  const AC: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AC) return silent();

  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return silent();
  }

  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);

  // Слой 1 — охлаждение помещения.
  const room = ctx.createBufferSource();
  room.buffer = noiseBuffer(ctx as Ctx, 4, true);
  room.loop = true;
  const roomLp = ctx.createBiquadFilter();
  roomLp.type = "lowpass";
  roomLp.frequency.value = 320;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.9;
  room.connect(roomLp).connect(roomGain).connect(out);

  // Слой 2 — вентиляторы машин.
  const fans = ctx.createBufferSource();
  fans.buffer = noiseBuffer(ctx as Ctx, 4, false);
  fans.loop = true;
  const fansHp = ctx.createBiquadFilter();
  fansHp.type = "highpass";
  fansHp.frequency.value = 180;
  const fansGain = ctx.createGain();
  fansGain.gain.value = 0.05;
  fans.connect(fansHp).connect(fansGain).connect(out);

  const bands = [236, 347, 720].map((f, i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.value = [0.09, 0.07, 0.04][i];
    fansHp.connect(bp).connect(g).connect(out);
    return bp;
  });

  // Медленное дыхание: прячет шов петли и убирает ощущение синтетики.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain).connect(roomGain.gain);

  room.start();
  fans.start();
  lfo.start();

  let load = 0;
  let audible = true;
  let stopped = false;

  const apply = (t = 0.35) => {
    if (stopped) return;
    const target = audible ? MAX_GAIN * (0.25 + 0.75 * load) : 0;
    out.gain.cancelScheduledValues(ctx.currentTime);
    out.gain.setTargetAtTime(target, ctx.currentTime, t);
  };

  return {
    setLoad(v) {
      load = Math.max(0, Math.min(1, v));
      roomLp.frequency.setTargetAtTime(320 + 200 * load, ctx.currentTime, 0.5);
      apply();
    },
    setAudible(v) {
      audible = v;
      apply(0.4);
    },
    click() {
      if (stopped) return;
      // Короткий щелчок защёлки: узкий всплеск, без хвоста.
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.08);
    },
    spinUp() {
      if (stopped) return;
      load = 1;
      bands.forEach((b, i) => {
        const base = [236, 347, 720][i];
        b.frequency.setValueAtTime(base * 0.75, ctx.currentTime);
        b.frequency.linearRampToValueAtTime(base, ctx.currentTime + 3.2);
      });
      roomLp.frequency.linearRampToValueAtTime(520, ctx.currentTime + 3.2);
      apply(0.9);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => {
        try {
          room.stop();
          fans.stop();
          lfo.stop();
          void ctx.close();
        } catch {
          /* уже закрыт */
        }
      }, 700);
    },
  };
}

function silent(): Hum {
  return {
    setLoad() {},
    setAudible() {},
    click() {},
    spinUp() {},
    stop() {},
  };
}
