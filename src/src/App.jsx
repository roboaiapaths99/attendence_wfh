import { useState, useEffect, useRef } from "react";
import { backendApi, agentApi } from "./api";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Screenshots from "./pages/Screenshots";
import Productivity from "./pages/Productivity";
import Leaves from "./pages/Leaves";
import Watercooler from "./pages/Watercooler";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Notifications from "./pages/Notifications";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")) || null);
  const [org, setOrg] = useState(JSON.parse(localStorage.getItem("org")) || null);
  
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [timerString, setTimerString] = useState("00:00:00");
  const [agentStatus, setAgentStatus] = useState("offline");
  const [deviceId, setDeviceId] = useState("wfh-device-001");
  const [wifiSecured, setWifiSecured] = useState(true);
  const [deviceStatus, setDeviceStatus] = useState(null); // null | 'pending' | 'approved' | 'revoked'
  const [clockSkew, setClockSkew] = useState(0); // clientTime - serverTime
  
  // Monitoring & Telemetry
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [webcamPreview, setWebcamPreview] = useState(true);
  const [webcamImage, setWebcamImage] = useState("");
  const [productivity, setProductivity] = useState({ score: 0, keystrokes: 0, clicks: 0, app: "unknown" });
  const [wellnessNudge, setWellnessNudge] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  
  // WebRTC / Watercooler state
  const [teamMembers, setTeamMembers] = useState([]);
  const [isHuddled, setIsHuddled] = useState(false);
  const [activeHuddlePeer, setActiveHuddlePeer] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("System idle.");
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', text: string }
  
  const showToast = (text, type = "success") => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const timerRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const lastIdleWarningTimeRef = useRef(0);


  // Sync token & profile to localstorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      checkActiveSession();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("org");
      setUser(null);
      setOrg(null);
    }
  }, [token]);

  // Session Stopwatch Timer
  useEffect(() => {
    if (session && session.check_in_time) {
      let checkInStr = session.check_in_time;
      if (typeof checkInStr === "string" && !/([+-]\d{2}:?\d{2}|Z)$/.test(checkInStr)) {
        checkInStr = checkInStr + "Z";
      }
      const start = new Date(checkInStr).getTime();
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        const adjustedNow = Date.now() - clockSkew;
        const elapsed = Math.max(0, adjustedNow - start);
        const hrs = String(Math.floor(elapsed / 3600000)).padStart(2, "0");
        const mins = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, "0");
        const secs = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
        setTimerString(`${hrs}:${mins}:${secs}`);
        
        // ergonomic nudge every 90 minutes (5400s)
        if (Math.floor(elapsed / 1000) % 5400 === 0 && elapsed > 1000) {
          setWellnessNudge(true);
        }
      }, 1000);
    } else {
      setTimerString("00:00:00");
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  // Sync / Daemon status checking loop
  useEffect(() => {
    let statusInterval;
    const fetchStatus = async () => {
      try {
        const health = await agentApi.get("/health");
        if (health.data.status === "healthy") {
          setAgentStatus("active");
          
          // Poll current activity, app foreground window and productivity indices
          const [appInfo, activity, prodInfo] = await Promise.all([
            agentApi.get("/active-app").catch(() => ({ data: { active_app: "unknown" } })),
            agentApi.get("/activity").catch(() => ({ data: { keystrokes: 0, mouse_clicks: 0, consecutive_idle_seconds: 0 } })),
            agentApi.get("/productivity").catch(() => ({ data: { score: 0 } }))
          ]);
          
          setProductivity(prev => ({
            ...prev,
            app: appInfo.data.active_app || "unknown",
            keystrokes: activity.data.keystrokes || 0,
            clicks: activity.data.mouse_clicks || 0,
            score: prodInfo.data.score || 0
          }));

          // Dynamic policy based idle warning / auto checkout
          if (session) {
            const cachedPolicy = localStorage.getItem("wfh_policy");
            const policy = cachedPolicy ? JSON.parse(cachedPolicy) : null;
            if (policy) {
              const maxIdleMins = policy.max_idle_minutes || 20;
              const consecutiveIdleSecs = activity.data.consecutive_idle_seconds || 0;
              const warningThreshold = Math.max(60, (maxIdleMins - 5) * 60);
              const limitThreshold = maxIdleMins * 60;
              
              if (consecutiveIdleSecs >= limitThreshold) {
                console.log(`Auto checkout triggered: ${consecutiveIdleSecs}s idle >= limit ${limitThreshold}s`);
                triggerAutoCheckout();
              } else if (consecutiveIdleSecs >= warningThreshold) {
                const now = Date.now();
                if (now - lastIdleWarningTimeRef.current > 60000) {
                  showToast(`Inactivity warning: You have been idle for ${Math.floor(consecutiveIdleSecs / 60)} minutes. You will be automatically checked out at ${maxIdleMins} minutes.`, "error");
                  lastIdleWarningTimeRef.current = now;
                }
              }
            }
          }

          // Fetch dynamic hardware device ID if set to default fallback
          if (deviceId === "wfh-device-001") {
            const hwInfo = await agentApi.get("/hardware").catch(() => null);
            if (hwInfo && hwInfo.data.device_id) {
              setDeviceId(hwInfo.data.device_id);
              setWifiSecured(hwInfo.data.wifi_secured !== false);
            }
          }

          // Fetch webcam preview frame if active
          if (webcamPreview) {
            const webcamRes = await agentApi.get("/webcam").catch(() => null);
            if (webcamRes && webcamRes.data.image_base64) {
              setWebcamImage(webcamRes.data.image_base64);
            }
          }
        } else {
          setAgentStatus("offline");
        }
      } catch (err) {
        setAgentStatus("offline");
      }
    };

    fetchStatus();
    statusInterval = setInterval(fetchStatus, 5000);
    return () => clearInterval(statusInterval);
  }, [webcamPreview, deviceId, session, token]);

  // Poll WFH Alerts unread count
  useEffect(() => {
    if (!token || !session) {
      setUnreadAlerts(0);
      return;
    }
    const fetchUnreadCount = async () => {
      try {
        const res = await backendApi.get("/api/wfh/my-alerts", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const pendingCount = (res.data || []).filter(a => a.status === "pending" || a.status === "active").length;
        setUnreadAlerts(pendingCount);
      } catch (err) {
        console.error("Failed to fetch alert count:", err);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [token, session]);

  // WebRTC Signals & Active team member polling
  useEffect(() => {
    if (!token || !session) return;
    let pollInterval;
    const pollTeamAndSignals = async () => {
      try {
        const [teamRes, signalsRes] = await Promise.all([
          backendApi.get("/api/wfh/team/active", { headers: { Authorization: `Bearer ${token}` } }),
          backendApi.get("/api/wfh/meeting/signal", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        setTeamMembers(teamRes.data || []);
        
        const signals = signalsRes.data || [];
        for (const sig of signals) {
          await handleIncomingSignal(sig);
        }
      } catch (err) {
        console.error("WebRTC team/signals error:", err);
      }
    };

    pollTeamAndSignals();
    pollInterval = setInterval(pollTeamAndSignals, 4000);
    return () => clearInterval(pollInterval);
  }, [token, session]);

  // Poll admin screenshot trigger commands when checked in
  useEffect(() => {
    if (!token || !session) return;
    let commandInterval;
    const pollCommands = async () => {
      try {
        const cmdRes = await backendApi.get("/api/wfh/commands/pending", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cmdRes.data && cmdRes.data.commands) {
          for (const cmd of cmdRes.data.commands) {
            if (cmd.command === "trigger_screenshot") {
              const shot = await agentApi.get("/screenshot").catch(() => null);
              if (shot && shot.data && shot.data.image_base64) {
                const appRes = await agentApi.get("/active-app").catch(() => ({ data: { active_app: "LogDay Desktop Gate", active_window: "Active Workstation" } }));
                const statusRes = await agentApi.get("/auth/status").catch(() => ({ data: { device_id: "wfh-device-001", session_id: null } }));
                
                const payload = {
                  device_id: statusRes.data.device_id || "wfh-device-001",
                  session_id: statusRes.data.session_id,
                  image_url: shot.data.image_base64,
                  thumbnail_url: null,
                  active_app: appRes.data.active_app || "Unknown",
                  active_window: appRes.data.active_window || "Active Window"
                };
                
                await backendApi.post("/api/wfh/screenshot", payload, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                showToast("📸 Admin requested a screenshot — captured and uploaded", "success");
                window.electronAPI?.sendNotification?.("LogDay WFH Audit", "📸 Admin requested a screenshot — captured and uploaded");
              }
              await backendApi.post(`/api/wfh/commands/${cmd.id}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
            } else if (cmd.command === "force_end_session") {
              await stopMonitoring();
              setSession(null);
              showToast("Your WFH session has been remotely terminated by an administrator.", "error");
              await backendApi.post(`/api/wfh/commands/${cmd.id}/complete`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
            }
          }
        }
      } catch (err) {
        console.error("Error polling commands:", err);
      }
    };

    pollCommands();
    commandInterval = setInterval(pollCommands, 5000);
    return () => clearInterval(commandInterval);
  }, [token, session]);

  const handleIncomingSignal = async (sig) => {
    const { sender_email, type, data } = sig;
    const parsedData = JSON.parse(data);

    if (type === "offer") {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      setActiveHuddlePeer(sender_email);
      setIsHuddled(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      } catch (err) {
        console.error("Failed to access mic:", err);
      }

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          await backendApi.post("/api/wfh/meeting/signal", {
            receiver_email: sender_email,
            type: "candidate",
            data: JSON.stringify(event.candidate)
          }, { headers: { Authorization: `Bearer ${token}` } });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(parsedData));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await backendApi.post("/api/wfh/meeting/signal", {
        receiver_email: sender_email,
        type: "answer",
        data: JSON.stringify(answer)
      }, { headers: { Authorization: `Bearer ${token}` } });
    } 
    else if (type === "answer" && pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(parsedData));
    } 
    else if (type === "candidate" && pcRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(parsedData));
      } catch (e) {
        console.error("Ice candidate error:", e);
      }
    }
  };

  const startHuddle = async (peerEmail) => {
    if (isHuddled) return;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcRef.current = pc;
    setActiveHuddlePeer(peerEmail);
    setIsHuddled(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } catch (err) {
      console.error("Mic access failed:", err);
    }

    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await backendApi.post("/api/wfh/meeting/signal", {
          receiver_email: peerEmail,
          type: "candidate",
          data: JSON.stringify(event.candidate)
        }, { headers: { Authorization: `Bearer ${token}` } });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await backendApi.post("/api/wfh/meeting/signal", {
      receiver_email: peerEmail,
      type: "offer",
      data: JSON.stringify(offer)
    }, { headers: { Authorization: `Bearer ${token}` } });
  };

  const leaveHuddle = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setActiveHuddlePeer(null);
    setIsHuddled(false);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Check agent health daemon
  const checkAgent = async () => {
    try {
      const res = await agentApi.get("/health");
      setAgentStatus("active");
      setMessage(res.data);
    } catch (err) {
      setAgentStatus("offline");
      setMessage("Local WFH Agent background daemon is offline. Please launch it.");
    }
  };

  const checkActiveSession = async () => {
    try {
      const clientTimeBefore = Date.now();
      const res = await backendApi.get("/api/wfh/session/active", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const clientTimeAfter = Date.now();
      const clientTime = (clientTimeBefore + clientTimeAfter) / 2;
      
      setSession(res.data.session);
      if (res.data.session && res.data.server_time) {
        const serverTime = new Date(res.data.server_time).getTime();
        setClockSkew(clientTime - serverTime);
      }
      if (res.data.session) {
        let policy = null;
        try {
          const policyRes = await backendApi.get("/api/wfh/policy", {
            headers: { Authorization: `Bearer ${token}` }
          });
          policy = policyRes.data;
          if (policy) {
            localStorage.setItem("wfh_policy", JSON.stringify(policy));
          }
        } catch (policyErr) {
          console.error("Failed to load WFH policy on active check:", policyErr);
        }
        startMonitoring(res.data.session._id, policy);
      }
    } catch (err) {
      console.error("Session active error:", err);
    }
  };

  const handleSmartAttendance = async (base64Image, type) => {
    setLoading(true);
    try {
      let lat = 0;
      let long = 0;
      let address = "Remote Workspace";
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000}));
        lat = pos.coords.latitude;
        long = pos.coords.longitude;
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            address = geoData.display_name || "Remote Workspace";
          }
        } catch (e) {
          console.warn("Reverse geocode error:", e.message);
        }
      } catch (e) {
        console.warn("Location error:", e.message);
      }
      
      let res;
      if (type === "check-in") {
        const payload = {
          device_id: deviceId,
          face_image: base64Image,
          metadata: {
            lat,
            long,
            address,
            wifi_ssid: "",
            wifi_bssid: "",
            wifi_strength: -50.0
          }
        };
        res = await backendApi.post("/api/wfh/checkin", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const sessionId = res.data.session_id;
        const policy = res.data.wfh_policy;
        
        if (res.data.check_in_time) {
          const serverTime = new Date(res.data.check_in_time).getTime();
          setClockSkew(Date.now() - serverTime);
        }
        
        setMessage("Checked-In successfully. Face verified.");
        showToast("Checked In successfully. Biometrics verified.", "success");
        
        if (policy) {
          localStorage.setItem("wfh_policy", JSON.stringify(policy));
        }
        await startMonitoring(sessionId, policy);
      } else {
        const payload = {
          device_id: deviceId,
          session_id: session?._id
        };
        res = await backendApi.post("/api/wfh/checkout", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setMessage("Checked-Out successfully.");
        showToast("Checked Out successfully.", "success");
        
        await stopMonitoring();
      }

      await checkActiveSession();
    } catch (err) {
      setMessage(err.response?.data?.detail || err.message);
      showToast(err.response?.data?.detail || err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const startMonitoring = async (sessionId, policy = null) => {
    try {
      if (!policy) {
        const cachedPolicy = localStorage.getItem("wfh_policy");
        if (cachedPolicy) {
          policy = JSON.parse(cachedPolicy);
        }
      }

      // First save token, session_id and policy to agent
      await agentApi.post("/auth/save", {
        token: token,
        device_id: deviceId,
        session_id: sessionId,
        policy: policy
      }).catch(err => console.error("Agent auth save error:", err));

      await agentApi.post("/auto-sync/start");
      setIsMonitoring(true);
    } catch (err) {
      console.error("Failed to start monitoring:", err);
    }
  };

  const stopMonitoring = async () => {
    try {
      await agentApi.post("/auto-sync/stop");
      await agentApi.post("/auth/clear");
      setIsMonitoring(false);
    } catch (err) {
      console.error("Failed to stop monitoring:", err);
    }
  };

  const triggerAutoCheckout = async () => {
    try {
      setLoading(true);
      showToast("Auto-checkout triggered due to extended inactivity.", "error");
      await backendApi.post("/api/wfh/checkout", {
        device_id: deviceId,
        session_id: session?._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await stopMonitoring();
      await checkActiveSession();
      setMessage("Session auto-closed due to extended idle time.");
    } catch (err) {
      console.error("Auto checkout error:", err);
    } finally {
      setLoading(false);
    }
  };

  const registerDevice = async () => {
    try {
      const hardware = await agentApi.get("/hardware");
      await backendApi.post(
        "/api/wfh/device-info",
        { ...hardware.data, device_id: deviceId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      throw new Error(err.response?.data?.detail || err.message);
    }
  };

  const handleLoginSuccess = async (accessToken, userProfile, organization) => {
    localStorage.setItem("user", JSON.stringify(userProfile));
    localStorage.setItem("org", JSON.stringify(organization));
    setUser(userProfile);
    setOrg(organization);
    setToken(accessToken);
    setCurrentPage("dashboard");
    
    // Auto-register device after login so admin can see it in WFH Devices panel
    try {
      // First fetch hardware info from agent
      const hwRes = await agentApi.get("/hardware").catch(() => null);
      const actualDeviceId = hwRes?.data?.device_id || "wfh-device-001";
      setDeviceId(actualDeviceId);
      setWifiSecured(hwRes?.data?.wifi_secured !== false);
      
      // Register device with backend
      const devicePayload = {
        ...(hwRes?.data || {}),
        device_id: actualDeviceId
      };
      const regRes = await backendApi.post(
        "/api/wfh/device-info",
        devicePayload,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setDeviceStatus(regRes.data?.device_status || "pending");
      if (regRes.data?.device_status === "pending") {
        showToast("Device registered — awaiting admin approval before you can check in.", "error");
      }
    } catch (err) {
      console.warn("Auto device register failed:", err.response?.data?.detail || err.message);
    }
  };

  const handleLogout = async () => {
    setToken("");
    setUser(null);
    setOrg(null);
    setSession(null);
    setIsMonitoring(false);
    setAgentStatus("offline");
    
    try {
      await agentApi.post("/auth/logout");
    } catch (err) {
      // ignore
    }
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      user={user}
      org={org}
      session={session}
      timerString={timerString}
      agentStatus={agentStatus}
      onLogout={handleLogout}
      unreadAlerts={unreadAlerts}
    >
      {currentPage === "dashboard" && (
        <Dashboard
          session={session}
          timerString={timerString}
          productivity={productivity}
          agentStatus={agentStatus}
          deviceId={deviceId}
          deviceStatus={deviceStatus}
          wifiSecured={wifiSecured}
          isMonitoring={isMonitoring}
          webcamPreview={webcamPreview}
          setWebcamPreview={setWebcamPreview}
          webcamImage={webcamImage}
          loading={loading}
          onCheckIn={(img) => handleSmartAttendance(img, 'check-in')}
          onCheckOut={(img) => handleSmartAttendance(img, 'check-out')}
          onStartMonitoring={() => startMonitoring(session?._id)}
          onStopMonitoring={() => stopMonitoring()}
          onCheckAgent={checkAgent}
          wellnessNudge={wellnessNudge}
          setWellnessNudge={setWellnessNudge}
        />
      )}

      {currentPage === "screenshots" && (
        <Screenshots token={token} user={user} />
      )}

      {currentPage === "productivity" && (
        <Productivity token={token} />
      )}

      {currentPage === "leaves" && (
        <Leaves token={token} user={user} />
      )}

      {currentPage === "tasks" && (
        <Tasks token={token} />
      )}

      {currentPage === "watercooler" && (
        <Watercooler
          teamMembers={teamMembers}
          isHuddled={isHuddled}
          activeHuddlePeer={activeHuddlePeer}
          isMuted={isMuted}
          onStartHuddle={startHuddle}
          onLeaveHuddle={leaveHuddle}
          onToggleMute={toggleMute}
        />
      )}

      {currentPage === "settings" && (
        <Settings
          token={token}
          deviceId={deviceId}
          wifiSecured={wifiSecured}
          onRegisterDevice={registerDevice}
        />
      )}

      {currentPage === "notifications" && (
        <Notifications token={token} />
      )}

      {/* Audio player for incoming streams */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: "none" }} />

      {/* Modern Glassmorphic Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-slide-in ${
          toast.type === "error" 
            ? "bg-rose-950/80 border-rose-500/30 text-rose-200 shadow-rose-950/20" 
            : "bg-emerald-950/80 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20"
        }`}>
          {toast.type === "error" ? (
            <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <span className="font-bold text-xs">!</span>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <span className="font-bold text-xs">✓</span>
            </div>
          )}
          <div className="text-xs font-bold leading-normal">{toast.text}</div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white ml-2 text-xs font-semibold shrink-0">
            ✕
          </button>
        </div>
      )}
    </Layout>
  );
}

const FALLBACK_WEBCAM_MOCK = (
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
);