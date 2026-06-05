import { useState, useEffect, useRef } from "react";
import { CalendarDays, Plus, MessageSquare, Send, Check, X, FileText, Loader2 } from "lucide-react";
import { backendApi } from "../api";

export default function Leaves({ token, user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Leave form state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState("sick");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [proofBase64, setProofBase64] = useState("");

  // Discussion state
  const [activeRequest, setActiveRequest] = useState(null);
  const [discussion, setDiscussion] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  useEffect(() => {
    if (activeRequest) {
      fetchDiscussion(activeRequest._id);
      const interval = setInterval(() => {
        fetchDiscussion(activeRequest._id, true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeRequest]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [discussion]);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/api/leave/my-requests", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch leaves:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscussion = async (requestId, silent = false) => {
    if (!silent) setLoadingChat(true);
    try {
      const res = await backendApi.get(`/api/leave/requests/${requestId}/discussion`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDiscussion(res.data || []);
    } catch (err) {
      console.error("Failed to load chat:", err);
    } finally {
      if (!silent) setLoadingChat(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) return;

    setSubmitting(true);
    try {
      await backendApi.post(
        "/api/leave/request",
        {
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
          proof_url: proofBase64 || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Reset form
      setLeaveType("sick");
      setStartDate("");
      setEndDate("");
      setReason("");
      setProofBase64("");
      setShowApplyModal(false);

      // Refresh list
      await fetchMyRequests();
    } catch (err) {
      console.error("Failed to submit leave:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRequest) return;

    setSendingMsg(true);
    try {
      await backendApi.post(
        `/api/leave/requests/${activeRequest._id}/message`,
        { message: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewMessage("");
      await fetchDiscussion(activeRequest._id, true);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-8 flex gap-8 flex-1 overflow-hidden h-full max-h-screen">
      
      {/* Main Left: Requests List */}
      <div className="flex-1 flex flex-col min-w-0 space-y-6 overflow-y-auto pr-2">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <CalendarDays className="text-indigo-400" size={24} /> Leave & OD Requests
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Apply for leave, register On-Duty tasks, and trace managers' feedback discussions.
            </p>
          </div>
          <button
            onClick={() => setShowApplyModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 flex items-center gap-1.5"
          >
            <Plus size={14} /> Apply Clearance
          </button>
        </div>

        {/* Requests List */}
        <div className="bg-slate-950/20 border border-slate-900 rounded-3xl p-6 flex-1 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Syncing Leave Logs...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="text-slate-600 mb-3" size={32} />
              <h3 className="text-sm font-bold text-white">No Requests Found</h3>
              <p className="text-[10px] text-slate-500 max-w-[280px] mt-1 leading-normal">
                You haven't filed any leave or on-duty clearance applications in this work cycle.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const isActive = activeRequest?._id === req._id;
                return (
                  <div
                    key={req._id}
                    onClick={() => setActiveRequest(req)}
                    className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-indigo-600/10 border-indigo-500/30 shadow-md shadow-indigo-500/2"
                        : "bg-slate-950/40 border-slate-900/60 hover:border-slate-800/80"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          req.leave_type === "sick" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          req.leave_type === "casual" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          req.leave_type === "on_duty" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                          "bg-slate-800 text-slate-400"
                        }`}>
                          {req.leave_type === "on_duty" ? "On-Duty Clear" : `${req.leave_type} Leave`}
                        </span>
                        <h4 className="text-xs font-bold text-white mt-2">
                          {req.start_date} to {req.end_date}
                        </h4>
                      </div>

                      <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        req.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        req.status === "rejected" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                        "bg-slate-900/60 text-slate-400 border-slate-800"
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {req.reason}
                    </p>

                    <div className="flex items-center gap-3 pt-3 border-t border-slate-900/60 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} className="text-indigo-400" />
                        <strong>{req.discussion?.length || 0}</strong> messages
                      </span>
                      {req.proof_url && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <FileText size={12} />
                          Medical proof attached
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Chat Panel */}
      {activeRequest && (
        <div className="w-[360px] bg-slate-950/40 border border-slate-900 rounded-3xl flex flex-col overflow-hidden h-full">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-900 bg-slate-950/60 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-xs font-extrabold text-white leading-none">Review Discussion</h3>
              <span className="text-[9px] text-slate-500 block mt-1">Request ID: {activeRequest._id.slice(-6)}</span>
            </div>
            <button 
              onClick={() => setActiveRequest(null)}
              className="text-slate-500 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* System/Request Details Card inside Chat */}
            <div className="bg-slate-900/40 border border-slate-900 p-3.5 rounded-2xl space-y-1.5">
              <span className="text-[9px] uppercase font-bold text-indigo-400 block tracking-wider">Leave Context</span>
              <p className="text-[11px] text-slate-300 font-semibold leading-normal">{activeRequest.reason}</p>
            </div>

            {loadingChat ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : discussion.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[10px] text-slate-500">No messages in this request slot yet. Send a note to the operations team below.</p>
              </div>
            ) : (
              discussion.map((msg, idx) => {
                const isMe = msg.sender_id === user?.email;
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-bold text-slate-500">{msg.sender_name}</span>
                      <span className="text-[8px] text-slate-600">({msg.role})</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                      isMe 
                        ? "bg-indigo-600 text-white rounded-tr-none" 
                        : "bg-slate-900 border border-slate-850 text-slate-200 rounded-tl-none"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChatMessage} className="p-4 bg-slate-950/60 border-t border-slate-900 shrink-0">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="Enter discussion message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={sendingMsg || !newMessage.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shadow shadow-indigo-500/10 flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Apply Leave Modal overlay */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-950 border border-slate-900 p-6 rounded-3xl shadow-2xl relative space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">File Attendance Clearance</h2>
              <button 
                onClick={() => setShowApplyModal(false)}
                className="text-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs font-semibold text-slate-400">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Clearance Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="on_duty">On-Duty Clearance (OD)</option>
                  <option value="other">Other Clearance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Clearance Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explain justification for leave/on-duty requests..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Medical/Clearance Proof (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none cursor-pointer text-[10px]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-extrabold uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 mt-2 flex items-center justify-center gap-1.5"
              >
                {submitting ? "Submitting Clearance..." : "File Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
