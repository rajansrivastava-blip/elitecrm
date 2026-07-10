import React, { useState, useMemo } from "react";
import { Appointment, Lead, User as AppUser } from "../types";
import { 
  Plus, 
  Calendar, 
  Clock, 
  Mail, 
  MapPin, 
  Video, 
  Check, 
  Bell, 
  BellOff, 
  Trash2, 
  Edit3, 
  X,
  User,
  AlertCircle,
  FileText
} from "lucide-react";


const sanitizeDateForInput = (dateStr: string): string => {
  if (!dateStr) return "";
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? dateStr : "";
};

const sanitizeTimeForInput = (timeStr: string): string => {
  if (!timeStr) return "";
  const match = timeStr.match(/^\d{2}:\d{2}$/);
  return match ? timeStr : "";
};

interface AppointmentsListProps {
  appointments: Appointment[];
  leads: Lead[];
  users: AppUser[];
  currentUser: AppUser | null;
  onAddAppointment: (app: Omit<Appointment, "id" | "isCompleted">) => void;
  onUpdateAppointment: (app: Appointment) => void;
  onDeleteAppointment: (id: string, skipConfirm?: boolean) => void;
  darkMode: boolean;
  onClearAllAppointments?: () => void;
  triggerConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert?: (title: string, message: string) => void;
}

