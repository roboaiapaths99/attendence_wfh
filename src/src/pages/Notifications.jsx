import { useState, useEffect } from "react";
import { backendApi } from "../api";
import { Bell, AlertTriangle, AlertCircle, ShieldAlert, Clock, UserCheck, CheckCircle, Info, Monitor } from "lucide-react";

// Convert technical alert type to simple, friendly title
const getFriendlyTitle = (type) => {
  const map = {
    "Continuous Auth Failure": "Identity Check Warning",
    "WFH_IDENTITY_MISMATCH": "Identity Check Warning",
    "WFH_FACE_CHECK_FAILED": "Face Verification Failed",
    "WFH_FACE_CHECK_FAILURE": "Face Verification Failed",
    "WFH_FAKE_WEBCAM": "Fake Camera Detected",
    "WFH_IDLE_EXTENDED": "Inactive Too Long",
    "WFH_LOW_PRODUCTIVITY": "Low Work Activity",
    "WFH_SESSION_FORCE_ENDED": "Session Ended by Admin",
    "WFH_SCREENSHOT_THREAT": "Suspicious Screen Content",
    "WFH_SUSPICIOUS_APP": "Unapproved App Detected",
  };
  return map[type] || type.replace("WFH_", "").replace(/_/g, " ").toLowerCase();
};

// Convert technical detail message to plain English
const getFriendlyDetail = (type, details) => {
  if (!details) return "";

  // Handle old "Typing cadence profile mismatch..." messages
  if (details.includes("Typing cadence profile mismatch") || details.includes("Keyboard rhythm variance")) {
    const livenessMatch = details.match(/liveness status:\s*(Passed|Failed)/i);
    const liveness = livenessMatch ? livenessMatch[1].toLowerCase() : "unknown";
    if (liveness === "failed") {
      return "Your typing pattern looked different from usual, and the camera couldn't confirm your face. Please make sure you're sitting in front of your webcam with good lighting.";
    }
    return "Your typing speed or rhythm changed noticeably. This is just a routine check — no action needed if it was you.";
  }

  // Handle old "Keyboard typing pattern warning..." messages
  if (details.includes("Keystroke typing rhythm") || details.includes("possible user swap")) {
    const faceMatch = details.match(/Webcam face (?:check|verification):\s*(passed|failed)/i);
    const face = faceMatch ? faceMatch[1].toLowerCase() : "unknown";
    if (face === "failed") {
      return "Your typing pattern changed and the webcam couldn't verify your face. Make sure you're in front of your camera with good lighting.";
    }
    return "Your typing pattern changed a bit. This is a routine security check — nothing to worry about if it was you.";
  }

  // Handle idle messages
  if (details.includes("completely inactive") || details.includes("No keyboard or mouse activity")) {
    const minsMatch = details.match(/(\d+)\s*minutes/);
    const mins = minsMatch ? minsMatch[1] : "a while";
    return `You were away from your computer for ${mins} minutes with no typing or mouse movement. Try to take shorter breaks to stay on track.`;
  }

  // Handle face check failures
  if (details.includes("No face detected")) {
    return "The webcam couldn't see your face. Please make sure you're sitting in front of your camera.";
  }
  if (details.includes("Multiple faces")) {
    return "More than one person was seen on camera. Please work in a private space during your WFH session.";
  }
  if (details.includes("Liveness check failed") || details.includes("spoofing")) {
    return "The camera check didn't pass. Make sure you're using a real camera (not a virtual one) and have good lighting.";
  }
  if (details.includes("Virtual camera") || details.includes("fake_webcam")) {
    return "A virtual/fake camera app was detected. Please use your real webcam during work hours.";
  }

  // Handle productivity
  if (details.includes("low productivity") || details.includes("productivity score")) {
    return "Your work activity was lower than expected. Try staying focused on work-related apps.";
  }

  // Handle session force-ended
  if (details.includes("force") && details.includes("end")) {
    return "Your admin ended your WFH session remotely. Contact your manager if you have questions.";
  }

  // If it's already a clean message (from our new code), return as-is
  return details;
};

export default function Notifications({ token }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/api/wfh/my-alerts", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(res.data || []);
    } catch (err) {
      console.error("Failed to fetch WFH alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [token]);

  const getAlertIcon = (type) => {
    switch (type) {
      case "WFH_FACE_CHECK_FAILED":
      case "WFH_FACE_CHECK_FAILURE":
        return <UserCheck className="text-rose-400" size={20} />;
      case "WFH_FAKE_WEBCAM":
        return <ShieldAlert className="text-red-500" size={20} />;
      case "WFH_IDLE_EXTENDED":
        return <Clock className="text-amber-400" size={20} />;
      case "WFH_LOW_PRODUCTIVITY":
        return <AlertTriangle className="text-amber-500" size={20} />;
      case "WFH_SESSION_FORCE_ENDED":
        return <AlertCircle className="text-blue-400" size={20} />;
      case "Continuous Auth Failure":
      case "WFH_IDENTITY_MISMATCH":
        return <ShieldAlert className="text-rose-500" size={20} />;
      case "WFH_SUSPICIOUS_APP":
      case "WFH_SCREENSHOT_THREAT":
        return <Monitor className="text-orange-400" size={20} />;
      default:
        return <Info className="text-slate-400" size={20} />;
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-950/40 border-red-500/30 text-red-200";
      case "high":
        return "bg-rose-950/40 border-rose-500/30 text-rose-200";
      case "medium":
        return "bg-amber-950/40 border-amber-500/30 text-amber-200";
      case "low":
        return "bg-blue-950/40 border-blue-500/30 text-blue-200";
      default:
        return "bg-slate-900/40 border-slate-800 text-slate-300";
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case "critical": return "Urgent";
      case "high": return "Important";
      case "medium": return "Heads Up";
      case "low": return "Info";
      default: return "Notice";
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 animate-fade-in font-outfit">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-600/15 rounded-2xl flex items-center justify-center text-primary-400 border border-primary-500/10">
            <Bell size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">Notifications</h1>
            <p className="text-xs text-slate-400 mt-0.5">Updates about your work session, security checks & reminders</p>
          </div>
        </div>
        <button
          onClick={fetchAlerts}
          className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white rounded-xl border border-slate-700/50 transition-all"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm font-medium">
          Loading notifications...
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl text-center p-8 space-y-4">
          <div className="w-16 h-16 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500">
            <CheckCircle size={32} />
          </div>
          <div className="space-y-1">
            <p className="text-slate-300 font-semibold text-sm">You're all good! No notifications</p>
            <p className="text-xs text-slate-500 max-w-xs">Everything is running smoothly with your work session.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert._id}
              className={`flex items-start gap-4 p-5 rounded-2xl border backdrop-blur-xl transition-all hover:scale-[1.005] duration-200 ${getAlertColor(
                alert.severity
              )}`}
            >
              <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/50 mt-0.5">
                {getAlertIcon(alert.type)}
              </div>
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white tracking-wide">
                      {getFriendlyTitle(alert.type)}
                    </h3>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      alert.severity === "critical" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      alert.severity === "high" ? "bg-rose-500/15 text-rose-400 border-rose-500/30" :
                      alert.severity === "medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    }`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 font-medium font-mono">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  {getFriendlyDetail(alert.type, alert.details)}
                </p>
                {alert.review_note && (
                  <div className="mt-2.5 p-3 bg-slate-950/45 rounded-xl border border-slate-800/60">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Admin Response</p>
                    <p className="text-xs text-slate-200 mt-1 font-medium italic">"{alert.review_note}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
