import { 
  Users, Video, Sparkles, Volume2, Mic, MicOff, PhoneOff, Phone, Smile, Terminal
} from "lucide-react";

export default function Watercooler({
  teamMembers,
  isHuddled,
  activeHuddlePeer,
  isMuted,
  onStartHuddle,
  onLeaveHuddle,
  onToggleMute
}) {
  return (
    <div className="p-8 space-y-8 flex-1 flex flex-col justify-between">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-indigo-400" size={24} /> Virtual Voice Watercooler
            </h1>
            <p className="text-slate-400 text-xs mt-1">Join micro-huddles, bounce thoughts, and chat with team colleagues instantly.</p>
          </div>
          {isHuddled && (
            <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-2xl animate-pulse">
              <Volume2 className="text-indigo-400" size={16} />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Huddled: {activeHuddlePeer}</span>
            </div>
          )}
        </div>

        {/* Huddle controls status bar */}
        {isHuddled && (
          <div className="bg-slate-950/60 border border-indigo-500/20 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Mic size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Active Huddle Connection</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">P2P Secure WebRTC audio channel is live.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleMute}
                className={`px-4 py-2.5 rounded-xl border text-[10px] uppercase font-bold flex items-center gap-2 transition-all ${
                  isMuted 
                    ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' 
                    : 'border-slate-800 hover:bg-slate-900 text-slate-300'
                }`}
              >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />} {isMuted ? "Muted" : "Mute Mic"}
              </button>
              <button
                onClick={onLeaveHuddle}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] uppercase font-bold flex items-center gap-2 transition-all"
              >
                <PhoneOff size={14} /> Leave Huddle
              </button>
            </div>
          </div>
        )}

        {/* Teammates online list grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.length === 0 ? (
            <div className="col-span-full bg-slate-950/40 border border-slate-900 p-12 rounded-3xl text-center flex flex-col items-center justify-center">
              <Smile className="text-slate-500 mb-3" size={32} />
              <h3 className="text-sm font-bold text-white">No Peers Checked In</h3>
              <p className="text-[10px] text-slate-400 max-w-[280px] mt-1 leading-relaxed">
                It looks like your colleagues haven't checked into active remote WFH slots yet. Sync will show them once they join.
              </p>
            </div>
          ) : (
            teamMembers.map((member) => (
              <div key={member.employee_email} className="bg-slate-950/40 border border-slate-900 hover:border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between min-h-[160px] transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        {member.employee_name ? member.employee_name[0] : "R"}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{member.employee_name || "Remote Worker"}</h4>
                        <span className="text-[9px] text-slate-500 block max-w-[120px] truncate">{member.employee_email}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold uppercase animate-pulse">
                      Online
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-900/50">
                    <div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Rating</span>
                      <span className="text-[10px] font-bold text-indigo-400 block mt-0.5">{member.productivity_score}%</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Active For</span>
                      <span className="text-[10px] font-bold text-white block mt-0.5">Live</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-900/50 mt-4">
                  {isHuddled && activeHuddlePeer === member.employee_email ? (
                    <button
                      onClick={onLeaveHuddle}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] uppercase font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <PhoneOff size={12} /> Drop Call
                    </button>
                  ) : (
                    <button
                      onClick={() => onStartHuddle(member.employee_email)}
                      disabled={isHuddled}
                      className="w-full py-2 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 hover:text-white text-indigo-400 text-[10px] uppercase font-bold rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-indigo-400 flex items-center justify-center gap-1.5"
                    >
                      <Phone size={12} /> Huddle Voice
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modern User-friendly Huddle Status Footer */}
      <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-900/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isHuddled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
          <span>
            {isHuddled 
              ? `Connected securely with ${activeHuddlePeer}` 
              : 'Standby mode — ready to huddle'
            }
          </span>
        </div>
        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest font-sans">
          End-to-End Encrypted
        </span>
      </div>
    </div>
  );
}
