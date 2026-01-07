export default function TabletopShell({ children }) {
 return (
   <div className="min-h-screen bg-zinc-950 text-zinc-100">
     {/* Cozy ambient background */}
     <div className="fixed inset-0 -z-10">
       <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,80,40,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(20,120,80,0.22),transparent_55%)]" />
       <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(0deg,transparent_0%,rgba(255,255,255,0.8)_50%,transparent_100%)] mix-blend-overlay" />
     </div>

     {/* Centered table frame */}
     <div className="mx-auto max-w-6xl px-4 py-6">
       <div className="rounded-[28px] border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.55)] overflow-hidden">
         {/* “Felt” surface */}
         <div className="bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.12),rgba(0,0,0,0)_60%),linear-gradient(180deg,rgba(24,24,27,0.88),rgba(10,10,10,0.92))]">
           {children}
         </div>
       </div>
     </div>
   </div>
 );
}
