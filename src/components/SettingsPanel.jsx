import { Panel, Badge, Button } from "../ui/ui.jsx";

export default function SettingsPanel({
  reduceMotion,
  setReduceMotion,
  soundOn,
  setSoundOn,
  bigTap,
  setBigTap,
}) {
  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Settings</div>
          <Badge>Local</Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Reduce motion</div>
            <div className="mt-1 text-xs text-white/60">Disables shakes + hover movement.</div>
            <div className="mt-3">
              <Button
                variant={reduceMotion ? "primary" : "secondary"}
                onClick={() => setReduceMotion((v) => !v)}
              >
                {reduceMotion ? "ON" : "OFF"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Sound</div>
            <div className="mt-1 text-xs text-white/60">We’ll hook effects in next.</div>
            <div className="mt-3">
              <Button
                variant={soundOn ? "primary" : "secondary"}
                onClick={() => setSoundOn((v) => !v)}
              >
                {soundOn ? "ON" : "OFF"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Big tap targets</div>
            <div className="mt-1 text-xs text-white/60">More spacing on mobile.</div>
            <div className="mt-3">
              <Button
                variant={bigTap ? "primary" : "secondary"}
                onClick={() => setBigTap((v) => !v)}
              >
                {bigTap ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
