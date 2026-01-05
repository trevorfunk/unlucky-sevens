import { suitLabel } from "../game/cards";

export default function SuitModal({ open, value, onChange, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          background: "white",
          borderRadius: 16,
          border: "1px solid #eee",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Choose a suit</div>
            <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
              Your 8 sets the forced suit for the next play.
            </div>
          </div>
          <button onClick={onClose} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
          {["S", "H", "D", "C"].map((s) => {
            const active = value === s;
            return (
              <button
                key={s}
                onClick={() => onChange(s)}
                style={{
                  padding: "14px 10px",
                  borderRadius: 14,
                  border: active ? "2px solid #111" : "1px solid #ddd",
                  background: active ? "#f3f3f3" : "white",
                  fontWeight: 900,
                  fontSize: 20,
                  cursor: "pointer",
                }}
                title={s}
              >
                {suitLabel(s)}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 800,
            }}
          >
            Confirm {suitLabel(value)}
          </button>
        </div>
      </div>
    </div>
  );
}
