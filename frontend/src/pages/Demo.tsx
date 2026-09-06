import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  FileImageIcon,
  FocusIcon,
  FrameIcon,
  GlassesIcon,
  HomeIcon,
  LightbulbIcon,
  RefreshIcon,
  RulerIcon,
  ShieldAlertIcon,
  SparklesIcon,
  StethoscopeIcon,
  SunIcon,
  UploadIcon,
} from '../components/Icons';

type Stage = 'consent' | 'guide' | 'upload' | 'loading' | 'result' | 'retake';

interface PredictResult {
  risk: string;
  message: string;
  disclaimer: string;
}

interface ApiError {
  detail: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/** Minimum time the scanning stage stays visible, so the animation reads as deliberate. */
const MIN_SCAN_MS = 2400;

/**
 * Backend base URL. Empty in local dev (Vite proxies /api to localhost:8000);
 * in production this comes from VITE_API_BASE_URL set on Vercel.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const STEPS = ['Consent', 'Capture', 'Analyse', 'Result'];

const stepOf: Record<Stage, number> = {
  consent: 0,
  guide: 1,
  upload: 1,
  loading: 2,
  retake: 2,
  result: 3,
};

/* ── Shared bits ────────────────────────────────────────────────────────── */

const stageMotion = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: { duration: 0.32, ease: 'easeOut' as const },
};

function GradientButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 px-7 py-3.5 font-semibold text-white shadow-[0_8px_28px_rgba(244,63,94,0.3)] transition-shadow duration-300 hover:shadow-[0_8px_38px_rgba(244,63,94,0.45)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {children}
    </motion.button>
  );
}

function GhostButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-slate-200 backdrop-blur transition-colors duration-300 hover:border-white/20 hover:bg-white/10 ${className}`}
    >
      {children}
    </motion.button>
  );
}

/** Animated stepper: Consent → Capture → Analyse → Result */
function Stepper({ step }: { step: number }) {
  return (
    <div className="mx-auto mb-10 flex w-full max-w-xl items-center">
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={
                  active
                    ? { scale: 1.12, boxShadow: '0 0 22px rgba(244,63,94,0.4)' }
                    : { scale: 1, boxShadow: '0 0 0px rgba(244,63,94,0)' }
                }
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                  done
                    ? 'border-teal-400/40 bg-teal-400/15 text-teal-300'
                    : active
                      ? 'border-transparent bg-gradient-to-r from-rose-500 to-amber-500 text-white'
                      : 'border-white/10 bg-white/5 text-slate-500'
                }`}
              >
                {done ? <CheckIcon className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span
                className={`text-[10px] font-medium uppercase tracking-wider sm:text-xs ${
                  active ? 'text-white' : 'text-slate-500'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative mx-2 mb-5 h-px flex-1 overflow-hidden rounded bg-white/10 sm:mx-3">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-rose-500 to-amber-500"
                  initial={false}
                  animate={{ width: i < step ? '100%' : '0%' }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Demo() {
  const [stage, setStage] = useState<Stage>('consent');
  const [consented, setConsented] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [stage]);

  const handleFileSelect = useCallback((selected: File | null) => {
    if (!selected) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Unsupported file type. Please use JPEG, PNG, or WEBP.');
      setStage('retake');
      return;
    }
    if (selected.size > MAX_SIZE) {
      setError('That image is larger than 10 MB. Please pick a smaller one.');
      setStage('retake');
      return;
    }
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selected);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setStage('loading');
    setError(null);

    const form = new FormData();
    form.append('image', file);

    const startedAt = performance.now();
    // Hold the scanning animation long enough to feel deliberate.
    const revealAfter = (fn: () => void) => {
      const wait = Math.max(0, MIN_SCAN_MS - (performance.now() - startedAt));
      window.setTimeout(fn, wait);
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/predict`, { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        const msg: string = (data as ApiError).detail ?? 'Something went wrong.';
        revealAfter(() => {
          setError(msg);
          setStage('retake');
        });
        return;
      }

      revealAfter(() => {
        setResult(data as PredictResult);
        setStage('result');
      });
    } catch {
      revealAfter(() => {
        setError('Network error — is the backend running?');
        setStage('retake');
      });
    }
  };

  const handleRetake = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setStage('upload');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Stepper step={stepOf[stage]} />

      <AnimatePresence mode="wait">
        {/* ── Consent ── */}
        {stage === 'consent' && (
          <motion.div key="consent" {...stageMotion} className="glass mx-auto max-w-2xl rounded-3xl p-6 sm:p-10">
            <div className="mb-8 flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-400">
                <ShieldAlertIcon className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
                  Before you begin
                </h1>
                <p className="text-sm text-slate-500">Four things worth knowing</p>
              </div>
            </div>

            <ul className="space-y-3.5">
              {[
                {
                  icon: ShieldAlertIcon,
                  text: 'This is a research prototype — not a medical device.',
                  accent: 'text-rose-400 border-rose-400/20 bg-rose-400/10',
                },
                {
                  icon: ActivityIcon,
                  text: 'The output is an uncalibrated model signal, not a diagnosis or probability of anemia.',
                  accent: 'text-amber-400 border-amber-400/20 bg-amber-400/10',
                },
                {
                  icon: FileImageIcon,
                  text: 'Your image is processed in memory only and is never stored.',
                  accent: 'text-teal-400 border-teal-400/20 bg-teal-400/10',
                },
                {
                  icon: StethoscopeIcon,
                  text: 'Do not use this result for any medical decision.',
                  accent: 'text-sky-400 border-sky-400/20 bg-sky-400/10',
                },
              ].map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: 'easeOut' }}
                  className="flex items-start gap-3.5 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${item.accent}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-300">{item.text}</p>
                </motion.li>
              ))}
            </ul>

            <button
              role="checkbox"
              aria-checked={consented}
              onClick={() => setConsented((c) => !c)}
              className="mt-8 flex w-full cursor-pointer items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors duration-300 hover:border-white/20"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${
                  consented
                    ? 'border-transparent bg-gradient-to-r from-rose-500 to-amber-500'
                    : 'border-white/20 bg-white/5'
                }`}
              >
                <AnimatePresence>
                  {consented && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <CheckIcon className="h-4 w-4 text-white" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="text-sm leading-relaxed text-slate-300">
                I understand this is a research prototype, the result is not clinically validated,
                and I should not use it for medical decisions.
              </span>
            </button>

            <div className="mt-6">
              <GradientButton
                onClick={() => consented && setStage('guide')}
                disabled={!consented}
                className="w-full sm:w-auto"
              >
                Continue
                <ArrowRightIcon className="h-4 w-4" />
              </GradientButton>
            </div>
          </motion.div>
        )}

        {/* ── Capture guide ── */}
        {stage === 'guide' && (
          <motion.div key="guide" {...stageMotion} className="mx-auto max-w-3xl space-y-8">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-white sm:text-4xl">
                Capture a clear eye photo
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                The better the photo, the more meaningful the signal
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: SunIcon, title: 'Light it well', text: 'Bright, even light — no harsh flash or glare.' },
                { icon: GlassesIcon, title: 'Glasses off', text: 'Remove glasses and avoid strong reflections.' },
                { icon: RulerIcon, title: 'Keep distance', text: 'Hold the camera about 20–30 cm from the eye.' },
                { icon: FrameIcon, title: 'Frame it all', text: 'Include the whole eye, lids and surrounding skin.' },
                { icon: CameraIcon, title: 'Eye wide open', text: 'Look straight at the camera, fully open eye.' },
                { icon: FocusIcon, title: 'Stay sharp', text: 'Avoid blur — tap to focus if you need to.' },
              ].map((tip, i) => (
                <motion.div
                  key={tip.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.4, ease: 'easeOut' }}
                  whileHover={{ y: -4 }}
                  className="glass rounded-2xl p-5 transition-colors duration-300 hover:border-white/20"
                >
                  <tip.icon className="mb-3 h-5 w-5 text-amber-400" />
                  <h3 className="font-display text-sm font-semibold text-white">{tip.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{tip.text}</p>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4 text-sm text-amber-200/80">
              <LightbulbIcon className="h-4 w-4 shrink-0 text-amber-400" />
              Tip — asking someone else to take the photo for you works best.
            </div>

            <div className="text-center">
              <GradientButton onClick={() => setStage('upload')}>
                <CameraIcon className="h-4 w-4" />
                Upload or capture photo
              </GradientButton>
            </div>
          </motion.div>
        )}

        {/* ── Upload / dropzone ── */}
        {stage === 'upload' && (
          <motion.div key="upload" {...stageMotion} className="mx-auto max-w-2xl space-y-6">
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-white sm:text-4xl">
                Your eye photo
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Drop a file, browse, or use your camera — processed in memory only
              </p>
            </div>

            {preview ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="glass space-y-5 rounded-3xl p-5"
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                  <img src={preview} alt="Your eye photo preview" className="mx-auto max-h-80 object-contain" />
                </div>
                {file && (
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <FileImageIcon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate font-medium text-slate-300">{file.name}</span>
                    <span className="shrink-0">·</span>
                    <span className="shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <GhostButton onClick={() => inputRef.current?.click()}>
                    <RefreshIcon className="h-4 w-4" />
                    Replace
                  </GhostButton>
                  <GradientButton onClick={handleSubmit}>
                    <SparklesIcon className="h-4 w-4" />
                    Analyse image
                  </GradientButton>
                </div>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFileSelect(e.dataTransfer.files?.[0] ?? null);
                }}
                animate={dragging ? { scale: 1.015 } : { scale: 1 }}
                whileHover={{ scale: 1.01 }}
                className={`flex w-full cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors duration-300 ${
                  dragging
                    ? 'border-rose-400/60 bg-rose-500/[0.07]'
                    : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]'
                }`}
              >
                <span className="animate-float flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-gradient-to-br from-rose-500/20 to-amber-500/10 text-rose-300">
                  <UploadIcon className="h-7 w-7" />
                </span>
                <span className="space-y-1">
                  <span className="block font-display text-lg font-semibold text-white">
                    {dragging ? 'Drop it here' : 'Drop your eye photo here'}
                  </span>
                  <span className="block text-xs text-slate-500">
                    or tap to browse / use camera
                  </span>
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                  JPEG · PNG · WEBP — up to 10 MB
                </span>
              </motion.button>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
          </motion.div>
        )}

        {/* ── Loading / scanning ── */}
        {stage === 'loading' && (
          <LoadingStage preview={preview} />
        )}

        {/* ── Retake / error ── */}
        {stage === 'retake' && (
          <motion.div key="retake" {...stageMotion} className="glass mx-auto max-w-xl rounded-3xl p-8 text-center sm:p-10">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/25 bg-rose-400/10 text-rose-400"
            >
              <AlertTriangleIcon className="h-7 w-7" />
            </motion.div>
            <h1 className="font-display text-2xl font-bold text-white">Image not usable</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              {error ?? 'The image could not be processed. Please try a different photo.'}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <GradientButton onClick={handleRetake}>
                <RefreshIcon className="h-4 w-4" />
                Choose another photo
              </GradientButton>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-slate-300 transition-colors duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <HomeIcon className="h-4 w-4" />
                Home
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── Result ── */}
        {stage === 'result' && result && (
          <ResultStage result={result} onRetake={handleRetake} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Loading stage: image being scanned ─────────────────────────────────── */

const STATUS_STEPS = ['Preprocessing image…', 'Running neural network…', 'Computing signal…'];

function LoadingStage({ preview }: { preview: string | null }) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_STEPS.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div key="loading" {...stageMotion} className="mx-auto max-w-xl space-y-8">
      <div className="glass relative overflow-hidden rounded-3xl p-4 sm:p-5">
        {/* Corner brackets */}
        <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-rose-400/60" />
        <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-rose-400/60" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-rose-400/60" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-rose-400/60" />

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50">
          {preview && (
            <img
              src={preview}
              alt="Eye photo being analysed"
              className="mx-auto max-h-80 object-contain opacity-90 saturate-[0.85]"
            />
          )}
          {/* Scanning beam */}
          <div className="animate-scan absolute left-0 right-0 h-12 border-b-2 border-rose-400/80 bg-gradient-to-b from-transparent via-rose-500/25 to-transparent" />
          {/* Scan grid overlay */}
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
        </div>
      </div>

      <div className="space-y-4 text-center">
        <div className="flex h-8 items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={statusIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="font-display text-sm font-medium text-slate-300"
            >
              {STATUS_STEPS[statusIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mx-auto h-1.5 w-56 overflow-hidden rounded-full bg-white/5">
          <div className="shimmer-bar h-full w-full rounded-full" />
        </div>
        <p className="text-xs text-slate-600">This usually takes a few seconds</p>
      </div>
    </motion.div>
  );
}

/* ── Result stage ───────────────────────────────────────────────────────── */

function ResultStage({
  result,
  onRetake,
}: {
  result: PredictResult;
  onRetake: () => void;
}) {
  const isHigher = result.risk === 'higher';

  return (
    <motion.div key="result" {...stageMotion} className="mx-auto max-w-xl space-y-6">
      {/* Verdict card */}
      <div
        className={`glass relative overflow-hidden rounded-3xl p-8 text-center sm:p-10 ${
          isHigher ? 'border-rose-400/25' : 'border-teal-400/25'
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${
            isHigher ? 'from-rose-500/15' : 'from-teal-500/15'
          } to-transparent`}
        />

        <div className="relative space-y-5">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.1 }}
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${
              isHigher
                ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                : 'border-teal-400/30 bg-teal-400/10 text-teal-300'
            }`}
          >
            {isHigher ? (
              <AlertTriangleIcon className="h-9 w-9" />
            ) : (
              <svg
                className="h-9 w-9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <motion.path
                  d="M20 6L9 17l-5-5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                />
              </svg>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className={`font-display text-2xl font-bold tracking-tight sm:text-3xl ${
              isHigher ? 'text-rose-200' : 'text-teal-200'
            }`}
          >
            {isHigher ? 'Anemia Signal Detected' : 'No Anemia Signal Detected'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="mx-auto max-w-md text-sm leading-relaxed text-slate-400"
          >
            {result.message}
          </motion.p>
        </div>
      </div>

      {/* Signal spectrum */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.45 }}
        className="glass rounded-3xl p-6"
      >
        <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest">
          <span className="text-teal-400">Lower signal</span>
          <span className="text-slate-600">Uncalibrated</span>
          <span className="text-rose-400">Higher signal</span>
        </div>
        <div className="relative h-3 rounded-full bg-gradient-to-r from-teal-500/50 via-slate-600/40 to-rose-500/50">
          {/* Centre tick */}
          <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-white/25" />
          {/* Marker */}
          <motion.div
            initial={{ left: '50%' }}
            animate={{ left: isHigher ? '78%' : '22%' }}
            transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.6 }}
            className={`absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-ink shadow-lg ${
              isHigher ? 'border-rose-400' : 'border-teal-400'
            }`}
          >
            <span
              className={`absolute inset-1.5 rounded-full ${
                isHigher ? 'bg-rose-400/60' : 'bg-teal-400/60'
              }`}
            />
          </motion.div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          A research signal — <span className="text-slate-400">not a probability</span>, not a
          diagnosis.
        </p>
      </motion.div>

      {/* What this means */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.45 }}
        className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
      >
        <p className="mb-1.5 font-display text-sm font-semibold text-white">What does this mean?</p>
        <p className="text-sm leading-relaxed text-slate-400">
          This is a research prototype with limited accuracy on a small internal dataset. The
          signal is based on image patterns only — it is{' '}
          <span className="text-slate-200">not a blood test</span>, and many factors that affect
          anemia cannot be seen in an eye photo.
        </p>
      </motion.div>

      {/* Disclaimer from the API */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.45 }}
        className="flex items-start gap-3 rounded-3xl border border-amber-400/15 bg-amber-400/5 p-5 text-sm leading-relaxed text-amber-200/80"
      >
        <ShieldAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <span>
          <strong className="font-semibold text-amber-200">Disclaimer:</strong> {result.disclaimer}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.75, duration: 0.45 }}
        className="flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <GradientButton onClick={onRetake}>
          <RefreshIcon className="h-4 w-4" />
          Try another image
        </GradientButton>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold text-slate-300 transition-colors duration-300 hover:border-white/20 hover:bg-white/10"
        >
          <HomeIcon className="h-4 w-4" />
          Home
        </Link>
      </motion.div>
    </motion.div>
  );
}
