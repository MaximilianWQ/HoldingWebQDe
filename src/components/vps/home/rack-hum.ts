/**
 * Звук симулятора стойки — синтезом в браузере, без единого файла.
 *
 * ПОЧЕМУ НЕ ФАЙЛЫ. Десять коротких звуков плюс петля гула — это
 * 250–400 КБ, вдвое больше всего набора рендеров. Кроме веса: сток в
 * проекте запрещён, у петли слышен шов, а громкость гула должна расти
 * по мере сборки — файлу такое не поручишь.
 *
 * ГЛАВНОЕ ПРАВИЛО НАБОРА: каждый голос обязан узнаваться с закрытыми
 * глазами. Десять похожих щелчков — это один щелчок. Поэтому пары,
 * которые легче всего спутать, разведены не громкостью, а ПРИРОДОЙ
 * звука:
 *
 *   вставили модуль  — шум, низ, длинный ход и глухой упор;
 *   щёлкнул штекер   — тон, верх, сухой и очень короткий;
 *   щёлкнул тумблер  — два удара подряд, середина, механический;
 *   промах           — низ, мягкий, с падением высоты — «не сюда», а
 *                      не «ты неправ»;
 *   тревога          — повторяющийся мягкий тон, НЕ резкий: это
 *                      витрина, а не операционная.
 *
 * ЗВУК НЕ ВКЛЮЧАЕТСЯ САМ. `startRig()` зовётся только из обработчика
 * нажатия: контекст, созданный раньше жеста, браузер отдаёт в
 * состоянии `suspended`, и звука не будет.
 */

export interface Rig {
  /** 0 — стойка пуста, 1 — собрана. Громкость и яркость гула. */
  setLoad(v: number): void;
  /** Вне кадра — глушим, но не рвём. */
  setAudible(v: boolean): void;
  /** Модуль вошёл в направляющие и упёрся. */
  slideIn(): void;
  /** Защёлка штекера. */
  latch(): void;
  /** Промах: деталь не попала и вернулась. */
  reject(): void;
  /** Тумблер питания. */
  flip(): void;
  /** Разгон вентиляторов при пуске. */
  spinUp(): void;
  /** Тревога. */
  alarm(): void;
  /** Авария устранена. */
  recover(): void;
  stop(): void;
}

/** Громкость гула в собранном виде, линейный гейн ≈ −16 dBFS. */
const MAX_GAIN = 0.15;

/**
 * Громкости голосов друг относительно друга. Тревога НЕ самая
 * громкая — самая заметная она за счёт повтора и высоты, а не силы.
 */
const VOL = {
  slide: 0.16,
  latch: 0.11,
  reject: 0.08,
  flip: 0.10,
  alarm: 0.09,
  recover: 0.09,
};

/** Минимальный промежуток между двумя одинаковыми голосами, мс. */
const MIN_GAP = 70;

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Коричневый шум — интеграл белого. Делитель держит дорожку от
      // уползания в постоянную составляющую.
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = white;
    }
  }
  return buf;
}

