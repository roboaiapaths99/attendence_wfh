import { 
  Activity, Camera, BarChart3, CalendarDays, 
  Users, Settings, LogOut, Shield, ChevronRight,
  Wifi, WifiOff, Circle, CheckSquare, Bell
} from "lucide-react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "screenshots", label: "Screenshots", icon: Camera },
  { id: "productivity", label: "Productivity", icon: BarChart3 },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "leaves", label: "Leaves", icon: CalendarDays },
  { id: "watercooler", label: "Watercooler", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function Layout({ 
  currentPage, onPageChange, user, org, 
  session, timerString, agentStatus, onLogout, unreadAlerts = 0, children 
}) {
  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-[260px] bg-slate-950/80 border-r border-slate-800/60 flex flex-col justify-between backdrop-blur-xl">
        
        {/* Logo + Org Branding */}
        <div>
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center gap-3">
              {org?.logo_url ? (
                <img src={org.logo_url} className="w-9 h-9 rounded-xl object-contain bg-slate-900 p-1 border border-slate-800" alt="Org" />
              ) : (
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
                  <Shield size={20} />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-tight truncate">{org?.name || "LogDay"}</h2>
                <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">WFH Desktop</span>
              </div>
            </div>
          </div>

          {/* Session Timer Bar */}
          <div className="mx-4 mb-4 px-4 py-3 rounded-2xl bg-gradient-to-r from-slate-900/80 to-slate-900/40 border border-slate-800/60">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Session</span>
              <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${session ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Circle size={6} fill="currentColor" className={session ? 'animate-pulse' : ''} />
                {session ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className={`text-xl font-extrabold tracking-tight mt-1 ${session ? 'text-white' : 'text-slate-600'}`}>
              {timerString}
            </p>
          </div>

          {/* Navigation */}
          <nav className="px-3 space-y-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = currentPage === id;
              return (
                <button
                  key={id}
                  onClick={() => onPageChange(id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-[13px] font-medium group ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm shadow-indigo-500/5' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="flex-1 text-left">{label}</span>
                  {id === "notifications" && unreadAlerts > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold animate-pulse shrink-0">
                      {unreadAlerts}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} className="text-indigo-500/60 shrink-0" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: User Card + Agent Status */}
        <div className="px-4 pb-5 space-y-3">
          
          {/* Agent Status */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/40 border border-slate-800/40">
            {agentStatus === 'active' ? (
              <Wifi size={13} className="text-emerald-400" />
            ) : (
              <WifiOff size={13} className="text-rose-400" />
            )}
            <span className="text-[10px] font-semibold text-slate-400">
              Agent: <span className={agentStatus === 'active' ? 'text-emerald-400' : 'text-rose-400'}>{agentStatus === 'active' ? 'Connected' : 'Offline'}</span>
            </span>
          </div>

          {/* User Card */}
          <div className="flex items-center gap-3 px-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-slate-700/50">
              {user?.profile_image ? (
                <img src={user.profile_image.startsWith('data:') ? user.profile_image : `data:image/jpeg;base64,${user.profile_image}`} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <span className="text-xs font-bold text-slate-300">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.full_name || "Employee"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.designation || user?.email || ""}</p>
            </div>
          </div>

          {/* Logout Button */}
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/15 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 transition-all text-xs font-semibold"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-gradient-to-br from-[#020617] via-[#050b21] to-[#020617]">
        {children}
      </main>
    </div>
  );
}
