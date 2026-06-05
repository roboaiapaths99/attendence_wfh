import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, ShieldCheck, Flame, Hourglass, Monitor } from "lucide-react";
import { agentApi, backendApi } from "../api";


export default function Productivity({ token }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("apps");
  const [stats, setStats] = useState({
    productiveTime: "0m",
    neutralTime: "0m",
    unproductiveTime: "0m",
    score: 100,
    appBreakdown: [
      { name: "VS Code", duration: "0m", percentage: 0, status: "Productive" }
    ],
    cadence: {
      avgWpm: 0,
      clicksPerMin: 0,
      intensity: "Balanced"
    }
  });

  // Pull local typing cadence & productivity from WFH Core daemon + Backend records
  useEffect(() => {
    fetchProductivityDetails();
  }, []);

  const fetchProductivityDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch from local agent (WPM, clicks, local score)
      const prodRes = await agentApi.get("/productivity").catch(() => null);
      const cadenceRes = await agentApi.get("/cadence").catch(() => null);
      
      // 2. Fetch from backend API (Real database records logged today)
      const todayStr = new Date().toISOString().split("T")[0];
      
      const [backendProdRes, backendAppsRes] = await Promise.all([
        backendApi.get(`/api/wfh/productivity?date=${todayStr}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        backendApi.get(`/api/wfh/apps?date=${todayStr}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);
      
      let localScore = 100;
      if (prodRes && prodRes.data && prodRes.data.score !== undefined) {
        localScore = prodRes.data.score;
      }
      
      // If we have backend productivity records, let's compute average score and times
      let prodScore = localScore;
      let productiveSeconds = 0;
      let neutralSeconds = 0;
      let unproductiveSeconds = 0;
      
      if (backendProdRes && backendProdRes.data && backendProdRes.data.length > 0) {
        const scores = backendProdRes.data.map(item => item.score);
        prodScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
      
      // 3. Process application logs
      const appBreakdownMap = {};
      let totalAppSeconds = 0;
      
      if (backendAppsRes && backendAppsRes.data && backendAppsRes.data.length > 0) {
        backendAppsRes.data.forEach(batch => {
          if (batch.apps) {
            batch.apps.forEach(app => {
              const name = app.name || "Unknown";
              const duration = app.duration_seconds || 0;
              const rawCategory = app.category || app.status || "productive";
              const status = rawCategory.toLowerCase();
              
              const isProd = status === "productive";
              const isUnprod = status === "unproductive";
              
              if (isProd) {
                productiveSeconds += duration;
              } else if (isUnprod) {
                unproductiveSeconds += duration;
              } else {
                neutralSeconds += duration;
              }
              
              if (appBreakdownMap[name]) {
                appBreakdownMap[name].seconds += duration;
              } else {
                appBreakdownMap[name] = {
                  name,
                  seconds: duration,
                  status: isProd ? "Productive" : (isUnprod ? "Unproductive" : "Neutral")
                };
              }
              totalAppSeconds += duration;
            });
          }
        });
      }
      
      // Format app breakdown array for UI
      let appBreakdown = [];
      if (totalAppSeconds > 0) {
        appBreakdown = Object.values(appBreakdownMap).map(app => {
          const hours = Math.floor(app.seconds / 3600);
          const mins = Math.floor((app.seconds % 3600) / 60);
          let duration = `${mins}m`;
          if (hours > 0) duration = `${hours}h ${mins}m`;
          return {
            name: app.name,
            duration,
            percentage: Math.round((app.seconds / totalAppSeconds) * 100),
            status: app.status
          };
        }).sort((a, b) => b.percentage - a.percentage).slice(0, 5);
      }
      
      // Format total times
      const formatTime = (secs) => {
        const hours = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        if (hours === 0 && mins === 0) return "0m";
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      };
      
      setStats({
        productiveTime: formatTime(productiveSeconds),
        neutralTime: formatTime(neutralSeconds),
        unproductiveTime: formatTime(unproductiveSeconds),
        score: prodScore,
        appBreakdown: appBreakdown.length > 0 ? appBreakdown : [
          { name: "VS Code", duration: "0m", percentage: 0, status: "Productive" }
        ],
        cadence: {
          avgWpm: cadenceRes?.data?.typing_speed_wpm || 0,
          clicksPerMin: cadenceRes?.data?.clicks_per_minute || 0,
          intensity: cadenceRes?.data?.work_intensity_category || "Balanced"
        }
      });
      
    } catch (err) {
      console.error("Failed to load local productivity data:", err);
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
            <BarChart3 className="text-indigo-400" size={24} /> Productivity Sync Analytics
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Analyze your workstation active categories, application workflows, and typing cadences.
          </p>
        </div>
        <button
          onClick={fetchProductivityDetails}
          className="p-2 border border-slate-800 rounded-xl hover:bg-slate-900 transition-all text-slate-400 hover:text-white"
        >
          <TrendingUp size={16} />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Core score ring */}
        <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">Productivity Rating</span>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-900"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-500"
                  strokeDasharray={`${stats.score}, 100`}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-sm font-extrabold text-white">{stats.score}%</span>
            </div>
            <div>
              <p className="text-xs font-bold text-white">Focus Index</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Calculated by window active duration ratio</p>
            </div>
          </div>
        </div>

        {/* Productive Time */}
        <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2 flex items-center gap-1">
            <Flame size={12} className="text-emerald-400" /> Focus Time
          </span>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">{stats.productiveTime}</h3>
          <span className="text-[9px] text-emerald-500 font-medium block mt-1">Productive active applications</span>
        </div>

        {/* Neutral Time */}
        <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2 flex items-center gap-1">
            <Hourglass size={12} className="text-slate-400" /> Neutral Time
          </span>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">{stats.neutralTime}</h3>
          <span className="text-[9px] text-slate-400 font-medium block mt-1">Communication & miscellaneous</span>
        </div>

        {/* Cadence info */}
        <div className="bg-slate-950/40 border border-slate-900 p-5 rounded-2xl">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2 flex items-center gap-1">
            <ShieldCheck size={12} className="text-indigo-400" /> typing flow
          </span>
          <h3 className="text-2xl font-extrabold text-white tracking-tight">{stats.cadence.avgWpm} WPM</h3>
          <span className="text-[9px] text-indigo-400 font-semibold block mt-1">{stats.cadence.intensity} Work Intensity</span>
        </div>
      </div>

      {/* Main Details and App usage list */}
      <div className="bg-slate-950/20 border border-slate-900 rounded-3xl p-6">
        <div className="flex border-b border-slate-900 pb-4 mb-6">
          <button
            onClick={() => setActiveTab("apps")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "apps" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Workflows & Apps
          </button>
          <button
            onClick={() => setActiveTab("cadence")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "cadence" ? "border-indigo-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            Typing Cadence Snapshot
          </button>
        </div>

        {activeTab === "apps" ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Monitor size={14} className="text-indigo-400" /> Active Application Logs
            </h3>

            <div className="space-y-3.5">
              {stats.appBreakdown.map((app) => (
                <div key={app.name} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        app.status === "Productive" ? "bg-emerald-500" : "bg-slate-600"
                      }`} />
                      <span className="text-white">{app.name}</span>
                    </div>
                    <div className="text-slate-400">
                      <span>{app.duration}</span>
                      <span className="text-[10px] text-slate-600 ml-2">({app.percentage}%)</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        app.status === "Productive" ? "bg-emerald-500/80" : "bg-slate-600/80"
                      }`}
                      style={{ width: `${app.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Inputs Cadence Indicators</h4>
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-900 space-y-4 text-xs">
                <div className="flex justify-between items-center pb-3 border-b border-slate-900/60">
                  <span className="text-slate-500">Average Typing Speed</span>
                  <span className="font-bold text-white">{stats.cadence.avgWpm} WPM</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-900/60">
                  <span className="text-slate-500">Average Mouse Clicks</span>
                  <span className="font-bold text-white">{stats.cadence.clicksPerMin} CPM</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Workday Energy Score</span>
                  <span className="font-extrabold text-emerald-400">{stats.cadence.intensity}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/30 p-6 rounded-2xl border border-slate-900/80 flex flex-col justify-center">
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Biometric Workday Intensity</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                LogDay monitors keystroke rhythmic pulses (cadence) to estimate focus blocks and physical strain thresholds. 
                Rhythm data checks are carried out locally. None of your raw keystrokes are uploaded or logged under security constraints.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