export function startRig(): Rig {
  const AC: typeof AudioContext | undefined =
    typeof window === "undefined"
      ? undefined
      : window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AC) return silent();

  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return silent();
  }

  // ДВЕ ШИНЫ, А НЕ ОДНА. Сначала гул и голоса шли в один компрессор —
  // и гул проседал под каждым щелчком, как радиофон под голосом
  // диктора. Теперь сжимаются только короткие голоса (их можно
  // настучать десяток в секунду), а ровный гул идёт мимо.
  const voices = ctx.createDynamicsCompressor();
  voices.threshold.value = -12;
  voices.knee.value = 18;
  voices.ratio.value = 6;
  voices.attack.value = 0.003;
  voices.release.value = 0.15;
  voices.connect(ctx.destination);
  const master = voices;

  // ─── Гул ────────────────────────────────────────────────────────
  // Два слоя настоящей серверной: охлаждение помещения снизу и
  // вентиляторы машин сверху.

  const humOut = ctx.createGain();
  humOut.gain.value = 0;
  humOut.connect(ctx.destination);

  const white = noiseBuffer(ctx, 4, false);

  const room = ctx.createBufferSource();
  room.buffer = noiseBuffer(ctx, 4, true);
  room.loop = true;
  const roomLp = ctx.createBiquadFilter();
  roomLp.type = "lowpass";
  roomLp.frequency.value = 320;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.9;
  room.connect(roomLp).connect(roomGain).connect(humOut);

  const fans = ctx.createBufferSource();
  fans.buffer = white;
  fans.loop = true;
  const fansHp = ctx.createBiquadFilter();
  fansHp.type = "highpass";
  fansHp.frequency.value = 180;
  const fansGain = ctx.createGain();
  fansGain.gain.value = 0.05;
  fans.connect(fansHp).connect(fansGain).connect(humOut);

  // Полосы взяты НЕСОИЗМЕРИМЫМИ: круглые 240 и 360 дают чистую квинту,
  // и железо начинает звучать аккордом, а не железом.
  const bands = [236, 347, 720].map((f, i) => {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f;
    bp.Q.value = 9;
    const g = ctx.createGain();
    g.gain.value = [0.09, 0.07, 0.04][i];
    fansHp.connect(bp).connect(g).connect(humOut);
    return bp;
  });

  // Медленное дыхание прячет шов петли.
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
  const lastAt: Record<string, number> = {};

  const applyHum = (t = 0.35) => {
    if (stopped) return;
    const target = audible ? MAX_GAIN * (0.25 + 0.75 * load) : 0;
    humOut.gain.cancelScheduledValues(ctx.currentTime);
    humOut.gain.setTargetAtTime(target, ctx.currentTime, t);
  };

  /** Не чаще, чем раз в MIN_GAP, и только когда звук слышен. */
  function allow(key: string): boolean {
    if (stopped || !audible) return false;
    const now = performance.now();
    if (now - (lastAt[key] ?? -1e9) < MIN_GAP) return false;
    lastAt[key] = now;
    return true;
  }

  /** Лёгкая расстройка: десять одинаковых щелчков звучат механически. */
  const detune = (v: number, cents = 40) => v * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200);

  function burst(opts: {
    dur: number;
    vol: number;
    type: BiquadFilterType;
    from: number;
    to: number;
    q?: number;
    attack?: number;
  }) {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    const a = opts.attack ?? 0.004;
    f.frequency.setValueAtTime(detune(opts.from, 60), t0);
    f.frequency.exponentialRampToValueAtTime(detune(opts.to, 60), t0 + opts.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(master);
    // Смещение по буферу: без него каждый щелчок берёт ОДИН И ТОТ ЖЕ
    // кусок шума, и десять подряд слышны как один засэмплированный
    // звук. Самая дешёвая правка набора и самая заметная на слух.
    src.start(t0, Math.random() * 3.5);
    src.stop(t0 + opts.dur + 0.02);
  }

  function tone(opts: {
    freq: number;
    dur: number;
    vol: number;
    type?: OscillatorType;
    to?: number;
    delay?: number;
    attack?: number;
  }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? "sine";
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const a = opts.attack ?? 0.006;
    o.frequency.setValueAtTime(detune(opts.freq), t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.02);
  }

  return {
    setLoad(v) {
      load = Math.max(0, Math.min(1, v));
      roomLp.frequency.setTargetAtTime(320 + 200 * load, ctx.currentTime, 0.5);
      applyHum();
    },

    setAudible(v) {
      audible = v;
      applyHum(0.4);
    },

    /** Ход по направляющим и глухой упор: шум, низ, длинно. */
    slideIn() {
      if (!allow("slide")) return;
      burst({ dur: 0.26, vol: VOL.slide, type: "lowpass", from: 2400, to: 320, attack: 0.03 });
      tone({ freq: 104, to: 62, dur: 0.16, vol: VOL.slide * 0.8, delay: 0.19, attack: 0.002 });
    },

    /** Защёлка: тон, верх, очень коротко. Ни с чем не спутать. */
    latch() {
      if (!allow("latch")) return;
      burst({ dur: 0.02, vol: VOL.latch * 0.6, type: "highpass", from: 3000, to: 3000 });
      tone({ freq: 2100, to: 1500, dur: 0.045, vol: VOL.latch, type: "triangle", attack: 0.001 });
    },

    /**
     * Промах: мягкое падение высоты. Отказ, а не упрёк.
     *
     * Было 190→120 Гц — и на ноутбучных динамиках, у которых отклик
     * валится около 200 Гц, самый нужный для обучения звук пропадал
     * целиком. Поднят в область, которую воспроизводит любая железка.
     */
    reject() {
      if (!allow("reject")) return;
      tone({ freq: 560, to: 430, dur: 0.17, vol: VOL.reject, attack: 0.014 });
    },

    /** Тумблер: два удара подряд, середина, механический. */
    flip() {
      if (!allow("flip")) return;
      burst({ dur: 0.03, vol: VOL.flip, type: "bandpass", from: 900, to: 700, q: 3 });
      burst({ dur: 0.04, vol: VOL.flip * 0.7, type: "bandpass", from: 620, to: 420, q: 3 });
    },

    /** Разгон вентиляторов: полосы подъезжают снизу к рабочим. */
    spinUp() {
      if (stopped) return;
      load = 1;
      const t0 = ctx.currentTime;
      bands.forEach((b, i) => {
        const base = [236, 347, 720][i];
        b.frequency.cancelScheduledValues(t0);
        b.frequency.setValueAtTime(base * 0.55, t0);
        b.frequency.linearRampToValueAtTime(base, t0 + 3.2);
      });
      roomLp.frequency.cancelScheduledValues(t0);
      roomLp.frequency.setValueAtTime(240, t0);
      roomLp.frequency.linearRampToValueAtTime(520, t0 + 3.2);
      applyHum(0.9);
    },

    /**
     * Тревога. Три мягких импульса на одной высоте с паузами — так
     * сигнал читается как «обрати внимание», а не как «беги». Резкая
     * атака и высокий писк здесь были бы ошибкой: это витрина.
     */
    alarm() {
      if (!allow("alarm")) return;
      // ДВА импульса, а не три. Число импульсов — это и есть приоритет
      // сигнала по IEC 60601-1-8: три читаются как средний приоритет,
      // один-два — как низкий. Нам нужна заметность, а не тревога.
      //
      // И не чистый синус: на телефонном динамике, который ниже 800 Гц
      // почти ничего не отдаёт, одинокая синусоида теряет себя.
      // Вторая и третья гармоники тише на 6 и 12 дБ — сигнал остаётся
      // слышен, а характер не становится резче.
      for (let i = 0; i < 2; i += 1) {
        const at = i * 0.3;
        tone({ freq: 622, dur: 0.17, vol: VOL.alarm, delay: at, attack: 0.035 });
        tone({ freq: 1244, dur: 0.15, vol: VOL.alarm * 0.5, delay: at, attack: 0.035 });
        tone({ freq: 1866, dur: 0.13, vol: VOL.alarm * 0.25, delay: at, attack: 0.035 });
      }
    },

    /** Всё в порядке: две ноты вверх. */
    recover() {
      if (!allow("recover")) return;
      tone({ freq: 523, dur: 0.12, vol: VOL.recover, attack: 0.012 });
      tone({ freq: 784, dur: 0.18, vol: VOL.recover, delay: 0.1, attack: 0.012 });
    },

    stop() {
      if (stopped) return;
      stopped = true;
      humOut.gain.cancelScheduledValues(ctx.currentTime);
      humOut.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
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

function silent(): Rig {
  const noop = () => {};
  return {
    setLoad: noop,
    setAudible: noop,
    slideIn: noop,
    latch: noop,
    reject: noop,
    flip: noop,
    spinUp: noop,
    alarm: noop,
    recover: noop,
    stop: noop,
  };
}
