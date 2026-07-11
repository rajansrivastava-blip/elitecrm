import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { INITIAL_LEADS, INITIAL_APPOINTMENTS, INITIAL_COMMUNICATION_LOGS, SALES_METRICS_HISTORY, PRESET_USERS } from "./data";
import { Lead, Appointment, CommunicationLog, User, UserRole, LeadEditLog, AppNotification } from "./types";
import Sidebar from "./components/Sidebar";
import LeadPipeline from "./components/LeadPipeline";
import AppointmentsList from "./components/AppointmentsList";
import LoginPortal from "./components/LoginPortal";
import NotificationCenter from "./components/NotificationCenter";

// Lazy-load heavy tab components to reduce initial bundle size
const PerformanceDashboard = lazy(() => import("./components/PerformanceDashboard"));
const StakeholderReports = lazy(() => import("./components/StakeholderReports"));
const SystemSync = lazy(() => import("./components/SystemSync"));
const MobileCompanion = lazy(() => import("./components/MobileCompanion"));
const UserManagement = lazy(() => import("./components/UserManagement"));

import { 
  checkSupabaseStatus, 
  pushLocalDataToSupabase, 
  pullSupabaseData, 
  SupabaseStatus,
  dbUpsertUser,
  dbDeleteUser,
  dbUpsertLead,
  dbDeleteLead,
  dbUpsertAppointment,
  dbDeleteAppointment,
  dbUpsertCommunicationLog,
  dbUpsertLeadEditLog,
  dbBulkUpsert
} from "./supabase";
import { 
  Menu, 
  X, 
  Building2, 
  Sparkles, 
  HelpCircle,
  Bell,
  Lock,
  UserCheck,
  ShieldCheck,
  AlertOctagon,
  Check,
  ExternalLink,
  MessageSquare,
  Send,
  Share2
} from "lucide-react";
import { motion } from "motion/react";
import { isDuplicateLead } from "./googleAuth";

