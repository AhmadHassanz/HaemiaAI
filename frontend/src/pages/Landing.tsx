import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowRightIcon,
  CameraIcon,
  CpuIcon,
  ActivityIcon,
  EyeIcon,
  LockIcon,
  ZapIcon,
  SparklesIcon,
} from '../components/Icons';

/* ── Interactive eye visual ─────────────────────────────────────────────── */

function EyeVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 90, damping: 14 });
  const sy = useSpring(my, { stiffness: 90, damping: 14 });
  const irisX = useTransform(sx, [-1, 1], [-16, 16]);
  const irisY = useTransform(sy, [-1, 1], [-12, 12]);

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    my.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative mx-auto flex h-80 w-80 items-center justify-center sm:h-[26rem] sm:w-[26rem]"
    >
      {/* Expanding pulse rings */}
      <div className="animate-pulse-ring absolute inset-0 rounded-full border border-rose-500/25" />
      <div className="animate-pulse-ring-delayed absolute inset-0 rounded-full border border-amber-400/15" />

      {/* Radar sweep */}
      <div className="absolute inset-4 overflow-hidden rounded-full">
        <div
          className="animate-spin-slower absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, rgba(251,113,133,0.28) 42deg, transparent 95deg)',
          }}
        />
      </div>

      {/* Outer dial */}
      <div className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-sm" />
      <div className="absolute inset-5 rounded-full border border-white/5" />

      {/* Iris — follows the cursor */}
      <motion.div style={{ x: irisX, y: irisY }} className="relative h-40 w-40 sm:h-48 sm:w-48">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, #9f1239, #e11d48, #f59e0b, #e11d48, #9f1239)',
          }}
        />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.35), transparent 42%), radial-gradient(circle at 50% 50%, transparent 32%, rgba(0,0,0,0.6) 78%)',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/90 shadow-[inset_0_0_18px_rgba(0,0,0,0.95)]" />
        <div className="absolute left-[28%] top-[22%] h-4 w-4 rounded-full bg-white/80 blur-[2px]" />
      </motion.div>

      {/* Floating capability chips */}
      <div className="animate-float absolute -left-2 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d0d17]/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md sm:-left-6">
        <CpuIcon className="h-3.5 w-3.5 text-rose-400" />
        Deep learning
      </div>
      <div className="animate-float-delayed absolute -right-2 top-1/3 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d0d17]/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md sm:-right-8">
        <EyeIcon className="h-3.5 w-3.5 text-amber-400" />
        Full-eye scan
      </div>
      <div className="animate-float absolute -bottom-2 left-10 flex items-center gap-2 rounded-full border border-white/10 bg-[#0d0d17]/90 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg backdrop-blur-md">
        <LockIcon className="h-3.5 w-3.5 text-teal-400" />
        In-memory only
      </div>
    </div>
  );
}

/* ── Count-up statistic ─────────────────────────────────────────────────── */

function useCountUp(target: number, active: boolean, decimals = 0, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(parseFloat((target * eased).toFixed(decimals)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, decimals, duration]);

  return value.toFixed(decimals);
}

function Stat({
  target,
  decimals,
  label,
  suffix,
}: {
  target: number;
  decimals: number;
  label: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const value = useCountUp(target, inView, decimals);

  return (
    <div ref={ref} className="px-4 py-6 text-center sm:py-8">
      <p className="font-display text-3xl font-bold text-white sm:text-4xl">
        {value}
        {suffix && <span className="text-gradient">{suffix}</span>}
      </p>
      <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{label}</p>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const HOW_STEPS = [
  {
    icon: CameraIcon,
    step: '01',
    title: 'Capture',
    text: 'One clear, well-lit photo of a fully open eye — glasses off, no glare, whole eye in frame.',
    accent: 'text-rose-400 border-rose-400/20 bg-rose-400/10',
  },
  {
    icon: CpuIcon,
    step: '02',
    title: 'Analyse',
    text: 'A deep-learning model reads the image in memory. Nothing is uploaded, stored, or logged.',
    accent: 'text-amber-400 border-amber-400/20 bg-amber-400/10',
  },
  {
    icon: ActivityIcon,
    step: '03',
    title: 'Understand',
    text: 'You get a higher-or-lower research signal in seconds — never a diagnosis or probability.',
    accent: 'text-teal-400 border-teal-400/20 bg-teal-400/10',
  },
];

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-24 sm:space-y-32"
    >
      {/* ── Hero ── */}
      <section className="grid items-center gap-12 pt-6 sm:pt-10 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-7">
          <motion.div
            {...fadeUp}
            transition={{ delay: 0.05, duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-slate-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
            </span>
            Research prototype · Not a medical device
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
            className="font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl"
          >
            Scan your eye.
            <br />
            <span className="text-gradient">Surface a signal.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            className="max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            Haemia runs a deep-learning model over a single full-eye photo to estimate an
            anemia-related signal — in seconds, entirely in memory. It&apos;s research,{' '}
            <span className="text-slate-200">not a diagnosis.</span>
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ delay: 0.28, duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              to="/demo"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-7 py-3.5 font-semibold text-white shadow-[0_8px_32px_rgba(244,63,94,0.35)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_40px_rgba(244,63,94,0.5)] active:scale-95"
            >
              <SparklesIcon className="h-5 w-5" />
              Start eye scan
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-slate-200 backdrop-blur transition-all duration-300 hover:border-white/20 hover:bg-white/10 active:scale-95"
            >
              How it works
            </a>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ delay: 0.36, duration: 0.5, ease: 'easeOut' }}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"
          >
            <span className="flex items-center gap-1.5">
              <ZapIcon className="h-3.5 w-3.5 text-amber-400" /> Results in seconds
            </span>
            <span className="flex items-center gap-1.5">
              <LockIcon className="h-3.5 w-3.5 text-teal-400" /> Nothing stored
            </span>
            <span className="flex items-center gap-1.5">
              <EyeIcon className="h-3.5 w-3.5 text-rose-400" /> No account needed
            </span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <EyeVisual />
        </motion.div>
      </section>

      {/* ── Stats strip ── */}
      <motion.section
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass grid grid-cols-1 divide-y divide-white/5 rounded-3xl sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <Stat target={0.747} decimals={3} label="Internal CV AUC" />
        <Stat target={216} decimals={0} label="Training images" />
        <Stat target={0} decimals={0} label="Images stored" />
      </motion.section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-24 space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-3 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-400">
            How it works
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Three steps. One photo.
          </h2>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-3">
          {HOW_STEPS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12, duration: 0.55, ease: 'easeOut' }}
              whileHover={{ y: -6 }}
              className="glass group relative overflow-hidden rounded-3xl p-6 transition-colors duration-300 hover:border-white/20"
            >
              <span className="pointer-events-none absolute -right-2 -top-6 font-display text-7xl font-bold text-white/[0.04] transition-colors duration-300 group-hover:text-white/[0.07]">
                {s.step}
              </span>
              <div
                className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${s.accent}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center sm:p-14"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/15 via-transparent to-amber-500/10" />
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div className="relative space-y-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Curious what your eye says?
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-400">
            One photo, one research signal — processed in memory and gone when you leave.
          </p>
          <Link
            to="/demo"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-8 py-4 font-semibold text-white shadow-[0_8px_32px_rgba(244,63,94,0.35)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_8px_40px_rgba(244,63,94,0.5)] active:scale-95"
          >
            Try the demo
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.section>
    </motion.div>
  );
}
