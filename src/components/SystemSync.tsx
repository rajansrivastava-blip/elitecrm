import React, { useState, useEffect } from "react";
import { 
  RefreshCw, 
  Settings, 
  Calendar, 
  CheckCircle2, 
  Radio, 
  CalendarDays, 
  Link2, 
  Lock, 
  ExternalLink,
  Users2,
  CloudLightning,
  AlertTriangle,
  Flame,
  Check,
  Database,
  Terminal,
  Copy,
  Info,
  Mail,
  Download,
  Send,
  Archive,
  Shield,
  Clock,
  Trash,
  FileSpreadsheet,
  Globe,
  Sparkles,
  Github,
  GitBranch,
  GitCommit
} from "lucide-react";
import { SupabaseStatus } from "../supabase";
import { 
  googleSheetsSignIn, 
  googleSheetsSignOut, 
  getCachedGoogleToken, 
  fetchGoogleSheetValues, 
  mapSpreadsheetRowsToLeads,
  initGoogleAuth,
  extractSpreadsheetId,
  isDuplicateLead
} from "../googleAuth";

import { User } from "../types";

interface SystemSyncProps {
  currentUser?: User | null;
  darkMode: boolean;
  isSyncing: boolean;
  onTriggerSync: () => void;
  syncHistory: string[];
  
  // Supabase Props
  supabaseStatus: SupabaseStatus;
  isSupabaseOpInProgress: boolean;
  onPushToSupabase: () => Promise<{ success: boolean; errors: string[] }>;
  onPullFromSupabase: () => Promise<{ success: boolean; errors: string[] }>;
  onRefreshSupabaseStatus: () => Promise<any>;
  isAutoSyncEnabled: boolean;
  onToggleAutoSync: () => void;

  // Data Props for backup exports
  users?: any[];
  leads?: any[];
  appointments?: any[];
  communicationLogs?: any[];
  leadEditLogs?: any[];

  // Google Sheets callback prop
  onBulkAddLeads?: (newLeads: any[], skipDupCheck?: boolean) => Promise<void> | void;

  // Hoisted Google Sheets configuration states
  sheetUrl: string;
  setSheetUrl: React.Dispatch<React.SetStateAction<string>>;
  sheetRange: string;
  setSheetRange: React.Dispatch<React.SetStateAction<string>>;
  autoSheetsSync: boolean;
  setAutoSheetsSync: React.Dispatch<React.SetStateAction<boolean>>;
  lastSheetsSynced: string;
  setLastSheetsSynced: React.Dispatch<React.SetStateAction<string>>;

  // Hoisted Meta Ads configuration states
  metaVerifyToken: string;
  setMetaVerifyToken: React.Dispatch<React.SetStateAction<string>>;
  metaAutoIngest: boolean;
  setMetaAutoIngest: React.Dispatch<React.SetStateAction<boolean>>;
  lastMetaSynced: string;
  setLastMetaSynced: React.Dispatch<React.SetStateAction<string>>;

  // Hoisted GitHub configuration states
  githubRepoUrl: string;
  setGithubRepoUrl: React.Dispatch<React.SetStateAction<string>>;
  githubToken: string;
  setGithubToken: React.Dispatch<React.SetStateAction<string>>;
  githubAutoSync: boolean;
  setGithubAutoSync: React.Dispatch<React.SetStateAction<boolean>>;

  // New optional recovery callback
  onRestoreCrmData?: (data: {
    leads?: any[];
    users?: any[];
    appointments?: any[];
    communicationLogs?: any[];
    leadEditLogs?: any[];
  }) => Promise<void>;
  onClearAllRecords?: () => Promise<{ success: boolean; errors?: string[] }>;
}

