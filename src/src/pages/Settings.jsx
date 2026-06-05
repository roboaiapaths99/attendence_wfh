import { useState, useEffect } from "react";
import { ShieldCheck, Cpu, Terminal, RefreshCw, KeyRound, Wifi, Settings as SettingsIcon } from "lucide-react";
import { agentApi, backendApi } from "../api";

export default function Settings({ token, deviceId, wifiSecured, onRegisterDevice }) {
  const [hardware, setHardware] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchHardwareInfo();
  }, []);

  const fetchHardwareInfo = async () => {
    setLoading(true);
    try {
      const res = await agentApi.get("/hardware");
      setHardware(res.data);
    } catch (err) {
      console.error("Failed to load local hardware details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setMessage("Syncing motherboard signature...");
    try {
      await onRegisterDevice();
      setMessage("Motherboard signature successfully bound to organization registries.");
    } catch (err) {
      setMessage(err.message || "Failed to register motherboard signatures.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto w-full space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="text-indigo-400" size={26} /> Device Auth & Settings
        </h1>
        <p className="text-slate-400 text-xs mt-1">Manage and sync the physical device credentials bound to your employee portal.</p>
      </div>

      <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="border-b border-slate-900 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Device Status</h3>
            <p className="text-[10px] text-slate-500 mt-1">Dynamic motherboard, MAC node, and IP mapping profile.</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            Operational
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-900">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Bound Device Node</span>
              <span className="font-mono text-[11px] text-white block mt-1 truncate">{deviceId}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Network Encryption</span>
              <span className={`font-bold text-[11px] block mt-1 ${wifiSecured ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
                {wifiSecured ? "SECURED (WPA2/3)" : "UNSECURED (OPEN)"}
              </span>
            </div>
          </div>

          {hardware && (
            <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-900 space-y-3.5">
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block">System Diagnostics</span>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[11px]">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                  <span className="text-slate-500">Operating System</span>
                  <span className="font-semibold text-slate-300 truncate max-w-[150px]">{hardware.os_info || "Windows"}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                  <span className="text-slate-500">MAC Address</span>
                  <span className="font-mono text-slate-300">{hardware.mac_address || "unknown"}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                  <span className="text-slate-500">IP Node</span>
                  <span className="font-mono text-slate-300">{hardware.ip_local || "127.0.0.1"}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-900/60">
                  <span className="text-slate-500">CPU Architecture</span>
                  <span className="font-semibold text-slate-300">{hardware.cpu_id || "x64"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-900 flex flex-col gap-3">
          <button 
            onClick={handleRegister}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            <Cpu size={16} /> Bind Hardware Clearance
          </button>
          
          {message && (
            <p className="text-[10px] text-indigo-400 text-center font-semibold mt-1 animate-pulse">
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="bg-slate-950/20 rounded-2xl p-4 border border-slate-900 flex items-start gap-3">
        <Terminal className="text-slate-500 mt-0.5 shrink-0" size={16} />
        <div className="text-[10px] text-slate-400 leading-relaxed font-medium">
          Binding hardware anchors this physical device's signature securely in your company's MongoDB registries. 
          Any subsequent telemetry syncs or active check-ins attempted from unauthorized devices will be instantly flagged to the administration console.
        </div>
      </div>
    </div>
  );
}
