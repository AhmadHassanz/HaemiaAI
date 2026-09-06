import { ShieldAlertIcon } from './Icons';

export default function Disclaimer() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-400/15 bg-[#0d0a05]/95 backdrop-blur-md">
      <p className="mx-auto flex max-w-5xl items-center justify-center gap-2 px-4 py-2.5 text-center text-[10px] leading-relaxed text-amber-200/70 sm:text-xs">
        <ShieldAlertIcon className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400/80" />
        <span>
          <strong className="font-semibold text-amber-200">Research prototype</strong> — not a
          medical device, not clinically validated, not a diagnosis. Never use it for medical
          decisions; if you are concerned about anemia, consult a healthcare professional.
        </span>
      </p>
    </div>
  );
}