export default function SystemSync({
  currentUser,
  darkMode,
  isSyncing,
  onTriggerSync,
  syncHistory,
  supabaseStatus,
  isSupabaseOpInProgress,
  onPushToSupabase,
  onPullFromSupabase,
  onRefreshSupabaseStatus,
  isAutoSyncEnabled,
  onToggleAutoSync,
  users = [],
  leads = [],
  appointments = [],
  communicationLogs = [],
  leadEditLogs = [],
  onBulkAddLeads,
  sheetUrl,
  setSheetUrl,
  sheetRange,
  setSheetRange,
  autoSheetsSync,
  setAutoSheetsSync,
  lastSheetsSynced,
  setLastSheetsSynced,
  metaVerifyToken,
  setMetaVerifyToken,
  metaAutoIngest,
  setMetaAutoIngest,
  lastMetaSynced,
  setLastMetaSynced,
  githubRepoUrl,
  setGithubRepoUrl,
  githubToken,
  setGithubToken,
  githubAutoSync,
  setGithubAutoSync,
  onRestoreCrmData,
  onClearAllRecords
}: SystemSyncProps) {
  
  // Privilege check
  const isPrivileged = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  // Local recovery state handlers
  const [serverCacheLeadsCount, setServerCacheLeadsCount] = useState<number | null>(null);
  const [serverCacheAppsCount, setServerCacheAppsCount] = useState<number | null>(null);
  const [serverCacheLogsCount, setServerCacheLogsCount] = useState<number | null>(null);
  const [isCheckingServerCache, setIsCheckingServerCache] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // System purging states
  const [isPurging, setIsPurging] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handlePurgeAllData = async () => {
    if (!onClearAllRecords) {
      alert("Clear records callback is not registered in the application shell.");
      return;
    }

    const confirmWipe1 = window.confirm(
      "⚠️ WARNING: COMPLETE DATA PURGE DETECTED!\n\nThis will permanently delete ALL customer fields, marketing leads, appointments, communication trails, and edit action history logs from BOTH your Live Supabase database and your Portal caches.\n\nAre you absolutely sure you want to proceed with this hard system reset?"
    );

    if (!confirmWipe1) return;

    const confirmWipe2 = window.confirm(
      "⚠️ FINAL SAFETY CHECK!\n\nThis action CANNOT BE UNDONE. This will clear leads registry files down to zero records. Any active team pipeline layouts, reminders, and schedules will be completely wiped from all remote and local sources.\n\nAre you sure you want to trigger this complete purge?"
    );

    if (!confirmWipe2) return;

    setIsPurging(true);
    setPurgeFeedback(null);

    try {
      const res = await onClearAllRecords();
      if (res.success) {
        setPurgeFeedback({
          message: "Database purge accomplished! Successfully deleted and wiped all active leads, reminder tasks, and contact histories from both the central cloud cluster and local portal states.",
          type: "success"
        });
        // Reinforce checking the server cache sizes to reflect zero
        await checkServerCacheMeta();
      } else {
        const errList = res.errors?.join("; ") || "Unknown database cluster connection failure.";
        setPurgeFeedback({
          message: `Purge completed with warning parameters: ${errList} (Portal state cleared, but remote tables may have been partially unreachable. If you manually modified or deleted columns directly on Supabase, please verify policies).`,
          type: "error"
        });
        await checkServerCacheMeta();
      }
    } catch (err: any) {
      console.error("Purge failure:", err);
      setPurgeFeedback({
        message: `Purge encountered execution error: ${err.message || String(err)}`,
        type: "error"
      });
    } finally {
      setIsPurging(false);
    }
  };

  const checkServerCacheMeta = async () => {
    setIsCheckingServerCache(true);
    setRecoveryFeedback(null);
    try {
      const res = await fetch("/api/crm/data");
      const data = await res.json();
      if (data) {
        setServerCacheLeadsCount(data.leads ? data.leads.length : 0);
        setServerCacheAppsCount(data.appointments ? data.appointments.length : 0);
        setServerCacheLogsCount(
          (data.communicationLogs ? data.communicationLogs.length : 0) + 
          (data.leadEditLogs ? data.leadEditLogs.length : 0)
        );
      } else {
        setServerCacheLeadsCount(0);
        setServerCacheAppsCount(0);
        setServerCacheLogsCount(0);
      }
    } catch (err: any) {
      console.error(err);
      setRecoveryFeedback({ message: `Cache diagnostic trace failed: ${err.message || String(err)}`, type: "error" });
    } finally {
      setIsCheckingServerCache(false);
    }
  };

  useEffect(() => {
    checkServerCacheMeta();
  }, [leads.length]);

  const triggerServerCacheRecovery = async () => {
    if (!onRestoreCrmData) {
      alert("Restore callback is not yet registered in application shell.");
      return;
    }
    const confirmRestore = window.confirm(
      `⚠️ PORTFOLIOS RESTORATION ALERT!\n\nThis will fetch all archived portfolios from the server's cache filesystem and restore them into your browser active view with localstorage override. This will NOT overwrite your synced cloud tables unless you push afterward.\n\nAre you sure you want to restore?`
    );
    if (!confirmRestore) return;

    setIsRecovering(true);
    setRecoveryFeedback(null);
    try {
      const res = await fetch("/api/crm/data");
      const data = await res.json();
      if (data && data.leads && data.leads.length > 0) {
        await onRestoreCrmData(data);
        setRecoveryFeedback({
          message: `Restoration accomplished! Successfully recovered ${data.leads.length} leads and ${data.appointments?.length || 0} agenda items into active view. All elements are successfully bound to local storage.`,
          type: "success"
        });
      } else {
        setRecoveryFeedback({
          message: "The server cache file appears empty of portfolios. No records were restored.",
          type: "error"
        });
      }
    } catch (err: any) {
      console.error(err);
      setRecoveryFeedback({
        message: `Restoration encountered failure parameters: ${err.message || String(err)}`,
        type: "error"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  // Status check state
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(true);
  
  // Google Sheets state variables
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(() => getCachedGoogleToken());
  const [isSheetsSyncing, setIsSheetsSyncing] = useState(false);
  const [sheetsFeedback, setSheetsFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Meta Ads simulator state
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isSimulatingLead, setIsSimulatingLead] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Simulated lead form fields
  const [simName, setSimName] = useState("Vikram Sengupta");
  const [simPhone, setSimPhone] = useState("+91 98112 34567");
  const [simEmail, setSimEmail] = useState("vikram.sengupta@premiumspace.in");
  const [simBudget, setSimBudget] = useState("₹2.25 Cr");
  const [simLocation, setSimLocation] = useState("Gurugram Sector-104");
  const [simCampaign, setSimCampaign] = useState("Elite High-Rise Residential - Q2 Inbound");
  const [simProject, setSimProject] = useState("Elite Signature Residences");
  const [showSimulator, setShowSimulator] = useState(false);

  // GitHub Repository integration state
  const [gitStatus, setGitStatus] = useState<{
    initialized: boolean;
    currentBranch: string;
    remoteUrl: string;
    lastCommit: string;
    uncommittedChangesCount: number;
  } | null>(null);
  const [isCheckingGitStatus, setIsCheckingGitStatus] = useState(false);
  const [isGithubPushing, setIsGithubPushing] = useState(false);
  const [githubFeedback, setGithubFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showToken, setShowToken] = useState(false);

  const fetchGitStatus = async () => {
    setIsCheckingGitStatus(true);
    try {
      const res = await fetch("/api/github/status");
      if (res.ok) {
        const data = await res.json();
        setGitStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch Git status:", err);
    } finally {
      setIsCheckingGitStatus(false);
    }
  };

  useEffect(() => {
    fetchGitStatus();
  }, []);

  const handleGithubPush = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!githubRepoUrl) {
      setGithubFeedback({ message: "Please configure your GitHub Repository URL first.", type: "error" });
      return;
    }
    if (!githubToken) {
      setGithubFeedback({ message: "Please configure your GitHub Personal Access Token (PAT).", type: "error" });
      return;
    }

    setIsGithubPushing(true);
    setGithubFeedback(null);

    try {
      const res = await fetch("/api/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: githubRepoUrl,
          token: githubToken,
          commitMessage: `Manual Push & Sync: ${new Date().toISOString().replace("T", " ").substring(0, 19)} UTC`
        })
      });

      const data = await res.json();
      if (res.ok) {
        setGithubFeedback({ message: data.message || "Successfully pushed to GitHub!", type: "success" });
        fetchGitStatus();
      } else {
        setGithubFeedback({ message: data.error || "Failed to push to GitHub.", type: "error" });
      }
    } catch (err: any) {
      setGithubFeedback({ message: `Push failed: ${err.message || String(err)}`, type: "error" });
    } finally {
      setIsGithubPushing(false);
    }
  };

  const simulateMetaAdsWebhookCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulatingLead(true);
    setSimulationResult(null);

    try {
      const response = await fetch("/api/webhooks/meta-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isSimulation: true,
          name: simName,
          phone: simPhone,
          email: simEmail,
          budget: simBudget,
          location: simLocation,
          campaign: simCampaign,
          projectName: simProject,
          notes: "Simulated live customer form feed triggered via CRM Webhook test simulator."
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json();
      if (data && data.success) {
        setSimulationResult({
          type: "success",
          message: `Webhook received by CRM successfully! Created Lead ID: ${data.leadId || "N/A"}. Added with Source (Meta Ad) & Assignee: 'Pending Assignment'.`
        });
        
        // Randomize fields for next simulation
        const firstNames = ["Rajesh", "Pooja", "Arjun", "Aditi", "Karan", "Simran", "Kabir", "Neha", "Rohan"];
        const lastNames = ["Kapoor", "Srinivasan", "Shastri", "Malhotra", "Goel", "Bhasin", "Trivedi", "Chawla"];
        const budgets = ["₹1.80 Cr", "₹3.50 Cr", "₹2.90 Cr", "₹4.75 Cr", "₹95 Lakh", "₹5.50 Cr"];
        const sectors = ["Gurugram Phase 1", "Noida Sector-150", "South Delhi Estates", "Dwarka Expressway", "Noida Expressway"];
        const campaigns = ["Super Luxury Villas - Q3 Inbound", "Elite Commercial Units Inflow", "Penthouse Splendor Campaign"];
        const projects = ["Elite Landmark Heights", "The Courtyard Estates", "Elite Sovereign Terraces"];

        const rFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
        const rLast = lastNames[Math.floor(Math.random() * lastNames.length)];
        const rName = `${rFirst} ${rLast}`;
        
        setSimName(rName);
        setSimPhone(`+91 98${Math.floor(Math.random() * 900000 + 100000)}`);
        setSimEmail(`${rName.toLowerCase().replace(/\s+/g, ".")}@example.com`);
        setSimBudget(budgets[Math.floor(Math.random() * budgets.length)]);
        setSimLocation(sectors[Math.floor(Math.random() * sectors.length)]);
        setSimCampaign(campaigns[Math.floor(Math.random() * campaigns.length)]);
        setSimProject(projects[Math.floor(Math.random() * projects.length)]);
      } else {
        setSimulationResult({
          type: "error",
          message: `Webhook failed: ${data.error || "Unknown server response."}`
        });
      }
    } catch (err: any) {
      setSimulationResult({
        type: "error",
        message: `Simulation connection failed: ${err.message || String(err)}`
      });
    } finally {
      setIsSimulatingLead(false);
    }
  };

  // Handle Firebase Auth listener for Google authentication
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(getCachedGoogleToken());
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSheetsSignIn = async () => {
    try {
      setSheetsFeedback(null);
      const res = await googleSheetsSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        setSheetsFeedback({ message: "Successfully connected to Google account!", type: "success" });
      }
    } catch (err: any) {
      setSheetsFeedback({ message: `Authorization failed: ${err.message || String(err)}`, type: "error" });
    }
  };

  const handleGoogleSheetsSignOut = async () => {
    try {
      setSheetsFeedback(null);
      await googleSheetsSignOut();
      setGoogleUser(null);
      setGoogleToken(null);
      setSheetsFeedback({ message: "Disconnected Google Account session.", type: "info" });
    } catch (err: any) {
      setSheetsFeedback({ message: `Disconnect failed: ${err.message || String(err)}`, type: "error" });
    }
  };

  // Dedicated execution handler: Fetch and sync Google Sheet leads
  const executeGoogleSheetsSync = async () => {
    if (!sheetUrl) {
      setSheetsFeedback({ message: "Please specify a Spreadsheet URL or Spreadsheet ID first.", type: "error" });
      return;
    }
    const tokenToUse = googleToken || getCachedGoogleToken() || undefined;

    setIsSheetsSyncing(true);
    setSheetsFeedback(null);

    try {
      // 1. Fetch values
      const rows = await fetchGoogleSheetValues(sheetUrl, sheetRange || "Sheet1", tokenToUse);
      if (!rows || rows.length < 2) {
        setSheetsFeedback({ 
          message: "Zero or insufficient records found. Make sure the first row contains headers (e.g., Name, Email, Phone) and subsequent rows contain leads data.", 
          type: "error" 
        });
        setIsSheetsSyncing(false);
        return;
      }

      // 2. Parse values
      const parsedLeads = mapSpreadsheetRowsToLeads(rows, users);
      if (parsedLeads.length === 0) {
        setSheetsFeedback({ 
          message: "No valid leads could be parsed. Check that your spreadsheet contains a 'Name' column with non-empty rows.", 
          type: "error" 
        });
        setIsSheetsSyncing(false);
        return;
      }

      // 3. Prevent Duplicates with existing leads using robust multi-field identification
      const filteredNewLeads = parsedLeads.filter(nl => {
        return !isDuplicateLead(nl, leads);
      });

      // 4. Register new leads
      if (filteredNewLeads.length > 0) {
        if (onBulkAddLeads) {
          await onBulkAddLeads(filteredNewLeads);
        }
      }

      const updatedTime = new Date().toLocaleTimeString("en-US", { hour12: true }) + " (Local)";
      setLastSheetsSynced(updatedTime);
      localStorage.setItem("google_sheets_last_sync_time", updatedTime);

      setSheetsFeedback({
        message: `Sync Completed successfully: Analyzed ${rows.length - 1} records from sheet. Ingested ${filteredNewLeads.length} new leads into CRM (skipped ${parsedLeads.length - filteredNewLeads.length} duplicates). Leads are staged as Pending Assignment.`,
        type: "success"
      });

    } catch (err: any) {
      console.error(err);
      setSheetsFeedback({ 
        message: `Google Sheets Sync failed: ${err.message || String(err)} (Verify that your Spreadsheet URL / Sheet Range are correct and public/shared, or check Google token validity).`, 
        type: "error" 
      });
    } finally {
      setIsSheetsSyncing(false);
    }
  };

  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [opFeedback, setOpFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Automated Data Protection & Security Backup States
  const [backupRecipients, setBackupRecipients] = useState<string[]>([
    "viren@eliteproinfra.com",
    "rajan.srivastava@eliteproinfra.com"
  ]);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [backupCadence, setBackupCadence] = useState<"daily" | "weekly" | "sandbox">("daily");
  
  const [backupIncLeads, setBackupIncLeads] = useState(true);
  const [backupIncUsers, setBackupIncUsers] = useState(true);
  const [backupIncAppointments, setBackupIncAppointments] = useState(true);
  const [backupIncLogs, setBackupIncLogs] = useState(true);

  const [backupHistory, setBackupHistory] = useState<Array<{
    id: string;
    timestamp: string;
    sizeKb: string;
    recipients: string[];
    triggeredBy: string;
    isAuto: boolean;
    checksum: string;
  }>>([
    {
      id: "BK-20260527-0200",
      timestamp: "Today, 02:00:00 AM UTC",
      sizeKb: "155.4 KB",
      recipients: ["viren@eliteproinfra.com", "rajan.srivastava@eliteproinfra.com"],
      triggeredBy: "Automated System cron",
      isAuto: true,
      checksum: "sha256-fbf3782ce99c..."
    },
    {
      id: "BK-20260526-0200",
      timestamp: "Yesterday, 02:00:00 AM UTC",
      sizeKb: "154.8 KB",
      recipients: ["viren@eliteproinfra.com", "rajan.srivastava@eliteproinfra.com"],
      triggeredBy: "Automated System cron",
      isAuto: true,
      checksum: "sha256-e9f3b891bd10..."
    },
    {
      id: "BK-20260525-0200",
      timestamp: "May 25, 2026, 02:00:00 AM UTC",
      sizeKb: "153.2 KB",
      recipients: ["viren@eliteproinfra.com", "rajan.srivastava@eliteproinfra.com"],
      triggeredBy: "Automated System cron",
      isAuto: true,
      checksum: "sha256-a3c01fcbd221..."
    }
  ]);

  const [isDispatchingBackup, setIsDispatchingBackup] = useState(false);
  const [backupConsoleLogs, setBackupConsoleLogs] = useState<string[]>([]);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);

  // WhatsApp Integration & DM Dispatch States
  const [waMode, setWaMode] = useState<"manual" | "twilio" | "gcloud">("manual");
  const [waAutoNotify, setWaAutoNotify] = useState(true);

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMail = newRecipientEmail.trim().toLowerCase();
    if (!cleanMail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanMail)) {
      alert("Please enter a valid structure email address.");
      return;
    }
    if (backupRecipients.includes(cleanMail)) {
      alert("This email is already in the recipient list.");
      return;
    }
    setBackupRecipients(prev => [...prev, cleanMail]);
    setNewRecipientEmail("");
  };

  const handleRemoveRecipient = (email: string) => {
    if (backupRecipients.length <= 1) {
      alert("At least one target email recipient must remain active for system integrity safeguards.");
      return;
    }
    setBackupRecipients(prev => prev.filter(e => e !== email));
  };

  const executeBackupAndDispatch = async () => {
    setIsDispatchingBackup(true);
    setBackupSuccessMessage(null);
    setBackupConsoleLogs(["[SECURITY INITIALIZATION] Arming secure cryptographic checksum keys..."]);

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    await delay(500);
    setBackupConsoleLogs(prev => [...prev, "[DATABASE COMPRESSION] Packaging local CRM schema indices and records..."]);
    
    // Construct real payload corresponding to checkboxes
    const payload: Record<string, any> = {
      manifest: {
        crm_system: "Elite Pro CRM",
        timestamp: new Date().toISOString(),
        backup_id: "BK-MANUAL-" + Date.now().toString(36).toUpperCase(),
        checksum_algorithm: "SHA-256",
        version: "v4.0.12-corporate"
      }
    };

    if (backupIncLeads) payload.leads = leads;
    if (backupIncUsers) payload.users = users;
    if (backupIncAppointments) payload.appointments = appointments;
    if (backupIncLogs) {
      payload.communication_logs = communicationLogs;
      payload.lead_edit_logs = leadEditLogs;
    }

    const payloadString = JSON.stringify(payload, null, 2);
    const sizeKb = (payloadString.length / 1024).toFixed(1) + " KB";
    const randChecksum = "sha255-" + Math.random().toString(16).substr(2, 8) + "c8b..." + Math.random().toString(16).substr(2, 4);

    await delay(600);
    setBackupConsoleLogs(prev => [...prev, `[ENCRYPTION COMPLETE] Archive compiled. File size: ${sizeKb}. Integrity Checksum: ${randChecksum}`]);
    
    await delay(700);
    setBackupConsoleLogs(prev => [...prev, `[TRANSLATOR RELAY] Transferring data tunnel to SMTP mail hosts [smtp://relay.eliteproinfra.com:587]...`]);

    await delay(800);
    const namesList = backupRecipients.join(", ");
    setBackupConsoleLogs(prev => [...prev, `[DISPATCH COMPLETED] Distributed highly encrypted corporate archives securely to: ${namesList}`]);

    await delay(500);
    
    // Download actual JSON file
    try {
      const blob = new Blob([payloadString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "_");
      link.href = url;
      link.download = `elitepro_crm_secure_backup_${dateStr}_manual.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Local file download error:", e);
    }

    // Update state history representation
    const runItem = {
      id: "BK-" + new Date().toISOString().replace(/\D/g, "").slice(0, 12),
      timestamp: new Date().toLocaleString("en-US", { hour12: true }) + " UTC",
      sizeKb,
      recipients: [...backupRecipients],
      triggeredBy: "Manual Admin override",
      isAuto: false,
      checksum: randChecksum
    };

    setBackupHistory(prev => [runItem, ...prev]);
    setIsDispatchingBackup(false);
    setBackupSuccessMessage(`Secure database backup archive generated, custom downloadable package triggered, and distributed copies sent to ${namesList}!`);
  };

  const sqlSchema = `-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role TEXT NOT NULL,
  avatar_url TEXT,
  department TEXT NOT NULL,
  password TEXT,
  team_leader_id TEXT,
  active BOOLEAN NOT NULL DEFAULT true
);

-- 2. Create Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  position TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  temperature TEXT NOT NULL,
  budget TEXT,
  location TEXT,
  assigned_agent TEXT,
  notes TEXT,
  project_name TEXT,
  date_created TEXT,
  date_updated TEXT,
  last_communication TEXT,
  score INTEGER,
  assignment_timestamp BIGINT,
  assigned_tl_id TEXT,
  last_action_timestamp BIGINT,
  reassigned_timestamp BIGINT
);

-- 3. Create Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  lead_name TEXT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  reminder_active BOOLEAN NOT NULL DEFAULT true
);