const ensureStableTimestamps = (leadsList: Lead[], usersList: User[]): Lead[] => {
  if (!leadsList || !Array.isArray(leadsList)) return [];
  const cachedStr = localStorage.getItem("crm_lead_timestamps_cache");
  const cache = cachedStr ? JSON.parse(cachedStr) : {};
  let cacheUpdated = false;
  
  const now = Date.now();
  const updated = leadsList.map(l => {
    const cached = cache[l.id];
    
    let assignmentTimestamp = l.assignmentTimestamp;
    let lastActionTimestamp = l.lastActionTimestamp;
    let reassignedTimestamp = l.reassignedTimestamp;
    let assignedTlId = l.assignedTlId;
    
    if (!assignedTlId && l.assignedAgent && usersList) {
      const assignedUser = usersList.find(u => u.name.toLowerCase() === l.assignedAgent.toLowerCase() && (u.role === "team_leader" || u.role === "sales_team"));
      if (assignedUser) {
        assignedTlId = assignedUser.id;
      }
    }
    
    if (!assignmentTimestamp && cached?.assignmentTimestamp) {
      assignmentTimestamp = cached.assignmentTimestamp;
    }
    if (!lastActionTimestamp && cached?.lastActionTimestamp) {
      lastActionTimestamp = cached.lastActionTimestamp;
    }
    if (!reassignedTimestamp && cached?.reassignedTimestamp) {
      reassignedTimestamp = cached.reassignedTimestamp;
    }
    
    if (l.status === "New Lead") {
      if (!assignmentTimestamp) {
        assignmentTimestamp = now;
        cacheUpdated = true;
      }
      if (!lastActionTimestamp) {
        lastActionTimestamp = now;
        cacheUpdated = true;
      }
    }
    
    if (l.status === "Not Pick" || l.status === "Switched Off") {
      if (!reassignedTimestamp) {
        reassignedTimestamp = now;
        cacheUpdated = true;
      }
    }
    
    if (
      assignmentTimestamp !== cached?.assignmentTimestamp ||
      lastActionTimestamp !== cached?.lastActionTimestamp ||
      reassignedTimestamp !== cached?.reassignedTimestamp
    ) {
      cache[l.id] = {
        assignmentTimestamp,
        lastActionTimestamp,
        reassignedTimestamp
      };
      cacheUpdated = true;
    }
    
    return {
      ...l,
      assignedTlId,
      assignmentTimestamp,
      lastActionTimestamp,
      reassignedTimestamp
    };
  });
  
  if (cacheUpdated) {
    localStorage.setItem("crm_lead_timestamps_cache", JSON.stringify(cache));
  }
  
  return updated;
};

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("elite_pro_current_user");
    return saved ? JSON.parse(saved) : null; // Starts logged out for realistic, robust role-based access testing
  });

  const [deactivatedError, setDeactivatedError] = useState<string>("");

  // User Directory State
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem("elite_pro_users");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {
        console.error(err);
      }
    }
    return PRESET_USERS;
  });

  // Application State
  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem("elite_pro_leads");
    const isSyncActive = localStorage.getItem("elite_pro_auto_sync") !== "false";
    const rawLeads = saved ? JSON.parse(saved) : (isSyncActive ? [] : INITIAL_LEADS);
    // Walk through and scrub any auto-transferred text from the notes field so it is kept clean and pristine
    return rawLeads.map((l: Lead) => {
      if (l.notes && (l.notes.includes("[System Auto-Transfer]") || l.notes.includes("System Auto-Transfer"))) {
        const cleanNotes = l.notes
          .split("\n")
          .filter((line: string) => !line.includes("[System Auto-Transfer]") && !line.includes("System Auto-Transfer"))
          .join("\n")
          .trim();
        return { ...l, notes: cleanNotes };
      }
      return l;
    });
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem("elite_pro_appointments");
    const isSyncActive = localStorage.getItem("elite_pro_auto_sync") !== "false";
    return saved ? JSON.parse(saved) : (isSyncActive ? [] : INITIAL_APPOINTMENTS);
  });

  const [communicationLogs, setCommunicationLogs] = useState<CommunicationLog[]>(() => {
    const saved = localStorage.getItem("elite_pro_communication_logs");
    const isSyncActive = localStorage.getItem("elite_pro_auto_sync") !== "false";
    return saved ? JSON.parse(saved) : (isSyncActive ? [] : INITIAL_COMMUNICATION_LOGS);
  });

  const [leadEditLogs, setLeadEditLogs] = useState<LeadEditLog[]>(() => {
    const saved = localStorage.getItem("elite_pro_lead_edit_logs");
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem("elite_pro_notifications");
    if (saved) return JSON.parse(saved);
    return [
      {
        id: "notif-preset-1",
        recipientName: "Ricky Matharu",
        title: "New Lead Assigned",
        message: "High priority lead 'Aarav Sharma' has been registered and assigned to your team from Meta Ad.",
        source: "Meta Ad",
        timestamp: "May 25, 2026, 10:15 AM UTC",
        isRead: false,
        type: "assignment",
        leadId: "lead-1"
      },
      {
        id: "notif-preset-2",
        recipientName: "Kaushal Midha",
        title: "Fresh Inflow Alert",
        message: "A website query 'Dev Verma' has been assigned to your workspace. Action required.",
        source: "Website",
        timestamp: "May 25, 2026, 11:32 AM UTC",
        isRead: false,
        type: "assignment",
        leadId: "lead-2"
      },
      {
        id: "notif-preset-3",
        recipientName: "Kunal Wadhwa",
        title: "IVR Lead Routed",
        message: "Prospect 'Preeti Patel' called via IVR Board and was routed directly to you.",
        source: "IVR Board",
        timestamp: "May 24, 2026, 04:10 PM UTC",
        isRead: true,
        type: "sync",
        leadId: "lead-3"
      }
    ];
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("elite_pro_dark_mode");
    return saved ? JSON.parse(saved) === "true" : false; // Default to eye-comfort clean light mode
  });

    // Hoisted Google Sheets configuration states (prevent state loss when doing other work / switching tabs)
  const [sheetUrl, setSheetUrl] = useState<string>(() => localStorage.getItem("google_sheets_sync_url") || "");
  const [sheetRange, setSheetRange] = useState<string>(() => localStorage.getItem("google_sheets_sync_range") || "Sheet1");
  const [autoSheetsSync, setAutoSheetsSync] = useState<boolean>(() => localStorage.getItem("google_sheets_sync_auto") === "true");
  const [lastSheetsSynced, setLastSheetsSynced] = useState<string>(() => localStorage.getItem("google_sheets_last_sync_time") || "Never");

  // Hoisted Meta Ads configuration states
  const [metaVerifyToken, setMetaVerifyToken] = useState<string>(() => localStorage.getItem("meta_verify_token") || "elite_pro_meta_verify_token_2026");
  const [metaAutoIngest, setMetaAutoIngest] = useState<boolean>(() => localStorage.getItem("meta_auto_ingest") === "true");
  const [lastMetaSynced, setLastMetaSynced] = useState<string>(() => localStorage.getItem("meta_last_synced_time") || "Never");

  // Hoisted GitHub configuration states
  const [githubRepoUrl, setGithubRepoUrl] = useState<string>(() => localStorage.getItem("github_repo_url") || "");
  const [githubToken, setGithubToken] = useState<string>(() => localStorage.getItem("github_token") || "");
  const [githubAutoSync, setGithubAutoSync] = useState<boolean>(() => localStorage.getItem("github_auto_sync") === "true");

  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [settingsLoadedSuccessfully, setSettingsLoadedSuccessfully] = useState<boolean>(false);

  // Load from backend server persistently on mount (to restore sheet url on any device/refresh)
  useEffect(() => {
    let active = true;
    const loadSettingsWithRetry = async (retriesLeft = 3, delay = 1000) => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) {
          throw new Error(`Load failed with HTTP status ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        
        if (data) {
          if (data.sheetUrl !== undefined) setSheetUrl(data.sheetUrl);
          if (data.sheetRange !== undefined) setSheetRange(data.sheetRange);
          if (data.autoSheetsSync !== undefined) setAutoSheetsSync(!!data.autoSheetsSync);
          if (data.lastSheetsSynced !== undefined) setLastSheetsSynced(data.lastSheetsSynced || "Never");
          if (data.metaVerifyToken !== undefined) setMetaVerifyToken(data.metaVerifyToken);
          if (data.metaAutoIngest !== undefined) setMetaAutoIngest(!!data.metaAutoIngest);
          if (data.lastMetaSynced !== undefined) setLastMetaSynced(data.lastMetaSynced || "Never");
          if (data.githubRepoUrl !== undefined) setGithubRepoUrl(data.githubRepoUrl);
          if (data.githubToken !== undefined) setGithubToken(data.githubToken);
          if (data.githubAutoSync !== undefined) setGithubAutoSync(!!data.githubAutoSync);
        }
        setSettingsLoadedSuccessfully(true);
        setSettingsLoaded(true);
      } catch (err: any) {
        if (!active) return;
        if (retriesLeft > 0) {
          console.warn(`[Settings] Failed to load settings (${err.message || String(err)}). Retrying in ${delay}ms... (${retriesLeft} retries left)`);
          setTimeout(() => {
            if (active) loadSettingsWithRetry(retriesLeft - 1, delay * 1.5);
          }, delay);
        } else {
          console.error("Failed to load server-side settings after multiple retries, falling back to local storage:", err);
          // Set settingsLoadedSuccessfully to false to bypass autosaving and avoid empty-state overrides,
          // but set settingsLoaded to true so the application can load from localStorage without blocking.
          setSettingsLoadedSuccessfully(false);
          setSettingsLoaded(true);
        }
      }
    };

    loadSettingsWithRetry();
    return () => {
      active = false;
    };
  }, []);

  // Save config changes both to server and local storage persistently
  useEffect(() => {
    if (!settingsLoaded) return;

    localStorage.setItem("google_sheets_sync_url", sheetUrl);
    localStorage.setItem("google_sheets_sync_range", sheetRange);
    localStorage.setItem("google_sheets_sync_auto", autoSheetsSync ? "true" : "false");
    localStorage.setItem("google_sheets_last_sync_time", lastSheetsSynced);

    localStorage.setItem("meta_verify_token", metaVerifyToken);
    localStorage.setItem("meta_auto_ingest", metaAutoIngest ? "true" : "false");
    localStorage.setItem("meta_last_synced_time", lastMetaSynced);

    localStorage.setItem("github_repo_url", githubRepoUrl);
    localStorage.setItem("github_token", githubToken);
    localStorage.setItem("github_auto_sync", githubAutoSync ? "true" : "false");

    // Only save to backend if settings were successfully fetched on startup.
    // This prevents overwriting server settings with local storage or state default values when loading failed.
    if (!settingsLoadedSuccessfully) {
      console.warn("[Settings] Server-side saving bypassed because configuration could not be successfully loaded from the server on startup.");
      return;
    }

    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetUrl,
        sheetRange,
        autoSheetsSync,
        lastSheetsSynced,
        metaVerifyToken,
        metaAutoIngest,
        lastMetaSynced,
        githubRepoUrl,
        githubToken,
        githubAutoSync
      })
    }).catch(err => console.error("Error saving server settings:", err));
  }, [sheetUrl, sheetRange, autoSheetsSync, lastSheetsSynced, metaVerifyToken, metaAutoIngest, lastMetaSynced, githubRepoUrl, githubToken, githubAutoSync, settingsLoaded, settingsLoadedSuccessfully]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncHistory, setSyncHistory] = useState<string[]>([]);

  // Supabase Integration States
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>({
    isConnected: false,
    tablesVerified: {
      users: false,
      leads: false,
      appointments: false,
      communication_logs: false,
      lead_edit_logs: false,
    }
  });
  const [isSupabaseOpInProgress, setIsSupabaseOpInProgress] = useState<boolean>(false);

  // Supabase Auto Sync setting: Default to true for automatic real-time cloud database synchronization
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("elite_pro_auto_sync");
    return saved ? saved === "true" : true;
  });

  // Global "Pause Software" Mode setting (defaults to false)
  const [isSoftwarePaused, setIsSoftwarePaused] = useState<boolean>(() => {
    return localStorage.getItem("elite_pro_software_paused") === "true";
  });

  const handleToggleSoftwarePaused = () => {
    setIsSoftwarePaused(prev => {
      const newVal = !prev;
      localStorage.setItem("elite_pro_software_paused", newVal ? "true" : "false");
      
      // Post alert to notification stack for visibility
      const timestampText = new Date().toLocaleTimeString();
      const newNotif: AppNotification = {
        id: `paused-alert-${Date.now()}`,
        recipientName: currentUser?.name || "System",
        title: newVal ? "System Process Paused" : "System Process Resumed",
        message: newVal 
          ? `All automated database syncs and ingest actions have been successfully paused at ${timestampText}.` 
          : `Automated operations and real-time syncing resumed successfully at ${timestampText}.`,
        isRead: false,
        timestamp: new Date().toISOString(),
        type: "sync"
      };
      setNotifications(prev => [newNotif, ...prev]);

      return newVal;
    });
  };

  const handleToggleAutoSync = () => {
    setIsAutoSyncEnabled(prev => {
      const newVal = !prev;
      localStorage.setItem("elite_pro_auto_sync", newVal ? "true" : "false");
      return newVal;
    });
  };

  const refreshSupabaseStatus = async () => {
    try {
      const status = await checkSupabaseStatus();
      setSupabaseStatus(status);
      return status;
    } catch (e) {
      console.error("Supabase check error", e);
      return {
        isConnected: false,
        tablesVerified: {
          users: false, leads: false, appointments: false, communication_logs: false, lead_edit_logs: false
        }
      };
    }
  };

  // Check Supabase status on mount
  useEffect(() => {
    refreshSupabaseStatus();
  }, []);

  const handlePushToSupabase = async () => {
    setIsSupabaseOpInProgress(true);
    const res = await pushLocalDataToSupabase({
      users,
      leads,
      appointments,
      communicationLogs,
      leadEditLogs
    });
    setIsSupabaseOpInProgress(false);
    
    if (res.success) {
      await refreshSupabaseStatus();
      setSyncHistory(prev => [
        `${new Date().toISOString().replace("T", " ").substr(0, 19)} GMT - Seeded all local records to Supabase.`,
        ...prev
      ]);
    }
    return res;
  };

  const handlePullFromSupabase = async () => {
    setIsSupabaseOpInProgress(true);
    const res = await pullSupabaseData();
    setIsSupabaseOpInProgress(false);

    let success = res.errors.length === 0;
    if (success) {
      if (res.leads) {
        const uniquePulled: Lead[] = [];
        res.leads.forEach(l => {
          if (!isDuplicateLead(l, uniquePulled)) {
            uniquePulled.push(l);
          }
        });
        setLeads(uniquePulled);
      }
      if (res.users) {
        setUsers(prev => {
          const merged = [...res.users!];
          prev.forEach(localUser => {
            const matchedIdx = merged.findIndex(u => u.id === localUser.id || u.email.toLowerCase() === localUser.email.toLowerCase());
            if (matchedIdx >= 0) {
              if (!merged[matchedIdx].password && localUser.password) {
                merged[matchedIdx].password = localUser.password;
              }
            } else {
              merged.push(localUser);
            }
          });
          return merged;
        });
      }
      if (res.appointments) {
        setAppointments(res.appointments);
      }
      if (res.communicationLogs) {
        setCommunicationLogs(res.communicationLogs);
      }
      if (res.leadEditLogs) {
        setLeadEditLogs(res.leadEditLogs);
      }

      setSyncHistory(prev => [
        `${new Date().toISOString().replace("T", " ").substr(0, 19)} GMT - Pulled live data from Supabase backend tables.`,
        ...prev
      ]);
    }
    
    return {
      success,
      errors: res.errors
    };
  };

  // Is Mobile Companion Mode simulated activity check
  const [isMobileModeActive, setIsMobileModeActive] = useState<boolean>(false);

  // Server state sync loading status
  const [crmDataLoaded, setCrmDataLoaded] = useState<boolean>(false);

  // Custom modal config state
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "alert" | "confirm";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "alert"
  });

  // Automated notification dispatch pipeline state
  const [activeAutoDispatch, setActiveAutoDispatch] = useState<{
    isOpen: boolean;
    leadName: string;
    agentName: string;
    phone: string;
    message: string;
    waHref: string;
  } | null>(null);

  const triggerAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: "alert"
    });
  };

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type: "confirm",
      onConfirm
    });
  };

  // Persistence side effects synced to local storage and server-side cache
  useEffect(() => {
    localStorage.setItem("elite_pro_leads", JSON.stringify(leads));
    localStorage.setItem("elite_pro_appointments", JSON.stringify(appointments));
    localStorage.setItem("elite_pro_communication_logs", JSON.stringify(communicationLogs));
    localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(leadEditLogs));
    localStorage.setItem("elite_pro_users", JSON.stringify(users));

    if (crmDataLoaded) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        fetch("/api/crm/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads, users, appointments, communicationLogs, leadEditLogs }),
          signal: controller.signal
        }).catch(err => {
          const errMsg = err?.message || String(err);
          const errName = err?.name || "";
          if (
            errName !== "AbortError" &&
            !errMsg.toLowerCase().includes("abort") &&
            !errMsg.toLowerCase().includes("cancel") &&
            !errMsg.toLowerCase().includes("load failed")
          ) {
            console.error("Server cache sync error:", err);
          }
        });
      }, 2000); // 2000ms debounce to prevent excessive writes during bulk operations
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
  }, [leads, appointments, communicationLogs, leadEditLogs, users, crmDataLoaded]);

  useEffect(() => {
    localStorage.setItem("elite_pro_notifications", JSON.stringify(notifications));
  }, [notifications]);


  useEffect(() => {
    localStorage.setItem("elite_pro_dark_mode", darkMode ? "true" : "false");
  }, [darkMode]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("elite_pro_current_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("elite_pro_current_user");
    }
  }, [currentUser]);

  // Load initial CRM data on mount (Sequential sequence with Supabase authority)
  useEffect(() => {
    const initializeCrmAndSync = async () => {
      try {
        // One-time client clean slate setup to match only-data-storage directive
        if (!localStorage.getItem("elite_pro_sterile_reset_v3")) {
          localStorage.removeItem("elite_pro_leads");
          localStorage.removeItem("elite_pro_appointments");
          localStorage.removeItem("elite_pro_communication_logs");
          localStorage.removeItem("elite_pro_lead_edit_logs");
          localStorage.setItem("elite_pro_sterile_reset_v3", "true");
          
          setLeads([]);
          setAppointments([]);
          setCommunicationLogs([]);
          setLeadEditLogs([]);
        }

        // 1. Refresh Supabase connection and tables state
        const status = await refreshSupabaseStatus();

        // 2. If Supabase is connected and auto-sync is enabled, use live Supabase data as absolute truth
        if (isAutoSyncEnabled && status.isConnected) {
          console.log("[init] Live Supabase detected. Loading clean DB tables.");
          const res = await pullSupabaseData();
          
          // Even if some secondary tables or logs have errors (e.g. table cleared, or relation error),
          // we want to use whatever database rows are actually present in Supabase rather than falling back
          // to default mock records from crm_data_cache.json or crm presets.
          const pulledLeads = res.leads || [];
          const pulledUsers = res.users || [];
          const pulledApps = res.appointments || [];
          const pulledComms = res.communicationLogs || [];
          const pulledEdits = res.leadEditLogs || [];

          setLeads(pulledLeads);
          
          // Merge users safely to preserve mock session details or local password overrides
          setUsers(prev => {
            const merged = [...pulledUsers];
            prev.forEach(lu => {
              const matchedIdx = merged.findIndex(u => u.id === lu.id || u.email.toLowerCase() === lu.email.toLowerCase());
              if (matchedIdx >= 0) {
                if (!merged[matchedIdx].password && lu.password) {
                  merged[matchedIdx].password = lu.password;
                }
                if (merged[matchedIdx].active === undefined && lu.active !== undefined) {
                  merged[matchedIdx].active = lu.active;
                }
              } else {
                merged.push(lu);
              }
            });
            return merged;
          });

          setAppointments(pulledApps);
          setCommunicationLogs(pulledComms);
          setLeadEditLogs(pulledEdits);

          // Sync with local storage
          localStorage.setItem("elite_pro_leads", JSON.stringify(pulledLeads));
          localStorage.setItem("elite_pro_appointments", JSON.stringify(pulledApps));
          localStorage.setItem("elite_pro_communication_logs", JSON.stringify(pulledComms));
          localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(pulledEdits));

          // Populate the server cache so it is immediately in sync with manual DB removals/clears
          await fetch("/api/crm/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leads: pulledLeads,
              users: pulledUsers,
              appointments: pulledApps,
              communicationLogs: pulledComms,
              leadEditLogs: pulledEdits
            })
          });

          if (res.errors.length === 0) {
            setSyncHistory(prev => [
              `${new Date().toISOString().replace("T", " ").substr(0, 19)} GMT - Hydrated from Supabase Cloud Cluster successfully.`,
              ...prev
            ]);
          } else {
            setSyncHistory(prev => [
              `${new Date().toISOString().replace("T", " ").substr(0, 19)} GMT - Unified with Supabase live state (with warnings: ${res.errors.join(", ")}).`,
              ...prev
            ]);
          }
          
          setCrmDataLoaded(true);
          return; // Strictly exit to prevent executing the file-based crm_data_cache.json fallback!
        }

        // 3. Fallback: Load initialization from local filesystem crm cache file
        const res = await fetch("/api/crm/data");
        const data = await res.json();
        if (data && data.leads) {
          const loadedLeads = data.leads || [];
          const loadedUsers = data.users || [];
          const loadedApps = data.appointments || [];
          const loadedComms = data.communicationLogs || [];
          const loadedEdits = data.leadEditLogs || [];

          setLeads(loadedLeads);
          setUsers(prev => {
            const merged = [...loadedUsers];
            prev.forEach(lu => {
              const matchedIdx = merged.findIndex(u => u.id === lu.id || u.email.toLowerCase() === lu.email.toLowerCase());
              if (matchedIdx >= 0) {
                if (!merged[matchedIdx].password && lu.password) {
                  merged[matchedIdx].password = lu.password;
                }
                if (merged[matchedIdx].active === undefined && lu.active !== undefined) {
                  merged[matchedIdx].active = lu.active;
                }
              } else {
                merged.push(lu);
              }
            });
            return merged;
          });
          setAppointments(loadedApps);
          setCommunicationLogs(loadedComms);
          setLeadEditLogs(loadedEdits);
          
          localStorage.setItem("elite_pro_leads", JSON.stringify(loadedLeads));
          localStorage.setItem("elite_pro_appointments", JSON.stringify(loadedApps));
          localStorage.setItem("elite_pro_communication_logs", JSON.stringify(loadedComms));
          localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(loadedEdits));
        } else {
          // Zero slate initialization
          const localLeads = localStorage.getItem("elite_pro_leads");
          const localUsers = localStorage.getItem("elite_pro_users");
          const localApps = localStorage.getItem("elite_pro_appointments");
          const localLogs = localStorage.getItem("elite_pro_communication_logs");
          const localEdits = localStorage.getItem("elite_pro_lead_edit_logs");

          const initialSyncLeads = localLeads ? JSON.parse(localLeads) : [];
          const initialSyncUsers = localUsers ? JSON.parse(localUsers) : users;
          const initialSyncApps = localApps ? JSON.parse(localApps) : [];
          const initialSyncLogs = localLogs ? JSON.parse(localLogs) : [];
          const initialSyncEdits = localEdits ? JSON.parse(localEdits) : [];

          await fetch("/api/crm/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              leads: initialSyncLeads,
              users: initialSyncUsers,
              appointments: initialSyncApps,
              communicationLogs: initialSyncLogs,
              leadEditLogs: initialSyncEdits
            })
          });
          
          setLeads(initialSyncLeads);
          setAppointments(initialSyncApps);
          setCommunicationLogs(initialSyncLogs);
          setLeadEditLogs(initialSyncEdits);
        }
      } catch (err) {
        console.error("Failed to fetch server-side CRM cache:", err);
      } finally {
        setCrmDataLoaded(true);
      }
    };
    initializeCrmAndSync();
  }, []);



  // Self-deactivation/Admin-deactivation kick out check
  useEffect(() => {
    if (currentUser) {
      const match = users.find(u => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
      if (match && match.active === false) {
        setDeactivatedError("Access Denied: Your account has been deactivated by an Administrator.");
        setCurrentUser(null);
        localStorage.removeItem("elite_pro_current_user");
      }
    }
  }, [currentUser, users]);

  // Derive filtered records based on active role boundary
  const visibleLeads = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      return leads;
    }
    if (currentUser.role === "team_leader") {
      const teamMemberNames = new Set(
        users
          .filter(u => u.teamLeaderId === currentUser.id)
          .map(u => u.name.toLowerCase())
      );
      return leads.filter(l => {
        const agentLower = (l.assignedAgent || "").toLowerCase();
        return agentLower === currentUser.name.toLowerCase() || teamMemberNames.has(agentLower);
      });
    }
    // Sales Team can see only leads which is assigned to them.
    return leads.filter(l => (l.assignedAgent || "").toLowerCase() === currentUser.name.toLowerCase());
  }, [leads, currentUser, users]);

  const visibleLeadEditLogs = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      return leadEditLogs;
    }
    // Users can see edit logs for leads assigned to them or their team, or logs they edited
    const visibleLeadIds = new Set(visibleLeads.map(l => l.id));
    return leadEditLogs.filter(log => {
      const isLogForVisibleLead = visibleLeadIds.has(log.leadId);
      const isLoggedBySelf = log.editorName.toLowerCase() === currentUser.name.toLowerCase();
      return isLogForVisibleLead || isLoggedBySelf;
    });
  }, [leadEditLogs, currentUser, visibleLeads]);

  const handleClearLeadEditLogs = async (type: "transfer" | "edit" | "all") => {
    let updatedLogs: LeadEditLog[] = [];
    if (type === "transfer") {
      updatedLogs = leadEditLogs.filter(
        log => log.editorName !== "System Auto-Transfer Agent" && log.editorName !== "System Auto-Reassigner"
      );
    } else if (type === "edit") {
      updatedLogs = leadEditLogs.filter(
        log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner"
      );
    }
    
    setLeadEditLogs(updatedLogs);
    localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(updatedLogs));

    if (type === "transfer" || type === "all") {
      setSyncHistory([]);
    }

    try {
      await fetch("/api/crm/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          leads, 
          users, 
          appointments, 
          communicationLogs, 
          leadEditLogs: updatedLogs 
        })
      });

      if (isAutoSyncEnabled && supabaseStatus.isConnected && supabaseStatus.tablesVerified.lead_edit_logs) {
        const { clientSupabase } = await import("./supabase");
        if (clientSupabase) {
          if (type === "all") {
            await clientSupabase.from("lead_edit_logs").delete().neq("id", "keep-alive-dummy-id-custom");
          } else if (type === "transfer") {
            await clientSupabase.from("lead_edit_logs").delete().in("editor_name", ["System Auto-Transfer Agent", "System Auto-Reassigner"]);
          } else if (type === "edit") {
            await clientSupabase.from("lead_edit_logs").delete().not("editor_name", "eq", "System Auto-Transfer Agent").not("editor_name", "eq", "System Auto-Reassigner");
          }
        }
      }
    } catch (e) {
      console.error("Failed to sync cleared logs to backend servers:", e);
    }
  };

  const visibleAppointments = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      return appointments;
    }
    // Filter appointments belonging to visible leads
    const visibleLeadIds = new Set(visibleLeads.map(l => l.id));
    return appointments.filter(app => visibleLeadIds.has(app.leadId));
  }, [appointments, visibleLeads, currentUser]);

  // Handler: Add User
  const handleAddUser = async (newUser: Omit<User, "id">) => {
    const id = "user-" + (users.length + 1) + "-" + Math.random().toString(36).substr(2, 4);
    const item: User = {
      ...newUser,
      id
    };
    setUsers(prev => [...prev, item]);

    const res = await dbUpsertUser(item);
    if (!res.success) {
      console.warn("Failed to upsert user to Supabase:", res.error);
      triggerAlert(
        "Supabase User Sync Alert",
        `User portfolio for "${item.name}" registered successfully to your local browser storage, but failed to write onto your Supabase database!\n\nDatabase Error: "${res.error || "No response"}"\n\nPlease ensure your 'users' table is properly configured under your Supabase backend using the SQL commands located inside the Integrations "System Sync" tab.`
      );
    } else {
      triggerAlert(
        "Supabase Sync Success",
        `New portal account for "${item.name}" has been successfully stored in your remote Supabase users database.\n\nThey can now login instantly using their email: ${item.email}`
      );
    }
  };

  // Handler: Update User
  const handleUpdateUser = async (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    if (currentUser && currentUser.id === updated.id) {
      setCurrentUser(updated);
    }

    const res = await dbUpsertUser(updated);
    if (!res.success) {
      console.warn("Failed to update user to Supabase:", res.error);
      triggerAlert(
        "Supabase User Update Alert",
        `User updates saved locally, but we couldn't send them to your Supabase database!\n\nDatabase Error: "${res.error || "No response"}"`
      );
    } else {
      triggerAlert(
        "Supabase Sync Success",
        `User file for "${updated.name}" has been successfully updated on your remote Supabase users database.\n\nAny modified credentials (including login password) are active immediately.`
      );
    }
  };

  // Handler: Delete User
  const handleDeleteUser = async (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));

    if (isAutoSyncEnabled) {
      const res = await dbDeleteUser(userId);
      if (!res.success) {
        console.warn("Failed to delete user in Supabase:", res.error);
        triggerAlert(
          "Supabase User Delete Alert",
          `User removed locally, but we couldn't delete them from your Supabase database!\n\nDatabase Error: "${res.error || "No response"}"`
        );
      }
    }
  };

  // Handler: Add Lead
  const handleAddLead = async (newLead: Omit<Lead, "id" | "dateCreated" | "dateUpdated">) => {
    // Role-based Access Control authorization filter
    if (
      currentUser?.role !== "super_admin" &&
      currentUser?.role !== "admin" &&
      currentUser?.role !== "team_leader" &&
      currentUser?.role !== "sales_team"
    ) {
      triggerAlert(
        "Access Refused",
        `Only registered system users (Admins, Team Leaders, or Sales Advisors) can add data or register new leads.`
      );
      return;
    }

    // Duplicate verification filter for manual single lead addition
    if (isDuplicateLead(newLead, leads)) {
      triggerAlert(
        "Duplicate Lead Warning",
        `A lead with the same name, email, or phone number already exists in your CRM directory.`
      );
      return;
    }

    const id = "lead-" + (leads.length + 1) + "-" + Math.random().toString(36).substr(2, 4);
    const createdDate = new Date().toISOString().split("T")[0];
    
    // Check if assignee is a Team Leader or Sales Team using highly resilient clean match
    const cleanAgentName = (newLead.assignedAgent || "").trim().toLowerCase();
    const assignedUser = users.find(
      u => (u.name || "").trim().toLowerCase() === cleanAgentName && (u.role === "team_leader" || u.role === "sales_team")
    );
    const nowTimestamp = Date.now();

    const item: Lead = {
      ...newLead,
      id,
      dateCreated: createdDate,
      dateUpdated: createdDate,
      assignmentTimestamp: nowTimestamp,
      lastActionTimestamp: nowTimestamp,
      assignedTlId: assignedUser ? assignedUser.id : undefined,
      createdById: currentUser?.id,
      createdByUserRole: currentUser?.role,
    };
    leadsRef.current = [item, ...leadsRef.current];
    setLeads(prev => [item, ...prev]);

    // Create a notification for the assignee about this new lead assignment
    // Skip if the lead is registered by Sales Team or Team Leaders (per user directive)
    const isRegisteredBySalesOrTL = currentUser?.role === "sales_team" || currentUser?.role === "team_leader";
    if (item.assignedAgent && !isRegisteredBySalesOrTL) {
      const newNotif: AppNotification = {
        id: "notif-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        recipientName: item.assignedAgent,
        title: "New Lead Assigned",
        message: `Fresh investor lead "${item.name}" from ${item.source} has been assigned to you.`,
        source: item.source,
        timestamp: new Date().toLocaleString("en-US", { 
          timeStyle: "short", 
          dateStyle: "medium"
        }),
        isRead: false,
        type: "assignment",
        leadId: id,
        leadName: item.name
      };
      setNotifications(prev => [newNotif, ...prev]);

      // Automatically pop up notification dispatcher if assigned user is found and has a phone
      // Display only to Admin and Super Admin roles, not Sales Team and TLs
      if (assignedUser && (currentUser?.role === "super_admin" || currentUser?.role === "admin")) {
        const textMessage = `*ELITE PRO INFRA ADVISORY ALERT*\n\n` +
          `Hello *${assignedUser.name}*,\n` +
          `You have been assigned a new Client Lead!\n\n` +
          `🔹 *Client:* ${item.name || "N/A"}\n` +
          `🔹 *Project:* ${item.projectName || "N/A"}\n` +
          `🔹 *Budget Plan:* ${item.budget || "N/A"}\n` +
          `🔹 *Location:* ${item.location || "N/A"}\n` +
          `🔹 *Reference Source:* ${item.source || "N/A"}\n` +
          `💬 *Client Notes:* ${item.notes || "No extra notes."}\n\n` +
          `Please contact the lead immediately. High conversion priority.`;
        
        const sanitizedPhone = (assignedUser.phone || "").replace(/[+\s-]/g, "");
        const waHref = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(textMessage)}`;
        
        setActiveAutoDispatch({
          isOpen: true,
          leadName: item.name,
          agentName: assignedUser.name,
          phone: assignedUser.phone || "N/A",
          message: textMessage,
          waHref,
        });

        // Add to live sync timeline logs
        const localTime = new Date().toLocaleTimeString();
        setSyncHistory(prev => [
          `[${localTime}] - [AUTO ALERT STATUS] Staged real-time notification dispatch parameters for ${assignedUser.name}`,
          ...prev
        ]);
      }
    }


    // Perform background db sync (only if Auto-Sync is enabled)
    if (isAutoSyncEnabled) {
      const leadRes = await dbUpsertLead(item);
      if (!leadRes.success) {
        console.warn("Supabase Lead Sync failed:", leadRes.error);
        triggerAlert(
          "Supabase Synchronization Warned",
          `Investor Lead "${item.name}" registered successfully to your local browser storage, but failed to write onto your Supabase cluster!\n\nDatabase Error: "${leadRes.error || "No response"}"\n\nTo make this lead visible in your Supabase backend dashboard:\n1. Open the "System Sync" (Integrations) tab.\n2. Copy the initialization SQL.\n3. Open your Supabase SQL Editor (https://supabase.com) and run the commands to build the 'leads' and 'appointments' tables.\n4. Make sure Row Level Security (RLS) is disabled or a public access policy is configured!`
        );
      }
    }
  };

  // Handler: Bulk Add Leads (CSV/Excel ingestion)
  const handleBulkAddLeads = async (newLeads: Omit<Lead, "id" | "dateCreated" | "dateUpdated">[], skipDupCheck: boolean = false) => {
    // Role-based Access Control authorization filter
    if (
      currentUser?.role !== "super_admin" &&
      currentUser?.role !== "admin" &&
      currentUser?.role !== "team_leader" &&
      currentUser?.role !== "sales_team"
    ) {
      triggerAlert(
        "Access Refused",
        `Only registered system users (Admins, Team Leaders, or Sales Advisors) can bulk import or add data.`
      );
      return;
    }

    const createdDate = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const nowTimestamp = Date.now();

    // Secondary deep verification filters for absolute duplicate safety using up-to-date ref state
    const uniqueNewLeads: Omit<Lead, "id" | "dateCreated" | "dateUpdated">[] = [];
    if (skipDupCheck) {
      // Direct pass - do absolutely NO duplicate filters
      newLeads.forEach(nl => {
        uniqueNewLeads.push(nl);
      });
    } else {
      newLeads.forEach(nl => {
        const isDupInCrm = isDuplicateLead(nl, leadsRef.current || []);
        const isDupInBatch = isDuplicateLead(nl, uniqueNewLeads);
        if (!isDupInCrm && !isDupInBatch) {
          uniqueNewLeads.push(nl);
        }
      });
    }

    if (uniqueNewLeads.length === 0) {
      console.log("[Bulk Add Leads] All imported leads matched existing contacts; bypassing registration.");
      return;
    }

    const newItems: Lead[] = [];
    
    // Create batch lists to execute
    uniqueNewLeads.forEach((nl, index) => {
      const id = "lead-bulk-" + (leads.length + index + 1) + "-" + Math.random().toString(36).substr(2, 4);
      
      const assignedUser = users.find(u => u.name.toLowerCase() === nl.assignedAgent?.toLowerCase());

      const item: Lead = {
        ...nl,
        id,
        dateCreated: createdDate,
        dateUpdated: createdDate,
        assignmentTimestamp: nowTimestamp,
        assignedTlId: assignedUser ? assignedUser.id : undefined,
        lastActionTimestamp: nowTimestamp,
      };
      newItems.push(item);
    });

    leadsRef.current = [...newItems, ...leadsRef.current];
    setLeads(prev => [...newItems, ...prev]);

    // Create notifications for assigned agents
    // Skip if the lead is registered by Sales Team or Team Leaders (per user directive)
    const rawBulkNotifs: AppNotification[] = [];
    const isBulkRegisteredBySalesOrTL = currentUser?.role === "sales_team" || currentUser?.role === "team_leader";
    if (!isBulkRegisteredBySalesOrTL) {
      newItems.forEach(item => {
        if (item.assignedAgent) {
          rawBulkNotifs.push({
            id: "notif-" + Math.random().toString(36).substr(2, 5) + "-" + Date.now(),
            recipientName: item.assignedAgent,
            title: "New Lead Assigned",
            message: `Lead "${item.name}" from ${item.source} has been imported & assigned to you.`,
            source: item.source,
            timestamp: new Date().toLocaleString("en-US", { 
              timeStyle: "short", 
              dateStyle: "medium"
            }),
            isRead: false,
            type: "assignment",
            leadId: item.id,
            leadName: item.name
          });
        }
      });
    }

    if (rawBulkNotifs.length > 0) {
      setNotifications(prev => [...rawBulkNotifs, ...prev]);
    }


    // Push each newly registered lead to Supabase (only if Auto-Sync is enabled in local state or storage)
    const isSyncActiveCombined = isAutoSyncEnabled || localStorage.getItem("elite_pro_auto_sync") !== "false";
    if (isSyncActiveCombined) {
      const dbRes = await dbBulkUpsert({
        leads: newItems,
        appointments: []
      });

      if (!dbRes.success) {
        const sampleErr = dbRes.error || "Missing schema table or blocked with RLS";
        console.warn("Supabase bulk registration failed:", sampleErr);
        triggerAlert(
          "Supabase Bulk Sync Alert",
          `Successfully added ${uniqueNewLeads.length} leads to local browser state, but failed to write onto your remote Supabase database.\n\nDatabase Error: "${sampleErr}"\n\nPlease ensure your 'leads' and 'appointments' tables are properly configured under Supabase's SQL Editor schema (details located inside the Integrations "System Sync" page).`
        );
      }
    }
  };

  // Stable refs to prevent permanent timers from capturing stale React closures
  const leadsRef = useRef(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const handleBulkAddLeadsRef = useRef(handleBulkAddLeads);
  useEffect(() => {
    handleBulkAddLeadsRef.current = handleBulkAddLeads;
  }, [handleBulkAddLeads]);

  const sheetUrlRef = useRef(sheetUrl);
  useEffect(() => {
    sheetUrlRef.current = sheetUrl;
  }, [sheetUrl]);

  const sheetRangeRef = useRef(sheetRange);
  useEffect(() => {
    sheetRangeRef.current = sheetRange;
  }, [sheetRange]);

  const autoSheetsSyncRef = useRef(autoSheetsSync);
  useEffect(() => {
    autoSheetsSyncRef.current = autoSheetsSync;
  }, [autoSheetsSync]);

  const crmDataLoadedRef = useRef(crmDataLoaded);
  useEffect(() => {
    crmDataLoadedRef.current = crmDataLoaded;
  }, [crmDataLoaded]);

  const appointmentsRef = useRef(appointments);
  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  const communicationLogsRef = useRef(communicationLogs);
  useEffect(() => {
    communicationLogsRef.current = communicationLogs;
  }, [communicationLogs]);

  const leadEditLogsRef = useRef(leadEditLogs);
  useEffect(() => {
    leadEditLogsRef.current = leadEditLogs;
  }, [leadEditLogs]);

  const isAutoSyncEnabledRef = useRef(isAutoSyncEnabled);
  useEffect(() => {
    isAutoSyncEnabledRef.current = isAutoSyncEnabled;
  }, [isAutoSyncEnabled]);

  const isSoftwarePausedRef = useRef(isSoftwarePaused);
  useEffect(() => {
    isSoftwarePausedRef.current = isSoftwarePaused;
  }, [isSoftwarePaused]);

  const isSyncingSheetsRef = useRef(false);
  const lastLocalUpdateRef = useRef<Record<string, number>>({});

  // Background Google Sheets Synchronization Loop
  useEffect(() => {
    const runSheetsBackgroundSync = async () => {
      // Prevents concurrent sync loops or attempts when CRM data is still loading or software is paused
      if (isSoftwarePausedRef.current) {
        return;
      }
      if (!crmDataLoadedRef.current) {
        return;
      }
      if (isSyncingSheetsRef.current) {
        return;
      }

      // Security check: Only trigger background sync for Admins or Super Admins
      const u = currentUserRef.current;
      if (!u || (u.role !== "super_admin" && u.role !== "admin")) {
        return;
      }

      const isAuto = autoSheetsSyncRef.current;
      const sheetUrlVal = sheetUrlRef.current;
      const sheetRangeVal = sheetRangeRef.current;
      const token = sessionStorage.getItem("google_sheets_token") || undefined;

      if (isAuto && sheetUrlVal) {
        isSyncingSheetsRef.current = true;
        try {
          const { fetchGoogleSheetValues, mapSpreadsheetRowsToLeads, isDuplicateLead } = await import("./googleAuth");
          const rows = await fetchGoogleSheetValues(sheetUrlVal, sheetRangeVal, token);
          if (rows && rows.length >= 2) {
            const parsedLeads = mapSpreadsheetRowsToLeads(rows, usersRef.current || []);
            if (parsedLeads.length > 0) {
              const filteredNewLeads = parsedLeads.filter(nl => {
                return !isDuplicateLead(nl, leadsRef.current || []);
              });

              if (filteredNewLeads.length > 0) {
                // Call via the up-to-date ref to execute the latest function with accurate states
                await handleBulkAddLeadsRef.current(filteredNewLeads);
                const updatedTime = new Date().toLocaleTimeString("en-US", { hour12: true }) + " (Local)";
                setLastSheetsSynced(updatedTime);
                localStorage.setItem("google_sheets_last_sync_time", updatedTime);
                console.log(`[Google Sheets Auto-Sync] Automatically synchronized ${filteredNewLeads.length} new leads.`);
              }
            }
          }
        } catch (err) {
          console.warn("[Google Sheets Background-Sync Interrupted]:", err);
        } finally {
          isSyncingSheetsRef.current = false;
        }
      }
    };

    // Steady interval: every 60 seconds, starting with a 7 second initial delay
    const intervalId = setInterval(runSheetsBackgroundSync, 60000);
    const timeoutId = setTimeout(runSheetsBackgroundSync, 7000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  const metaAutoIngestRef = useRef(metaAutoIngest);
  useEffect(() => {
    metaAutoIngestRef.current = metaAutoIngest;
  }, [metaAutoIngest]);

  // Background Meta Ads Leads Inbound sync Loop
  useEffect(() => {
    const runMetaBackgroundSync = async () => {
      if (isSoftwarePausedRef.current) {
        return;
      }
      // Security check: Only trigger background sync for Admins or Super Admins
      const u = currentUserRef.current;
      if (!u || (u.role !== "super_admin" && u.role !== "admin")) {
        return;
      }

      const isAuto = metaAutoIngestRef.current;
      if (!isAuto) return;

      try {
        const response = await fetch("/api/meta-ads/incoming-leads");
        if (!response.ok) return;
        const data = await response.json();

        if (data && data.leads && data.leads.length > 0) {
          const incoming = data.leads;
          
          // Filter out duplicates
          const currentLeads = leadsRef.current;
          const filteredIncoming = incoming.filter((inc: any) => {
            return !currentLeads.some((l) => l.id === inc.id || (inc.phone && l.phone === inc.phone));
          });

          if (filteredIncoming.length > 0) {
            // Append them to state!
            setLeads((prev) => [...filteredIncoming, ...prev]);

            // Set timestamps
            const updatedTime = new Date().toLocaleTimeString("en-US", { hour12: true }) + " (Local)";
            setLastMetaSynced(updatedTime);
            localStorage.setItem("meta_last_synced_time", updatedTime);

            // Log synchronized action
            const logMsg = `[Meta Webhook Sync] Automatically ingested ${filteredIncoming.length} new lead(s) set to 'Pending Assignment'.`;
            console.log(logMsg);
            
            // Log this sync event to Sync history
            setSyncHistory(prev => [
              `${new Date().toISOString().replace('T', ' ').substring(0,19)} GMT - Ingested ${filteredIncoming.length} Meta Ad Leads`,
              ...prev
            ]);
            
            // Dispatch a window event to trigger reactive announcements if listening
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent("meta-lead-received", { detail: filteredIncoming }));
            }
          }
        }
      } catch (err) {
        console.warn("[Meta Background-Sync Interrupted]:", err);
      }
    };

    // run sync every 60 seconds (reduced from 15s to ease API load)
    const intervalId = setInterval(runMetaBackgroundSync, 60000);
    return () => clearInterval(intervalId);
  }, []);

  // Real-time Background Sync Loop for Supabase Cloud Database Tables
  useEffect(() => {
    let isFetching = false;

    const runSupabaseRealtimeSync = async () => {
      // 1. Guard check: only run if CRM data is loaded, and auto-sync is enabled
      if (isSoftwarePausedRef.current) {
        return;
      }
      if (!crmDataLoadedRef.current || !isAutoSyncEnabledRef.current) {
        return;
      }
      if (isFetching) {
        return;
      }

      isFetching = true;
      try {
        const res = await pullSupabaseData();
        if (res.errors && res.errors.length > 0) {
          // If there is any connection error, log and return silently
          console.warn("[Realtime Sync Warning]:", res.errors.join(", "));
          isFetching = false;
          return;
        }

        // Compare and update leads
        if (res.leads) {
          // Filter out duplicates just in case
          const uniquePulled: Lead[] = [];
          res.leads.forEach(l => {
            if (!uniquePulled.some(item => item.id === l.id)) {
              uniquePulled.push(l);
            }
          });

          // Handled transition lock logic: if local update happened key-wise < 25 seconds ago,
          // OR if the local version's lastActionTimestamp (or other modifications) is newer than the remote version,
          // maintain local values to allow database writes to finish and sync properly,
          // preventing race condition state flipping or defaults back to old status.
          const currentLeads = leadsRef.current || [];
          const nowTime = Date.now();
          const uniquePulledHandled = ensureStableTimestamps(uniquePulled.map(l => {
            const lastLocalTime = lastLocalUpdateRef.current[l.id];
            const localLead = currentLeads.find(cl => cl.id === l.id);
            if (localLead) {
              const localTime = lastLocalTime || 0;
              const hasActiveLock = (nowTime - localTime < 25000);
              const localUpdated = localLead.lastActionTimestamp || 0;
              const remoteUpdated = l.lastActionTimestamp || 0;
              if (hasActiveLock || localUpdated > remoteUpdated) {
                return localLead;
              }
            }
            return l;
          }), usersRef.current || []);

          // Check if different from leadsRef.current
          const sortedA = [...uniquePulledHandled].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const sortedB = [...currentLeads].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const isLeadsDifferent = JSON.stringify(sortedA) !== JSON.stringify(sortedB);

          if (isLeadsDifferent) {
            console.log("[Realtime Sync] Merging real-time lead updates from Supabase with write-lock safety.");
            setLeads(uniquePulledHandled);
            localStorage.setItem("elite_pro_leads", JSON.stringify(uniquePulledHandled));
          }
        }

        // Compare and update users
        if (res.users) {
          const currentUsers = usersRef.current || [];
          
          // Merge remote users with local-only fields
          const mergedUsers = res.users.map(remoteUser => {
            const localUser = currentUsers.find(u => u.id === remoteUser.id || String(u.email).toLowerCase() === String(remoteUser.email).toLowerCase());
            return {
              ...remoteUser,
              // If remote active is undefined (column missing on remote DB), preserve local active state
              active: remoteUser.active === undefined && localUser ? localUser.active : remoteUser.active,
              password: remoteUser.password || (localUser ? localUser.password : undefined)
            };
          });

          // Add any local-only users not in remote DB
          currentUsers.forEach(localUser => {
            const hasRemote = mergedUsers.some(u => u.id === localUser.id || String(u.email).toLowerCase() === String(localUser.email).toLowerCase());
            if (!hasRemote) {
              mergedUsers.push(localUser);
            }
          });

          const sortedA = [...mergedUsers].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const sortedB = [...currentUsers].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const isUsersDifferent = JSON.stringify(sortedA) !== JSON.stringify(sortedB);

          if (isUsersDifferent) {
            setUsers(mergedUsers);
          }
        }

        // Compare and update appointments
        if (res.appointments) {
          const currentAppts = appointmentsRef.current || [];
          const sortedA = [...res.appointments].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const sortedB = [...currentAppts].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const isApptsDifferent = JSON.stringify(sortedA) !== JSON.stringify(sortedB);

          if (isApptsDifferent) {
            setAppointments(res.appointments);
            localStorage.setItem("elite_pro_appointments", JSON.stringify(res.appointments));
          }
        }

        // Compare and update communication logs
        if (res.communicationLogs) {
          const currentLogs = communicationLogsRef.current || [];
          const sortedA = [...res.communicationLogs].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const sortedB = [...currentLogs].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const isCommsDifferent = JSON.stringify(sortedA) !== JSON.stringify(sortedB);

          if (isCommsDifferent) {
            setCommunicationLogs(res.communicationLogs);
            localStorage.setItem("elite_pro_communication_logs", JSON.stringify(res.communicationLogs));
          }
        }

        // Compare and update edit logs
        if (res.leadEditLogs) {
          const currentEdits = leadEditLogsRef.current || [];
          const sortedA = [...res.leadEditLogs].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const sortedB = [...currentEdits].sort((x, y) => String(x.id).localeCompare(String(y.id)));
          const isEditsDifferent = JSON.stringify(sortedA) !== JSON.stringify(sortedB);

          if (isEditsDifferent) {
            setLeadEditLogs(res.leadEditLogs);
            localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(res.leadEditLogs));
          }
        }

      } catch (err) {
        console.warn("[Realtime Sync Interrupted]:", err);
      } finally {
        isFetching = false;
      }
    };

    // run sync every 30 seconds (reduced from 5s to ease server/API load)
    const intervalId = setInterval(runSupabaseRealtimeSync, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Sync initialization for pre-existing New Lead elements without tracking data stably via local cache fallback
  useEffect(() => {
    if (leads.length === 0) return;
    const initializedLeads = ensureStableTimestamps(leads, users);
    const differs = initializedLeads.some((sl, idx) => {
      const orig = leads[idx];
      if (!orig) return true;
      return (
        sl.assignmentTimestamp !== orig.assignmentTimestamp ||
        sl.lastActionTimestamp !== orig.lastActionTimestamp ||
        sl.reassignedTimestamp !== orig.reassignedTimestamp ||
        sl.assignedTlId !== orig.assignedTlId
      );
    });
    if (differs) {
      setLeads(initializedLeads);
    }
  }, [users, leads]);

  // Auto-transfer rules (60-minute idle transfers and 48-hour status transfers) have been permanently removed from the system.


  // Handler: Bulk Transfer Leads
  const handleBulkTransferLeads = async (leadIds: string[], targetAgentNames: string[]): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!currentUser) {
      return { success: false, count: 0, error: "No authenticated user session found." };
    }

    if (!targetAgentNames || targetAgentNames.length === 0) {
      return { success: false, count: 0, error: "No target advisors were selected for reallocation." };
    }
    
    const now = Date.now();
    
    // Find all target assignees in our active roster
    const targetAssignees: User[] = [];
    const missingAgents: string[] = [];
    
    targetAgentNames.forEach(name => {
      const uNameClean = name.trim().toLowerCase();
      const found = users.find(
        u => (u.name || "").trim().toLowerCase() === uNameClean && (u.role === "team_leader" || u.role === "sales_team")
      );
      if (found) {
        targetAssignees.push(found);
      } else {
        missingAgents.push(name);
      }
    });
    
    if (targetAssignees.length === 0) {
      return { 
        success: false, 
        count: 0, 
        error: "None of the selected recipient advisors could be located in directory." 
      };
    }

    const updatedLeads: Lead[] = [];
    const newEditLogs: LeadEditLog[] = [];
    const newNotifications: AppNotification[] = [];

    // Filter leads that belong to leadIds list
    const leadsToTransfer = leads.filter(l => leadIds.includes(l.id));

    leadsToTransfer.forEach((lead, index) => {
      // Round-robin index selection across chosen checklists
      const newAssignee = targetAssignees[index % targetAssignees.length];
      
      lastLocalUpdateRef.current[lead.id] = now;
      const oldAgent = lead.assignedAgent || "Unassigned";
      
      if (oldAgent.trim().toLowerCase() === newAssignee.name.trim().toLowerCase()) {
        return;
      }

      const finalUpdated: Lead = {
        ...lead,
        assignedAgent: newAssignee.name,
        assignedTlId: newAssignee.id,
        assignmentTimestamp: now,
        lastActionTimestamp: now,
        reassignedTimestamp: now,
        dateUpdated: new Date().toISOString().split("T")[0]
      };

      updatedLeads.push(finalUpdated);

      // Edit log representation
      const newLog: LeadEditLog = {
        id: "edit-log-bulk-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        leadId: lead.id,
        leadName: lead.name,
        editorName: currentUser.name,
        editorRole: currentUser.role,
        timestamp: new Date().toLocaleString("en-US", { 
          timeStyle: "medium", 
          dateStyle: "medium",
          timeZone: "UTC"
        }) + " UTC",
        changes: [
          { field: "assignedAgent", oldValue: oldAgent, newValue: newAssignee.name }
        ]
      };
      newEditLogs.push(newLog);

      // Assignment notifications
      const notif: AppNotification = {
        id: "notif-bulk-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
        recipientName: newAssignee.name,
        title: "Bulk Reallocation Assignment",
        message: `Investor lead "${lead.name}" has been transferred to you as part of a bulk status reallocation by ${currentUser.name}.`,
        source: lead.source,
        timestamp: new Date().toLocaleString("en-US", { 
          timeStyle: "short", 
          dateStyle: "medium"
        }),
        isRead: false,
        type: "assignment",
        leadId: lead.id,
        leadName: lead.name
      };
      newNotifications.push(notif);
    });

    if (updatedLeads.length === 0) {
      return { success: true, count: 0 };
    }

    setLeads(prev => prev.map(l => {
      const match = updatedLeads.find(ul => ul.id === l.id);
      return match ? match : l;
    }));

    setLeadEditLogs(prev => [...newEditLogs, ...prev]);
    setNotifications(prev => [...newNotifications, ...prev]);

    if (isAutoSyncEnabled) {
      try {
        const leadPromises = updatedLeads.map(l => dbUpsertLead(l));
        const logPromises = newEditLogs.map(el => dbUpsertLeadEditLog(el));
        const results = await Promise.all([...leadPromises, ...logPromises]);
        const errors = results.filter(r => !r.success).map(r => r.error);
        if (errors.length > 0) {
          console.warn("[Bulk Reassignment database sync warnings]:", errors);
        }
      } catch (err: any) {
        console.warn("[Bulk Reassignment sync exception]:", err);
      }
    }

    return { success: true, count: updatedLeads.length };
  };


  // Handler: Update Lead
  const handleUpdateLead = async (updated: Lead) => {
    // Record local change timestamp to prevent real-time sync overwrites for 10 seconds
    lastLocalUpdateRef.current[updated.id] = Date.now();
    const oldLead = leads.find(l => l.id === updated.id);
    let newLog: LeadEditLog | null = null;
    let finalUpdated = { ...updated };
    
    if (oldLead && currentUser) {
      const now = Date.now();
      const assigneeChanged = (oldLead.assignedAgent || "").trim().toLowerCase() !== (finalUpdated.assignedAgent || "").trim().toLowerCase();
      
      const cleanAgentNameUpdate = (finalUpdated.assignedAgent || "").trim().toLowerCase();
      const newAssignee = users.find(
        u => (u.name || "").trim().toLowerCase() === cleanAgentNameUpdate && (u.role === "team_leader" || u.role === "sales_team")
      );
      
      if (newAssignee) {
        finalUpdated.assignedTlId = newAssignee.id;
        const statusChangedToNewLead = (oldLead.status !== "New Lead" && finalUpdated.status === "New Lead");
        if (assigneeChanged || statusChangedToNewLead) {
          finalUpdated.assignmentTimestamp = now;
          finalUpdated.lastActionTimestamp = now;
        } else {
          // Check if any trackable field actually changed to reset inactivity timer
          const fieldsToTrack: (keyof Lead)[] = [
            "name", "company", "position", "email", "phone", "source", "status", "temperature", "budget", "location", "notes", "score", "projectName"
          ];
          const hasChanges = fieldsToTrack.some(field => {
            const oldVal = (oldLead[field] !== undefined && oldLead[field] !== null) ? String(oldLead[field]) : "";
            const newVal = (finalUpdated[field] !== undefined && finalUpdated[field] !== null) ? String(finalUpdated[field]) : "";
            return oldVal !== newVal;
          });
          if (hasChanges) {
            finalUpdated.lastActionTimestamp = now;
          }
        }
      } else {
        // Clear if not TL or Sales Team
        finalUpdated.assignedTlId = undefined;
        finalUpdated.assignmentTimestamp = undefined;
        finalUpdated.lastActionTimestamp = now;
      }

      const changes: { field: string; oldValue: string; newValue: string }[] = [];
      const fieldsToTrack: (keyof Lead)[] = [
        "name", "company", "position", "email", "phone", "source", "status", "temperature", "budget", "location", "assignedAgent", "notes", "score", "projectName"
      ];
      
      fieldsToTrack.forEach(field => {
         const oldVal = (oldLead[field] !== undefined && oldLead[field] !== null) ? String(oldLead[field]) : "";
         const newVal = (finalUpdated[field] !== undefined && finalUpdated[field] !== null) ? String(finalUpdated[field]) : "";
         if (oldVal !== newVal) {
           changes.push({
             field,
             oldValue: oldVal,
             newValue: newVal
           });
         }
      });

      // Create an assignment notification if the assignee value has changed
      if (oldLead.assignedAgent.toLowerCase() !== finalUpdated.assignedAgent.toLowerCase() && finalUpdated.assignedAgent) {
        const newNotif: AppNotification = {
          id: "notif-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
          recipientName: finalUpdated.assignedAgent,
          title: "New Lead Reassigned",
          message: `Investor lead "${finalUpdated.name}" has been reassigned to you by ${currentUser.name}.`,
          source: finalUpdated.source,
          timestamp: new Date().toLocaleString("en-US", { 
            timeStyle: "short", 
            dateStyle: "medium"
          }),
          isRead: false,
          type: "assignment",
          leadId: finalUpdated.id,
          leadName: finalUpdated.name
        };
        setNotifications(prev => [newNotif, ...prev]);

        // Auto notification dispatch window on reassignment
        // Only trigger for Admin or Super Admin
        if (newAssignee && (currentUser?.role === "super_admin" || currentUser?.role === "admin")) {
          const textMessage = `*ELITE PRO INFRA ADVISORY ALERT*\n\n` +
            `Hello *${newAssignee.name}*,\n` +
            `You have been assigned a new Client Lead!\n\n` +
            `🔹 *Client:* ${finalUpdated.name || "N/A"}\n` +
            `🔹 *Project:* ${finalUpdated.projectName || "N/A"}\n` +
            `🔹 *Budget Plan:* ${finalUpdated.budget || "N/A"}\n` +
            `🔹 *Location:* ${finalUpdated.location || "N/A"}\n` +
            `🔹 *Reference Source:* ${finalUpdated.source || "N/A"}\n` +
            `💬 *Client Notes:* ${finalUpdated.notes || "No extra notes."}\n\n` +
            `Please contact the lead immediately. High conversion priority.`;
          
          const sanitizedPhone = (newAssignee.phone || "").replace(/[+\s-]/g, "");
          const waHref = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(textMessage)}`;
          
          setActiveAutoDispatch({
            isOpen: true,
            leadName: finalUpdated.name,
            agentName: newAssignee.name,
            phone: newAssignee.phone || "N/A",
            message: textMessage,
            waHref,
          });

          const localTime = new Date().toLocaleTimeString();
          setSyncHistory(prev => [
            `[${localTime}] - [MANUAL ASSIGNMENT ALERT] Queued dispatch parameters for ${newAssignee.name}`,
            ...prev
          ]);
        }
      }

      // Create an edit log if there are alterations
      if (changes.length > 0) {
        newLog = {
          id: "edit-log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
          leadId: finalUpdated.id,
          leadName: finalUpdated.name,
          editorName: currentUser.name,
          editorRole: currentUser.role,
          timestamp: new Date().toLocaleString("en-US", { 
            timeStyle: "medium", 
            dateStyle: "medium",
            timeZone: "UTC"
          }) + " UTC",
          changes
        };
        setLeadEditLogs(prev => [newLog!, ...prev]);
      }
    }
    setLeads(prev => prev.map(l => l.id === finalUpdated.id ? finalUpdated : l));


    if (isAutoSyncEnabled) {
      const res = await dbUpsertLead(finalUpdated);
      if (!res.success) {
        console.warn("Lead update save failed on Supabase:", res.error);
        triggerAlert(
          "Supabase Update Failure",
          `Changes saved locally, but failed to sync online to Supabase.\n\nDatabase Error: "${res.error || "Permission Denied / Missing Table 'leads'"}"`
        );
      } else if (newLog) {
        const editLogRes = await dbUpsertLeadEditLog(newLog);
        if (!editLogRes.success) {
          console.warn("Lead edit log sync failed on Supabase:", editLogRes.error);
        }
      }
    }
  };

  // Handler: Delete Lead
  const handleDeleteLead = (id: string) => {
    // Role-based Access Control authorization filter
    if (currentUser?.role !== "super_admin" && currentUser?.role !== "admin") {
      triggerAlert(
        "Access Refused",
        `Full hard removal of real-estate lead portfolios requires [Super Admin] or [Admin] authority. Your current role [${currentUser?.role?.replace('_', ' ').toUpperCase()}] does not possess this permit.`
      );
      return;
    }

    triggerConfirm(
      "Confirm Investor Removal",
      "Are you sure you want to remove this investor registration? All communication logs will remain secured in metadata.",
      async () => {
        setLeads(prev => prev.filter(l => l.id !== id));
        if (isAutoSyncEnabled) {
          const res = await dbDeleteLead(id);
          if (!res.success) {
            console.warn("Delete lead failed on Supabase:", res.error);
            triggerAlert(
              "Supabase Delete Warning",
              `Investor removed locally, but could not delete from Supabase database!\n\nError: ${res.error || "Network error"}`
            );
          }
        }
      }
    );
  };

  // Handler: Bulk Delete Leads
  const handleBulkDeleteLeads = (ids: string[]) => {
    // Role-based Access Control authorization filter
    if (currentUser?.role !== "super_admin" && currentUser?.role !== "admin") {
      triggerAlert(
        "Access Refused",
        `Full hard removal of real-estate lead portfolios requires [Super Admin] or [Admin] authority.`
      );
      return;
    }

    triggerConfirm(
      "Confirm Bulk Investor Removal",
      `Are you sure you want to permanently remove the ${ids.length} selected investor registrations? All records will preserve data integrity locally and compile for cloud sync.`,
      async () => {
        setLeads(prev => prev.filter(l => !ids.includes(l.id)));
        if (isAutoSyncEnabled) {
          let failCount = 0;
          let lastErrorMessage = "";
          for (const id of ids) {
            const res = await dbDeleteLead(id);
            if (!res.success) {
              failCount++;
              lastErrorMessage = res.error || "Network/Server error";
            }
          }
          if (failCount > 0) {
            console.warn(`Bulk delete partially failed: ${failCount} of ${ids.length} could not delete from Supabase.`);
            triggerAlert(
              "Supabase Sync Warning",
              `Selected investors removed locally, but ${failCount} entries could not be deleted from Supabase database!\n\nLast Error: ${lastErrorMessage}`
            );
          }
        }
      }
    );
  };

  // Handler: Add Appointment
  const handleAddAppointment = async (appt: Omit<Appointment, "id" | "isCompleted">) => {
    const id = "app-" + (appointments.length + 1) + "-" + Math.random().toString(36).substr(2, 4);
    const item: Appointment = {
      ...appt,
      id,
      isCompleted: false
    };
    setAppointments(prev => [item, ...prev]);

    if (isAutoSyncEnabled) {
      const parentLead = leads.find(l => l.id === item.leadId);
      if (parentLead) {
        const leadRes = await dbUpsertLead(parentLead);
        if (!leadRes.success) {
          console.warn("Failed to sync parent lead before adding appointment:", leadRes.error);
        }
      }
      const res = await dbUpsertAppointment(item);
      if (!res.success) {
        console.warn("Appointment creation failed on Supabase:", res.error);
        triggerAlert(
          "Supabase Agenda Sync failure",
          `Appointment scheduled locally, but failed to upload to Supabase.\n\nDatabase Error: "${res.error || "Missing table 'appointments' or permission blocked"}"`
        );
      }
    }
  };

  // Handler: Update Appointment
  const handleUpdateAppointment = async (updated: Appointment) => {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));

    if (isAutoSyncEnabled) {
      const parentLead = leads.find(l => l.id === updated.leadId);
      if (parentLead) {
        const leadRes = await dbUpsertLead(parentLead);
        if (!leadRes.success) {
          console.warn("Failed to sync parent lead before updating appointment:", leadRes.error);
        }
      }
      const res = await dbUpsertAppointment(updated);
      if (!res.success) {
        console.warn("Appointment updates failed on Supabase:", res.error);
        triggerAlert(
          "Supabase Agenda Sync failure",
          `Appointment changes saved locally, but failed to update Supabase.\n\nDatabase Error: "${res.error || "Missing table 'appointments' or permission blocked"}"`
        );
      }
    }
  };

  // Handler: Delete Appointment
  const handleDeleteAppointment = (idOrIds: string | string[], skipConfirm = false) => {
    // Role-based Access Control authorization filter
    if (currentUser?.role === "sales_team") {
      triggerAlert(
        "Access Refused",
        "Sales Advisor accounts are unauthorized to delete active client appointments. Please coordinate with operations admins or super administrators."
      );
      return;
    }

    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (skipConfirm) {
      setAppointments(prev => prev.filter(a => !ids.includes(a.id)));
      if (isAutoSyncEnabled) {
        ids.forEach(id => {
          dbDeleteAppointment(id).then(res => {
            if (!res.success) {
              console.warn("Appointment removal failed on Supabase:", res.error);
              triggerAlert(
                "Supabase Agenda Sync alert",
                `Appointment unscheduled locally, but delete failed on Supabase.\n\nDatabase Error: "${res.error || "Missing table or network error"}"`
              );
            }
          });
        });
      }
      return;
    }

    triggerConfirm(
      "Confirm Appointment Removal",
      ids.length > 1 
        ? `Are you sure you want to delete these ${ids.length} scheduled meetings?`
        : "Are you sure you want to delete this scheduled meeting? This changes live corporate agendas.",
      async () => {
        setAppointments(prev => prev.filter(a => !ids.includes(a.id)));
        if (isAutoSyncEnabled) {
          for (const id of ids) {
            const res = await dbDeleteAppointment(id);
            if (!res.success) {
              console.warn("Appointment removal failed on Supabase:", res.error);
              triggerAlert(
                "Supabase Agenda Sync alert",
                `Appointment unscheduled locally, but delete failed on Supabase.\n\nDatabase Error: "${res.error || "Missing table or network error"}"`
              );
            }
          }
        }
      }
    );
  };

  // Handler: Clear All Selected Reminders
  const handleClearAllAppointments = async () => {
    if (currentUser?.role === "sales_team") {
      triggerAlert(
        "Access Refused",
        "Sales Advisor accounts are unauthorized to clear scheduled or completed appointments."
      );
      return;
    }

    setAppointments([]);
    localStorage.setItem("elite_pro_appointments", JSON.stringify([]));

    if (isAutoSyncEnabled) {
      try {
        const response = await fetch("/api/db/clear-all-appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          const resJson = await response.json();
          console.warn("Failed to delete reminders on Supabase:", resJson.error);
        }
      } catch (err) {
        console.warn("Failed to delete reminders from Supabase:", err);
      }
    }

    setSyncHistory(prev => [
      `[${new Date().toLocaleTimeString()}] - [REMINDERS PURGED] Cleared all scheduled appointments and active reminders globally.`,
      ...prev
    ]);
  };

  // Handler: Full Master Portfolios Recovery Restore
  const handleRestoreCrmData = async (data: {
    leads?: Lead[];
    users?: User[];
    appointments?: Appointment[];
    communicationLogs?: CommunicationLog[];
    leadEditLogs?: LeadEditLog[];
  }) => {
    if (data.leads && data.leads.length > 0) {
      setLeads(data.leads);
      localStorage.setItem("elite_pro_leads", JSON.stringify(data.leads));
    }
    if (data.users && data.users.length > 0) {
      setUsers(data.users);
      localStorage.setItem("elite_pro_users", JSON.stringify(data.users));
    }
    if (data.appointments && data.appointments.length > 0) {
      setAppointments(data.appointments);
      localStorage.setItem("elite_pro_appointments", JSON.stringify(data.appointments));
    }
    if (data.communicationLogs && data.communicationLogs.length > 0) {
      setCommunicationLogs(data.communicationLogs);
      localStorage.setItem("elite_pro_communication_logs", JSON.stringify(data.communicationLogs));
    }
    if (data.leadEditLogs && data.leadEditLogs.length > 0) {
      setLeadEditLogs(data.leadEditLogs);
      localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify(data.leadEditLogs));
    }
  };

  // Handler: Full Purge & Hard Reset of All Records
  const handleClearAllRecords = async (): Promise<{ success: boolean; errors?: string[] }> => {
    try {
      const response = await fetch("/api/db/clear-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const res = await response.json();
      
      // Update local states regardless of server database errors so the client is clean
      setLeads([]);
      setAppointments([]);
      setCommunicationLogs([]);
      setLeadEditLogs([]);

      // Sync and store empty arrays as absolute truth
      localStorage.setItem("elite_pro_leads", JSON.stringify([]));
      localStorage.setItem("elite_pro_appointments", JSON.stringify([]));
      localStorage.setItem("elite_pro_communication_logs", JSON.stringify([]));
      localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify([]));

      setSyncHistory(prev => [
        `${new Date().toISOString().replace("T", " ").substr(0, 19)} GMT - All portal records & server caches cleared successfully.`,
        ...prev
      ]);

      return { success: res.success, errors: res.errors };
    } catch (err: any) {
      console.error("Failed to clear CRM records:", err);
      // Fallback clean even if error
      setLeads([]);
      setAppointments([]);
      setCommunicationLogs([]);
      setLeadEditLogs([]);
      localStorage.setItem("elite_pro_leads", JSON.stringify([]));
      localStorage.setItem("elite_pro_appointments", JSON.stringify([]));
      localStorage.setItem("elite_pro_communication_logs", JSON.stringify([]));
      localStorage.setItem("elite_pro_lead_edit_logs", JSON.stringify([]));

      return { success: false, errors: [err.message || String(err)] };
    }
  };

  // Handler: Add Communication Log
  const handleAddCommunicationLog = async (log: Omit<CommunicationLog, "id">) => {
    const id = "log-" + (communicationLogs.length + 1) + "-" + Math.random().toString(36).substr(2, 4);
    const item: CommunicationLog = {
      ...log,
      id
    };
    setCommunicationLogs(prev => [item, ...prev]);
    setIsMobileModeActive(true); // Signal activity state icon on companion mobile sidebar
    
    // Reset inactivity timer on parent lead by updating its lastActionTimestamp
    const nowTimestamp = Date.now();
    const currentDateStr = new Date().toISOString().split("T")[0];
    let syncedParentLead: Lead | undefined;

    setLeads(prev => prev.map(l => {
      if (l.id === item.leadId) {
        const updatedL = {
          ...l,
          lastActionTimestamp: nowTimestamp,
          dateUpdated: currentDateStr
        };
        syncedParentLead = updatedL;
        return updatedL;
      }
      return l;
    }));

    if (isAutoSyncEnabled) {
      const parentLead = syncedParentLead || leads.find(l => l.id === item.leadId);
      if (parentLead) {
        const leadRes = await dbUpsertLead(parentLead);
        if (!leadRes.success) {
          console.warn("Failed to sync parent lead before adding communication log:", leadRes.error);
        }
      }
      const res = await dbUpsertCommunicationLog(item);
      if (!res.success) {
        console.warn("Communication log sync failed on Supabase:", res.error);
        triggerAlert(
          "Supabase Interaction Logger alert",
          `Interaction logged locally, but could not sync log to Supabase.\n\nDatabase Error: "${res.error || "Missing table 'communication_logs' or permission restricted"}"`
        );
      }
    }
  };

  // Master Synchronizer Action (simulates API connection)
  const handleMasterSynchronization = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date();
      const timeStr = now.toISOString().replace("T", " ").substr(0, 19) + " GMT";
      setSyncHistory(prev => [
        `${timeStr} - Forced Synchronization complete. Workspace calendar & CRM systems mapped.`,
        ...prev
      ]);
    }, 1800);
  };

  // Toggle Dark Mode
  const handleToggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  // Handle Logout
  const handleLogout = () => {
    triggerConfirm(
      "Confirm Logout",
      "Do you want to log out of Elite Pro CRM? This will secure your active session.",
      () => {
        setCurrentUser(null);
      }
    );
  };

  // Guard check to filter out active view tab restrictions
  const isViewRestricted = (tabId: string) => {
    if (currentUser?.role === "sales_team") {
      return tabId === "reports" || tabId === "integrations" || tabId === "users";
    }
    if (currentUser?.role === "team_leader") {
      return tabId === "integrations";
    }
    return false;
  };

  // Render locked screen styling inside the tab runway
  const renderRestrictedAccessBlock = (moduleLabel: string, permittedRoles: string[]) => {
    return (
      <div className={`p-10 rounded-3xl border transition-all flex flex-col items-center justify-center text-center max-w-xl mx-auto my-14
        ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/10"}`}
      >
        <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-5 animate-pulse">
          <Lock size={32} className="stroke-[1.75]" />
        </div>
        
        <h3 className={`font-display font-bold text-xl tracking-tight mb-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
          Module Access Unauthorized
        </h3>
        
        <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
          The proprietary module <span className="text-teal-400 uppercase font-mono font-bold">[{moduleLabel}]</span> is restricted from your assigned security level. Board policies mandate high-level credentials for access.
        </p>

        <div className={`w-full p-4 rounded-xl border text-left space-y-3 mb-6
          ${darkMode ? "bg-slate-950/70 border-slate-805" : "bg-slate-50 border-slate-200/50"}`}
        >
          <div>
            <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400 block mb-1">Permitted Levels:</span>
            <div className="flex gap-2.5">
              {permittedRoles.map((role, i) => (
                <span key={i} className="px-2.5 py-0.5 rounded-md text-[9px] font-mono border font-bold uppercase bg-teal-500/15 border-teal-500/30 text-teal-400">
                  {role.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
          
          <div className="border-t border-slate-100/10 pt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Your Identity: <strong className="text-rose-400 uppercase font-mono">{currentUser?.name}</strong></span>
            <span className="px-2 py-0.5 rounded-md text-[9px] font-mono border font-bold uppercase bg-rose-500/10 border-rose-500/30 text-rose-400">
              {currentUser?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <button 
          id="restricted-bypass-btn"
          onClick={() => setCurrentUser(null)}
          className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs tracking-wide uppercase transition shadow-md shadow-teal-500/10 cursor-pointer active:scale-95"
        >
          Securely Switch Admin Account
        </button>
      </div>
    );
  };

  // Render sub-components based on active tab state
  const renderTabContent = () => {
    if (isViewRestricted(currentTab)) {
      if (currentTab === "reports") {
        return renderRestrictedAccessBlock("Stakeholder Reports", ["super_admin", "admin"]);
      }
      if (currentTab === "integrations") {
        return renderRestrictedAccessBlock("System Sync", ["super_admin", "admin"]);
      }
      if (currentTab === "users") {
        return renderRestrictedAccessBlock("Sales Team Accounts", ["super_admin", "admin"]);
      }
    }

    switch (currentTab) {
      case "dashboard":
        return (
          <PerformanceDashboard
            leads={visibleLeads}
            users={users}
            currentUser={currentUser}
            metricsHistory={SALES_METRICS_HISTORY}
            darkMode={darkMode}
            onNavigateToLeads={() => setCurrentTab("leads")}
          />
        );
      case "leads":
        return (
          <LeadPipeline
            leads={visibleLeads}
            users={users}
            onAddLead={handleAddLead}
            onBulkAddLeads={handleBulkAddLeads}
            onUpdateLead={handleUpdateLead}
            onDeleteLead={handleDeleteLead}
            onBulkDeleteLeads={handleBulkDeleteLeads}
            onBulkTransferLeads={handleBulkTransferLeads}
            communicationLogs={communicationLogs}
            onAddCommunicationLog={handleAddCommunicationLog}
            darkMode={darkMode}
            currentUser={currentUser}
            leadEditLogs={visibleLeadEditLogs}
            onClearLeadEditLogs={handleClearLeadEditLogs}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            appointments={appointments}
            triggerConfirm={triggerConfirm}
            triggerAlert={triggerAlert}
          />
        );
      case "calendar":
        return (
          <AppointmentsList
            appointments={visibleAppointments}
            leads={visibleLeads}
            users={users}
            currentUser={currentUser}
            onAddAppointment={handleAddAppointment}
            onUpdateAppointment={handleUpdateAppointment}
            onDeleteAppointment={handleDeleteAppointment}
            onClearAllAppointments={handleClearAllAppointments}
            darkMode={darkMode}
            triggerConfirm={triggerConfirm}
            triggerAlert={triggerAlert}
          />
        );
      case "reports":
        return (
          <StakeholderReports
            leads={visibleLeads}
            darkMode={darkMode}
          />
        );
      case "integrations":
        return (
          <SystemSync
            currentUser={currentUser}
            darkMode={darkMode}
            isSyncing={isSyncing}
            onTriggerSync={handleMasterSynchronization}
            syncHistory={syncHistory}
            supabaseStatus={supabaseStatus}
            isSupabaseOpInProgress={isSupabaseOpInProgress}
            onPushToSupabase={handlePushToSupabase}
            onPullFromSupabase={handlePullFromSupabase}
            onRefreshSupabaseStatus={refreshSupabaseStatus}
            isAutoSyncEnabled={isAutoSyncEnabled}
            onToggleAutoSync={handleToggleAutoSync}
            users={users}
            leads={leads}
            appointments={appointments}
            communicationLogs={communicationLogs}
            leadEditLogs={leadEditLogs}
            onBulkAddLeads={handleBulkAddLeads}
            sheetUrl={sheetUrl}
            setSheetUrl={setSheetUrl}
            sheetRange={sheetRange}
            setSheetRange={setSheetRange}
            autoSheetsSync={autoSheetsSync}
            setAutoSheetsSync={setAutoSheetsSync}
            lastSheetsSynced={lastSheetsSynced}
            setLastSheetsSynced={setLastSheetsSynced}
            metaVerifyToken={metaVerifyToken}
            setMetaVerifyToken={setMetaVerifyToken}
            metaAutoIngest={metaAutoIngest}
            setMetaAutoIngest={setMetaAutoIngest}
            lastMetaSynced={lastMetaSynced}
            setLastMetaSynced={setLastMetaSynced}
            githubRepoUrl={githubRepoUrl}
            setGithubRepoUrl={setGithubRepoUrl}
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            githubAutoSync={githubAutoSync}
            setGithubAutoSync={setGithubAutoSync}
            onRestoreCrmData={handleRestoreCrmData}
            onClearAllRecords={handleClearAllRecords}
          />
        );
      case "users":
        return (
          <UserManagement
            users={users}
            leads={leads}
            currentUser={currentUser}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            darkMode={darkMode}
          />
        );
      case "mobile-simulation":
        return (
          <MobileCompanion
            leads={visibleLeads}
            onUpdateLead={handleUpdateLead}
            onAddCommunicationLog={handleAddCommunicationLog}
            onTriggerSync={handleMasterSynchronization}
            darkMode={darkMode}
            currentUser={currentUser}
          />
        );
      default:
        return (
          <PerformanceDashboard
            leads={visibleLeads}
            users={users}
            currentUser={currentUser}
            metricsHistory={SALES_METRICS_HISTORY}
            darkMode={darkMode}
            onNavigateToLeads={() => setCurrentTab("leads")}
          />
        );
    }
  };

  // If there's no logged-in user session, render the beautiful, dedicated Security Control Login Gate!
  if (!currentUser) {
    return (
      <LoginPortal 
        users={users}
        onLoginSuccess={(user) => {
          setDeactivatedError("");
          setCurrentUser(user);
          // Auto route to lead pipeline or dashboard
          setCurrentTab("dashboard");
        }}
        darkMode={darkMode}
        initialError={deactivatedError}
      />
    );
  }

  const todayRemindersCount = appointments.filter(a => a.date === new Date().toISOString().split("T")[0] && !a.isCompleted).length;

  return (
    <div 
      id="root-viewport-wrap"
      className={`min-h-screen transition-colors duration-300 flex overflow-hidden
        ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}
    >
      {/* Sidebar Controller Component */}
      <Sidebar
        currentTab={currentTab}
        onChangeTab={(tab) => {
          setCurrentTab(tab);
          if (tab === "mobile-simulation") {
            setIsMobileModeActive(false); // Reset notification dot once viewed
          }
        }}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        isSyncing={isSyncing}
        onTriggerSync={handleMasterSynchronization}
        isMobileModeActive={isMobileModeActive}
        currentUser={currentUser}
        onLogout={handleLogout}
        onUpdateUserAvatar={(newUrl) => {
          if (currentUser) {
            handleUpdateUser({ ...currentUser, avatarUrl: newUrl });
          }
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isSoftwarePaused={isSoftwarePaused}
        onToggleSoftwarePause={handleToggleSoftwarePaused}
      />

      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          id="mobile-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Screen Runway Area */}
      <main 
        id="crm-main-canvas"
        className="flex-1 md:ml-64 ml-0 min-h-screen flex flex-col justify-between overflow-y-auto px-4 md:px-8 py-6 relative"
      >
        <div>
          {/* Top Navbar Header */}
          <header className={`flex justify-between items-center pb-5 border-b mb-6 ${darkMode ? "border-slate-850" : "border-slate-150"}`}>
            <div className="flex items-center gap-3 text-left">
              {/* Hamburger Toggle button on Mobile */}
              <button
                id="mobile-menu-trigger"
                onClick={() => setSidebarOpen(true)}
                className={`p-2 rounded-xl border md:hidden flex items-center justify-center transition cursor-pointer active:scale-95
                  ${darkMode 
                    ? "bg-slate-900 border-slate-800 text-slate-350 hover:bg-slate-855" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs"}`}
              >
                <Menu size={18} />
              </button>

              <div>
                <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase font-bold">
                  SYSTEM MODULE &gt; {currentTab.toUpperCase()}
                </span>
                <h2 className="font-display font-bold text-base sm:text-xl leading-snug tracking-tight mt-0.5 max-w-[150px] xs:max-w-xs sm:max-w-none truncate sm:overflow-visible">
                  {currentTab === "dashboard" && "Executive Command Dashboard"}
                  {currentTab === "leads" && "Lead Infrastructure Runway"}
                  {currentTab === "calendar" && "Appointment Calendar & Active Reminders"}
                  {currentTab === "reports" && "Board Insights & Executive Summaries"}
                  {currentTab === "integrations" && "Domain Integration & Sync Master"}
                  {currentTab === "mobile-simulation" && "Field Representative Mobile Companion"}
                </h2>
              </div>
            </div>

            {/* Quick alert indicator pill */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              {todayRemindersCount > 0 && (
                <button 
                  id="header-notification-pill"
                  onClick={() => setCurrentTab("calendar")}
                  className="px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-500 text-[10px] sm:text-xs font-semibold flex items-center gap-1.5 animate-pulse cursor-pointer transition select-none hover:bg-amber-500/25 active:scale-95"
                >
                  <Bell size={13} className="fill-amber-500/10 shrink-0" />
                  <span className="hidden sm:inline">{todayRemindersCount} Alignment Reminders Due Today</span>
                  <span className="sm:hidden">{todayRemindersCount} Due</span>
                </button>
              )}

              {/* Notification Bell Component */}
              {currentUser && (
                <NotificationCenter
                  notifications={notifications}
                  currentUser={currentUser}
                  users={users}
                  onMarkAsRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))}
                  onMarkAllAsRead={() => setNotifications(prev => prev.map(n => {
                    const isPrivileged = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
                    let isRelevant = false;
                    if (isPrivileged) {
                      isRelevant = true;
                    } else {
                      const recipientLower = (n.recipientName || "").trim().toLowerCase();
                      const currentUserNameLower = (currentUser?.name || "").trim().toLowerCase();
                      if (recipientLower === currentUserNameLower) {
                        isRelevant = true;
                      } else if (currentUser?.role === 'team_leader') {
                        const teamMemberNames = users
                          .filter(u => u.teamLeaderId === currentUser?.id)
                          .map(u => (u.name || "").trim().toLowerCase());
                        isRelevant = teamMemberNames.includes(recipientLower);
                      }
                    }
                    return isRelevant ? { ...n, isRead: true } : n;
                  }))}
                  onClearAll={() => {
                    const isPrivileged = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
                    if (isPrivileged) {
                      setNotifications([]);
                    } else {
                      setNotifications(prev => prev.filter(n => {
                        const recipientLower = (n.recipientName || "").trim().toLowerCase();
                        const currentUserNameLower = (currentUser?.name || "").trim().toLowerCase();
                        if (recipientLower === currentUserNameLower) {
                          return false; // Remove
                        }
                        if (currentUser?.role === 'team_leader') {
                          const teamMemberNames = users
                            .filter(u => u.teamLeaderId === currentUser?.id)
                            .map(u => (u.name || "").trim().toLowerCase());
                          if (teamMemberNames.includes(recipientLower)) {
                            return false; // Remove
                          }
                        }
                        return true; // Keep
                      }));
                    }
                  }}
                  onNavigateToLead={(leadId) => {
                    setCurrentTab("leads");
                    localStorage.setItem("elite_pro_search_lead_highlight", leadId);
                    window.dispatchEvent(new CustomEvent("elite_pro_focus_lead", { detail: { leadId } }));
                  }}
                  darkMode={darkMode}
                />
              )}

              {/* Dynamic current user badge */}
              <div 
                id="quick-domain-tag" 
                onClick={handleLogout}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-mono font-bold flex items-center gap-1.5 transition duration-150 cursor-pointer active:scale-95 select-none shrink-0
                  ${darkMode 
                    ? "bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300" 
                    : "bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs"}`}
                title="Click to Switch User Profile"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                <span className="max-w-[70px] xs:max-w-[120px] sm:max-w-[200px] truncate">{currentUser.email}</span>
                <span className="text-[9px] text-teal-400 uppercase font-mono font-semibold hidden lg:inline">[{currentUser.role}]</span>
              </div>
            </div>
          </header>

          {/* Pause Notification Warning Banner */}
          {isSoftwarePaused && (
            <motion.div
              id="global-system-paused-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-lg shadow-amber-500/5 animate-fade-in"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                  <span className="hidden sm:inline">⚠️</span>
                  <span className="sm:hidden">⚡</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                    Automated System Sync is Paused
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 tracking-wider">Muted</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    All recurring Google Sheets synchronization and Meta Ads lead auto-ingestion sequences are paused. Press Resume to reactivate real-time workflows.
                  </p>
                </div>
              </div>
              <button
                id="resume-from-banner-btn"
                onClick={handleToggleSoftwarePaused}
                className="px-4 py-2 font-semibold text-xs rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/15 cursor-pointer active:scale-95 transition-all text-center whitespace-nowrap self-start sm:self-auto shrink-0"
              >
                Resume Operations
              </button>
            </motion.div>
          )}

          {/* Active Tab Sub-view render */}
          <div id="tab-window-content-carrier" className="pb-16 animate-fade-in">
            <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading...</div>}>
              {renderTabContent()}
            </Suspense>
          </div>
        </div>

        {/* Global Footer */}
        <footer className={`pt-4 border-t text-[10px] text-slate-400 font-mono flex flex-col sm:flex-row justify-between items-center gap-2 mt-auto
          ${darkMode ? "border-slate-800" : "border-slate-200"}`}
        >
          <span>Elite Pro Corporate Real Estate Advisors CRM Console © 2026</span>
          <div className="flex gap-4 items-center">
            <span>Secure Enterprise Connection: Active TLSv1.3</span>
            <span>Local Node Current Time: {new Date().toISOString().replace('T', ' ').substring(0, 16).replace(/-/g, '/')} UTC</span>
          </div>
        </footer>
      </main>

      {/* Custom Confirmation/Alert Dialog Overlay */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop lock */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => {
              if (modalConfig.type === "alert") {
                setModalConfig(prev => ({ ...prev, isOpen: false }));
              }
            }}
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`relative max-w-sm w-full p-6 rounded-2xl border shadow-2xl z-10 text-center flex flex-col items-center gap-4.5
              ${darkMode 
                ? "bg-slate-900 border-slate-800 text-slate-100" 
                : "bg-white border-slate-150 text-slate-800"}`}
          >
            {/* Top Indicator Accent Symbol */}
            {modalConfig.type === "alert" ? (
              <div className="p-3.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                <AlertOctagon size={24} className="stroke-[1.75]" />
              </div>
            ) : (
              <div className="p-3.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <HelpCircle size={24} className="stroke-[1.75]" />
              </div>
            )}

            {/* Typography Heading & Body */}
            <div>
              <h3 className="font-display font-bold text-base leading-tight tracking-tight">
                {modalConfig.title}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {modalConfig.message}
              </p>
            </div>

            {/* Structured Selection Button Rows */}
            <div className="flex gap-2.5 w-full mt-1">
              {modalConfig.type === "confirm" ? (
                <>
                  <button
                    id="modal-cancel-btn"
                    onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer select-none active:scale-97
                      ${darkMode 
                        ? "border-slate-850 bg-slate-950/40 hover:bg-slate-950 text-slate-400" 
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
                  >
                    Cancel
                  </button>
                  <button
                    id="modal-confirm-btn"
                    onClick={() => {
                      setModalConfig(prev => ({ ...prev, isOpen: false }));
                      if (modalConfig.onConfirm) modalConfig.onConfirm();
                    }}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition cursor-pointer select-none active:scale-97 shadow-sm shadow-teal-500/10"
                  >
                    Confirm Action
                  </button>
                </>
              ) : (
                <button
                  id="modal-dismiss-btn"
                  onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer select-none active:scale-97 shadow-sm
                    ${darkMode 
                      ? "bg-slate-800 text-slate-100 hover:bg-slate-700" 
                      : "bg-slate-900 text-white hover:bg-slate-800"}`}
                >
                  Acknowledge
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Automated Real-time Dispatch Panel */}
      {activeAutoDispatch && activeAutoDispatch.isOpen && (
        <div id="auto-dispatch-panel-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setActiveAutoDispatch(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
          />

          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`relative max-w-md w-full p-6 rounded-2xl border shadow-2xl z-10 flex flex-col gap-4
              ${darkMode 
                ? "bg-slate-900 border-slate-800 text-slate-100" 
                : "bg-white border-slate-200 text-slate-800"}`}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/15">
                  <Send size={16} className="animate-pulse" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-sm tracking-tight">Lead Assignment Dispatcher</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Real-time Admin notification system</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveAutoDispatch(null)}
                className="p-1 rounded-lg hover:bg-slate-800/10 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Staged Recipient Stats */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1.5
              ${darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150"}`}
            >
              <div className="flex justify-between">
                <span className="text-slate-400 font-mono uppercase text-[9px] tracking-wider">Assigned Agent</span>
                <span className="font-semibold text-emerald-400">👤 {activeAutoDispatch.agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-mono uppercase text-[9px] tracking-wider">Contact Phone</span>
                <span className="font-mono font-medium text-slate-200">{activeAutoDispatch.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-mono uppercase text-[9px] tracking-wider">Staged Lead</span>
                <span className="font-semibold text-teal-400">🏷️ {activeAutoDispatch.leadName}</span>
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold">Message Outbox Template</label>
              <textarea
                readOnly
                value={activeAutoDispatch.message}
                rows={6}
                className={`w-full p-3 font-mono text-[10.5px] leading-relaxed rounded-xl border outline-none
                  ${darkMode ? "bg-slate-950 border-slate-800 text-slate-300 animate-none" : "bg-white border-slate-205 text-slate-702 shadow-inner"}`}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => setActiveAutoDispatch(null)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer select-none active:scale-97
                  ${darkMode 
                    ? "border-slate-850 bg-slate-950/40 hover:bg-slate-950 text-slate-400" 
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500"}`}
              >
                Dismiss
              </button>
              
              <a
                href={activeAutoDispatch.waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // Wait brief moment and clear queue to maintain clean UI flow
                  setTimeout(() => setActiveAutoDispatch(null), 800);
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/10 transition flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-97"
              >
                <MessageSquare size={14} />
                Send Alert Now
                <ExternalLink size={10} />
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
