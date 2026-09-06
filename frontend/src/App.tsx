import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Disclaimer from './components/Disclaimer';
import Landing from './pages/Landing';
import Demo from './pages/Demo';
import { EyeIcon } from './components/Icons';

/** Full-page animated backdrop: aurora blobs + blueprint grid + top glow. */
function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink">
      {/* Blueprint grid, fading out towards the fold */}
      <div className="bg-grid mask-fade absolute inset-0" />

      {/* Aurora blobs */}
      <motion.div
        className="absolute -top-44 left-1/4 h-[34rem] w-[34rem] rounded-full bg-rose-600/15 blur-[130px]"
        animate={{ x: [0, 60, -30, 0], y: [0, 40, 10, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[-10rem] top-1/3 h-[28rem] w-[28rem] rounded-full bg-teal-500/10 blur-[130px]"
        animate={{ x: [0, -50, 20, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-8rem] left-[-6rem] h-[26rem] w-[26rem] rounded-full bg-amber-500/10 blur-[130px]"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 10, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Top centre glow */}
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(251,113,133,0.10),transparent)]" />
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-slate-400 hover:text-white'
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-full border border-white/10 bg-white/10"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative">{children}</span>
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-[0_0_24px_rgba(244,63,94,0.35)] transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
            <EyeIcon className="h-5 w-5" />
          </span>
          <span className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight text-white">
              Haemia
            </span>
            <span className="hidden rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:block">
              Research demo
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/demo">Demo</NavLink>
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <Nav />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-36 pt-8 sm:px-6 sm:pt-12">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            {/* Methodology was removed — old links land safely on Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>

      <Disclaimer />
    </div>
  );
}
