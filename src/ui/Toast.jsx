import { useEffect } from "react";

export default function Toast({ message, onClose, duration = 2200 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999]">
      <div className="rounded-2xl border border-white/10 bg-zinc-950/85 px-4 py-3 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold">{message}</div>
          <button
            className="text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close toast"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