export default function AppointmentsList({
  appointments,
  leads,
  users,
  currentUser,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  darkMode,
  onClearAllAppointments,
  triggerConfirm,
  triggerAlert
}: AppointmentsListProps) {
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Appointment | null>(null);
  const [reminderFilter, setReminderFilter] = useState<"all" | "overdue" | "due_today" | "pending" | "upcoming">("all");

  const [selectedTL, setSelectedTL] = useState<string>(() => {
    if (currentUser && currentUser.role === "team_leader") {
      return currentUser.id;
    }
    return "all";
  });
  const [selectedAgentName, setSelectedAgentName] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedBudget, setSelectedBudget] = useState<string>("all");

  const [projectSearchQuery, setProjectSearchQuery] = useState<string>("");
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>("");
  const [budgetMinQuery, setBudgetMinQuery] = useState<string>("");
  const [budgetMaxQuery, setBudgetMaxQuery] = useState<string>("");

  // Dynamic lists of unique values from visible leads for filter selects
  const projectsPool = useMemo(() => {
    const leadNames = new Set(leads.map(l => l.name.toLowerCase().trim()));
    const userNames = new Set((users || []).map(u => u.name.toLowerCase().trim()));
    return Array.from(new Set(leads.map(l => l.projectName || "").filter(Boolean)))
      .filter(proj => {
        const projLower = proj.toLowerCase().trim();
        return !leadNames.has(projLower) && !userNames.has(projLower);
      })
      .sort();
  }, [leads, users]);

  const locationsPool = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.location || "").filter(Boolean))).sort();
  }, [leads]);

  const budgetsPool = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.budget || "").filter(Boolean))).sort();
  }, [leads]);

  // Reset agent filter when TL filter changes to ensure consistent display
  const handleTLChange = (tlId: string) => {
    setSelectedTL(tlId);
    setSelectedAgentName("all");
  };

  // Get list of TL users for Super Admin / Admin dropdowns
  const tlUsers = useMemo(() => {
    return users.filter(u => u.role === "team_leader" && u.active !== false);
  }, [users]);

  // Get list of Sales Team users based on currentUser role and selected TL
  const salesUsers = useMemo(() => {
    if (!currentUser) return [];
    
    // Only return active sales advisors
    const activeUsers = users.filter(u => u.active !== false);
    
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      if (selectedTL === "all") {
        return activeUsers.filter(u => u.role === "sales_team");
      } else {
        return activeUsers.filter(u => u.role === "sales_team" && u.teamLeaderId === selectedTL);
      }
    }
    
    if (currentUser.role === "team_leader") {
      // TL can only see their team members
      return activeUsers.filter(u => u.role === "sales_team" && u.teamLeaderId === currentUser.id);
    }
    
    return [];
  }, [users, currentUser, selectedTL]);

  // Expand with team leader themselves if applicable
  const salesUsersOptions = useMemo(() => {
    if (!currentUser) return [];
    const pool = [...salesUsers];
    if (currentUser.role === "team_leader") {
      // Add TL themselves to the filter list so they can view only their own reminders
      pool.unshift(currentUser);
    }
    return pool;
  }, [salesUsers, currentUser]);

  // Form State
  const [newAppForm, setNewAppForm] = useState({
    leadId: "",
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00",
    type: "meeting" as Appointment["type"],
    notes: "",
    reminderActive: true
  });

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppForm.title) return;
    
    // Find matching lead name if appropriate
    let selectedLeadName = "";
    if (newAppForm.leadId) {
      const found = leads.find(l => l.id === newAppForm.leadId);
      if (found) {
        selectedLeadName = found.name;
      }
    }

    onAddAppointment({
      leadId: newAppForm.leadId || undefined,
      leadName: selectedLeadName || undefined,
      title: newAppForm.title,
      date: newAppForm.date,
      time: newAppForm.time,
      type: newAppForm.type,
      notes: newAppForm.notes,
      reminderActive: newAppForm.reminderActive
    });

    // Reset Form
    setNewAppForm({
      leadId: "",
      title: "",
      date: new Date().toISOString().split("T")[0],
      time: "10:00",
      type: "meeting",
      notes: "",
      reminderActive: true
    });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    // Resolve lead name if changed
    let updatedLeadName = editingApp.leadName;
    if (editingApp.leadId) {
      const found = leads.find(l => l.id === editingApp.leadId);
      if (found) {
        updatedLeadName = found.name;
      }
    } else {
      updatedLeadName = undefined;
    }

    onUpdateAppointment({
      ...editingApp,
      leadName: updatedLeadName
    });
    setEditingApp(null);
  };

  // Helper styles for Appointment Types
  const getTypeMeta = (type: Appointment["type"]) => {
    switch (type) {
      case "site_visit":
        return { label: "Site Tour Alignment", color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20", icon: MapPin };
      case "meeting":
        return { label: "Executive Alignment Meeting", color: "bg-teal-500/10 text-teal-400 border border-teal-500/20", icon: User };
      case "call":
        return { label: "Strategy Alignment Call", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20", icon: Video };
      case "followup":
        return { label: "Prospective Follow-up", color: "bg-purple-500/10 text-purple-400 border border-purple-500/20", icon: FileText };
    }
  };

  // Get current date string in UTC / local standard to detect today
  const SYSTEM_CURRENT_DATE = new Date().toISOString().split("T")[0]; 

  // Snooze function to add 1 day to the date (YYYY-MM-DD format)
  const snoozeAppointmentOneDay = (app: Appointment) => {
    try {
      const currentDate = new Date(app.date);
      if (isNaN(currentDate.getTime())) {
        const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
        onUpdateAppointment({
          ...app,
          date: tomorrowStr
        });
        return;
      }
      currentDate.setDate(currentDate.getDate() + 1);
      const nextDateStr = currentDate.toISOString().split("T")[0];
      onUpdateAppointment({
        ...app,
        date: nextDateStr
      });
    } catch (e) {
      console.error("Failed to postpone reminder:", e);
    }
  };

  // Helper to parse capital budget string values into a numeric amount in Crores (Cr)
  const parseBudgetValue = (b: string): number => {
    if (!b) return 0;
    const sanitized = b
      .replace(/â\u0082¹/g, "₹")
      .replace(/â‚¹/g, "₹")
      .replace(/â\u0082/g, "₹")
      .replace(/â\u0092¹/g, "₹")
      .replace(/â\u0092/g, "₹");
    const cleaned = sanitized.replace(/[₹$cr\sM]/gi, "");
    const val = parseFloat(cleaned);
    if (!isNaN(val)) {
      if (b.toLowerCase().includes("lakh") || b.toLowerCase().includes("l")) {
        return val / 100; // normalize and scale down to Cr
      }
      return val;
    }
    return 0;
  };

  // Filter appointments by Team & Agent hierarchy first
  const teamFilteredApps = useMemo(() => {
    return appointments.filter(app => {
      const lead = leads.find(l => l.id === app.leadId);
      if (!lead) {
        // Safe-fallback for general items if no specific filters are chosen
        return (
          selectedTL === "all" &&
          selectedAgentName === "all" &&
          selectedProject === "all" &&
          selectedLocation === "all" &&
          selectedBudget === "all" &&
          projectSearchQuery.trim() === "" &&
          locationSearchQuery.trim() === "" &&
          budgetMinQuery.trim() === "" &&
          budgetMaxQuery.trim() === ""
        );
      }

      const agentUser = users.find(u => u.name.toLowerCase() === lead.assignedAgent.toLowerCase());

      // TL Filter check
      if (selectedTL !== "all") {
        if (!agentUser) return false;
        const isAgentThatTL = agentUser.role === 'team_leader' && agentUser.id === selectedTL;
        const isUnderThatTL = agentUser.teamLeaderId === selectedTL;
        if (!isAgentThatTL && !isUnderThatTL) return false;
      }

      // Advisor Filter check
      if (selectedAgentName !== "all") {
        if (lead.assignedAgent.toLowerCase() !== selectedAgentName.toLowerCase()) {
          return false;
        }
      }

      // Project Filter check
      if (selectedProject !== "all") {
        if ((lead.projectName || "").toLowerCase() !== selectedProject.toLowerCase()) {
          return false;
        }
      }
      if (projectSearchQuery.trim() !== "") {
        if (!(lead.projectName || "").toLowerCase().includes(projectSearchQuery.trim().toLowerCase())) {
          return false;
        }
      }

      // Location Filter check
      if (selectedLocation !== "all") {
        if ((lead.location || "").toLowerCase() !== selectedLocation.toLowerCase()) {
          return false;
        }
      }
      if (locationSearchQuery.trim() !== "") {
        if (!(lead.location || "").toLowerCase().includes(locationSearchQuery.trim().toLowerCase())) {
          return false;
        }
      }

      // Budget Filter check
      if (selectedBudget !== "all") {
        if ((lead.budget || "").toLowerCase() !== selectedBudget.toLowerCase()) {
          return false;
        }
      }

      // Budget Range Filter Check (Min / Max in Crores)
      if (budgetMinQuery.trim() !== "" || budgetMaxQuery.trim() !== "") {
        const leadBudgetValue = parseBudgetValue(lead.budget || "");
        if (budgetMinQuery.trim() !== "") {
          const minVal = parseFloat(budgetMinQuery);
          if (!isNaN(minVal) && leadBudgetValue < minVal) return false;
        }
        if (budgetMaxQuery.trim() !== "") {
          const maxVal = parseFloat(budgetMaxQuery);
          if (!isNaN(maxVal) && leadBudgetValue > maxVal) return false;
        }
      }

      return true;
    });
  }, [
    appointments, 
    selectedTL, 
    selectedAgentName, 
    selectedProject, 
    selectedLocation, 
    selectedBudget, 
    projectSearchQuery, 
    locationSearchQuery, 
    budgetMinQuery, 
    budgetMaxQuery, 
    leads, 
    users
  ]);

  const overdueCount = teamFilteredApps.filter(app => !app.isCompleted && app.date < SYSTEM_CURRENT_DATE).length;
  const dueTodayCount = teamFilteredApps.filter(app => app.date === SYSTEM_CURRENT_DATE && !app.isCompleted).length;
  const pendingCount = teamFilteredApps.filter(app => !app.isCompleted).length;
  const upcomingCount = teamFilteredApps.filter(app => !app.isCompleted && app.date > SYSTEM_CURRENT_DATE).length;
  const allCount = teamFilteredApps.length;

  // Filtered appointments list for rendering
  const filteredApps = useMemo(() => {
    return teamFilteredApps.filter(app => {
      if (reminderFilter === "overdue") {
        return !app.isCompleted && app.date < SYSTEM_CURRENT_DATE;
      }
      if (reminderFilter === "due_today") {
        return app.date === SYSTEM_CURRENT_DATE;
      }
      if (reminderFilter === "pending") {
        return !app.isCompleted;
      }
      if (reminderFilter === "upcoming") {
        return !app.isCompleted && app.date > SYSTEM_CURRENT_DATE;
      }
      return true; // "all"
    }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [teamFilteredApps, reminderFilter]);

  // Immediate today warnings for accessibility & attention management
  const todayCount = appointments.filter(a => a.date === SYSTEM_CURRENT_DATE && !a.isCompleted).length;

  return (
    <div id="appointments-tab" className="space-y-6">
      
      {/* Upper Announcement Box with Immediate Reminders Warning */}
      <div className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4
        ${todayCount > 0 
          ? "bg-amber-500/10 border-amber-500/20 text-amber-100 animate-none" 
          : darkMode 
            ? "bg-slate-900 border-slate-850" 
            : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${todayCount > 0 ? "bg-amber-500/20 text-amber-400" : "bg-teal-500/10 text-teal-400 animate-pulse"}`}>
            <AlertCircle size={22} />
          </div>
          <div>
            <h3 className={`font-display font-semibold text-base ${darkMode || todayCount > 0 ? "text-white" : "text-slate-900"}`}>
              {todayCount > 0 ? "Daily Alignment Action Required" : "Agenda & Appointment Alignment"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {todayCount > 0 
                ? `You have ${todayCount} prospective client alignment appointment(s) scheduled for today, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. Prioritize client routing immediately.` 
                : "Perfect! All corporate followups are active and cataloged within standard boundaries."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {appointments.length > 0 && onClearAllAppointments && (
            <button
               id="clear-all-reminders-global-btn"
              type="button"
              onClick={() => {
                const handleClear = () => {
                  onClearAllAppointments();
                };
                if (triggerConfirm) {
                  triggerConfirm(
                    "Remove All Set Reminders",
                    "⚠️ WARNING: This will permanently delete and remove all scheduled reminders and advisory alignment agendas across the entire CRM system. Are you sure you want to remove all set reminders?",
                    handleClear
                  );
                } else if (window.confirm("⚠️ WARNING: This will permanently delete and remove all scheduled reminders and advisory alignment agendas across the entire CRM system.\n\nAre you sure you want to remove all set reminders?")) {
                  handleClear();
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-450 hover:text-rose-400 font-semibold text-xs tracking-wide transition flex items-center gap-2 cursor-pointer active:scale-95 select-none"
            >
              <Trash2 size={14} />
              Remove All Set Reminders
            </button>
          )}

          <button
            id="create-appt-modal-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-teal-500/5 select-none"
          >
            <Plus size={15} />
            Schedule Advisory Session
          </button>
        </div>
      </div>

      {/* Reminder Strategy & Status Filter Control Bento Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          {
            key: "all" as const,
            label: "All Reminders",
            icon: Bell,
            count: allCount,
            activeClass: "bg-teal-500/15 border-teal-500/40 text-teal-400 dark:text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.1)]",
            inactiveClass: "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900/60",
            lightActiveClass: "bg-teal-50 border-teal-350 text-teal-700 shadow-sm",
            lightInactiveClass: "bg-white border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-50",
            iconColor: "text-teal-400"
          },
          {
            key: "overdue" as const,
            label: "Overdue",
            icon: AlertCircle,
            count: overdueCount,
            activeClass: "bg-rose-500/15 border-rose-500/40 text-rose-450 dark:text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.1)] animate-pulse",
            inactiveClass: "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-900/60",
            lightActiveClass: "bg-rose-55 border-rose-300 text-rose-700 shadow-sm",
            lightInactiveClass: "bg-white border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-slate-50",
            iconColor: "text-rose-420"
          },
          {
            key: "due_today" as const,
            label: "Due Today",
            icon: Clock,
            count: dueTodayCount,
            activeClass: "bg-amber-500/15 border-amber-500/40 text-amber-500 dark:text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.1)]",
            inactiveClass: "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-900/60",
            lightActiveClass: "bg-amber-50 border-amber-250 text-amber-700 shadow-sm",
            lightInactiveClass: "bg-white border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-slate-50",
            iconColor: "text-amber-400"
          },
          {
            key: "pending" as const,
            label: "Pending",
            icon: Calendar,
            count: pendingCount,
            activeClass: "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 dark:text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.1)]",
            inactiveClass: "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-indigo-400 hover:bg-slate-900/60",
            lightActiveClass: "bg-indigo-50 border-indigo-250 text-indigo-700 shadow-sm",
            lightInactiveClass: "bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50",
            iconColor: "text-indigo-400"
          },
          {
            key: "upcoming" as const,
            label: "Upcoming",
            icon: Mail,
            count: upcomingCount,
            activeClass: "bg-purple-500/15 border-purple-500/40 text-purple-400 dark:text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.1)]",
            inactiveClass: "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-purple-400 hover:bg-slate-900/60",
            lightActiveClass: "bg-purple-55 border-purple-250 text-purple-705 shadow-sm",
            lightInactiveClass: "bg-white border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-slate-50",
            iconColor: "text-purple-400"
          }
        ].map((item) => {
          const IconComponent = item.icon;
          const isActive = reminderFilter === item.key;
          const cardStyle = isActive 
            ? (darkMode ? item.activeClass : item.lightActiveClass)
            : (darkMode ? item.inactiveClass : item.lightInactiveClass);
          
          return (
            <button
              key={item.key}
              id={`reminder-tab-filter-${item.key}`}
              onClick={() => setReminderFilter(item.key)}
              className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer active:scale-95 flex flex-col justify-between gap-3 relative overflow-hidden group select-none
                ${cardStyle}`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110
                  ${isActive 
                    ? (darkMode ? "bg-slate-800 text-teal-400" : "bg-teal-50 text-teal-600") 
                    : (darkMode ? "bg-slate-950/80 text-slate-500" : "bg-slate-50 text-slate-400")}`}
                >
                  <IconComponent size={14} />
                </div>
                
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border transition-all duration-200
                  ${isActive 
                    ? "bg-teal-500/10 border-teal-500/20" 
                    : "bg-slate-950/20 border-slate-100/10 dark:text-slate-400 text-slate-600"}`}
                >
                  {item.count}
                </span>
              </div>
              
              <div className="mt-1">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Advisory</p>
                <h4 className="text-xs font-bold font-sans tracking-tight mt-0.5">{item.label}</h4>
              </div>
            </button>
          );
        })}
      </div>

      {/* Corporate Reminders Filter Grid (Project, Location, Budget, Team & Sales Advisor) */}
      {currentUser && (
        <div className={`p-4.5 rounded-2xl border transition-all flex flex-col gap-4
          ${darkMode 
            ? "bg-slate-900 border-slate-850" 
            : "bg-white border-slate-150 shadow-sm"}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl flex-shrink-0 ${darkMode ? "bg-teal-500/10 text-teal-400" : "bg-teal-50 text-teal-600"}`}>
                <User size={16} />
              </div>
              <div>
                <h4 className={`text-xs font-mono font-bold uppercase tracking-wider ${darkMode ? "text-slate-350" : "text-slate-650"}`}>
                  Corporate Reminders Filtering Matrix
                </h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-0.5">
                  Filter meeting and site visit rosters by sales hierarchies, project complexes, geography, or budget categories.
                </p>
              </div>
            </div>

            {/* Clear filters trigger */}
            {((selectedTL !== "all" && (currentUser.role === "super_admin" || currentUser.role === "admin")) || 
              selectedAgentName !== "all" || 
              selectedProject !== "all" || 
              selectedLocation !== "all" || 
              selectedBudget !== "all" ||
              projectSearchQuery !== "" ||
              locationSearchQuery !== "" ||
              budgetMinQuery !== "" ||
              budgetMaxQuery !== "") && (
              <button
                id="clear-all-reminder-filters-btn"
                onClick={() => {
                  if (currentUser.role === "super_admin" || currentUser.role === "admin") {
                    setSelectedTL("all");
                  }
                  setSelectedAgentName("all");
                  setSelectedProject("all");
                  setSelectedLocation("all");
                  setSelectedBudget("all");
                  setProjectSearchQuery("");
                  setLocationSearchQuery("");
                  setBudgetMinQuery("");
                  setBudgetMaxQuery("");
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer transition flex items-center gap-1.5 active:scale-95 border self-start sm:self-auto
                  ${darkMode 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" 
                    : "bg-rose-50 border-rose-105 text-rose-700 hover:bg-rose-100"}`}
              >
                <X size={12} />
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Team Leader Select (Admins/Super Admins only) */}
            {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") ? (
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Team Leader</span>
                <select
                  id="filter-appt-tl-select"
                  value={selectedTL}
                  onChange={(e) => handleTLChange(e.target.value)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-205 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <option value="all">📂 (All TLs)</option>
                  {tlUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      👔 {user.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              currentUser.role === "team_leader" && (
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Team Leader</span>
                  <div className={`px-3 py-2 text-xs font-semibold rounded-xl border w-full select-none opacity-80 font-mono flex items-center gap-1.5
                    ${darkMode ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                  >
                    👔 {currentUser.name} (You)
                  </div>
                </div>
              )
            )}

            {/* Sales Advisor / Agent Select (Admins, Super Admins, TLs) */}
            {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin" || currentUser.role === "team_leader") ? (
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">
                  {currentUser.role === "team_leader" ? "Team Member" : "Sales Advisor"}
                </span>
                <select
                  id="filter-appt-agent-select"
                  value={selectedAgentName}
                  onChange={(e) => setSelectedAgentName(e.target.value)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border cursor-pointer w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-205 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  <option value="all">🛡️ (All Members)</option>
                  {salesUsersOptions.map(user => {
                    const labelPrefix = user.role === "team_leader" ? "👔" : "👤";
                    const suffix = user.id === currentUser.id ? " (You)" : "";
                    return (
                      <option key={user.id} value={user.name}>
                        {labelPrefix} {user.name}{suffix}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Assigned To</span>
                <div className={`px-3 py-2 text-xs font-semibold rounded-xl border w-full select-none opacity-80 font-mono flex items-center gap-1.5
                  ${darkMode ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}
                >
                  👤 {currentUser.name} (You)
                </div>
              </div>
            )}

            {/* Project Filter */}
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Project</span>
              <input
                type="text"
                id="filter-appt-project-search"
                placeholder="🔍 Search project name..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border w-full mb-1 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                  ${darkMode 
                    ? "bg-slate-950 border-slate-800 text-slate-205 placeholder-slate-650 focus:border-teal-500" 
                    : "bg-white border-slate-250 text-slate-705 placeholder-slate-400 hover:bg-slate-50"}`}
              />
              <select
                id="filter-appt-project-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl border cursor-pointer w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/25
                  ${darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-405 focus:border-teal-500" 
                    : "bg-slate-50 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
              >
                <option value="all">🏢 (Quick select...)</option>
                {projectsPool.map(proj => (
                  <option key={proj} value={proj}>
                    🏢 {proj}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Geography / Location</span>
              <input
                type="text"
                id="filter-appt-location-search"
                placeholder="🔍 Search location..."
                value={locationSearchQuery}
                onChange={(e) => setLocationSearchQuery(e.target.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border w-full mb-1 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                  ${darkMode 
                    ? "bg-slate-950 border-slate-800 text-slate-205 placeholder-slate-650 focus:border-teal-500" 
                    : "bg-white border-slate-250 text-slate-705 placeholder-slate-400 hover:bg-slate-50"}`}
              />
              <select
                id="filter-appt-location-select"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl border cursor-pointer w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/25
                  ${darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-405 focus:border-teal-500" 
                    : "bg-slate-50 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
              >
                <option value="all">📍 (Quick select...)</option>
                {locationsPool.map(loc => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget Filter */}
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-60">Capital Budget (Range)</span>
              <div className="flex items-center gap-1 mb-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min Cr"
                  value={budgetMinQuery}
                  onChange={(e) => setBudgetMinQuery(e.target.value)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-lg border w-1/2 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-teal-400 placeholder-slate-650 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-teal-700 placeholder-slate-400 hover:bg-slate-50"}`}
                />
                <span className="text-[9px] font-bold opacity-40">to</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max Cr"
                  value={budgetMaxQuery}
                  onChange={(e) => setBudgetMaxQuery(e.target.value)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-lg border w-1/2 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-teal-400 placeholder-slate-650 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-teal-700 placeholder-slate-400 hover:bg-slate-50"}`}
                />
              </div>
              <select
                id="filter-appt-budget-select"
                value={selectedBudget}
                onChange={(e) => setSelectedBudget(e.target.value)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-xl border cursor-pointer w-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500/25
                  ${darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-405 focus:border-teal-500" 
                    : "bg-slate-50 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
              >
                <option value="all">💰 (Quick select...)</option>
                {budgetsPool.map(bud => (
                  <option key={bud} value={bud}>
                    💰 {bud}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Structured Alignment List */}
      <div className="space-y-3.5">
        {filteredApps.length > 0 ? (
          filteredApps.map((app) => {
            const meta = getTypeMeta(app.type);
            const Icon = meta?.icon || Calendar;
            const isToday = app.date === SYSTEM_CURRENT_DATE;

            // Resolve Team Leader (TL) and Sales Agent advisor names
            const lead = leads.find(l => l.id === app.leadId);
            let tlName = "";
            let salesAgentName = lead?.assignedAgent || "";
            if (lead) {
              const agentUser = users.find(u => u.name.toLowerCase() === lead.assignedAgent.toLowerCase());
              if (agentUser) {
                if (agentUser.teamLeaderId) {
                  const tlUser = users.find(u => u.id === agentUser.teamLeaderId);
                  if (tlUser) tlName = tlUser.name;
                } else if (agentUser.role === 'team_leader') {
                  tlName = agentUser.name;
                }
              }
            }

            return (
              <div
                key={app.id}
                id={`appointment-strip-${app.id}`}
                className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group relative overflow-hidden
                  ${app.isCompleted 
                    ? darkMode
                      ? "bg-slate-900/40 border-slate-900 text-slate-500 opacity-70" 
                      : "bg-slate-100/60 border-slate-200 text-slate-550 opacity-80"
                    : isToday
                      ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/35 hover:shadow-md"
                      : darkMode 
                        ? "bg-slate-900 border-slate-850 hover:border-slate-750 hover:shadow-md" 
                        : "bg-white border-slate-150 shadow-sm hover:border-slate-300"}`}
              >
                
                {/* Left Section: Icon, Time, Title, Associated Lead client */}
                <div className="flex items-start gap-4">
                  
                  {/* Status checklist trigger bubble */}
                  <button
                    id={`toggle-complete-appt-${app.id}`}
                    onClick={() => onUpdateAppointment({ ...app, isCompleted: !app.isCompleted })}
                    className={`p-2.5 rounded-xl border flex-shrink-0 cursor-pointer transition flex items-center justify-center
                      ${app.isCompleted
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : darkMode
                          ? "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-705 hover:text-white"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                    title={app.isCompleted ? "Mark Session Pending" : "Mark Session Completed"}
                  >
                    <Check size={16} className={`transition-transform duration-200 ${app.isCompleted ? "scale-100 stroke-[3]" : "scale-0"}`} />
                  </button>

                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider font-semibold uppercase ${meta?.color}`}>
                        {meta?.label}
                      </span>
                      
                      {isToday && !app.isCompleted && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider uppercase bg-amber-500 text-slate-950 animate-pulse">
                          Today Required
                        </span>
                      )}
                    </div>

                    <h4 className={`font-display font-semibold text-base mt-1 
                      ${app.isCompleted ? "line-through text-slate-450 dark:text-slate-500" : ""}`}>
                      {app.title}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 py-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} />
                        <span className="font-mono">{app.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={13} />
                        <span className="font-semibold font-mono text-teal-400">{app.time}</span>
                      </div>
                      {app.leadName && (
                        <div className="flex items-center gap-1 text-indigo-400 font-medium">
                          <User size={13} />
                          <span>Client: {app.leadName}</span>
                        </div>
                      )}
                      
                      {salesAgentName && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium hover:scale-105 transition-transform select-none
                          ${darkMode ? "bg-slate-800/80 text-teal-400" : "bg-teal-50 text-teal-700"}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full bg-teal-400`} />
                          <span className="opacity-60 text-[9px] uppercase font-bold tracking-wider mr-0.5">Advisor:</span>
                          <span>{salesAgentName}</span>
                        </div>
                      )}
                      {tlName && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium hover:scale-105 transition-transform select-none
                          ${darkMode ? "bg-slate-800/80 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="opacity-60 text-[9px] uppercase font-bold tracking-wider mr-0.5">TL:</span>
                          <span>{tlName}</span>
                        </div>
                      )}
                    </div>

                    {app.notes && (
                      <p className={`text-xs italic leading-relaxed pt-1 max-w-xl font-light ${app.isCompleted ? "text-slate-500/70" : "text-slate-400"}`}>
                        "{app.notes}"
                      </p>
                    )}
                  </div>

                </div>

                {/* Right side alignment: Reminder Active status toggle and action parameters */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100/10">
                  
                  {/* Quick Snooze Button to Postpone 1 Day */}
                  {!app.isCompleted && (
                    <button
                      id={`quick-snooze-${app.id}`}
                      onClick={() => snoozeAppointmentOneDay(app)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition select-none active:scale-95
                        ${darkMode
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                          : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"}`}
                      title="Postpone this reminder target by +1 day"
                    >
                      <Clock size={12} className="text-amber-500 animate-pulse" />
                      <span>Postpone 1 Day</span>
                    </button>
                  )}

                  {/* Reminder alert active state button */}
                  <button
                    id={`toggle-reminder-${app.id}`}
                    onClick={() => {
                      onUpdateAppointment({ ...app, reminderActive: !app.reminderActive });
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition select-none active:scale-95
                      ${app.reminderActive
                        ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                        : darkMode
                          ? "bg-slate-805 border-slate-800 text-slate-500 hover:bg-slate-800"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"}`}
                    title="Toggle sound & dashboard system reminders"
                  >
                    {app.reminderActive ? (
                      <>
                        <Bell size={13} className="text-teal-400 fill-teal-400/10 animate-bounce" />
                        Reminder
                      </>
                    ) : (
                      <>
                        <BellOff size={13} />
                        Mute
                      </>
                    )}
                  </button>

                  <div className="flex gap-1.5">
                    <button
                      id={`edit-appt-${app.id}`}
                      onClick={() => setEditingApp(app)}
                      className={`p-2 rounded-xl transition cursor-pointer border
                        ${darkMode 
                          ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200" 
                          : "bg-slate-50 hover:bg-slate-150 border-slate-200 text-slate-700"}`}
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      id={`delete-appt-${app.id}`}
                      onClick={() => onDeleteAppointment(app.id)}
                      className={`p-2 rounded-xl transition cursor-pointer border hover:border-rose-500/30 hover:text-rose-500
                        ${darkMode 
                          ? "bg-slate-800 border-slate-705 text-slate-400" 
                          : "bg-slate-50 border-slate-200 text-slate-505"}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100/10 rounded-2xl">
            No customized alignments matched current configuration. Schedule a fresh advisory loop.
          </div>
        )}
      </div>

      {/* MODAL: Creative Add Appointment */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
          <div 
            id="add-appt-modal"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-450 dark:hover:text-white hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="font-display font-bold text-lg border-b border-slate-100/10 pb-3 mb-4">Schedule Alignment Session</h3>

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Corporate Client Connection</label>
                <select
                  id="appt-lead-select"
                  value={newAppForm.leadId}
                  onChange={(e) => setNewAppForm({ ...newAppForm, leadId: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                >
                  <option value="">-- No Direct Corporate Link (General Task) --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Session Direct Objective Title *</label>
                <input
                  id="appt-title"
                  required
                  type="text"
                  placeholder="e.g. Saket Corridor Layout Alignment"
                  value={newAppForm.title}
                  onChange={(e) => setNewAppForm({ ...newAppForm, title: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-lg border 
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Target Date</label>
                  <input
                    id="appt-date"
                    type="date"
                    value={sanitizeDateForInput(newAppForm.date)}
                    onChange={(e) => setNewAppForm({ ...newAppForm, date: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white font-mono" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Arrival Alignment Time</label>
                  <input
                    id="appt-time"
                    type="time"
                    value={sanitizeTimeForInput(newAppForm.time)}
                    onChange={(e) => setNewAppForm({ ...newAppForm, time: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white font-mono" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Session Platform Type</label>
                  <select
                    id="appt-type"
                    value={newAppForm.type}
                    onChange={(e) => setNewAppForm({ ...newAppForm, type: e.target.value as Appointment["type"] })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  >
                    <option value="site_visit">🏗️ Site Tour Alignment</option>
                    <option value="meeting">🤝 Physical Office Negotiation</option>
                    <option value="call">📞 Teams Video Alignment</option>
                    <option value="followup">📝 Prospective Task Check</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="appt-reminder-active"
                      type="checkbox"
                      checked={newAppForm.reminderActive}
                      onChange={(e) => setNewAppForm({ ...newAppForm, reminderActive: e.target.checked })}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-800 focus:outline-none"
                    />
                    <span className="text-xs font-medium">Trigger Sound Alerts</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Internal Checklist Directives</label>
                <textarea
                  id="appt-notes"
                  rows={3}
                  value={newAppForm.notes}
                  onChange={(e) => setNewAppForm({ ...newAppForm, notes: e.target.value })}
                  placeholder="Record precise tasks, gate locks, red-lines, and alignments prior to launch."
                  className={`w-full px-3 py-2 text-xs rounded-lg border 
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer
                    ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  Confirm Agenda Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Appointment */}
      {editingApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-none">
          <div 
            id="edit-appt-modal"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => setEditingApp(null)}
              className="absolute top-4 right-4 text-slate-450 dark:hover:text-white hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="font-display font-bold text-lg border-b border-slate-100/10 pb-3 mb-4">Edit Alignment Agenda</h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Corporate Lead Link</label>
                <select
                  id="edit-appt-lead-select"
                  value={editingApp.leadId || ""}
                  onChange={(e) => setEditingApp({ ...editingApp, leadId: e.target.value || undefined })}
                  className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                >
                  <option value="">-- No Direct Corporate Link --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.company})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Session Objective Title</label>
                <input
                  id="edit-appt-title"
                  required
                  type="text"
                  value={editingApp.title || ""}
                  onChange={(e) => setEditingApp({ ...editingApp, title: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-lg border 
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    id="edit-appt-date"
                    required
                    type="date"
                    value={sanitizeDateForInput(editingApp.date || "")}
                    onChange={(e) => setEditingApp({ ...editingApp, date: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Time</label>
                  <input
                    id="edit-appt-time"
                    required
                    type="time"
                    value={sanitizeTimeForInput(editingApp.time || "")}
                    onChange={(e) => setEditingApp({ ...editingApp, time: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Platform Type</label>
                  <select
                    id="edit-appt-type"
                    value={editingApp.type}
                    onChange={(e) => setEditingApp({ ...editingApp, type: e.target.value as Appointment["type"] })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white font-medium" : "bg-slate-50 border-slate-200 font-medium"}`}
                  >
                    <option value="site_visit">🏗️ Site Tour Alignment</option>
                    <option value="meeting">🤝 Physical Office Negotiation</option>
                    <option value="call">📞 Teams Video Alignment</option>
                    <option value="followup">📝 Prospective Task Check</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="edit-appt-reminder-active"
                      type="checkbox"
                      checked={editingApp.reminderActive}
                      onChange={(e) => setEditingApp({ ...editingApp, reminderActive: e.target.checked })}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-slate-800 focus:outline-none"
                    />
                    <span className="text-xs font-semibold">Mute System Sound</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Checklist Directives</label>
                <textarea
                  id="edit-appt-notes"
                  rows={3}
                  value={editingApp.notes || ""}
                  onChange={(e) => setEditingApp({ ...editingApp, notes: e.target.value })}
                  className={`w-full px-3 py-2 text-xs rounded-lg border 
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100/10">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer
                    ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  Save Alignment Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
