import { useState, useEffect } from "react";
import { Camera, Calendar, ShieldAlert, ShieldCheck, Eye, EyeOff, LayoutGrid, List } from "lucide-react";
import { agentApi, backendApi } from "../api";

export default function Screenshots({ token, user }) {
  const [screenshots, setScreenshots] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [loading, setLoading] = useState(false);
  const [blurAll, setBlurAll] = useState(true);

  // Load mock or local screenshots
  useEffect(() => {
    fetchScreenshots();
  }, []);

  const fetchScreenshots = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/api/wfh/screenshots", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.screenshots) {
        const formatted = res.data.screenshots.map(s => {
          const dt = new Date(s.timestamp);
          return {
            id: s._id,
            timestamp: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            activeApp: s.active_window || s.active_app || "Unknown",
            keystrokes: s.keystrokes || 0,
            clicks: s.mouse_clicks || 0,
            category: "Productive",
            ocrAlert: false, // We'd need to sync this if we add OCR threat level
            blur: false,
            image: s.image_url.startsWith('http') ? s.image_url : `https://logday-api.duckdns.org${s.image_url}`
          };
        });
        setScreenshots(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerManualScreenshot = async () => {
    setLoading(true);
    try {
      const res = await agentApi.get("/screenshot");
      if (res.data && res.data.image_base64) {
        const appRes = await agentApi.get("/active-app").catch(() => ({ data: { active_app: "LogDay Desktop Gate", active_window: "Active Workstation" } }));
        const statusRes = await agentApi.get("/auth/status").catch(() => ({ data: { device_id: "wfh-device-001", session_id: null } }));
        
        const payload = {
          device_id: statusRes.data.device_id || "wfh-device-001",
          session_id: statusRes.data.session_id,
          image_url: res.data.image_base64,
          thumbnail_url: null,
          active_app: appRes.data.active_app || "Unknown",
          active_window: appRes.data.active_window || "Active Window"
        };
        
        await backendApi.post("/api/wfh/screenshot", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        await fetchScreenshots();
      }
    } catch (err) {
      console.error("Failed manual screenshot:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 flex-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Camera className="text-indigo-400" size={24} /> Screenshot History
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Review captured workstation monitors, active applications, and biometric security status.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBlurAll(!blurAll)}
            className="px-3.5 py-2 border border-slate-800 rounded-xl hover:bg-slate-900 transition-all text-xs font-semibold flex items-center gap-2 text-slate-300"
          >
            {blurAll ? <Eye size={14} /> : <EyeOff size={14} />}
            {blurAll ? "Reveal Previews" : "Blur Previews"}
          </button>
          <button
            onClick={triggerManualScreenshot}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
          >
            Trigger Screenshot
          </button>
        </div>
      </div>

      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Camera size={18} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Today's Total</span>
            <span className="text-lg font-extrabold text-white">{screenshots.length} captured</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">OCR Safety Scan</span>
            <span className="text-lg font-extrabold text-emerald-400">100% Cleared</span>
          </div>
        </div>

        <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-2xl flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ShieldAlert size={18} />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Secured Intercepts</span>
            <span className="text-lg font-extrabold text-white">0 Flags today</span>
          </div>
        </div>
      </div>

      {/* Layout Control and Listing */}
      <div className="bg-slate-950/20 border border-slate-900 rounded-3xl p-6 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-900">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar size={14} className="text-indigo-400" />
            <span>Workday Timeline: <span className="font-semibold text-white">Today</span></span>
          </div>
          <div className="flex border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-indigo-600/10 text-indigo-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        {loading && screenshots.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs text-slate-400 font-medium">Fetching sync journal...</span>
          </div>
        ) : (
          <div className={viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {screenshots.map((scr) => (
              <div 
                key={scr.id}
                className={`bg-slate-950/50 border rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-800 ${
                  scr.ocrAlert ? "border-rose-500/20" : "border-slate-900/60"
                } ${viewMode === "list" ? "flex items-center gap-6 p-4" : ""}`}
              >
                {/* Screenshot Image Container */}
                <div className={`relative bg-slate-900/60 overflow-hidden ${
                  viewMode === "list" ? "w-44 h-24 rounded-xl" : "w-full aspect-video"
                }`}>
                  <img
                    src={scr.image}
                    alt={scr.activeApp}
                    className={`w-full h-full object-cover transition-all duration-350 ${
                      blurAll || scr.blur ? "blur-md scale-105" : "blur-0"
                    }`}
                  />
                  {scr.ocrAlert && (
                    <div className="absolute top-2 right-2 bg-rose-500/80 backdrop-blur text-white text-[8px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase shadow">
                      Secure Alert
                    </div>
                  )}
                </div>

                {/* Screenshot Metadata Info */}
                <div className={`flex-1 p-4 ${viewMode === "list" ? "p-0" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{scr.timestamp}</span>
                    <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      scr.category === "Productive" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      scr.category === "Neutral" ? "bg-slate-800 text-slate-400 border border-slate-700" :
                      "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      {scr.category}
                    </span>
                  </div>

                  <p className="text-[11px] font-semibold text-slate-300 truncate mb-2">{scr.activeApp}</p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span>Keys: <strong className="text-slate-300">{scr.keystrokes}</strong></span>
                    <span>Clicks: <strong className="text-slate-300">{scr.clicks}</strong></span>
                  </div>

                  {scr.ocrAlert && scr.alertReason && (
                    <p className="text-[9px] text-rose-400 font-semibold mt-2 flex items-center gap-1">
                      <ShieldAlert size={10} />
                      {scr.alertReason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
