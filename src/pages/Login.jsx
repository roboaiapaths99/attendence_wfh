import { useState, useEffect, useRef } from "react";
import { backendApi, agentApi } from "../api";
import { 
  Shield, Compass, User, Key, ArrowLeft, Loader2, Camera, ShieldCheck, CheckCircle
} from "lucide-react";

export default function Login({ onLoginSuccess }) {
  const [authStep, setAuthStep] = useState(1); 
  // 1 = Org search, 2 = Credentials, 3 = Password Reset, 4 = Face Enrollment, 5 = Ready/Success
  
  const [orgSearchQuery, setOrgSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  
  // Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Password Reset
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Face Enrollment
  const [webcamActive, setWebcamActive] = useState(true);
  const [capturedImage, setCapturedImage] = useState("");
  const [webcamStream, setWebcamStream] = useState(null);
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [loginResponse, setLoginResponse] = useState(null);
  
  const videoRef = useRef(null);

  // Search Organizations
  const searchOrgs = async (query) => {
    setOrgSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await backendApi.get(`/organizations/search?q=${encodeURIComponent(query.trim())}`);
      
      // Handle both old format (array) and new format (object with results)
      let results = [];
      if (Array.isArray(res.data)) {
        results = res.data;
      } else if (res.data?.results && Array.isArray(res.data.results)) {
        results = res.data.results;
      }
      
      console.log(`[ORG-SEARCH] Query: "${query.trim()}" | Results: ${results.length}`, results);
      setSearchResults(results);
      
      if (results.length === 0 && query.trim().length >= 2) {
        setError(`No organizations found for "${query.trim()}". Please check the spelling.`);
      }
    } catch (err) {
      console.error("[ORG-SEARCH] Error:", err);
      setError(`Search error: ${err.response?.data?.error || err.message || "Unable to search organizations"}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectOrg = (org) => {
    setSelectedOrg(org);
    setAuthStep(2);
    setError("");
  };

  const goBackToOrgSearch = () => {
    setSelectedOrg(null);
    setSearchResults([]);
    setOrgSearchQuery("");
    setAuthStep(1);
    setError("");
  };

  // Step 2: Regular Login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const orgId = selectedOrg?.id || selectedOrg?._id;
      
      // Fetch actual hardware device ID from local agent to prevent "bound to another device" mismatches
      let actualDeviceId = "wfh-device-001";
      try {
        const hwRes = await agentApi.get("/hardware").catch(() => null);
        if (hwRes?.data?.device_id) {
          actualDeviceId = hwRes.data.device_id;
        }
      } catch (hwErr) {
        console.warn("Failed to retrieve actual device ID from agent:", hwErr);
      }

      const res = await backendApi.post("/login", {
        email: email.trim(),
        password,
        organization_id: orgId,
        device_id: actualDeviceId
      });

      const data = res.data;
      setToken(data.access_token);
      setLoginResponse(data);

      // Save auth token in local WFH Agent
      await agentApi.post("/auth/save", {
        token: data.access_token,
        device_id: actualDeviceId
      }).catch(() => null);

      // Flow orchestrator based on backend response
      if (data.force_password_change) {
        setAuthStep(3); // Password Reset Step
      } else if (data.needs_face_enrollment) {
        setAuthStep(4); // Face Enrollment Step
      } else {
        // All set! Save token/user and notify parent
        onLoginSuccess(data.access_token, data.user, selectedOrg);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Password Reset Flow
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError("Please fill out all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await backendApi.post(
        "/api/me/change-password",
        {
          old_password: password,
          new_password: newPassword
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Check next step
      if (res.data.needs_face_enrollment) {
        setAuthStep(4);
      } else {
        onLoginSuccess(token, loginResponse.user, selectedOrg);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Face Enrollment Webcam startup
  useEffect(() => {
    if (authStep === 4 && webcamActive) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [authStep, webcamActive]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      setWebcamStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Mic/Webcam start failed:", err);
      // Fallback template image
      setCapturedImage(FALLBACK_WEBCAM_MOCK);
    }
  };

  const stopWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImage(dataUrl);
      setWebcamActive(false);
    } else {
      setCapturedImage(FALLBACK_WEBCAM_MOCK);
      setWebcamActive(false);
    }
  };

  const handleEnrollFace = async () => {
    if (!capturedImage) return;
    setLoading(true);
    setError("");
    try {
      await backendApi.post(
        "/api/employee/update-face",
        { face_image: capturedImage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAuthStep(5); // Complete screen
      setTimeout(() => {
        onLoginSuccess(token, loginResponse.user, selectedOrg);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to process face embedding");
      // Reactivate webcam to try again
      setWebcamActive(true);
      setCapturedImage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#020617] via-[#0a1128] to-[#020617] text-slate-100 font-sans p-6">
      <div className="w-full max-w-md space-y-6">
        
        {/* Gateway Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/10">
            <Shield size={28} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white leading-none">LogDay WFH</h1>
            <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Enterprise Gateway</span>
          </div>
        </div>

        {/* Step 1: Find Organization */}
        {authStep === 1 && (
          <div className="bg-slate-950/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-7 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-white">Find Your Organization</h3>
              <p className="text-[10px] text-slate-500 mt-1">Search company name to connect to your workspace branding.</p>
            </div>

            <div className="relative">
              <Compass size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" />
              <input
                className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Search company name..."
                value={orgSearchQuery}
                onChange={(e) => searchOrgs(e.target.value)}
                autoFocus
              />
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Select Your Workspace</span>
                {searchResults.map((org) => (
                  <button
                    key={org.id || org._id}
                    onClick={() => selectOrg(org)}
                    className="w-full bg-slate-900/40 hover:bg-indigo-500/10 border border-slate-800/50 hover:border-indigo-500/30 p-3.5 rounded-2xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
                  >
                    {org.logo_url ? (
                      <img src={org.logo_url} className="w-9 h-9 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold text-sm">
                        {org.name?.[0] || "O"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-white block truncate">{org.name}</span>
                      {org.slug && <span className="text-[9px] text-slate-500 font-mono truncate block">{org.slug}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {orgSearchQuery.trim().length >= 2 && searchResults.length === 0 && !loading && (
              <div className="text-center p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                <span className="text-[10px] text-rose-400 font-medium">No organizations found. Check your spelling.</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-3">
                <Loader2 size={14} className="text-indigo-400 animate-spin" />
                <span className="text-[10px] text-slate-400 font-semibold">Searching...</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Employee Credentials */}
        {authStep === 2 && selectedOrg && (
          <div className="bg-slate-950/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/50 pb-4">
              <div className="flex items-center gap-3">
                {selectedOrg.logo_url ? (
                  <img src={selectedOrg.logo_url} className="w-10 h-10 rounded-xl object-contain bg-slate-950 p-1 border border-slate-800" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-extrabold">
                    {selectedOrg.name?.[0] || "O"}
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-extrabold text-white">{selectedOrg.name}</h3>
                  <span className="text-[9px] text-slate-500">{selectedOrg.slug || "Workspace"}</span>
                </div>
              </div>
              <button onClick={goBackToOrgSearch} className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-400 transition-colors">
                <ArrowLeft size={12} /> Change
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Employee Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="relative">
                <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                <p className="text-[11px] text-rose-400 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Authorizing...</> : "Authorize Workstation"}
            </button>
          </div>
        )}

        {/* Step 3: Password Reset */}
        {authStep === 3 && (
          <div className="bg-slate-950/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-7 space-y-5 shadow-2xl">
            <div>
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">First-Time Sign In</span>
              <h3 className="text-sm font-bold text-white">Reset Default Password</h3>
              <p className="text-[10px] text-slate-500 mt-1">To secure your workstation logs, please establish a personal password credential.</p>
            </div>

            <form onSubmit={handlePasswordReset} className="space-y-3.5">
              <div className="relative">
                <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Enter New Password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="relative">
                <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  className="w-full bg-slate-900/80 border border-slate-700/60 rounded-2xl py-3.5 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Confirm New Password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-[11px] text-rose-400 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Saving password...</> : "Update Password"}
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Face Biometric Enrollment */}
        {authStep === 4 && (
          <div className="bg-slate-950/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-7 space-y-5 shadow-2xl text-center">
            <div className="text-left">
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Step 2 of Security Setup</span>
              <h3 className="text-sm font-bold text-white">Enroll Face Biometrics</h3>
              <p className="text-[10px] text-slate-500 mt-1">Register your biometric face structure. This is required for workstation Check-In and Check-Out clearance validation.</p>
            </div>

            {/* Webcam / Captured Frame Preview */}
            <div className="relative aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {webcamActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <button
                      onClick={capturePhoto}
                      className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all shadow shadow-indigo-500/20"
                    >
                      <Camera size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img
                    src={capturedImage.startsWith("data:image") ? capturedImage : `data:image/jpeg;base64,${capturedImage}`}
                    className="w-full h-full object-cover transform scale-x-[-1]"
                    alt="Captured face biometric"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                    <button
                      onClick={() => {
                        setCapturedImage("");
                        setWebcamActive(true);
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition-all"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleEnrollFace}
                      disabled={loading}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all flex items-center gap-1.5"
                    >
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Register Face
                    </button>
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 text-left">
                <p className="text-[11px] text-rose-400 font-medium">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Success gateway check */}
        {authStep === 5 && (
          <div className="bg-slate-950/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-12 text-center space-y-4 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto animate-[bounce_1s_infinite]" />
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Gateway Authorized</h3>
              <p className="text-[10px] text-slate-400 mt-2">Biometrics enrolled & password keys synchronized. Initializing workplace dashboard...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FALLBACK_WEBCAM_MOCK = (
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
);
