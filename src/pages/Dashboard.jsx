import { useState, useEffect, useRef } from "react";
import { 
  Activity, Play, Square, Video, Eye, EyeOff, 
  RefreshCw, AlertTriangle, ShieldCheck, Heart, Cpu, Camera, X, Loader2, Clock
} from "lucide-react";
import { agentApi } from "../api";


export default function Dashboard({
  session,
  timerString,
  productivity,
  agentStatus,
  deviceId,
  deviceStatus,
  wifiSecured,
  isMonitoring,
  webcamPreview,
  setWebcamPreview,
  webcamImage,
  loading,
  onCheckIn,
  onCheckOut,
  onStartMonitoring,
  onStopMonitoring,
  onCheckAgent,
  wellnessNudge,
  setWellnessNudge
}) {
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [scanType, setScanType] = useState(null); // 'check-in' or 'check-out'
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const [previewStream, setPreviewStream] = useState(null);
  const previewVideoRef = useRef(null);

  const [queueCount, setQueueCount] = useState(0);
  const [showSyncedBanner, setShowSyncedBanner] = useState(false);
  const prevQueueRef = useRef(0);

  useEffect(() => {
    let intervalId;
    const fetchQueueCount = async () => {
      try {
        const response = await agentApi.get("/queue/count");
        const count = response.data?.pending || 0;
        const prevCount = prevQueueRef.current;
        
        setQueueCount(count);
        
        if (count === 0 && prevCount > 0) {
          setShowSyncedBanner(true);
          const timer = setTimeout(() => {
            setShowSyncedBanner(false);
          }, 5000);
        }
        
        prevQueueRef.current = count;
      } catch (err) {
        console.error("Failed to fetch agent queue count:", err);
      }
    };

    fetchQueueCount();
    intervalId = setInterval(fetchQueueCount, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let currentStream = null;
    if (webcamPreview) {
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then(s => {
          currentStream = s;
          setPreviewStream(s);
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = s;
          }
        })
        .catch(err => console.error("Preview camera access denied:", err));
    } else {
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
        setPreviewStream(null);
      }
    }
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
      }
      if (previewStream) {
        previewStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [webcamPreview]);

  // Handle opening the modal and starting the camera
  const handleStartScan = async (type) => {
    setScanType(type);
    setShowFaceScan(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  const closeScan = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setShowFaceScan(false);
    setScanType(null);
  };

  const executeScan = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    const dataUrl = canvas.toDataURL("image/jpeg");
    
    closeScan();
    
    if (scanType === 'check-in') {
      onCheckIn(dataUrl);
    } else {
      onCheckOut(dataUrl);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  return (
    <div className="p-8 space-y-8 flex-1 flex flex-col justify-between">
      <div className="space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Monitoring Central</h1>
            <p className="text-slate-400 text-xs mt-1">Keep track of your remote work hours and sync logs to the enterprise grid.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase flex items-center gap-1.5 ${
              session 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' 
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${session ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              {session ? 'Checked In' : 'Checked Out'}
            </span>
            <button 
              onClick={onCheckAgent}
              className="p-2 border border-slate-800 rounded-xl hover:bg-slate-900 transition-all text-slate-400 hover:text-white"
              title="Check background daemon"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Unsecured Wi-Fi Alert */}
        {!wifiSecured && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <AlertTriangle className="text-rose-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-white">Unsecured Connection Detected</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Your workstation is connected to an open, unencrypted Wi-Fi access point. Company VPN activation is highly recommended.</p>
            </div>
          </div>
        )}

        {/* Device Pending Approval Banner */}
        {deviceStatus === 'pending' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-amber-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-amber-300">⏳ Device Awaiting Admin Approval</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Your workstation has been registered but needs to be approved by your admin before you can check in.
                Please ask your administrator to approve it in the <strong className="text-amber-300">Admin Panel → WFH Devices</strong> section.
              </p>
            </div>
          </div>
        )}

        {/* Device Revoked Banner */}
        {deviceStatus === 'revoked' && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-rose-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-rose-300">🚫 Device Access Revoked</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Your device access has been revoked by an administrator. Please contact your admin to restore access.
              </p>
            </div>
          </div>
        )}

        {/* Offline Queue Banners */}
        {queueCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <Clock className="text-amber-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-amber-300">Offline Cache Queue Syncing</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">⏳ {queueCount} items pending upload — will sync when online</p>
            </div>
          </div>
        )}

        {showSyncedBanner && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
            <ShieldCheck className="text-emerald-400 shrink-0" size={20} />
            <div>
              <h4 className="text-xs font-bold text-emerald-400">Sync Complete</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">✓ All cached productivity logs and screenshots synced successfully.</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Worked Time</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white tracking-tight">{timerString}</span>
            </div>
            {session && session.check_in_time ? (
              <span className="text-[9px] text-emerald-400 block mt-2 font-semibold">
                Checked in: {(() => {
                  let checkInStr = session.check_in_time;
                  if (typeof checkInStr === "string" && !/([+-]\d{2}:?\d{2}|Z)$/.test(checkInStr)) {
                    checkInStr = checkInStr + "Z";
                  }
                  return new Date(checkInStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                })()} (IST)
              </span>
            ) : (
              <span className="text-[9px] text-slate-600 block mt-2">Active Session stopwatch</span>
            )}
          </div>

          <div className="bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Productivity Score</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-indigo-400 tracking-tight">{productivity.score}%</span>
            </div>
            <span className="text-[9px] text-slate-600 block mt-2">Aggregate tracking rating</span>
          </div>

          <div className="bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Activity Counters</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-400 tracking-tight">{productivity.keystrokes + productivity.clicks}</span>
            </div>
            <span className="text-[9px] text-slate-600 block mt-2">Clicks: {productivity.clicks} • Keys: {productivity.keystrokes}</span>
          </div>

          <div className="bg-slate-950/40 backdrop-blur-md border border-slate-900/60 p-5 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Active Application</span>
            <div className="flex items-baseline gap-2">
              <span className="text-md font-bold text-white truncate block w-full">{productivity.app}</span>
            </div>
            <span className="text-[9px] text-slate-600 block mt-2">Currently in foreground</span>
          </div>
        </div>

        {/* Webcam and Checkpost Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Webcam Preview Loop */}
          <div className="lg:col-span-2 bg-slate-950/40 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Video size={16} /> Webcam Preview Loop
              </span>
              <button 
                onClick={() => setWebcamPreview(!webcamPreview)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                {webcamPreview ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="relative flex-1 bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center min-h-[300px]">
              {webcamPreview ? (
                previewStream ? (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
                    <video 
                      ref={previewVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-2xl transform scale-x-[-1]" 
                    />
                    <div className="absolute top-3 left-3 bg-emerald-500/80 backdrop-blur-md text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase shadow flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> Live Video Feed
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                      <Video size={24} />
                    </div>
                    <p className="text-xs text-slate-400 max-w-[280px]">Webcam capturing system is active. Your biometric frames are verified strictly locally.</p>
                  </div>
                )
              ) : (
                <div className="absolute inset-0 bg-[#0c102b] flex items-center justify-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600">Video suspended</span>
                </div>
              )}
            </div>
          </div>

          {/* Checkpost Actions */}
          <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Checkpost Actions</span>
              
              {!session ? (
                <button 
                  onClick={() => handleStartScan('check-in')}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm tracking-wider uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} 
                  {loading ? 'Processing...' : 'Check In Session'}
                </button>
              ) : (
                <button 
                  onClick={() => handleStartScan('check-out')}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-extrabold text-sm tracking-wider uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Square size={14} />} 
                  {loading ? 'Processing...' : 'Check Out Session'}
                </button>
              )}

              <div className="border-t border-slate-800/80 pt-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Auto Monitor</span>
                  <span className={`text-[10px] font-bold ${isMonitoring ? "text-emerald-400" : "text-slate-500"}`}>
                    {isMonitoring ? "ACTIVE" : "SUSPENDED"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={onStartMonitoring}
                    className="flex-1 py-2 rounded-xl border border-slate-800 text-[10px] uppercase font-bold text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    Resume
                  </button>
                  <button 
                    onClick={onStopMonitoring}
                    className="flex-1 py-2 rounded-xl border border-slate-800 text-[10px] uppercase font-bold text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-600 text-center leading-normal mt-4 flex items-center justify-center gap-1.5 border-t border-slate-900 pt-3">
              <Cpu size={12} className="text-indigo-400" />
              <span>Identity bound: <span className="font-mono text-slate-500">{deviceId}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Wellness Hydration & Stretch Nudge Modal */}
      {wellnessNudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-950 border border-indigo-500/30 p-6 rounded-3xl shadow-2xl shadow-indigo-500/10 relative text-center space-y-5">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-teal-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-500/20">
              <Heart size={28} className="animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Wellness Stretch Guard</span>
              <h2 className="text-lg font-extrabold text-white">Time to stand up and stretch!</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                You have been active at your workstation for a continuous stretch. 
                Stand up, take a 30-second eye-break, stretch your neck, and sip some water.
              </p>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-900 text-left space-y-2">
              <h5 className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Quick Stretching Tip</h5>
              <p className="text-[11px] text-slate-300 leading-normal">
                Slowly tilt your head towards each shoulder, holding for 5 seconds. Repeat twice to reduce posture fatigue.
              </p>
            </div>

            <button
              onClick={() => setWellnessNudge(false)}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-400 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
            >
              Resume Focus Mode
            </button>
          </div>
        </div>
      )}

      {/* Face Authentication Modal */}
      {showFaceScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-2xl relative space-y-6">
            <button 
              onClick={closeScan}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="text-center space-y-1 pt-2">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Camera size={24} />
              </div>
              <h2 className="text-lg font-extrabold text-white">
                Biometric {scanType === 'check-in' ? 'Check In' : 'Check Out'}
              </h2>
              <p className="text-xs text-slate-400">Position your face clearly in the frame.</p>
            </div>

            <div className="relative w-full aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <div className="absolute inset-0 pointer-events-none">
                <div className="w-full h-full border-[3px] border-indigo-500/30 rounded-2xl" />
                {/* Crosshairs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border border-indigo-400/50 rounded-[40%] animate-pulse" />
              </div>
            </div>

            <button
              onClick={executeScan}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-500 hover:from-indigo-400 hover:to-teal-400 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} /> 
              Capture & Verify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