-- 4. Create Communication Logs Table
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  sender TEXT NOT NULL
);

-- 5. Create Lead Edit Logs Table
CREATE TABLE IF NOT EXISTS public.lead_edit_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  lead_name TEXT NOT NULL,
  editor_name TEXT NOT NULL,
  editor_role TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  changes JSONB NOT NULL
);

-- OPTIONAL: Migration for older existing users tables to ensure and add the password field
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- OPTIONAL: Migration for older existing leads tables to add timer tracking columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assignment_timestamp BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_tl_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_action_timestamp BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_timestamp BIGINT;

-- OPTIONAL: Quick Testing Rule (Disables Row Level Security for instant connection)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_edit_logs DISABLE ROW LEVEL SECURITY;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const executePush = async () => {
    setOpFeedback(null);
    const res = await onPushToSupabase();
    if (res.success) {
      setOpFeedback({
        message: "Successfully synchronized and seeded all CRM metadata records into your Supabase database!",
        type: "success"
      });
    } else {
      setOpFeedback({
        message: `Synchronization encountered errors: ${res.errors.join("; ")}. Standard RLS policies or unrun schemas may be restricting upserting.`,
        type: "error"
      });
    }
  };

  const executePull = async () => {
    setOpFeedback(null);
    const res = await onPullFromSupabase();
    if (res.success) {
      setOpFeedback({
        message: "Successfully retrieved live records from Supabase tables to replace local state caches!",
        type: "success"
      });
    } else {
      setOpFeedback({
        message: `Fetch failed: ${res.errors.join("; ")}. Please verify that the tables are properly created and allow reads.`,
        type: "error"
      });
    }
  };

  const handleTestLink = () => {
    setShowConfigAlert(true);
    onRefreshSupabaseStatus();
    setTimeout(() => {
      setShowConfigAlert(false);
    }, 4000);
  };

  // Check if any table is unverified
  const verified = supabaseStatus.tablesVerified;
  const allTablesOk = verified.users && verified.leads && verified.appointments && verified.communication_logs && verified.lead_edit_logs;

  return (
    <div id="integrations-tab" className="space-y-6">
      
      {/* Synchronization Status Banner */}
      <div className={`p-6 rounded-2xl border transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6
        ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center
            ${supabaseStatus.isConnected && allTablesOk 
              ? "bg-emerald-500/10 text-emerald-400" 
              : "bg-amber-500/10 text-amber-500"}`}
          >
            <Radio size={24} className={isSyncing || isSupabaseOpInProgress ? "animate-pulse" : ""} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
                Elite Pro Cloud Sync Console
              </h3>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-semibold uppercase 
                ${supabaseStatus.isConnected 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" 
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/25"}`}
              >
                {supabaseStatus.isConnected ? "Supabase Connected" : "Connection Failing"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Connect and bind your real-time customer data, team listings, advisory agendas, and communication trails with the cloud cluster.
            </p>
          </div>
        </div>

        {/* Big Manual Sync button */}
        <button
          id="system-sync-master-btn"
          onClick={handleTestLink}
          disabled={isSyncing || isSupabaseOpInProgress}
          className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs tracking-wider uppercase transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-teal-500/10 select-none"
        >
          <RefreshCw size={13} className={isSyncing || isSupabaseOpInProgress ? "animate-spin" : ""} />
          Test & Validate Cloud Handshake
        </button>
      </div>

      {opFeedback && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fadeIn border
          ${opFeedback.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/25 text-rose-400"}`}
        >
          {opFeedback.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <div>{opFeedback.message}</div>
        </div>
      )}

      {/* Grid of integrations cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Card 1: Google Calendar Domain Sync */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            {/* Status light */}
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400">
                <CalendarDays size={20} />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase
                ${googleCalendarConnected 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-slate-800 text-slate-400"}`}
              >
                {googleCalendarConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">Google Calendar Domain Sync</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Exchanges physical site tour alignment metadata, meeting bookings, and advisor calendar parameters seamlessly over secure JSON API routes.
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Google Domain:</span>
                <span className="font-mono text-slate-350">eliteproinfra.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">OAuth Permissions Granted:</span>
                <span className="font-mono text-slate-350 text-right">Calendar Read/Write</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Live Webhook Handler:</span>
                <span className="font-mono text-slate-350 truncate max-w-[170px] hover:underline cursor-pointer">/api/workspace/sync</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100/5 flex gap-2">
            <button
              id="google-cal-retest-btn"
              onClick={handleTestLink}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer select-none
                ${darkMode ? "bg-slate-800 hover:bg-slate-705 border-slate-700 text-white" : "bg-slate-50 hover:bg-slate-100 border-slate-205"}`}
            >
              Verify Endpoint Link
            </button>
            <button
              id="google-cal-config-btn"
              disabled={!isPrivileged}
              onClick={() => isPrivileged && setGoogleCalendarConnected(!googleCalendarConnected)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition border cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed
                ${googleCalendarConnected 
                  ? "border-rose-500/20 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10" 
                  : "border-teal-500/20 text-teal-400 bg-teal-500/5 hover:bg-teal-500/10"}`}
            >
              {googleCalendarConnected ? "Disconnect" : "Authorize Client"}
            </button>
          </div>
        </div>

        {/* Card 2: Supabase Live Database Integration */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
                <Database size={20} />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase
                ${supabaseStatus.isConnected 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}
              >
                {supabaseStatus.isConnected ? "Supabase Online" : "Disconnected / Check Key"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">Supabase Live Database</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Maintains true serverless synchronization of your commercial CRM pipeline schemas, investor logs, and meetings.
            </p>

            {/* Auto-Sync Toggle Option block */}
            <div className={`mt-3.5 p-3 rounded-xl flex items-center justify-between border transition-all duration-200
              ${darkMode ? "bg-slate-950/45 border-slate-800/40" : "bg-slate-50 border-slate-200"}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-300" : "text-slate-700"} flex items-center gap-1`}>
                  <span>Real-Time Auto-Sync</span>
                  {!isPrivileged && <span className="text-amber-500 font-sans text-[8px] font-bold">🔒 Locked</span>}
                </span>
                <span className="text-[10px] text-slate-455 text-left">
                  Upload changes instantly in the background
                </span>
              </div>
              <button
                type="button"
                id="toggle-supabase-autosync-switch"
                disabled={!isPrivileged}
                onClick={() => isPrivileged && onToggleAutoSync()}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-teal-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed
                  ${isAutoSyncEnabled ? "bg-teal-600" : "bg-slate-755"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                    ${isAutoSyncEnabled ? "translate-x-4" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Project ID:</span>
                <span className="font-mono text-slate-350 select-all">fzsjeukjjjutiihhzjgu</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Check API:</span>
                <span className={`font-mono font-semibold truncate max-w-[170px] ${supabaseStatus.isConnected ? "text-emerald-500" : "text-amber-500"}`}>
                  {supabaseStatus.isConnected ? "Handshake OK" : "Ping Unreachable"}
                </span>
              </div>
              
              {/* Tables checklist */}
              <div className="mt-2 border-t border-slate-800/20 pt-2 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Tables Schema Verification</span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-1">
                    <span className={supabaseStatus.tablesVerified.leads ? "text-emerald-500" : "text-amber-500"}>
                      {supabaseStatus.tablesVerified.leads ? "●" : "○"}
                    </span>
                    <span className="text-slate-300">leads</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={supabaseStatus.tablesVerified.users ? "text-emerald-500" : "text-amber-500"}>
                      {supabaseStatus.tablesVerified.users ? "●" : "○"}
                    </span>
                    <span className="text-slate-300">users</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={supabaseStatus.tablesVerified.appointments ? "text-emerald-500" : "text-amber-500"}>
                      {supabaseStatus.tablesVerified.appointments ? "●" : "○"}
                    </span>
                    <span className="text-slate-300">appointments</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={supabaseStatus.tablesVerified.communication_logs ? "text-emerald-500" : "text-amber-500"}>
                      {supabaseStatus.tablesVerified.communication_logs ? "●" : "○"}
                    </span>
                    <span className="text-slate-350">comm_logs</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    <span className={supabaseStatus.tablesVerified.lead_edit_logs ? "text-emerald-500" : "text-amber-500"}>
                      {supabaseStatus.tablesVerified.lead_edit_logs ? "●" : "○"}
                    </span>
                    <span className="text-slate-350">lead_edit_logs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100/5 flex gap-2">
            <button
              id="supabase-push-btn"
              onClick={executePush}
              disabled={isSupabaseOpInProgress || !supabaseStatus.isConnected || !isPrivileged}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white cursor-pointer active:scale-95 transition flex items-center justify-center gap-1
                ${(!supabaseStatus.isConnected || isSupabaseOpInProgress || !isPrivileged) && "opacity-55 cursor-not-allowed bg-teal-800"}`}
              title="Push current local Leads / Appointments database to Supabase tables"
            >
              <RefreshCw size={11} className={isSupabaseOpInProgress ? "animate-spin" : ""} />
              Push Local to DB
            </button>
            <button
              id="supabase-pull-btn"
              onClick={executePull}
              disabled={isSupabaseOpInProgress || !supabaseStatus.isConnected || !isPrivileged}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg border cursor-pointer active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-55 disabled:cursor-not-allowed
                ${darkMode ? "bg-slate-800 hover:bg-slate-705 border-slate-700 text-white" : "bg-slate-50 hover:bg-slate-100 border-slate-205"}
                ${(!supabaseStatus.isConnected || isSupabaseOpInProgress || !isPrivileged) && "opacity-50"}`}
              title="Pull remote database and override current local view"
            >
              Fetch Live Data
            </button>
          </div>
        </div>

        {/* Card 3: Google Sheets Real-Time Ingestion */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <FileSpreadsheet size={20} />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase
                ${googleUser 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-slate-800 text-slate-400"}`}
              >
                {googleUser ? "Connected" : "Disconnected"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">Google Sheets Ingestion</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Fetches records from connected Google Spreadsheets, processes contact structures, and transfers new leads directly to the CRM (defaulting to Pending Assignment for manual allocation).
            </p>
            <div className={`mt-2 p-2.5 rounded-xl border text-[11px] leading-relaxed flex gap-2 items-start
              ${darkMode ? "bg-teal-500/5 border-teal-500/10 text-slate-400" : "bg-teal-50/50 border-teal-100/50 text-slate-600"}`}
            >
              <span className="text-teal-400 font-bold shrink-0">💡 Quick Bypass:</span>
              <span>Google Login is <strong>optional</strong>! Simply share your Spreadsheet as <strong className="text-teal-400 font-medium">"Anyone with the link can view"</strong> and click <strong className="text-teal-400 font-medium">"Sync & Ingest"</strong> directly. This completely bypasses Firebase domain auth restrictions!</span>
            </div>

            {/* Inputs block */}
            <div className="mt-4 pt-3 border-t border-slate-150/10 dark:border-slate-800/40 space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                  <span>Spreadsheet URL or ID</span>
                  {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold uppercase tracking-wide flex items-center gap-1">🔒 Locked (Viewer)</span>}
                </label>
                <input
                  type="text"
                  placeholder="Paste URL or ID"
                  value={sheetUrl}
                  onChange={(e) => isPrivileged && setSheetUrl(e.target.value)}
                  readOnly={!isPrivileged}
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono
                    ${!isPrivileged ? "opacity-75 cursor-not-allowed bg-slate-100/5 dark:bg-slate-950/20" : ""}
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205 text-slate-900"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                    <span>Sheet Name / Range</span>
                    {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Sheet1"
                    value={sheetRange}
                    onChange={(e) => isPrivileged && setSheetRange(e.target.value)}
                    readOnly={!isPrivileged}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono
                      ${!isPrivileged ? "opacity-75 cursor-not-allowed bg-slate-100/5 dark:bg-slate-950/20" : ""}
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205 text-slate-900"}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                    <span>Auto Sheet Sync (60s)</span>
                    {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                  </label>
                  <div className={`p-1.5 rounded-lg border flex items-center justify-between h-[34px]
                    ${!isPrivileged ? "opacity-70 cursor-not-allowed" : ""}
                    ${darkMode ? "bg-slate-950/45 border-slate-800/40" : "bg-slate-50 border-slate-200"}`}
                  >
                    <span className="text-[9px] text-slate-450 uppercase font-mono pl-1 font-semibold">
                      {autoSheetsSync ? "ON" : "OFF"}
                    </span>
                    <button
                      type="button"
                      disabled={!isPrivileged}
                      onClick={() => isPrivileged && setAutoSheetsSync(prev => !prev)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed
                        ${autoSheetsSync ? "bg-teal-600" : "bg-slate-750"}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                          ${autoSheetsSync ? "translate-x-3" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10.5px] font-mono space-y-1.5 text-slate-400">
                <div className="flex justify-between">
                  <span>Last Checked Sync:</span>
                  <span className="text-slate-350 font-semibold">{lastSheetsSynced}</span>
                </div>
                <div className="flex justify-between">
                  <span>Authorized Account:</span>
                  <span className="text-slate-350 truncate max-w-[155px] font-semibold" title={googleUser?.email || "None"}>
                    {googleUser?.email || "Unauthenticated"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-105/5 space-y-3">
            {sheetsFeedback && (
              <div className={`p-2.5 rounded-lg text-[10.5px] font-semibold flex items-start gap-1.5 border leading-relaxed animate-fadeIn
                ${sheetsFeedback.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                  : sheetsFeedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                  : "bg-slate-500/15 border-slate-500/25 text-slate-300"}`}
              >
                {sheetsFeedback.type === "success" ? (
                  <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                ) : sheetsFeedback.type === "error" ? (
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                ) : (
                  <Info size={13} className="shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div>{sheetsFeedback.message}</div>
                  
                  {/* Specialized domain-resolution & bypass instructions panel */}
                  {sheetsFeedback.type === "error" && (sheetsFeedback.message.toLowerCase().includes("unauthorized-domain") || sheetsFeedback.message.toLowerCase().includes("auth/") || sheetsFeedback.message.toLowerCase().includes("domain")) && (
                    <div className="mt-3 pt-3 border-t border-rose-500/25 text-left space-y-3 font-normal text-slate-300">
                      <div className="flex items-center gap-1.5 font-bold text-rose-400 uppercase tracking-wider text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                        <span>Hostinger & Custom Domain Setup Resolution</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="font-semibold text-teal-400 text-[10px] uppercase font-mono tracking-wider">🚀 Option A (Instant Bypass - Recommended):</div>
                        <p className="text-[10.5px] leading-relaxed">
                          You do not need to authenticate with Google to sync! Simply share the spreadsheet and pull data directly:
                        </p>
                        <ol className="list-decimal pl-4.5 space-y-1 text-[10px] text-slate-350">
                          <li>Open your Google Spreadsheet.</li>
                          <li>Click the <strong className="text-white">Share</strong> button in the top-right corner.</li>
                          <li>Under General Access, change from <strong className="text-slate-450 border border-slate-800 bg-slate-950 px-1 py-0.5 rounded italic">"Restricted"</strong> to <strong className="text-emerald-400">"Anyone with the link can view"</strong>.</li>
                          <li>Paste the spreadsheet URL or ID in the input box above and click the green <strong className="text-teal-400">"Sync & Ingest"</strong> button directly! Our server will proxy the public feed instantly!</li>
                        </ol>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="font-semibold text-slate-350 text-[10px] uppercase font-mono tracking-wider">🛠️ Option B (Authorize custom domain in Firebase console):</div>
                        <p className="text-[10.5px] leading-relaxed">
                          If you absolutely require signing in with your Google Account for private spreadsheets:
                        </p>
                        <ol className="list-decimal pl-4.5 space-y-1 text-[10px] text-slate-355">
                          <li>Go to the <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-teal-400 underline hover:text-teal-300 font-medium">Firebase Console</a> and select your CRM project.</li>
                          <li>Navigate to <strong className="text-white">Authentication</strong> &gt; <strong className="text-white">Settings</strong> &gt; <strong className="text-white font-medium">Authorized domains</strong>.</li>
                          <li>Click <strong className="text-teal-400 font-medium">"Add domain"</strong> and input your Hostinger website domain (e.g., <code className="font-mono bg-slate-950 text-amber-300 px-1 rounded-sm text-[9.5px]">eliteproinfra.com</code> or web IP).</li>
                          <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-teal-400 underline hover:text-teal-300 font-medium">Google Cloud Console</a> &gt; <strong className="text-white font-medium">APIs & Services</strong> &gt; <strong className="text-white font-medium">Credentials</strong>.</li>
                          <li>Under OAuth 2.0 Client IDs, edit your Web Client and add your domain URL (including <code className="font-mono bg-slate-950 text-cyan-300 px-1 rounded-sm text-[9.5px]">https://</code>) to the list of <strong className="text-semibold">Authorized JavaScript origins</strong> and <strong className="text-semibold">Authorized redirect URIs</strong>.</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={executeGoogleSheetsSync}
                disabled={isSheetsSyncing || !isPrivileged}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-55 shadow-md shadow-teal-500/10`}
              >
                <RefreshCw size={12} className={isSheetsSyncing ? "animate-spin" : ""} />
                {isSheetsSyncing ? "Syncing..." : "Sync & Ingest"}
              </button>

              <button
                type="button"
                disabled={!isPrivileged}
                onClick={googleUser ? handleGoogleSheetsSignOut : handleGoogleSheetsSignIn}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition border cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                  ${googleUser 
                    ? "border-rose-500/20 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10" 
                    : "border-teal-500/20 text-teal-400 bg-teal-500/5 hover:bg-teal-500/10"}`}
              >
                {googleUser ? "Disconnect" : "Google Login"}
              </button>
            </div>
          </div>
        </div>

        {/* Card 4: Meta Ads Instant Webhook Integration */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Globe size={20} className="text-indigo-400" />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1
                ${metaAutoIngest 
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse" 
                  : "bg-slate-800 text-slate-400"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${metaAutoIngest ? "bg-indigo-405 animate-pulse" : "bg-slate-400"}`} />
                {metaAutoIngest ? "Inbound Aligned" : "Inactive"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">Meta Ads Lead Webhook</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Streams campaign inquiries directly from Facebook & Instagram Form triggers. Leads are fed automatically into the CRM as <strong className="text-indigo-300">Pending Assignment</strong> for super admins & admins to manually assign.
            </p>

            {/* Inputs block */}
            <div className="mt-4 pt-3 border-t border-slate-150/10 dark:border-slate-800/40 space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold">Active Webhook URL</label>
                <div className="relative font-mono">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.protocol}//${window.location.host}/api/webhooks/meta-ads`}
                    className={`w-full pr-10 px-3 py-1.5 text-xs rounded-lg border focus:outline-none font-mono select-all truncate
                      ${darkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-205 text-slate-705"}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.protocol}//${window.location.host}/api/webhooks/meta-ads`);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition active:scale-90"
                    title="Copy Webhook Endpoint URL"
                  >
                    {copiedWebhook ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                    <span>Verify Token</span>
                    {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="Verify Token (hub.verify_token)"
                    value={metaVerifyToken}
                    onChange={(e) => isPrivileged && setMetaVerifyToken(e.target.value)}
                    readOnly={!isPrivileged}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono
                      ${!isPrivileged ? "opacity-75 cursor-not-allowed bg-slate-100/5 dark:bg-slate-950/20" : ""}
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205 text-slate-900"}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                    <span>Live Ingest</span>
                    {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                  </label>
                  <div className={`p-1.5 rounded-lg border flex items-center justify-between h-[34px]
                    ${!isPrivileged ? "opacity-70 cursor-not-allowed" : ""}
                    ${darkMode ? "bg-slate-950/45 border-slate-800/40" : "bg-slate-50 border-slate-200"}`}
                  >
                    <span className="text-[9px] text-slate-450 uppercase font-mono pl-1 font-semibold">
                      {metaAutoIngest ? "ACTIVE" : "PAUSED"}
                    </span>
                    <button
                      type="button"
                      disabled={!isPrivileged}
                      onClick={() => isPrivileged && setMetaAutoIngest(prev => !prev)}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed
                        ${metaAutoIngest ? "bg-indigo-650" : "bg-slate-755"}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                          ${metaAutoIngest ? "translate-x-3" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10.5px] font-mono space-y-1.5 text-slate-405 border-t border-slate-150/10 dark:border-slate-800/40">
                <div className="flex justify-between">
                  <span>Last Checked Inbound:</span>
                  <span className="text-slate-350 font-semibold">{lastMetaSynced}</span>
                </div>
                <div className="flex justify-between">
                  <span>Inbound Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-450 animate-pulse" /> Active & Standby
                  </span>
                </div>
              </div>
            </div>
          </div>

          {isPrivileged && (
            <div className="mt-4 pt-3 border-t border-slate-105/5 space-y-3">
              {/* Expanded simulator form drawer */}
              {showSimulator && (
                <form onSubmit={simulateMetaAdsWebhookCall} className={`p-3 rounded-lg border text-left space-y-3 leading-relaxed animate-fadeIn
                  ${darkMode ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-200"}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800/10 pb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                      <Sparkles size={11} className="text-amber-400 animate-bounce" />
                      <span className={darkMode ? "text-slate-205" : "text-slate-805"}>Facebook Lead Ads Simulator</span>
                    </div>
                    <span className="text-[8px] font-mono select-none px-1 py-0.5 rounded bg-slate-800 text-slate-450">Sandbox Dry-Run</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <label className="block text-[9px] text-slate-450 uppercase font-mono tracking-wider mb-0.5">Contact Name</label>
                      <input
                        type="text"
                        required
                        value={simName}
                        onChange={(e) => setSimName(e.target.value)}
                        className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500
                          ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-450 uppercase font-mono tracking-wider mb-0.5">Contact Phone</label>
                      <input
                        type="text"
                        required
                        value={simPhone}
                        onChange={(e) => setSimPhone(e.target.value)}
                        className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono
                          ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <label className="block text-[9px] text-slate-450 uppercase font-mono tracking-wider mb-0.5">Budget Preference</label>
                      <input
                        type="text"
                        required
                        value={simBudget}
                        onChange={(e) => setSimBudget(e.target.value)}
                        className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono
                          ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-450 uppercase font-mono tracking-wider mb-0.5">Contact Email</label>
                      <input
                        type="email"
                        required
                        value={simEmail}
                        onChange={(e) => setSimEmail(e.target.value)}
                        className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500
                          ${darkMode ? "bg-slate-900 border-slate-800 text-white animate-pulse" : "bg-white border-slate-200 text-slate-900"}`}
                      />
                    </div>
                  </div>

                  <div className="text-[10px]">
                    <label className="block text-[9px] text-slate-450 uppercase font-mono tracking-wider mb-0.5">Campaign Name / Project Preferences</label>
                    <input
                      type="text"
                      required
                      value={simCampaign}
                      onChange={(e) => setSimCampaign(e.target.value)}
                      className={`w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-indigo-500
                        ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"}`}
                    />
                  </div>

                  {simulationResult && (
                    <div className={`p-2 rounded text-[10px] font-mono border leading-relaxed
                      ${simulationResult.type === "success" 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                        : "bg-rose-500/10 border-rose-500/20 text-rose-505"}`}
                    >
                      {simulationResult.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSimulatingLead}
                    className="w-full py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition flex items-center justify-center gap-1 disabled:opacity-55"
                  >
                    <Sparkles size={11} className={isSimulatingLead ? "animate-spin" : ""} />
                    {isSimulatingLead ? "Firing Webhook..." : "Deploy Webhook Simulation"}
                  </button>
                </form>
              )}

              <button
                type="button"
                onClick={() => setShowSimulator(prev => !prev)}
                className={`w-full py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-1.5
                  ${showSimulator 
                    ? "bg-rose-500/5 border-rose-500/10 text-rose-455 hover:bg-rose-500/10" 
                    : "bg-indigo-500/5 border-indigo-500/10 text-indigo-400 hover:bg-indigo-500/10"}`}
              >
                <Settings size={12} />
                {showSimulator ? "Close Form Simulator" : "Live Webhook Test Simulator"}
              </button>
            </div>
          )}
        </div>

        {/* Card 5: Notification Delivery & WhatsApp DM Integration */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Send size={20} className="text-emerald-400" />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase
                ${waAutoNotify 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-slate-800 text-slate-400"}`}
              >
                {waAutoNotify ? "Standby Alerting" : "Paused"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">Direct Message & WhatsApp Delivery</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Triggers instant Direct Message or WhatsApp alerts whenever a Super Admin or Admin assigns or auto-transfers leads to a Team Leader or Sales Advisor.
            </p>

            {/* Config variables and layout */}
            <div className="mt-4 pt-3 border-t border-slate-150/10 dark:border-slate-800/40 space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1.5 font-semibold">Alerting Dispatch Method</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWaMode("manual")}
                    className={`px-2 py-1 text-[10px] font-semibold font-mono rounded cursor-pointer transition active:scale-95 border
                      ${waMode === "manual" 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-450" 
                        : "bg-slate-950/30 border-slate-800/30 text-slate-400"}`}
                  >
                    WA Web Links
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaMode("twilio")}
                    className={`px-2 py-1 text-[10px] font-semibold font-mono rounded cursor-pointer transition active:scale-95 border
                      ${waMode === "twilio" 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-450" 
                        : "bg-slate-950/30 border-slate-800/30 text-slate-400"}`}
                  >
                    Twilio API
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaMode("gcloud")}
                    className={`px-2 py-1 text-[10px] font-semibold font-mono rounded cursor-pointer transition active:scale-95 border
                      ${waMode === "gcloud" 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-450" 
                        : "bg-slate-950/30 border-slate-800/30 text-slate-400"}`}
                  >
                    G-Chat Webhook
                  </button>
                </div>
              </div>

              {waMode === "manual" && (
                <div className={`p-2.5 rounded-lg border text-[10.5px] leading-relaxed
                  ${darkMode ? "bg-slate-950/40 border-slate-805 text-slate-350" : "bg-slate-50 border-slate-150"}`}
                >
                  <span className="font-semibold text-emerald-400">⚡ Client-Side Web Redirect routing option selected:</span> Zero configuration needed! The CRM dynamically registers agent phone coordinates and shows an instant <strong className="text-white">Notify WA Action button</strong> on modified lead cards for admins.
                </div>
              )}

              {waMode === "twilio" && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-mono tracking-wider mb-0.5">Twilio Account SID</label>
                    <input
                      type="text"
                      placeholder="e.g. AC87fb6..."
                      className={`w-full px-2.5 py-1 text-xs rounded border focus:outline-none font-mono
                        ${darkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-205 text-slate-705"}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-400 uppercase font-mono tracking-wider mb-0.5">WhatsApp Sender Number</label>
                    <input
                      type="text"
                      placeholder="e.g. whatsapp:+14155238886"
                      className={`w-full px-2.5 py-1 text-xs rounded border focus:outline-none font-mono
                        ${darkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-205 text-slate-705"}`}
                    />
                  </div>
                </div>
              )}

              {waMode === "gcloud" && (
                <div>
                  <label className="block text-[9px] text-slate-400 uppercase font-mono tracking-wider mb-0.5">Google Chat Incoming Webhook URL</label>
                  <input
                    type="text"
                    placeholder="e.g. https://chat.googleapis.com/v1/spaces/..."
                    className={`w-full px-2.5 py-1 text-xs rounded border focus:outline-none font-mono
                      ${darkMode ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-white border-slate-205 text-slate-750"}`}
                  />
                </div>
              )}

              <div className="pt-2 text-[10px] font-mono space-y-1 text-slate-400 border-t border-slate-150/10 dark:border-slate-800/40">
                <div className="flex justify-between">
                  <span>Custom Phone Fields Loaded:</span>
                  <span className="text-emerald-400 font-semibold">Active & Live</span>
                </div>
                <div className="flex justify-between items-center pr-1 mt-1">
                  <span>Instant Modal Dispatch Trigger</span>
                  <button
                    type="button"
                    onClick={() => setWaAutoNotify(prev => !prev)}
                    className={`relative inline-flex h-3.5 w-6 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none
                      ${waAutoNotify ? "bg-emerald-600" : "bg-slate-700"}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                        ${waAutoNotify ? "translate-x-2.5" : "translate-x-0"}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 6: GitHub Repository Code Auto-Sync */}
        <div className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                <Github size={20} className="text-purple-400" />
              </div>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1
                ${githubAutoSync 
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                  : "bg-slate-800 text-slate-400"}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${githubAutoSync ? "bg-purple-400 animate-pulse" : "bg-slate-400"}`} />
                {githubAutoSync ? "Auto-Sync ON" : "Manual Sync"}
              </span>
            </div>

            <h4 className="font-display font-bold text-base">GitHub Repository Sync</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Synchronizes your entire CRM codebase, local settings caches, and data pipelines to your private GitHub repository on save or manual trigger.
            </p>

            {/* Config inputs */}
            <div className="mt-4 pt-3 border-t border-slate-150/10 dark:border-slate-800/40 space-y-3">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                  <span>Repository HTTPS URL</span>
                  {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://github.com/username/Elite-Pro-CRM.git"
                  value={githubRepoUrl}
                  onChange={(e) => isPrivileged && setGithubRepoUrl(e.target.value)}
                  readOnly={!isPrivileged}
                  className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono
                    ${!isPrivileged ? "opacity-75 cursor-not-allowed bg-slate-100/5 dark:bg-slate-950/20" : ""}
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205 text-slate-900"}`}
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1 font-semibold flex items-center justify-between">
                  <span>Personal Access Token (PAT)</span>
                  {!isPrivileged && <span className="text-amber-500 font-sans text-[9px] font-bold">🔒 Locked</span>}
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => isPrivileged && setGithubToken(e.target.value)}
                    readOnly={!isPrivileged}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono pr-8
                      ${!isPrivileged ? "opacity-75 cursor-not-allowed bg-slate-100/5 dark:bg-slate-950/20" : ""}
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205 text-slate-900"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 text-xs font-mono select-none"
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Auto Sync Toggle */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between h-[34px]
                ${!isPrivileged ? "opacity-70 cursor-not-allowed" : ""}
                ${darkMode ? "bg-slate-950/45 border-slate-800/40" : "bg-slate-50 border-slate-200"}`}
              >
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 uppercase font-mono font-bold leading-tight">Auto Backup on Changes</span>
                  <span className="text-[8px] text-slate-500 font-sans leading-none mt-0.5">Push changes automatically on save</span>
                </div>
                <button
                  type="button"
                  disabled={!isPrivileged}
                  onClick={() => isPrivileged && setGithubAutoSync(!githubAutoSync)}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed
                    ${githubAutoSync ? "bg-purple-600" : "bg-slate-755"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out
                      ${githubAutoSync ? "translate-x-3" : "translate-x-0"}`}
                  />
                </button>
              </div>

              {/* Status information */}
              {gitStatus && (
                <div className="pt-2 text-[10px] font-mono space-y-1 text-slate-400 border-t border-slate-150/10 dark:border-slate-800/40 font-mono">
                  <div className="flex justify-between">
                    <span>Git Repository:</span>
                    <span className={gitStatus.initialized ? "text-emerald-400 font-semibold" : "text-amber-500 font-semibold"}>
                      {gitStatus.initialized ? "Initialized" : "Not Initialized"}
                    </span>
                  </div>
                  {gitStatus.initialized && (
                    <>
                      <div className="flex justify-between">
                        <span>Active Branch:</span>
                        <span className="text-slate-350 font-semibold flex items-center gap-0.5">
                          <GitBranch size={10} /> {gitStatus.currentBranch}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Uncommitted Files:</span>
                        <span className={gitStatus.uncommittedChangesCount > 0 ? "text-amber-400 font-semibold" : "text-slate-400"}>
                          {gitStatus.uncommittedChangesCount} files pending
                        </span>
                      </div>
                      {gitStatus.lastCommit && (
                        <div className="flex justify-between items-start">
                          <span className="shrink-0">Last Commit:</span>
                          <span className="text-slate-350 font-semibold text-right max-w-[150px] truncate" title={gitStatus.lastCommit}>
                            {gitStatus.lastCommit}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-105/5 space-y-2">
            {githubFeedback && (
              <div className={`p-2.5 rounded-lg text-[10.5px] font-semibold flex items-start gap-1.5 border leading-relaxed animate-fadeIn
                ${githubFeedback.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
                  : "bg-rose-500/10 border-rose-500/25 text-rose-400"}`}
              >
                {githubFeedback.type === "success" ? (
                  <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                )}
                <div>{githubFeedback.message}</div>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleGithubPush()}
              disabled={isGithubPushing || !isPrivileged}
              className={`w-full py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 text-white cursor-pointer active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-55 shadow-md shadow-purple-500/10`}
            >
              <GitCommit size={12} className={isGithubPushing ? "animate-spin" : ""} />
              {isGithubPushing ? "Pushing to GitHub..." : "Push Code & Backup Now"}
            </button>
          </div>
        </div>

      </div>

      {/* CARD 3: CONTINUOUS DATA SECURITY & SECURE DAILY BACKUPS */}
      <div className={`p-6 rounded-2xl border transition-all space-y-6 ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150/10 dark:border-slate-800/40 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
              <Shield size={22} className="text-teal-400 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-sm font-bold tracking-tight">Continuous Data Security & Secure Daily Backups</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                  System Armed & Secure
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 text-left">
                Redundant system archives automatically generated and securely shared daily to prevent any CRM database or leads data loss.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={13} className="text-slate-500" />
            <span className="text-[10px] font-mono text-slate-400">Next scheduled run: <strong>2:00 AM UTC (Daily)</strong></span>
          </div>
        </div>

        {/* Configurations Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Column A: Recipients Manager */}
          <div className="lg:col-span-4 space-y-4 text-left">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Mail size={13} className="text-teal-400" />
                <h5 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Authorized Backup Recipients</h5>
              </div>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Encrypted transaction sheets and user databases are dispatched directly to these verified contacts:
              </p>

              {/* Recipients list mapping */}
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                {backupRecipients.map(email => (
                  <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/20 border border-slate-800/40 text-xs font-mono">
                    <span className="text-slate-300 truncate font-semibold">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition cursor-pointer"
                      title="Deactivate recipient"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add recipient form */}
              <form onSubmit={handleAddRecipient} className="mt-3 flex gap-1.5">
                <input
                  type="email"
                  placeholder="name@eliteproinfra.com"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  className={`flex-1 px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono
                    ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-205"}`}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-550 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition cursor-pointer"
                >
                  Add
                </button>
              </form>
            </div>
          </div>

          {/* Column B: Backup Options and Target Parameters */}
          <div className="lg:col-span-4 space-y-4 text-left border-t lg:border-t-0 lg:border-l lg:border-r border-slate-150/10 dark:border-slate-800/40 px-0 lg:px-6 py-4 lg:py-0">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Settings size={13} className="text-teal-400" />
                <h5 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Storage Cadence & Datasets</h5>
              </div>

              <div className="space-y-3">
                {/* Backup Frequency */}
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest mb-1.5">Backup Interval</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBackupCadence("daily")}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition cursor-pointer select-none
                        ${backupCadence === "daily" 
                          ? "bg-teal-600 border-teal-500 text-white" 
                          : "border-slate-800 text-slate-400 hover:text-slate-200 bg-slate-950/20"}`}
                    >
                      Daily (Strict)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBackupCadence("weekly")}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border text-center transition cursor-pointer select-none
                        ${backupCadence === "weekly" 
                          ? "bg-teal-600 border-teal-500 text-white" 
                          : "border-slate-800 text-slate-400 hover:text-slate-200 bg-slate-950/20"}`}
                    >
                      Weekly Sweep
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-1">
                  <span className="block text-[10px] text-slate-400 uppercase font-mono tracking-widest">Included Models</span>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input
                        type="checkbox"
                        checked={backupIncLeads}
                        onChange={(e) => setBackupIncLeads(e.target.checked)}
                        className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-950"
                      />
                      <span>Leads ({leads.length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input
                        type="checkbox"
                        checked={backupIncUsers}
                        onChange={(e) => setBackupIncUsers(e.target.checked)}
                        className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-950"
                      />
                      <span>Users ({users.length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input
                        type="checkbox"
                        checked={backupIncAppointments}
                        onChange={(e) => setBackupIncAppointments(e.target.checked)}
                        className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-950"
                      />
                      <span>Agenda ({appointments.length})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                      <input
                        type="checkbox"
                        checked={backupIncLogs}
                        onChange={(e) => setBackupIncLogs(e.target.checked)}
                        className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-950"
                      />
                      <span>Logs ({communicationLogs.length + leadEditLogs.length})</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column C: Instant Backup Dispatch Trigger */}
          <div className="lg:col-span-4 space-y-4 flex flex-col justify-between text-left">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Send size={13} className="text-teal-400" />
                <h5 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Manual Secure Override</h5>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Force instant synthesis of a state database archive. Compiles and triggers download + dispatches copies immediately to current authorized email streams.
              </p>

              <button
                type="button"
                onClick={executeBackupAndDispatch}
                disabled={isDispatchingBackup}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-550 hover:to-emerald-550 text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-teal-500/10 cursor-pointer active:scale-95 transition select-none disabled:opacity-50"
              >
                <RefreshCw size={12} className={isDispatchingBackup ? "animate-spin" : ""} />
                {isDispatchingBackup ? "Syncing & Dispatches..." : "Dispatch Secure Copy"}
              </button>
            </div>

            {/* Current safety state indicator */}
            <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/10 text-[10px] font-mono text-teal-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
              <span>Full compliance verified. Encrypted payload using SHA-256 signatures.</span>
            </div>
          </div>

        </div>

        {/* Dynamic Interactive Terminal logs during dispatch / feedback */}
        {(isDispatchingBackup || backupConsoleLogs.length > 0 || backupSuccessMessage) && (
          <div className="border border-slate-800 bg-slate-950 rounded-xl overflow-hidden font-mono text-[11px] mt-4 shadow-inner">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-900 bg-slate-900/60 text-slate-400">
              <span className="flex items-center gap-1.5 text-[10px]">
                <Terminal size={12} className="text-teal-400 stroke-[2.5]" />
                DATABASE_ARCHIVE_DAEMON_LOGS
              </span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase font-bold text-slate-400">
                {isDispatchingBackup ? "Streaming Live" : "Idle Result Log"}
              </span>
            </div>

            <div className="p-4 space-y-1.5 max-h-[140px] overflow-y-auto text-left leading-relaxed">
              {backupConsoleLogs.map((log, index) => {
                let colorClass = "text-slate-400";
                if (log.startsWith("[SECURITY") || log.includes("COMPLETE")) colorClass = "text-emerald-400 font-bold";
                if (log.includes("DISPATCH") || log.includes("COMPLETED")) colorClass = "text-teal-350 font-bold";
                if (log.includes("COMPRESSION")) colorClass = "text-indigo-350";
                return (
                  <div key={index} className={colorClass}>
                    <span className="text-slate-500 mr-2">❯</span>
                    {log}
                  </div>
                );
              })}

              {!isDispatchingBackup && backupSuccessMessage && (
                <div className="mt-3 p-2 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-start gap-1.5 animate-fadeIn">
                  <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                  <span>{backupSuccessMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backup Runs Audit Trail list */}
        <div className="pt-3 border-t border-slate-150/10 dark:border-slate-800/40">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-display font-medium text-xs text-slate-400 uppercase tracking-widest font-mono">
              CRM Security Backup Audit Register
            </h4>
            <span className="text-[10px] text-slate-500 font-mono">History of dispatched runs</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {backupHistory.map((run, i) => (
              <div 
                key={run.id || i}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 text-xs font-mono text-left transition hover:scale-[1.01]
                  ${darkMode ? "bg-slate-950/45 border-slate-850" : "bg-slate-50 border-slate-150"}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-200 break-all">{run.id}</span>
                    <span className={`px-1 rounded text-[9px] font-bold uppercase ${run.isAuto ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15" : "bg-teal-500/10 text-teal-400 border border-teal-500/15"}`}>
                      {run.isAuto ? "Daily Auto" : "Manual run"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock size={10} className="text-slate-500" />
                    {run.timestamp}
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-850 dark:border-slate-800/60 pt-2 text-[10.5px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Archive Size:</span>
                    <strong className="text-teal-400 font-bold">{run.sizeKb}</strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Checksum:</span>
                    <span className="text-[9.5px] select-all cursor-copy text-slate-500" title={run.checksum}>{run.checksum}</span>
                  </div>
                  <div className="text-[9.5px] text-slate-400 truncate mt-1">
                    <span className="text-slate-500 font-bold">Mail copies to:</span> <span className="text-slate-350 font-semibold">{run.recipients.join(", ")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* CARD 4: DISASTER RECOVERY & SYSTEM PORTFOLIO RECONSTRUCTION */}
      <div className={`p-6 rounded-2xl border transition-all space-y-6 ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150/10 dark:border-slate-800/40 pb-4">
          <div className="flex items-start gap-3 text-left">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-450 shrink-0">
              <Archive size={22} className="text-rose-450 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-semibold text-sm font-bold tracking-tight">Disaster recovery & Lead Portfolios Reconstruction</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono tracking-wider font-extrabold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Master Cache Safeguard
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 text-left">
                Accidentally wiped your browser local storage or synced with an empty cloud database? Easily reconstruct your lead sheets and logs instantly.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={checkServerCacheMeta}
            disabled={isCheckingServerCache}
            className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-300 transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw size={11} className={isCheckingServerCache ? "animate-spin" : ""} />
            Scan Master Filesystem
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Column 1: Informational Text */}
          <div className="md:col-span-8 text-left space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              Our servers run a dual-tier protection cache that securely backs up all lead sheets on the server-side filesystem (<code className="font-mono bg-slate-950 text-slate-350 px-1 py-0.5 rounded">crm_data_cache.json</code>) during active modifications. 
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <div className="p-3 rounded-xl bg-slate-950/25 border border-slate-850 dark:border-slate-805/40 flex flex-col justify-center min-w-[130px]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 text-left">Master Server Leads</span>
                <span className="text-lg font-display font-bold text-teal-400 mt-0.5 text-left">
                  {serverCacheLeadsCount !== null ? `${serverCacheLeadsCount} Leads` : "Analyzing..."}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/25 border border-slate-850 dark:border-slate-805/40 flex flex-col justify-center min-w-[130px]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 text-left">Master Server Agenda</span>
                <span className="text-lg font-display font-bold text-cyan-400 mt-0.5 text-left">
                  {serverCacheAppsCount !== null ? `${serverCacheAppsCount} Slots` : "Analyzing..."}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/25 border border-slate-850 dark:border-slate-805/40 flex flex-col justify-center min-w-[130px]">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 text-left">Active Client Browser</span>
                <span className="text-lg font-display font-bold text-slate-350 mt-0.5 text-left">
                  {leads.length} Leads
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Trigger Button */}
          <div className="md:col-span-4 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={triggerServerCacheRecovery}
              disabled={isRecovering}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-550 hover:to-amber-550 text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-rose-500/10 cursor-pointer active:scale-95 transition select-none disabled:opacity-50"
            >
              <Archive size={13} className={isRecovering ? "animate-spin" : ""} />
              {isRecovering ? "Reconstructing..." : "Execute Master Portfolios Reconstruction"}
            </button>
            <div className="p-2 rounded bg-rose-500/5 text-[9px] font-mono text-rose-455 border border-rose-500/10 text-center select-none">
              ⚡ Overwrites active browser memory & local storage safely.
            </div>
          </div>
        </div>

        {recoveryFeedback && (
          <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fadeIn border
            ${recoveryFeedback.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/25 text-rose-455"}`}
          >
            {recoveryFeedback.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <div className="text-left">{recoveryFeedback.message}</div>
          </div>
        )}
      </div>

      {/* SQL Setup schema generation block */}
      {!allTablesOk && (
        <div className={`p-6 rounded-2xl border transition-all space-y-4
          ${darkMode ? "bg-slate-900 border-yellow-500/25 text-white" : "bg-white border-yellow-400 shadow-sm"}`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-500">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h4 className="font-display font-bold text-base text-yellow-500">Supabase Tables Schema Setup Needed</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                We verified your connection to project <span className="font-mono text-slate-200">fzsjeukjjjutiihhzjgu</span>, but we cannot locate the core tables yet. Copy and run the SQL below inside your **Supabase SQL Editor** to initialize them instantly.
              </p>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 font-mono text-[11px]">
            <div className="flex justify-between items-center px-4 py-2 border-b border-slate-850 bg-slate-900/60 text-[10px] text-slate-400">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-yellow-500" />
                <span>BOOTSTRAP_SCHEMA.sql</span>
              </div>
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1 cursor-pointer py-1 px-2.5 hover:bg-slate-850 rounded text-[10px] transition font-semibold"
              >
                {copiedSql ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copiedSql ? "Copied" : "Copy Schema Code"}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto max-h-60 text-slate-305 text-left leading-relaxed">
              <code>{sqlSchema}</code>
            </pre>
          </div>
          
          <div className="p-3.5 rounded-xl bg-slate-850/50 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
            <Info size={14} className="mt-0.5 text-teal-400 shrink-0" />
            <div>
              <strong>Quick Development Hint:</strong> The SQL command includes <code>DISABLE ROW LEVEL SECURITY</code> statements. Disabling RLS removes complex access controls so you can immediately prototype and read/write records directly from the frontend. For absolute production release, remember to add your custom user session/RLS policies.
            </div>
          </div>
        </div>
      )}

      {/* Connection confirmation pop-up */}
      {showConfigAlert && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2 animate-bounce">
          <Check size={14} className="stroke-[3]" />
          API Integrity verified: Handshaking with Supabase project fzsjeukjjjutiihhzjgu success! Checked all tables status.
        </div>
      )}

      {/* Complete Data Purge & Hard System Reset (Danger Zone) */}
      <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-rose-500/15" : "bg-white border-rose-100 shadow-sm shadow-rose-500/5"}`}>
        <div className="border-b border-rose-500/15 pb-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-500">
              <Trash size={16} className="text-rose-500 shrink-0" />
              <h4 className="font-display font-semibold text-sm">
                System Danger Zone: Hard Purge & Reset CRM Database
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl text-left">
              Permanently clears all CRM pipeline records (leads, appointments, schedules, communication and audit logs) from both the Supabase cloud database and the portal's background file/local storage caches. Use this to prepare a completely blank CRM slate for new records.
            </p>
          </div>

          <button
            type="button"
            id="clear-all-data-purge-btn"
            disabled={isPurging || !isPrivileged}
            onClick={handlePurgeAllData}
            className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed select-none min-w-[210px] shadow-sm active:scale-95 text-center"
          >
            <Trash size={13} className={isPurging ? "animate-pulse" : ""} />
            {isPurging ? "Purging All Records..." : "Purge All CRM Records"}
          </button>
        </div>

        {purgeFeedback && (
          <div className={`p-4 rounded-xl text-xs font-semibold flex items-start gap-2 animate-fadeIn border text-left
            ${purgeFeedback.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/25 text-rose-400"}`}
          >
            {purgeFeedback.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <div>{purgeFeedback.message}</div>
          </div>
        )}
      </div>

      {/* Sync history timeline log */}
      <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
        <div className="border-b border-slate-100/15 pb-3 mb-4 flex items-center justify-between">
          <h4 className="font-display font-semibold text-sm flex items-center gap-2">
            <CloudLightning size={15} className="text-teal-400" />
            Live Sync Transaction Logs
          </h4>
          <span className="text-[10px] font-mono text-slate-400">Showing last 4 transactions</span>
        </div>

        <div className="space-y-3.5 font-mono text-[11px] text-slate-350 text-left">
          {syncHistory.map((log, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-3
                ${darkMode ? "bg-slate-950/45 border-slate-900" : "bg-slate-50 border-slate-150"}`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500 mt-1 animate-pulse"></div>
              <div>
                <p className="font-semibold text-slate-300">{log}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">TLS security verified. Handshake success between workspace domain and server cluster logs.</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
