import { useState, useEffect, useRef } from "react";
import { 
  CheckSquare, Plus, Clock, Play, Square, Check, Trash2, ListTodo, AlertCircle 
} from "lucide-react";
import { backendApi } from "../api";

export default function Tasks({ token }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [showAddForm, setShowAddForm] = useState(false);

  // Tracking State
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [trackedSeconds, setTrackedSeconds] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data || []);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await backendApi.post(
        "/api/tasks",
        {
          title: title.trim(),
          description: description.trim(),
          priority: priority,
          status: "todo"
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTitle("");
      setDescription("");
      setPriority("medium");
      setShowAddForm(false);
      await fetchTasks();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    // If we were tracking this task and it's marked completed or todo, stop tracking first
    if (activeTaskId === taskId && newStatus !== "in_progress") {
      stopTimeTracking();
    }

    try {
      await backendApi.put(
        `/api/tasks/${taskId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTasks();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Time Tracking Functions
  const startTimeTracking = (task) => {
    if (activeTaskId) {
      // Stop tracking previous task first
      stopTimeTracking();
    }

    setActiveTaskId(task._id);
    setTrackedSeconds(0);

    // If starting tracking, also set task status to in_progress automatically
    if (task.status !== "in_progress") {
      handleUpdateStatus(task._id, "in_progress");
    }

    timerRef.current = setInterval(() => {
      setTrackedSeconds(prev => prev + 1);
    }, 1000);
  };

  const stopTimeTracking = async () => {
    if (!activeTaskId || !timerRef.current) return;

    clearInterval(timerRef.current);
    timerRef.current = null;

    const minutesWorked = Math.ceil(trackedSeconds / 60);
    const targetTask = tasks.find(t => t._id === activeTaskId);
    const currentWorkedMinutes = targetTask ? targetTask.worked_minutes || 0 : 0;
    const totalMinutes = currentWorkedMinutes + minutesWorked;

    const taskId = activeTaskId;
    setActiveTaskId(null);
    setTrackedSeconds(0);

    try {
      await backendApi.put(
        `/api/tasks/${taskId}`,
        { worked_minutes: totalMinutes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTasks();
    } catch (err) {
      console.error("Failed to save tracked time:", err);
    }
  };

  const formatTrackedTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const getPriorityBadge = (p) => {
    if (p === "high") return "bg-rose-500/10 text-rose-400 border-rose-500/25";
    if (p === "medium") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/25";
    return "bg-slate-800 text-slate-400 border-slate-700/60";
  };

  const getStatusColor = (s) => {
    if (s === "completed") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    if (s === "in_progress") return "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
    return "bg-slate-900 border-slate-800 text-slate-400";
  };

  // Group tasks
  const todoTasks = tasks.filter(t => t.status === "todo");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const completedTasks = tasks.filter(t => t.status === "completed");

  const activeTask = tasks.find(t => t._id === activeTaskId);

  return (
    <div className="p-8 space-y-8 flex-1 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <CheckSquare className="text-indigo-400" size={24} /> Workstation Tasks
            </h1>
            <p className="text-slate-400 text-xs mt-1">Assign, track, and log dynamic work minutes against specific project task boards.</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 flex items-center gap-1.5"
          >
            <Plus size={14} /> New Task Card
          </button>
        </div>

        {/* Live Timer Banner for Active Task */}
        {activeTaskId && activeTask && (
          <div className="bg-gradient-to-r from-indigo-950/80 to-slate-950/80 border border-indigo-500/30 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md animate-pulse shadow-xl shadow-indigo-950/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Clock className="animate-spin" size={20} />
              </div>
              <div>
                <span className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest block">Currently Tracking Task</span>
                <h4 className="text-sm font-bold text-white mt-0.5">{activeTask.title}</h4>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Time Logged</span>
                <span className="font-mono text-xl font-extrabold text-indigo-400 block mt-0.5">{formatTrackedTime(trackedSeconds)}</span>
              </div>
              <button
                onClick={stopTimeTracking}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Square size={12} fill="white" /> Stop Tracking
              </button>
            </div>
          </div>
        )}

        {/* Add Task Form Dialog Box */}
        {showAddForm && (
          <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-6 shadow-2xl animate-slide-in">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4">Create New Task Board</h3>
            <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs font-semibold text-slate-400">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="What are you working on?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Priority Weight</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-3">
                <label className="text-[10px] text-slate-500 uppercase tracking-wider">Detailed Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Add additional context or requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/10 disabled:opacity-40"
                >
                  {submitting ? "Adding..." : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Task Columns (Todo, In Progress, Completed) */}
        {loading && tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className="text-xs text-slate-400 font-medium">Loading workstation logs...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Todo Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <ListTodo size={16} className="text-slate-500" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">To Do ({todoTasks.length})</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {todoTasks.map(task => (
                  <div key={task._id} className="bg-slate-950/40 border border-slate-900 p-4.5 rounded-2xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-[9px] font-mono text-slate-600">Logged: {task.worked_minutes || 0}m</span>
                      </div>
                      <h4 className="text-xs font-bold text-white">{task.title}</h4>
                      {task.description && (
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2 border-t border-slate-900/60 pt-3 mt-1">
                      <button
                        onClick={() => startTimeTracking(task)}
                        className="flex-1 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                      >
                        <Play size={10} fill="currentColor" /> Start Track
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(task._id, "completed")}
                        className="p-1.5 border border-slate-800 hover:bg-emerald-950/20 hover:border-emerald-500/30 text-slate-500 hover:text-emerald-400 rounded-xl transition-all active:scale-95"
                        title="Mark complete"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {todoTasks.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-slate-900 rounded-2xl text-[10px] text-slate-600 font-medium">
                    No pending todo items.
                  </div>
                )}
              </div>
            </div>

            {/* 2. In Progress Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <Clock size={16} className="text-indigo-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">In Progress ({inProgressTasks.length})</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {inProgressTasks.map(task => {
                  const isTracking = activeTaskId === task._id;
                  return (
                    <div key={task._id} className={`bg-slate-950/40 border p-4.5 rounded-2xl flex flex-col justify-between space-y-3 transition-colors ${
                      isTracking ? "border-indigo-500/35 bg-indigo-950/5" : "border-slate-900"
                    }`}>
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">Logged: {task.worked_minutes || 0}m</span>
                        </div>
                        <h4 className="text-xs font-bold text-white">{task.title}</h4>
                        {task.description && (
                          <p className="text-[10px] text-slate-400 mt-1 leading-normal line-clamp-2">{task.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 border-t border-slate-900/60 pt-3 mt-1">
                        {isTracking ? (
                          <button
                            onClick={stopTimeTracking}
                            className="flex-1 py-1.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Square size={10} fill="currentColor" /> Stop Track
                          </button>
                        ) : (
                          <button
                            onClick={() => startTimeTracking(task)}
                            className="flex-1 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <Play size={10} fill="currentColor" /> Resume Track
                          </button>
                        )}
                        <button
                          onClick={() => handleUpdateStatus(task._id, "completed")}
                          className="px-3 py-1.5 border border-slate-800 hover:bg-emerald-950/20 hover:border-emerald-500/30 text-slate-500 hover:text-emerald-400 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-0.5 active:scale-95"
                        >
                          <Check size={10} /> Done
                        </button>
                      </div>
                    </div>
                  );
                })}
                {inProgressTasks.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-slate-900 rounded-2xl text-[10px] text-slate-600 font-medium">
                    No active tasks currently.
                  </div>
                )}
              </div>
            </div>

            {/* 3. Completed Column */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
                <CheckSquare size={16} className="text-emerald-400" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">Completed ({completedTasks.length})</h3>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {completedTasks.map(task => (
                  <div key={task._id} className="bg-slate-950/40 border border-slate-900/60 p-4.5 rounded-2xl flex flex-col justify-between space-y-3 opacity-70 hover:opacity-100 transition-opacity">
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          done
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400 font-bold">Total: {task.worked_minutes || 0}m</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-300 line-through">{task.title}</h4>
                    </div>
                    <div className="flex gap-2 border-t border-slate-900/60 pt-3 mt-1">
                      <button
                        onClick={() => handleUpdateStatus(task._id, "todo")}
                        className="flex-1 py-1.5 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold transition-all active:scale-95"
                      >
                        Re-open Task
                      </button>
                    </div>
                  </div>
                ))}
                {completedTasks.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-slate-900 rounded-2xl text-[10px] text-slate-600 font-medium">
                    No completed items logged.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Footer Alert */}
      <div className="bg-slate-950/20 rounded-2xl p-4 border border-slate-900 flex items-start gap-3 mt-8 shrink-0">
        <AlertCircle className="text-slate-500 mt-0.5 shrink-0" size={16} />
        <div className="text-[10px] text-slate-400 leading-relaxed font-medium">
          Workstation Task tracking logs active session minutes directly inside MongoDB task boards. 
          Admins can inspect active time counters, priority weights, and completed structures from the management terminal.
        </div>
      </div>
    </div>
  );
}
