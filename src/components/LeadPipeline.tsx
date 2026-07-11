import React, { useState, useMemo, useEffect } from "react";
import { Lead, CommunicationLog, User, LeadEditLog, Appointment, AppointmentType } from "../types";
import AddLeadModal from "./AddLeadModal";
import * as XLSX from "xlsx";
import { 
  Search, 
  Filter, 
  Sparkles, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Briefcase, 
  IndianRupee, 
  TrendingUp, 
  Trash2, 
  Check, 
  Edit3, 
  X,
  Copy,
  Send,
  Loader2,
  Calendar,
  AlertCircle,
  ChevronDown,
  Clock,
  Lock,
  History,
  UserCheck,
  Upload,
  FileSpreadsheet,
  Download,
  ArrowLeftRight,
  Bell
} from "lucide-react";


const sanitizeDateForInput = (dateStr: string): string => {
  if (!dateStr) return "";
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? dateStr : "";
};

interface LeadPipelineProps {
  leads: Lead[];
  users?: User[];
  onAddLead: (lead: Omit<Lead, "id" | "dateCreated" | "dateUpdated">) => void;
  onBulkAddLeads?: (leads: Omit<Lead, "id" | "dateCreated" | "dateUpdated">[], skipDupCheck?: boolean) => void;
  onUpdateLead: (lead: Lead) => void;
  onDeleteLead: (id: string) => void;
  onBulkDeleteLeads?: (ids: string[]) => void;
  onBulkTransferLeads?: (leadIds: string[], targetAgentNames: string[]) => Promise<{ success: boolean; count: number; error?: string }>;
  communicationLogs: CommunicationLog[];
  onAddCommunicationLog: (log: Omit<CommunicationLog, "id">) => void;
  darkMode: boolean;
  currentUser?: User | null;
  leadEditLogs?: LeadEditLog[];
  onClearLeadEditLogs?: (type: "transfer" | "edit" | "all") => void;
  onAddAppointment?: (appt: Omit<Appointment, "id" | "isCompleted">) => void;
  onUpdateAppointment?: (appt: Appointment) => void;
  onDeleteAppointment?: (idOrIds: string | string[], skipConfirm?: boolean) => void;
  appointments?: Appointment[];
  triggerConfirm?: (title: string, message: string, onConfirm: () => void) => void;
  triggerAlert?: (title: string, message: string) => void;
}

export default function LeadPipeline({
  leads,
  users,
  onAddLead,
  onBulkAddLeads,
  onUpdateLead,
  onDeleteLead,
  onBulkDeleteLeads,
  onBulkTransferLeads,
  communicationLogs,
  onAddCommunicationLog,
  darkMode,
  currentUser,
  leadEditLogs = [],
  onClearLeadEditLogs,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
  appointments = [],
  triggerConfirm,
  triggerAlert
}: LeadPipelineProps) {
  const isSalesOrTL = currentUser?.role === "sales_team" || currentUser?.role === "team_leader";

  const allowedNormalizeSet = new Set([
     "rickymatharu",
     "prabhjotsingh",
     "shammyverma",
     "sanjeevmehta",
     "haarishkhan",
     "vinaygrewal",
     "vishallaller",
     "yuvanshkapoor",
     "pardeepsharma",
     "chiragmehta",
     "pawantanwar",
     "deepanshugarg",
     "ankitghudayia",
     "devverma",
     "kunalwadhwa",
     "kaushalmidha",
     "argho",
     "jeevakraina",
     "sahilarora",
     "pratibhapawa"
  ]);

  const getNormalizedParts = (nameStr: string) => {
    if (!nameStr) return [];
    return nameStr.toLowerCase().replace(/\s+/g, '').split('/');
  };

  const isNameInAllowedList = (nameStr: string) => {
    if (!nameStr) return false;
    const parts = getNormalizedParts(nameStr);
    const inPreset = parts.some(part => allowedNormalizeSet.has(part));
    if (inPreset) return true;
    return (users || []).some(u => {
      if (u.role !== "sales_team" && u.role !== "team_leader") return false;
      const uParts = getNormalizedParts(u.name);
      return parts.some(p => uParts.includes(p)) || uParts.some(p => parts.includes(p));
    });
  };

  const isAgentEligibleForTransfer = (agentName: string) => {
    if (!agentName) return false;
    if (!isNameInAllowedList(agentName)) return false;
    const matchedUser = (users || []).find(u => {
      const uParts = getNormalizedParts(u.name);
      const agentParts = getNormalizedParts(agentName);
      return uParts.some(p => agentParts.includes(p)) || agentParts.some(p => uParts.includes(p));
    });
    return matchedUser ? (matchedUser.role === "team_leader" || matchedUser.role === "sales_team") : false;
  };

  // Find duplicate phone numbers of leads across any sources
  const isDuplicatePhone = (phoneStr: string, ignoreId?: string) => {
    const val = (phoneStr || "").trim();
    if (!val || val === "N/A" || val === "-") return false;
    
    // Normalize: strip non-digits for standard checking
    const norm = val.replace(/\D/g, "");
    
    let count = 0;
    leads.forEach(l => {
      if (ignoreId && l.id === ignoreId) return;
      const otherVal = (l.phone || "").trim();
      if (!otherVal || otherVal === "N/A" || otherVal === "-") return;
      
      const otherNorm = otherVal.replace(/\D/g, "");
      if (norm.length >= 6 && otherNorm.length >= 6) {
        if (norm === otherNorm) count++;
      } else {
        if (val.toLowerCase() === otherVal.toLowerCase()) count++;
      }
    });
    
    return count > 0;
  };

  // Generate dynamic WhatsApp link for triggering direct message assignment alerts
  const getAgentWhatsAppHref = (agentName: string, lead: Lead) => {
    if (!users) return null;
    const foundUser = users.find(u => u.name.toLowerCase() === agentName.toLowerCase());
    if (!foundUser || !foundUser.phone) return null;
    
    // Create clean WhatsApp Message template
    const text = `*ELITE PRO INFRA ADVISORY ALERT*\n\n` +
      `Hello *${foundUser.name}*,\n` +
      `You have been assigned a new Client Lead!\n\n` +
      `🔹 *Client:* ${lead.name || "N/A"}\n` +
      `🔹 *Project:* ${lead.projectName || "N/A"}\n` +
      `🔹 *Budget Plan:* ${lead.budget || "N/A"}\n` +
      `🔹 *Location:* ${lead.location || "N/A"}\n` +
      `🔹 *Reference Source:* ${lead.source || "N/A"}\n` +
      `💬 *Client Notes:* ${lead.notes || "No extra notes."}\n\n` +
      `Please contact the lead immediately. High conversion priority.`;
    
    // Sanitize phone number (remove +, spaces, hyphens)
    const sanitizedPhone = foundUser.phone.replace(/[+\s-]/g, "");
    return `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(text)}`;
  };

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showLogs, setShowLogs] = useState(false);
  const [showTransferLogs, setShowTransferLogs] = useState(false);
  const [copiedTransfers, setCopiedTransfers] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  const revisionLogs = useMemo(() => {
    return leadEditLogs.filter(
      log => log.editorName !== "System Auto-Transfer Agent" && log.editorName !== "System Auto-Reassigner"
    );
  }, [leadEditLogs]);

  const getDisplayNotes = (notesStr: string) => {
    if (!notesStr) return "";
    const isSpecialAdmin = currentUser?.role === "super_admin" || currentUser?.role === "admin";
    if (isSpecialAdmin) {
      return notesStr;
    }
    return notesStr
      .split("\n")
      .filter(line => {
        const lower = line.toLowerCase();
        return !line.includes("[System]") && 
               !lower.includes("automatically reassigned") && 
               !lower.includes("reassigned randomly") &&
               !lower.includes("system auto-transfer") &&
               !lower.includes("remained in") &&
               !lower.includes("hours since creation") &&
               !lower.includes("hours since last assignment/transfer");
      })
      .join("\n")
      .trim();
  };

  // Expanded dynamic filters (Project, Location, Budget, TL / Advisor wise)
  const [leadProjectFilter, setLeadProjectFilter] = useState<string>("all");
  const [leadLocationFilter, setLeadLocationFilter] = useState<string>("all");
  const [leadBudgetFilter, setLeadBudgetFilter] = useState<string>("all");

  const [leadProjectSearchQuery, setLeadProjectSearchQuery] = useState<string>("");
  const [leadLocationSearchQuery, setLeadLocationSearchQuery] = useState<string>("");
  const [leadBudgetMinQuery, setLeadBudgetMinQuery] = useState<string>("");
  const [leadBudgetMaxQuery, setLeadBudgetMaxQuery] = useState<string>("");

  const [leadSelectedTL, setLeadSelectedTL] = useState<string>(() => {
    if (currentUser && currentUser.role === "team_leader") {
      return currentUser.id;
    }
    return "all";
  });
  const [leadSelectedAgentName, setLeadSelectedAgentName] = useState<string>("all");

  // Handle notification focus redirection
  useEffect(() => {
    const handleFocusLead = (e: Event) => {
      const customEvent = e as CustomEvent<{ leadId: string }>;
      if (customEvent.detail && customEvent.detail.leadId) {
        const leadId = customEvent.detail.leadId;
        const targetLead = leads.find(l => l.id === leadId);
        if (targetLead) {
          setSearchTerm(targetLead.name);
          setStatusFilter("all");
          setSourceFilter("all");
          setTemperatureFilter("all");
          setLeadProjectFilter("all");
          setLeadLocationFilter("all");
          setLeadBudgetFilter("all");
          setLeadSelectedTL("all");
          setLeadSelectedAgentName("all");
        }
      }
    };

    window.addEventListener("elite_pro_focus_lead", handleFocusLead);
    
    // Check if there is a pending highlight from fresh navigation
    const pendingHighlight = localStorage.getItem("elite_pro_search_lead_highlight");
    if (pendingHighlight) {
      const targetLead = leads.find(l => l.id === pendingHighlight);
      if (targetLead) {
        setSearchTerm(targetLead.name);
        setStatusFilter("all");
        setSourceFilter("all");
        setTemperatureFilter("all");
        setLeadProjectFilter("all");
        setLeadLocationFilter("all");
        setLeadBudgetFilter("all");
        setLeadSelectedTL("all");
        setLeadSelectedAgentName("all");
      }
      localStorage.removeItem("elite_pro_search_lead_highlight");
    }

    return () => {
      window.removeEventListener("elite_pro_focus_lead", handleFocusLead);
    };
  }, [leads]);


  // Dynamic lists of unique values from visible leads for filter selects
  const leadProjectsPool = useMemo(() => {
    const leadNames = new Set(leads.map(l => l.name.toLowerCase().trim()));
    const userNames = new Set((users || []).map(u => u.name.toLowerCase().trim()));
    return Array.from(new Set(leads.map(l => l.projectName || "").filter(Boolean)))
      .filter(proj => {
        const projLower = proj.toLowerCase().trim();
        return !leadNames.has(projLower) && !userNames.has(projLower);
      })
      .sort();
  }, [leads, users]);

  const leadLocationsPool = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.location || "").filter(Boolean))).sort();
  }, [leads]);

  const leadBudgetsPool = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.budget || "").filter(Boolean))).sort();
  }, [leads]);

  // Extract TL lists
  const leadTLUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => u.role === "team_leader" && u.active !== false);
  }, [users]);

  // Extract Sales Advisors options
  const leadSalesUsersOptions = useMemo(() => {
    if (!users || !currentUser) return [];
    
    // Only return active sales advisors
    const activeUsers = users.filter(u => u.active !== false);
    
    let eligibleSales: User[] = [];
    if (currentUser.role === "super_admin" || currentUser.role === "admin") {
      if (leadSelectedTL === "all") {
        eligibleSales = activeUsers.filter(u => u.role === "sales_team");
      } else {
        eligibleSales = activeUsers.filter(u => u.role === "sales_team" && u.teamLeaderId === leadSelectedTL);
      }
    } else if (currentUser.role === "team_leader") {
      eligibleSales = activeUsers.filter(u => u.role === "sales_team" && u.teamLeaderId === currentUser.id);
    }
    
    // Add TL themselves to the list
    const pool = [...eligibleSales];
    if (currentUser.role === "team_leader") {
      pool.unshift(currentUser);
    } else if (leadSelectedTL !== "all") {
      const selectedTLUser = users.find(u => u.id === leadSelectedTL);
      if (selectedTLUser) {
        pool.unshift(selectedTLUser);
      }
    }
    return pool;
  }, [users, currentUser, leadSelectedTL]);

  // Modal / Form States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadForAI, setSelectedLeadForAI] = useState<Lead | null>(null);

  // Set Reminder Modal States
  const [reminderModalLead, setReminderModalLead] = useState<Lead | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderType, setReminderType] = useState<AppointmentType>("followup");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderAlert, setReminderAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const openReminderModal = (lead: Lead) => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const defaultDate = `${yyyy}-${mm}-${dd}`;

    setReminderModalLead(lead);

    // Find incomplete reminders for this lead
    const leadReminders = appointments.filter(app => app.leadId === lead.id && !app.isCompleted);
    if (leadReminders.length > 0) {
      // Default to editing the latest incomplete reminder
      const newestRem = leadReminders[0];
      setEditingReminderId(newestRem.id);
      setReminderTitle(newestRem.title);
      setReminderType(newestRem.type);
      setReminderDate(newestRem.date);
      setReminderTime(newestRem.time);
      setReminderNotes(newestRem.notes || "");
    } else {
      // default setup mode
      setEditingReminderId(null);
      setReminderTitle(`Follow-up with ${lead.name}`);
      setReminderType("followup");
      setReminderDate(defaultDate);
      setReminderTime("12:00");
      setReminderNotes(lead.projectName ? `Discuss project: ${lead.projectName} (Budget Plan: ${lead.budget || "N/A"})` : "Discuss real estate requirements.");
    }
    setReminderAlert(null);
  };

  const handleCreateOrUpdateReminder = () => {
    if (!reminderModalLead) return;
    if (!reminderTitle.trim()) {
      setReminderAlert({ type: "error", message: "Reminder title is required." });
      return;
    }
    if (!reminderDate) {
      setReminderAlert({ type: "error", message: "Reminder date is required." });
      return;
    }
    if (!reminderTime) {
      setReminderAlert({ type: "error", message: "Reminder time is required." });
      return;
    }

    if (editingReminderId) {
      if (onUpdateAppointment) {
        onUpdateAppointment({
          id: editingReminderId,
          leadId: reminderModalLead.id,
          leadName: reminderModalLead.name,
          title: reminderTitle.trim(),
          date: reminderDate,
          time: reminderTime,
          type: reminderType,
          notes: reminderNotes.trim(),
          isCompleted: false,
          reminderActive: true
        });

        setReminderAlert({ 
          type: "success", 
          message: `Successfully updated reminder "${reminderTitle.trim()}"!`
        });

        setTimeout(() => {
          setReminderModalLead(null);
          setEditingReminderId(null);
        }, 1500);
      } else {
        setReminderAlert({ type: "error", message: "Appointment update handler is not available." });
      }
    } else {
      if (onAddAppointment) {
        onAddAppointment({
          leadId: reminderModalLead.id,
          leadName: reminderModalLead.name,
          title: reminderTitle.trim(),
          date: reminderDate,
          time: reminderTime,
          type: reminderType,
          notes: reminderNotes.trim(),
          reminderActive: true
        });
        
        setReminderAlert({ 
          type: "success", 
          message: `Successfully scheduled reminder "${reminderTitle.trim()}" on ${reminderDate} at ${reminderTime}!`
        });
        
        setTimeout(() => {
          setReminderModalLead(null);
        }, 1500);
      } else {
        setReminderAlert({ type: "error", message: "Appointment creation handler is not available." });
      }
    }
  };

  const startNewReminderForm = () => {
    if (!reminderModalLead) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    
    setEditingReminderId(null);
    setReminderTitle(`Follow-up with ${reminderModalLead.name}`);
    setReminderType("followup");
    setReminderDate(`${yyyy}-${mm}-${dd}`);
    setReminderTime("12:00");
    setReminderNotes("");
    setReminderAlert({ type: "success", message: "Switched to creating a new reminder." });
    setTimeout(() => setReminderAlert(null), 1200);
  };

  // CSV/Excel Importer States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Bulk Status Transfer States
  const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
  const [bulkTransferUseSelected, setBulkTransferUseSelected] = useState(false);
  const [bulkSourceStatus, setBulkSourceStatus] = useState<string>("New Lead");
  const [bulkSourceAgent, setBulkSourceAgent] = useState<string>("All");
  const [bulkTargetAgents, setBulkTargetAgents] = useState<string[]>([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState<string>("");
  const [bulkTransferWorking, setBulkTransferWorking] = useState(false);
  const [bulkTransferMessage, setBulkTransferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Bulk Status Transfer Helper Calculations
  const bulkMatchingLeads = useMemo(() => {
    if (bulkTransferUseSelected) {
      return leads.filter(lead => selectedLeadIds.includes(lead.id));
    }
    return leads.filter(lead => {
      const matchStatus = lead.status === bulkSourceStatus;
      if (!matchStatus) return false;
      if (bulkSourceAgent === "All") return true;
      if (bulkSourceAgent === "Unassigned") {
        return !lead.assignedAgent || lead.assignedAgent.trim() === "";
      }
      return (lead.assignedAgent || "").trim().toLowerCase() === bulkSourceAgent.trim().toLowerCase();
    });
  }, [leads, bulkSourceStatus, bulkSourceAgent, bulkTransferUseSelected, selectedLeadIds]);

  const bulkCurrentAssigneesForSelectedStatus = useMemo(() => {
    const list = leads
      .filter(l => l.status === bulkSourceStatus)
      .map(l => (l.assignedAgent || "").trim());
    // Use unique non-empty cased values, map empty/trimmed to "Unassigned"
    const unique = Array.from(new Set(list)).map(name => name === "" ? "Unassigned" : name);
    return unique.filter(Boolean);
  }, [leads, bulkSourceStatus]);

  const bulkActiveAssignees = useMemo(() => {
    if (!users) return [];
    return users.filter(u => (u.role === "sales_team" || u.role === "team_leader") && u.active !== false);
  }, [users]);

  // Handler to sync resetting selected agent of TL filters properly
  const handleLeadTLChange = (tlId: string) => {
    setLeadSelectedTL(tlId);
    setLeadSelectedAgentName("all");
  };

  const handleCommitBulkTransfer = async () => {
    if (bulkMatchingLeads.length === 0) {
      setBulkTransferMessage({ type: "error", text: "There are no leads matching your selection criteria to transfer." });
      return;
    }
    if (bulkTargetAgents.length === 0) {
      setBulkTransferMessage({ type: "error", text: "Please select at least one active Team Leader or Sales Advisor as recipient." });
      return;
    }
    
    setBulkTransferWorking(true);
    setBulkTransferMessage(null);
    try {
      if (onBulkTransferLeads) {
        const res = await onBulkTransferLeads(bulkMatchingLeads.map(l => l.id), bulkTargetAgents);
        if (res.success) {
          const namesStr = bulkTargetAgents.length === 1 
            ? bulkTargetAgents[0]
            : `${bulkTargetAgents.length} selected advisors sequentially (Round-Robin equal balanced distribution)`;
          setBulkTransferMessage({ 
            type: "success", 
            text: bulkTransferUseSelected
              ? `Successfully reallocated ${res.count} hand-selected CRM record${res.count !== 1 ? "s" : ""} across ${namesStr}!`
              : `Successfully reallocated ${res.count} CRM record${res.count !== 1 ? "s" : ""} of status "${bulkSourceStatus}" across ${namesStr}!` 
          });
          setBulkTargetAgents([]);
          if (bulkTransferUseSelected) {
            setSelectedLeadIds([]);
            setBulkTransferUseSelected(false);
          }
        } else {
          setBulkTransferMessage({ type: "error", text: res.error || "An error occurred during bulk transfer." });
        }
      } else {
        setBulkTransferMessage({ type: "error", text: "Bulk transfer action not supported." });
      }
    } catch (err: any) {
      setBulkTransferMessage({ type: "error", text: err.message || "An unexpected error occurred." });
    } finally {
      setBulkTransferWorking(false);
    }
  };

  // Download CSV Template function
  const downloadImportTemplate = () => {
    const csvContent = "CUSTOMER NAME,PROJECT NAME,EMAIL ADDRESS,PHONE NUMBER,LEAD SOURCE,PHYSICAL LOCATION,LEAD STATUS,LEAD PRIORITY,BUDGET,NOTES (CONSULTATION SYNOPSIS BRIEF),ASSIGN AGENT\n" +
      "Rajesh Kumar,Apex Net-Zero Warehouse,rajesh@gmail.com,9876543210,Google Ad,Delhi NCR,Interested,Hot,₹15 Cr,Looking for warehouse space with highway connectivity.,Prabhjot Singh\n" +
      "Heena Sharma,Vortex Hyper-scale DC,heena.sharma@corp.com,9988776655,Meta Ad,Bangalore,Follow Up,Warm,₹45 Cr,Seeking 30MW redundant grid architecture solar sync.,Admin";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ElitePro_Leads_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download filtered leads as Excel spreadsheet for Admin & Super Admin
  const handleDownloadExcel = () => {
    if (!filteredLeads || filteredLeads.length === 0) return;

    // Convert lead fields into professional Excel columns
    const excelRows = filteredLeads.map(lead => ({
      "Customer Name": lead.name,
      "Corporate Group": lead.company || "N/A",
      "Executive Title": lead.position || "N/A",
      "Email Address": lead.email,
      "Contact Number": lead.phone,
      "Lead Source Route": lead.source,
      "Pipeline Stage": lead.status,
      "Intent Temperature": lead.temperature,
      "Capital Budget Range": lead.budget,
      "Physical Location": lead.location || "N/A",
      "Project Complex / Interest": lead.projectName || "N/A",
      "Assigned Advisor": lead.assignedAgent,
      "Lead Priority Score": lead.score || "N/A",
      "Lead Profile Notes": lead.notes || "",
      "Acquisition Date": lead.dateCreated ? lead.dateCreated.substring(0, 10) : "",
      "Recent Update Time": lead.dateUpdated ? lead.dateUpdated.substring(0, 10) : ""
    }));

    // Generate XLSX workbook & download it beautifully
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Portfolio Leads");

    // Adjust column widths automatically based on value lengths
    const maxLengths = Object.keys(excelRows[0] || {}).map(key => {
      let maxLen = key.length;
      excelRows.forEach(row => {
        const val = String((row as any)[key] || "");
        if (val.length > maxLen) {
          maxLen = val.length;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }; // clamp between 10 and 40 characters wide
    });
    worksheet["!cols"] = maxLengths;

    // Trigger local client file download
    const dateStr = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(workbook, `ElitePro_Filtered_Leads_${dateStr}.xlsx`);
  };

  // Process CSV/Excel
  const handleFileImport = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Could not read file data.");

        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read raw sheet array of arrays
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawJson.length < 2) {
          throw new Error("The file has no data rows. Must contain at least a header row and one data row.");
        }

        // Clean headers
        const headers = rawJson[0].map((h: any) => String(h || "").trim().toLowerCase());
        
        // Map columns (fuzzy matches)
        const nameIdx = headers.findIndex((h: string) => h.includes("customer name") || h === "name" || h === "customer");
        const projectIdx = headers.findIndex((h: string) => h.includes("project name") || h === "project");
        const emailIdx = headers.findIndex((h: string) => h.includes("email") || h === "mail" || h.includes("email address"));
        const phoneIdx = headers.findIndex((h: string) => h.includes("phone") || h === "contact" || h.includes("phone number") || h === "mobile");
        const sourceIdx = headers.findIndex((h: string) => h.includes("source") || h === "lead source");
        const locationIdx = headers.findIndex((h: string) => h.includes("location") || h === "physical location" || h === "address" || h === "city");
        const statusIdx = headers.findIndex((h: string) => h === "status" || h.includes("lead status") || h === "stage");
        const priorityIdx = headers.findIndex((h: string) => h === "priority" || h.includes("priority") || h.includes("lead priority") || h === "temperature" || h.includes("temp"));
        const budgetIdx = headers.findIndex((h: string) => h === "budget" || h.includes("budget") || h.includes("capital budget"));
        const notesIdx = headers.findIndex((h: string) => h === "notes" || h.includes("notes") || h.includes("consultation synopsis") || h === "synopsis" || h.includes("consultation synopsis brief"));
        const agentIdx = headers.findIndex((h: string) => h === "agent" || h.includes("assign agent") || h.includes("assigned agent") || h === "assignedagent" || h === "advisor" || h.includes("assign to") || h === "salesperson" || h === "representative" || h === "owner" || h === "name name" || h === "assigned agent name");

        if (nameIdx === -1) {
          throw new Error("Missing critical header mapping: 'CUSTOMER NAME' column is required.");
        }

        const parsedLeads: any[] = [];

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          let rawName = nameIdx !== -1 && row[nameIdx] !== undefined && row[nameIdx] !== null 
            ? String(row[nameIdx]).trim() 
            : "";

          const rawProj = projectIdx !== -1 && row[projectIdx] !== undefined ? String(row[projectIdx]).trim() : "";
          const rawEmail = emailIdx !== -1 && row[emailIdx] !== undefined ? String(row[emailIdx]).trim() : "";
          const rawPhone = phoneIdx !== -1 && row[phoneIdx] !== undefined ? String(row[phoneIdx]).trim() : "";

          // Bypassing completely empty spreadsheet rows
          if (!rawName && !rawProj && !rawEmail && !rawPhone) continue;

          if (!rawName) {
            if (rawPhone && rawPhone !== "N/A" && rawPhone !== "n/a") {
              rawName = `Prospect (${rawPhone})`;
            } else if (rawProj) {
              rawName = `Prospect (${rawProj})`;
            } else {
              rawName = "N/A";
            }
          }

          const rawSourceStr = sourceIdx !== -1 && row[sourceIdx] !== undefined ? String(row[sourceIdx]).trim() : "Website";
          const rawLoc = locationIdx !== -1 && row[locationIdx] !== undefined ? String(row[locationIdx]).trim() : "Noida, India";
          const rawStatusStr = statusIdx !== -1 && row[statusIdx] !== undefined ? String(row[statusIdx]).trim() : "New Lead";
          const rawPriorityStr = priorityIdx !== -1 && row[priorityIdx] !== undefined ? String(row[priorityIdx]).trim() : "Warm";
          let rawBudget = budgetIdx !== -1 && row[budgetIdx] !== undefined ? String(row[budgetIdx]).trim() : "₹1.0 Cr";
          // Sanitize corrupted UTF-8 sequences for Hindi Rupee symbol (₹)
          rawBudget = rawBudget
            .replace(/â\u0082¹/g, "₹")
            .replace(/â‚¹/g, "₹")
            .replace(/â\u0082/g, "₹")
            .replace(/â\u0092¹/g, "₹")
            .replace(/â\u0092/g, "₹");
          const rawNotes = notesIdx !== -1 && row[notesIdx] !== undefined ? String(row[notesIdx]).trim() : "";

          // Match Source safely
          const validSources = ['Meta Ad', 'Google Ad', 'IVR Board', 'IVR', 'Reference', 'Website', 'Social Media', 'Personal', 'Cold Call'];
          let finalSource: any = "Website";
          const matchedSource = validSources.find(s => s.toLowerCase() === rawSourceStr.toLowerCase() || rawSourceStr.toLowerCase().replace(/\sAd$/i, "") === s.toLowerCase().replace(/\sAd$/i, ""));
          if (matchedSource) finalSource = matchedSource;

          // Match Status safely
          const validStatuses = ['New Lead', 'Interested', 'Follow Up', 'Detailed Share', 'Not Interested', 'Meeting Done', 'Site Visit', 'Call Back', 'Junk', 'Duplicate', 'Not Pick', 'Closed Client', 'Switched Off', 'Low Budget'];
          let finalStatus: any = "New Lead";
          const matchedStatus = validStatuses.find(s => s.toLowerCase() === rawStatusStr.toLowerCase() || s.toLowerCase().replace(/\s+/g, "") === rawStatusStr.toLowerCase().replace(/\s+/g, ""));
          if (matchedStatus) finalStatus = matchedStatus;

          // Match Priority safely
          let finalTemperature: any = "Warm";
          const lowerPriority = rawPriorityStr.toLowerCase();
          if (lowerPriority.includes("hot") || lowerPriority.includes("high")) {
            finalTemperature = "Hot";
          } else if (lowerPriority.includes("cold") || lowerPriority.includes("low")) {
            finalTemperature = "Cold";
          } else if (lowerPriority.includes("dead")) {
            finalTemperature = "Dead";
          } else if (lowerPriority.includes("warm") || lowerPriority.includes("medium")) {
            finalTemperature = "Warm";
          }

          const scoreMap: Record<string, number> = { "Hot": 90, "Warm": 65, "Cold": 30, "Dead": 5 };
          const finalScore = scoreMap[finalTemperature] || 50;

          // Automatically assign to matching Sales Team or TL, otherwise fallback to "Admin"
          let finalAdvisor = "Admin";
          let localAssignmentMatched = false;

          if (agentIdx !== -1 && row[agentIdx] !== undefined) {
            const rawAgentName = String(row[agentIdx]).trim();
            if (rawAgentName) {
              const matchedUser = (users || []).find(u => (u.name || "").toLowerCase().trim() === rawAgentName.toLowerCase().trim());
              if (matchedUser && (matchedUser.role === "sales_team" || matchedUser.role === "team_leader" || matchedUser.role === "admin")) {
                finalAdvisor = matchedUser.name;
                localAssignmentMatched = true;
              }
            }
          }

          if (!localAssignmentMatched) {
            // Unspecified or unmatched columns: default to Admin if uploaded by admin, else local user
            finalAdvisor = currentUser?.role === "super_admin" || currentUser?.role === "admin" ? "Admin" : (currentUser?.name || "Admin");
          }

          parsedLeads.push({
            name: rawName,
            projectName: rawProj,
            email: rawEmail || `${rawName.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
            phone: rawPhone || "N/A",
            source: finalSource,
            location: rawLoc,
            status: finalStatus,
            temperature: finalTemperature,
            budget: rawBudget,
            assignedAgent: finalAdvisor,
            notes: rawNotes ? rawNotes : "Imported via spreadsheet batch ingestion.",
            score: finalScore,
          });
        }

        if (parsedLeads.length === 0) {
          throw new Error("Processed 0 files. Check that CUSTOMER NAME values are defined.");
        }

        setImportPreviewData(parsedLeads);
      } catch (err: any) {
        console.error("Parse error:", err);
        setImportError(err.message || "Failed to parse files. Please check template column structures.");
      }
    };

    reader.onerror = () => {
      setImportError("Error occurred reading this file.");
    };

    reader.readAsArrayBuffer(file);
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileImport(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileImport(e.target.files[0]);
    }
  };

  // Commit ingestion
  const handleCommitImport = () => {
    if (importPreviewData.length === 0) return;
    if (onBulkAddLeads) {
      onBulkAddLeads(importPreviewData, true);
    } else {
      importPreviewData.forEach(l => onAddLead(l));
    }
    
    setIsImportModalOpen(false);
    setImportPreviewData([]);
    setFileName("");
    setImportError(null);
  };
  
  // AI Email Generator states
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailMood, setEmailMood] = useState("persuasive and authoritative");
  const [emailNotes, setEmailNotes] = useState("");
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");

  // Validation error state for Edit Lead Form only
  const [formError, setFormError] = useState<string | null>(null);

  // Clear edit form errors whenever edit modal transitions
  useEffect(() => {
    setFormError(null);
  }, [editingLead]);

  const presetAgents = [
    "Rajan Srivastava",
    "Ananya Sharma",
    "Rakesh Verma",
    "Amit Patel",
    "Neha Gupta",
    "Suresh Kumar",
    "Priya Nair",
    "Vikram Singh"
  ];

  const finalAgents = useMemo(() => {
    let list: string[] = [];
    if (!users || users.length === 0) {
      list = [...presetAgents];
    } else {
      // Only list active users for new lead assignments
      const activeUsers = users.filter(u => u.active !== false);
      
      if (currentUser?.role === "team_leader") {
        list = activeUsers
          .filter(u => u.id === currentUser.id || u.teamLeaderId === currentUser.id)
          .map(u => u.name);
      } else {
        list = activeUsers.map((u) => u.name);
      }
    }
    if (!list.includes("Pending Assignment")) {
      list = ["Pending Assignment", ...list];
    }
    return list;
  }, [users, currentUser]);

  const [showNewAgentDropdown, setShowNewAgentDropdown] = useState(false);
  const [showEditAgentDropdown, setShowEditAgentDropdown] = useState(false);

  const isAuthorizedToAssign = !currentUser || 
    currentUser.role === "super_admin" || 
    currentUser.role === "admin" ||
    currentUser.role === "team_leader";

  const filteredLeads = useMemo(() => {
    const list = leads.filter(lead => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.phone || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.company || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.assignedAgent.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesSource = sourceFilter === "all" || lead.source === sourceFilter;
      const matchesTemperature = temperatureFilter === "all" || lead.temperature === temperatureFilter;
      
      let matchesStartDate = true;
      if (startDate) {
        // Compare YYYY-MM-DD strings directly
        matchesStartDate = (lead.dateCreated || "") >= startDate;
      }
      
      let matchesEndDate = true;
      if (endDate) {
        matchesEndDate = (lead.dateCreated || "") <= endDate;
      }

      // 1. Project Filter
      let matchesProject = leadProjectFilter === "all" || 
        (lead.projectName || "").toLowerCase() === leadProjectFilter.toLowerCase();
      if (matchesProject && leadProjectSearchQuery.trim() !== "") {
        matchesProject = (lead.projectName || "").toLowerCase().includes(leadProjectSearchQuery.trim().toLowerCase());
      }

      // 2. Location Filter
      let matchesLocation = leadLocationFilter === "all" || 
        (lead.location || "").toLowerCase() === leadLocationFilter.toLowerCase();
      if (matchesLocation && leadLocationSearchQuery.trim() !== "") {
        matchesLocation = (lead.location || "").toLowerCase().includes(leadLocationSearchQuery.trim().toLowerCase());
      }

      // 3. Budget Filter
      let matchesBudget = leadBudgetFilter === "all" || 
        (lead.budget || "").toLowerCase() === leadBudgetFilter.toLowerCase();
      
      // Parse budget value comfortably to check range constraints
      if (matchesBudget && (leadBudgetMinQuery.trim() !== "" || leadBudgetMaxQuery.trim() !== "")) {
        const parseBudgetValueLocal = (b: string): number => {
          if (!b) return 0;
          const sanitized = b
            .replace(/â\u0082¹/g, "₹")
            .replace(/â‚¹/g, "₹")
            .replace(/â\u0082/g, "₹")
            .replace(/â\u0092¹/g, "₹")
            .replace(/â\u0092/g, "₹");
          const cleaned = sanitized.replace(/[₹$cr\sM]/gi, "");
          const parseFloatVal = parseFloat(cleaned);
          if (!isNaN(parseFloatVal)) {
            if (b.toLowerCase().includes("lakh") || b.toLowerCase().includes("l")) {
              return parseFloatVal / 100; // normalize
            }
            return parseFloatVal;
          }
          return 0;
        };

        const leadNum = parseBudgetValueLocal(lead.budget || "");
        if (leadBudgetMinQuery.trim() !== "") {
          const minNum = parseFloat(leadBudgetMinQuery);
          if (!isNaN(minNum) && leadNum < minNum) {
            matchesBudget = false;
          }
        }
        if (leadBudgetMaxQuery.trim() !== "") {
          const maxNum = parseFloat(leadBudgetMaxQuery);
          if (!isNaN(maxNum) && leadNum > maxNum) {
            matchesBudget = false;
          }
        }
      }

      // 4. TL / Sales Advisor Filter (Admin/Super Admin / TL and Sales Team)
      let matchesTLSales = true;
      if (users && users.length > 0) {
        const agentUser = users.find(u => u.name.toLowerCase() === lead.assignedAgent.toLowerCase());
        
        // Team Leader Filter Check
        if (leadSelectedTL !== "all") {
          if (!agentUser) {
            matchesTLSales = false;
          } else {
            const isAgentThatTL = agentUser.role === 'team_leader' && agentUser.id === leadSelectedTL;
            const isUnderThatTL = agentUser.teamLeaderId === leadSelectedTL;
            if (!isAgentThatTL && !isUnderThatTL) {
              matchesTLSales = false;
            }
          }
        }

        // Sales Advisor / Agent name Filter Check
        if (matchesTLSales && leadSelectedAgentName !== "all") {
          if (lead.assignedAgent.toLowerCase() !== leadSelectedAgentName.toLowerCase()) {
            matchesTLSales = false;
          }
        }
      }
      
      return matchesSearch && 
        matchesStatus && 
        matchesSource && 
        matchesTemperature && 
        matchesStartDate && 
        matchesEndDate &&
        matchesProject &&
        matchesLocation &&
        matchesBudget &&
        matchesTLSales;
    });

    // Display recent date first (most recently created first)
    return [...list].sort((a, b) => {
      const dateA = a.dateCreated || "";
      const dateB = b.dateCreated || "";
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }
      return (b.dateUpdated || "").localeCompare(a.dateUpdated || "");
    });
  }, [
    leads, 
    searchTerm, 
    statusFilter, 
    sourceFilter, 
    temperatureFilter, 
    startDate, 
    endDate,
    leadProjectFilter,
    leadProjectSearchQuery,
    leadLocationFilter,
    leadLocationSearchQuery,
    leadBudgetFilter,
    leadBudgetMinQuery,
    leadBudgetMaxQuery,
    leadSelectedTL,
    leadSelectedAgentName,
    users
  ]);

  // Handle addition — receives validated lead data from AddLeadModal
  const handleAddNewLead = (leadData: Omit<Lead, "id" | "dateCreated" | "lastUpdated">) => {
    onAddLead(leadData as any);
    setIsAddModalOpen(false);
  };

  // Handle Edit submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const finalName = editingLead.name.trim();
    const finalPhone = editingLead.phone.trim();
    if (!finalName && !finalPhone) {
      setFormError("Minimum identifying criteria required: Please provide either a Customer Name or a Phone Number to save.");
      return;
    }
    setFormError(null);
    onUpdateLead({
      ...editingLead,
      name: finalName || `Lead (${finalPhone})`,
      phone: finalPhone,
      status: editingLead.status || "",
      temperature: editingLead.temperature || "",
      location: editingLead.location || "",
      budget: editingLead.budget || "",
      dateUpdated: new Date().toISOString().split("T")[0]
    });
    setEditingLead(null);
  };

  // Trigger automated email follow-up generation from server
  const generateAIFollowUp = async (lead: Lead) => {
    setSelectedLeadForAI(lead);
    setIsGeneratingEmail(true);
    setEmailSuccessMsg("");
    setEmailSubject("");
    setEmailBody("");
    
    const customNotes = emailNotes || lead.notes;
    
    try {
      const response = await fetch("/api/generate-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadName: lead.name,
          company: lead.company,
          source: lead.source,
          budget: lead.budget,
          recentNotes: customNotes,
          mood: emailMood
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setEmailSubject(data.subject);
        setEmailBody(data.body);
      } else {
        throw new Error(data.error || "Generation endpoint returned anomalous response.");
      }
    } catch (err: any) {
      console.error(err);
      setEmailSubject("Elite Pro Follow-Up | Corporate Real Estate Alignment");
      setEmailBody(`Dear ${lead.name},\n\nThank you for exploring premium real estate opportunities with Elite Pro. Regarding your inquiries via ${lead.source} with a capital budget range of ${lead.budget}, we are eager to coordinate an advisory alignment session.\n\nBest regards,\nRajan Srivastava\nElite Pro`);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Send followups (simulated communication logging)
  const handleSimulateSendEmail = () => {
    if (!selectedLeadForAI) return;
    onAddCommunicationLog({
      leadId: selectedLeadForAI.id,
      date: new Date().toISOString().split("T")[0],
      type: "email",
      content: `[AI AUTOPILOT FOLLOW-UP SENT] Subject: ${emailSubject}\n\n${emailBody}`,
      sender: "Rajan Srivastava"
    });
    
    // Automatic lead status progression is stopped per user request to maintain manual tracking purity

    setEmailSuccessMsg("Pristine email generated successfully & logged to Communication Timeline!");
    setTimeout(() => {
      setSelectedLeadForAI(null);
      setEmailNotes("");
    }, 2000);
  };

  const formatBudgetSafely = (b: string | undefined): string => {
    if (!b) return "N/A";
    return b
      .replace(/â\u0082¹/g, "₹")
      .replace(/â‚¹/g, "₹")
      .replace(/â\u0082/g, "₹")
      .replace(/â\u0092¹/g, "₹")
      .replace(/â\u0092/g, "₹");
  };

  // Helper colors for Lead status badges
  const getStatusBadgeClass = (status: Lead["status"]) => {
    switch (status) {
      case "New Lead":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      case "Interested":
        return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
      case "Follow Up":
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
      case "Detailed Share":
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case "Not Interested":
        return "bg-rose-500/10 text-rose-455 border border-rose-500/25";
      case "Closed Client":
        return "bg-emerald-650/10 text-emerald-400 border border-emerald-500/25 font-semibold";
      case "Meeting Done":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Site Visit":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "Call Back":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Junk":
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
      case "Duplicate":
        return "bg-pink-500/10 text-pink-400 border border-pink-500/20";
      case "Not Pick":
        return "bg-amber-600/10 text-amber-500 border border-amber-500/20";
      case "Switched Off":
        return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
      case "Low Budget":
        return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  // Helper colors for Temperature Status
  const getTemperatureBadgeClass = (temp: Lead["temperature"]) => {
    switch (temp) {
      case "Hot":
        return "bg-rose-500/10 text-rose-450 border border-rose-500/20";
      case "Warm":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "Cold":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      case "Dead":
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
    }
  };

  // Helper colors for lead priority score
  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-500 font-bold";
    if (score >= 60) return "text-amber-500 font-bold";
    return "text-slate-400";
  };

  const formatFieldName = (field: string) => {
    switch (field) {
      case "name": return "Customer Name";
      case "company": return "Company Name";
      case "position": return "Corporate Position";
      case "email": return "Corporate Email";
      case "phone": return "Contact Phone";
      case "source": return "Lead Source Channel";
      case "status": return "Advisory Stage Status";
      case "temperature": return "Conversion Temperature";
      case "budget": return "Capital Budget Plan";
      case "location": return "Project Target Location";
      case "assignedAgent": return "Assigned Advisor";
      case "notes": return "Consultation Synopsis (Notes)";
      case "score": return "Priority Rating Score";
      case "projectName": return "Project Name";
      default: return field.replace(/([A-Z])/g, ' $1').toUpperCase();
    }
  };

  return (
    <div id="lead-pipeline-tab" className="space-y-6">
      
      {/* Search and Filters Block */}
      <div className={`p-5 rounded-2xl border transition-all flex flex-col gap-4
        ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className={`font-display font-semibold text-lg ${darkMode ? "text-white" : "text-slate-900"}`}>
              Lead Management Runway
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Refinement filters and pipeline indicators for infrastructure investors
            </p>
          </div>
          
          {/* Create Button & Logs Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="toggle-edit-logs-btn"
              onClick={() => {
                setShowLogs(!showLogs);
                setShowTransferLogs(false);
              }}
              className={`px-4.5 py-2.5 rounded-xl border text-xs font-semibold tracking-wide uppercase transition-all duration-155 flex items-center gap-2 cursor-pointer active:scale-95
                ${showLogs 
                  ? "bg-amber-550 border-amber-550 text-white shadow-md shadow-amber-500/15 hover:bg-amber-500" 
                  : darkMode 
                    ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" 
                    : "bg-slate-50 border-slate-205 hover:bg-slate-100 hover:border-slate-300 text-slate-600"}`}
              title="Show log of lead parameter alterations made by Sales advisor advisors"
            >
              <History size={14} className={showLogs ? "animate-spin" : ""} />
              <span>{showLogs ? "Hide Edit Logs" : "Show Sales Team Edit Logs"}</span>
              {leadEditLogs.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono leading-none font-bold
                  ${showLogs ? "bg-amber-700/50 text-white" : "bg-teal-500/15 text-teal-400 border border-teal-500/10"}`}>
                  {leadEditLogs.length}
                </span>
              )}
            </button>

            {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") && (
              <button
                id="toggle-transfer-history-btn"
                onClick={() => {
                  setShowTransferLogs(!showTransferLogs);
                  setShowLogs(false);
                }}
                className={`px-4.5 py-2.5 rounded-xl border text-xs font-semibold tracking-wide uppercase transition-all duration-155 flex items-center gap-2 cursor-pointer active:scale-95
                  ${showTransferLogs 
                    ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/15 hover:bg-rose-550" 
                    : darkMode 
                      ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" 
                      : "bg-slate-50 border-slate-205 hover:bg-slate-100 hover:border-slate-300 text-slate-600"}`}
                title="Super Admin and Admin can see Lead Auto-Transfer Histories"
              >
                <Clock size={14} className={showTransferLogs ? "animate-bounce" : ""} />
                <span>{showTransferLogs ? "Hide Transfer Histories" : "Show Lead Auto-Transfer Logs"}</span>
                {leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner").length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono leading-none font-bold
                    ${showTransferLogs ? "bg-rose-700/50 text-white" : "bg-rose-500/15 text-rose-400 border border-rose-500/10"}`}>
                    {leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner").length}
                  </span>
                )}
              </button>
            )}

            {currentUser && (
              currentUser.role === "super_admin" || 
              currentUser.role === "admin" || 
              currentUser.role === "team_leader" || 
              currentUser.role === "sales_team"
            ) && (
              <>
                <button
                  id="register-lead-btn"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs tracking-wide uppercase transition-all shadow-md shadow-teal-600/15 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  Register New Lead
                </button>

                <button
                  id="import-spreadsheet-btn"
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-4.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-550 text-white font-semibold text-xs tracking-wide uppercase transition-all shadow-md shadow-emerald-600/15 flex items-center gap-2 cursor-pointer active:scale-95"
                  title="Bulk import leads from CSV, XLS, or XLSX spreadsheets"
                >
                  <FileSpreadsheet size={16} />
                  Import Spreadsheet
                </button>

                {(currentUser?.role === "super_admin" || currentUser?.role === "admin" || currentUser?.role === "team_leader") && (
                  <button
                    id="bulk-transfer-btn"
                    onClick={() => {
                      setBulkTransferMessage(null);
                      setBulkTargetAgents([]);
                      setBulkSearchQuery("");
                      setBulkSourceStatus("New Lead");
                      setBulkSourceAgent("All");
                      setBulkTransferUseSelected(false);
                      setIsBulkTransferModalOpen(true);
                    }}
                    className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-550 text-white font-semibold text-xs tracking-wide uppercase transition-all shadow-md shadow-indigo-600/15 flex items-center gap-2 cursor-pointer active:scale-95"
                    title="Bulk transfer leads based on selected lead status"
                  >
                    <ArrowLeftRight size={16} />
                    Bulk Transfer Status
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filters and Search Bar Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              id="lead-search-input"
              type="text"
              placeholder="Search Name, Phone, Company, Assignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border font-sans font-medium transition duration-200
                ${darkMode 
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500" 
                  : "bg-slate-50 border-slate-150 text-slate-800 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-600"}`}
            />
          </div>

          {/* New Status Select */}
          <div className="relative">
            <select
              id="lead-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-sans font-medium transition duration-200 cursor-pointer appearance-none
                ${darkMode 
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-teal-500" 
                  : "bg-slate-50 border-slate-150 text-slate-800 focus:border-teal-600 font-medium"}`}
            >
              <option value="all">💼 All Lead Statuses</option>
              <option value="New Lead">New Lead</option>
              <option value="Interested">Interested</option>
              <option value="Follow Up">Follow Up</option>
              <option value="Detailed Share">Detailed Share</option>
              <option value="Not Interested">Not Interested</option>
              <option value="Meeting Done">Meeting Done</option>
              <option value="Site Visit">Site Visit</option>
              <option value="Closed Client">Closed Client</option>
              <option value="Call Back">Call Back</option>
              <option value="Junk">Junk</option>
              <option value="Duplicate">Duplicate</option>
              <option value="Not Pick">Not Pick</option>
              <option value="Switched Off">Switched Off</option>
              <option value="Low Budget">Low Budget</option>
            </select>
          </div>

          {/* Source Select */}
          <div className="relative">
            <select
              id="lead-source-filter"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-sans font-medium transition duration-200 cursor-pointer appearance-none
                ${darkMode 
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-teal-500" 
                  : "bg-slate-50 border-slate-150 text-slate-800 focus:border-teal-600 font-medium"}`}
            >
              <option value="all">📣 All Sources / Ads</option>
              <option value="Meta Ad">Meta Ad</option>
              <option value="Google Ad">Google Ad</option>
              <option value="IVR Board">IVR Board</option>
              <option value="IVR">IVR</option>
              <option value="Reference">Reference</option>
              <option value="Website">Website</option>
              <option value="Social Media">Social Media</option>
              <option value="Personal">Personal</option>
              <option value="Cold Call">Cold Call</option>
            </select>
          </div>

          {/* Temperature Select */}
          <div className="relative">
            <select
              id="lead-temperature-filter"
              value={temperatureFilter}
              onChange={(e) => setTemperatureFilter(e.target.value)}
              className={`w-full px-3.5 py-2.5 text-xs rounded-xl border font-sans font-medium transition duration-200 cursor-pointer appearance-none
                ${darkMode 
                  ? "bg-slate-950 border-slate-800 text-slate-200 focus:border-teal-500" 
                  : "bg-slate-50 border-slate-150 text-slate-800 focus:border-teal-600 font-medium"}`}
            >
              <option value="all">🔥 All Temp Ratings</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">☀️ Warm</option>
              <option value="Cold">❄️ Cold</option>
              <option value="Dead">🫙 Dead</option>
            </select>
          </div>

          {/* Dynamic Portfolio and Team Hierarchy Filters */}
          <div className={`p-4 rounded-xl border flex flex-col gap-4 sm:col-span-2 lg:col-span-5 transition duration-200
            ${darkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-150/30 border-slate-200"}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${darkMode ? "text-slate-300" : "text-slate-650"}`}>
                <Filter size={13} className="text-teal-500" />
                Corporate Portfolio Filters:
              </span>
              
              {/* Reset trigger */}
              {(leadProjectFilter !== "all" || 
                leadLocationFilter !== "all" || 
                leadBudgetFilter !== "all" || 
                leadSelectedTL !== "all" || 
                leadSelectedAgentName !== "all" ||
                leadProjectSearchQuery !== "" ||
                leadLocationSearchQuery !== "" ||
                leadBudgetMinQuery !== "" ||
                leadBudgetMaxQuery !== "") && (
                <button
                  type="button"
                  id="reset-portfolio-filters-btn"
                  onClick={() => {
                    setLeadProjectFilter("all");
                    setLeadLocationFilter("all");
                    setLeadBudgetFilter("all");
                    setLeadProjectSearchQuery("");
                    setLeadLocationSearchQuery("");
                    setLeadBudgetMinQuery("");
                    setLeadBudgetMaxQuery("");
                    if (currentUser?.role === "super_admin" || currentUser?.role === "admin") {
                      setLeadSelectedTL("all");
                    }
                    setLeadSelectedAgentName("all");
                  }}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase font-mono tracking-wider rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1 cursor-pointer transition active:scale-95 self-start sm:self-auto"
                >
                  <X size={10} className="mr-0.5 inline" />
                  Reset Portfolio Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              
              {/* Team Leader Filter select */}
              {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") ? (
                <div className="relative">
                  <select
                    id="lead-pipeline-tl-filter"
                    value={leadSelectedTL}
                    onChange={(e) => handleLeadTLChange(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition
                      ${darkMode 
                        ? "bg-slate-950 border-slate-800 text-slate-205" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    <option value="all">📂 (All Team Leaders)</option>
                    {leadTLUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        👔 {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                currentUser?.role === "team_leader" && (
                  <div className={`px-3.5 py-2 text-xs rounded-lg border font-mono font-bold select-none opacity-80 flex items-center gap-1.5
                    ${darkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-205 text-slate-650"}`}
                  >
                    👔 TL: {currentUser.name}
                  </div>
                )
              )}

              {/* Sales Advisor select */}
              {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin" || currentUser.role === "team_leader") ? (
                <div className="relative">
                  <select
                    id="lead-pipeline-agent-filter"
                    value={leadSelectedAgentName}
                    onChange={(e) => setLeadSelectedAgentName(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs font-semibold rounded-lg border cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition
                      ${darkMode 
                        ? "bg-slate-950 border-slate-800 text-slate-205" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                  >
                    <option value="all">🛡️ (All Advisors)</option>
                    <option value="Pending Assignment">⚠️ [Pending Assignment leads]</option>
                    {leadSalesUsersOptions.map(user => {
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
                <div className={`px-3.5 py-2 text-xs rounded-lg border font-mono font-bold select-none opacity-80 flex items-center gap-1.5
                  ${darkMode ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-205 text-slate-650"}`}
                >
                  👤 Advisor: {currentUser?.name}
                </div>
              )}

              {/* Project select with typed search option */}
              <div className="flex flex-col gap-1 w-full">
                <input
                  type="text"
                  id="lead-pipeline-project-search"
                  placeholder="🔍 Search project name..."
                  value={leadProjectSearchQuery}
                  onChange={(e) => setLeadProjectSearchQuery(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border w-full transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-205 placeholder-slate-600 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-slate-705 placeholder-slate-400 hover:bg-slate-50"}`}
                />
                <select
                  id="lead-pipeline-project-filter"
                  value={leadProjectFilter}
                  onChange={(e) => setLeadProjectFilter(e.target.value)}
                  className={`w-full px-3 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer outline-none transition
                    ${darkMode 
                      ? "bg-slate-900 border-slate-800 text-slate-400 focus:border-teal-500" 
                      : "bg-slate-5 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
                >
                  <option value="all">🏢 (Quick select...)</option>
                  {leadProjectsPool.map(proj => (
                    <option key={proj} value={proj}>
                      🏢 {proj}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location select with typed search option */}
              <div className="flex flex-col gap-1 w-full">
                <input
                  type="text"
                  id="lead-pipeline-location-search"
                  placeholder="🔍 Search location..."
                  value={leadLocationSearchQuery}
                  onChange={(e) => setLeadLocationSearchQuery(e.target.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border w-full transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                    ${darkMode 
                      ? "bg-slate-950 border-slate-800 text-slate-205 placeholder-slate-600 focus:border-teal-500" 
                      : "bg-white border-slate-200 text-slate-705 placeholder-slate-400 hover:bg-slate-50"}`}
                />
                <select
                  id="lead-pipeline-location-filter"
                  value={leadLocationFilter}
                  onChange={(e) => setLeadLocationFilter(e.target.value)}
                  className={`w-full px-3 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer outline-none transition
                    ${darkMode 
                      ? "bg-slate-900 border-slate-800 text-slate-400 focus:border-teal-500" 
                      : "bg-slate-5 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
                >
                  <option value="all">📍 (Quick select...)</option>
                  {leadLocationsPool.map(loc => (
                    <option key={loc} value={loc}>
                      📍 {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Budget range query + select dropdown */}
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Min Cr"
                    value={leadBudgetMinQuery}
                    onChange={(e) => setLeadBudgetMinQuery(e.target.value)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md border w-1/2 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                      ${darkMode 
                        ? "bg-slate-950 border-slate-800 text-teal-400 placeholder-slate-600 focus:border-teal-500" 
                        : "bg-white border-slate-200 text-teal-700 placeholder-slate-400 hover:bg-slate-50"}`}
                  />
                  <span className="text-[10px] font-bold opacity-40">to</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Max Cr"
                    value={leadBudgetMaxQuery}
                    onChange={(e) => setLeadBudgetMaxQuery(e.target.value)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md border w-1/2 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20
                      ${darkMode 
                        ? "bg-slate-950 border-slate-800 text-teal-400 placeholder-slate-600 focus:border-teal-500" 
                        : "bg-white border-slate-200 text-teal-700 placeholder-slate-400 hover:bg-slate-50"}`}
                  />
                </div>
                <select
                  id="lead-pipeline-budget-filter"
                  value={leadBudgetFilter}
                  onChange={(e) => setLeadBudgetFilter(e.target.value)}
                  className={`w-full px-3 py-1 text-[11px] font-semibold rounded-lg border cursor-pointer outline-none transition
                    ${darkMode 
                      ? "bg-slate-900 border-slate-800 text-slate-400 focus:border-teal-500" 
                      : "bg-slate-5 border-slate-200 text-slate-505 hover:bg-slate-100"}`}
                >
                  <option value="all">💰 (Quick select...)</option>
                  {leadBudgetsPool.map(bud => (
                    <option key={bud} value={bud}>
                      💰 {bud}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Date Range Selector Card */}
          <div className={`p-4 rounded-xl border flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 sm:col-span-2 lg:col-span-5 transition duration-200
            ${darkMode ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-100/50 border-slate-200/90"}`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
              <span className={`text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 whitespace-nowrap ${darkMode ? "text-slate-300" : "text-slate-600"}`}>
                <Calendar size={13} className="text-teal-500" />
                Date Range Filter:
              </span>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative">
                  <input
                    id="filter-start-date"
                    type="date"
                    value={sanitizeDateForInput(startDate)}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`pl-3 pr-2 py-1.5 text-xs rounded-lg border outline-none font-mono transition duration-150 focus:border-teal-500 w-full sm:w-[135px]
                      ${darkMode ? "bg-slate-950 border-slate-850 text-white focus:bg-slate-900" : "bg-white border-slate-205 text-slate-800 focus:bg-slate-50"}`}
                    title="Start Date (Creation date at or after this value)"
                  />
                  {!startDate && (
                    <span className="absolute right-7.5 top-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-mono pointer-events-none hidden sm:inline">Start</span>
                  )}
                </div>
                
                <span className={`text-xs font-bold ${darkMode ? "text-slate-600" : "text-slate-400"}`}>to</span>
                
                <div className="relative">
                  <input
                    id="filter-end-date"
                    type="date"
                    value={sanitizeDateForInput(endDate)}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`pl-3 pr-2 py-1.5 text-xs rounded-lg border outline-none font-mono transition duration-150 focus:border-teal-500 w-full sm:w-[135px]
                      ${darkMode ? "bg-slate-950 border-slate-850 text-white focus:bg-slate-900" : "bg-white border-slate-205 text-slate-800 focus:bg-slate-50"}`}
                    title="End Date (Creation date at or before this value)"
                  />
                  {!endDate && (
                    <span className="absolute right-7.5 top-2.5 text-[9px] uppercase tracking-wider text-slate-400 font-mono pointer-events-none hidden sm:inline">End</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start sm:justify-between xl:justify-end">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split("T")[0];
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border cursor-pointer transition-all active:scale-95
                    ${startDate === new Date().toISOString().split("T")[0] && endDate === new Date().toISOString().split("T")[0]
                      ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                      : darkMode ? "bg-slate-950/80 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const day = today.getDay();
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                    const monday = new Date(today.setDate(diff)).toISOString().split("T")[0];
                    const sunday = new Date(new Date().setDate(diff + 6)).toISOString().split("T")[0];
                    setStartDate(monday);
                    setEndDate(sunday);
                  }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border cursor-pointer transition-all active:scale-95
                    ${darkMode ? "bg-slate-950/80 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
                    setStartDate(firstDay);
                    setEndDate(lastDay);
                  }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border cursor-pointer transition-all active:scale-95
                    ${darkMode ? "bg-slate-950/80 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const todayTime = new Date();
                    const thirtyDaysAgo = new Date(todayTime.setDate(todayTime.getDate() - 30)).toISOString().split("T")[0];
                    const todayStr = new Date().toISOString().split("T")[0];
                    setStartDate(thirtyDaysAgo);
                    setEndDate(todayStr);
                  }}
                  className={`px-2 py-1 text-[10px] font-semibold rounded-md border cursor-pointer transition-all active:scale-95
                    ${darkMode ? "bg-slate-950/80 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
                >
                  Last 30 Days
                </button>
              </div>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-2 py-1 text-[10px] font-bold uppercase font-mono tracking-wider rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1 cursor-pointer transition active:scale-95"
                >
                  <X size={10} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Metrics count indicator */}
          <div className={`p-1 pl-3 pr-1.5 py-1.5 rounded-xl border flex items-center justify-between text-xs font-mono sm:col-span-2 lg:col-span-5
            ${darkMode ? "bg-slate-950 border-slate-800/80 text-slate-400" : "bg-slate-50 border-slate-100 text-slate-500"}`}
          >
            <span>Retrieved Matrix Size:</span>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span className="font-bold text-teal-500">{filteredLeads.length} records matching parameters</span>
              {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") && (
                <button
                  type="button"
                  id="download-filtered-leads-excel-btn"
                  onClick={handleDownloadExcel}
                  className={`px-3 py-1 text-[11px] font-sans font-bold uppercase tracking-wider rounded-lg border cursor-pointer transition active:scale-95 flex items-center gap-1.5 hover:shadow-sm
                    ${darkMode 
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/80"}`}
                >
                  <Download size={13} className="text-emerald-500" />
                  Excel Export
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Grid of Leads Cards / Logs Ledger */}
      {showLogs ? (
        <div 
          id="lead-edit-logs-panel" 
          className={`p-6 rounded-2xl border transition-all space-y-6 ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-150 shadow-sm"}`}
        >
          <div className="flex justify-between items-center pb-4 border-b border-slate-100/10">
            <div>
              <h3 className={`font-display font-semibold text-base ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                Sales Advisor Revision Ledger
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser?.role === "super_admin" || currentUser?.role === "admin"
                  ? "Real-time auditing trail of infrastructural portfolio parameter modifications"
                  : `Auditing trail of parameter modifications captured for standard advisor profile [${currentUser?.name}]`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onClearLeadEditLogs && (leadEditLogs.filter(log => log.editorName !== "System Auto-Transfer Agent" && log.editorName !== "System Auto-Reassigner").length > 0) && (
                <button
                  type="button"
                  id="clear-edit-logs-history-btn"
                onClick={() => {
                  const handleClear = () => {
                    onClearLeadEditLogs("edit");
                  };
                  if (triggerConfirm) {
                    triggerConfirm(
                      "Clear History Logs",
                      "Are you sure you want to clear your Sales Advisor Revision history logs?",
                      handleClear
                    );
                  } else if (window.confirm("Are you sure you want to clear your Sales Advisor Revision history logs?")) {
                    handleClear();
                  }
                }}
                  className="px-3 py-1 text-[11px] font-sans font-bold uppercase tracking-wider rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer transition active:scale-95"
                >
                  Clear History Logs
                </button>
              )}
              <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/25">
                Secure Auditing: Active
              </span>
            </div>
          </div>

          {revisionLogs.length > 0 ? (
            <div className="space-y-4">
              {revisionLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-xl border font-sans text-xs transition duration-155
                    ${darkMode ? "bg-slate-950/60 border-slate-800 hover:border-slate-700" : "bg-slate-50/60 border-slate-205 hover:border-slate-300 shadow-sm"}`}
                >
                  {/* Log Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100/10 mb-3 text-slate-400">
                    <div className="flex items-center gap-2">
                       <div className="p-1 px-2 rounded bg-amber-500/15 text-amber-500 font-bold font-mono text-[9px] uppercase border border-amber-500/20 flex items-center gap-1">
                        <History size={10} />
                        <span>Log</span>
                      </div>
                      <span className={`font-semibold ${darkMode ? "text-white" : "text-slate-800"}`}>
                        Lead: <strong className="text-teal-500">{log.leadName}</strong>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 text-[10px] font-mono">
                      <span>Edited By: <strong className="text-teal-400">{log.editorName}</strong></span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border
                        ${log.editorRole === 'super_admin' 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                          : log.editorRole === 'admin' 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
                      >
                        {log.editorRole.replace('_', ' ')}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono text-[10px]">{log.timestamp}</span>
                    </div>
                  </div>

                  {/* Changes List */}
                  <div className="space-y-2">
                    {log.changes.map((change, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 pl-3 py-1 border-l-2 border-amber-550">
                        <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase min-w-[200px]">
                          {formatFieldName(change.field)}:
                        </span>
                        
                        <div className="flex-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-400 line-through truncate max-w-[220px]" title={change.oldValue}>
                            {change.oldValue || <span className="italic text-slate-500">None</span>}
                          </span>
                          <span className="text-slate-405 font-bold font-mono">→</span>
                          <span className="text-teal-450 font-bold bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded max-w-[320px] truncate" title={change.newValue}>
                            {change.newValue || <span className="italic text-teal-600">None</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              No portfolio revisions have been logged yet for your active session context.
            </div>
          )}
        </div>
      ) : showTransferLogs && (currentUser?.role === "super_admin" || currentUser?.role === "admin") ? (
        <div 
          id="lead-transfer-history-panel" 
          className={`p-6 rounded-2xl border transition-all space-y-6 ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-150 shadow-sm"}`}
        >
          <div className="flex justify-between items-center pb-4 border-b border-slate-100/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-display font-semibold text-base ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                  Lead Inactivity Auto-Transfer History Ledger
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/15 text-rose-450 border border-rose-500/20">
                  ● STOPPED & NOT ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Real-time auditing trail of historical automatic reassignments. Note: Automatic reassignments and automatic stage changes for New Leads are now permanently **disabled & stopped** to maintain perfect manual progression tracking.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {onClearLeadEditLogs && (leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner").length > 0) && (
                <button
                  type="button"
                  id="clear-auto-transfer-logs-btn"
                  onClick={() => {
                    const handleClear = () => {
                      onClearLeadEditLogs("transfer");
                    };
                    if (triggerConfirm) {
                      triggerConfirm(
                        "Clear Auto-Transfer Logs",
                        "Are you sure you want to clear your Lead Auto-Transfer logs?",
                        handleClear
                      );
                    } else if (window.confirm("Are you sure you want to clear your Lead Auto-Transfer logs?")) {
                      handleClear();
                    }
                  }}
                  className="px-3 py-1 text-[11px] font-sans font-bold uppercase tracking-wider rounded-lg border border-rose-500/25 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer transition active:scale-95"
                >
                  Clear Auto-Transfer Logs
                </button>
              )}
              <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-lg bg-rose-500/15 text-rose-500 border border-rose-500/25">
                Secure System Logs
              </span>
            </div>
          </div>

          {/* Consolidated Copyable Text Area Console */}
          {(() => {
            const transferLogs = leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner");
            const compiledText = transferLogs.map((log, idx) => {
              const routeChange = log.changes.find(c => c.field === "assignedAgent");
              const oldVal = routeChange?.oldValue || "Unassigned";
              const newVal = routeChange?.newValue || "Unassigned";
              return `[${log.timestamp}] Lead: "${log.leadName}" | Transferred Agent: ${oldVal} -> ${newVal}`;
            }).join("\n");
            
            const handleCopy = () => {
              if (!compiledText) return;
              navigator.clipboard.writeText(compiledText);
              setCopiedTransfers(true);
              setTimeout(() => setCopiedTransfers(false), 2050);
            };
            
            return (
              <div className={`p-4.5 rounded-xl border ${darkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-205"}`}>
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full bg-rose-500 ${compiledText ? "animate-pulse" : ""}`} />
                    <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">
                      Consolidated Transfer History Text Box (System Console)
                    </span>
                  </div>
                  {compiledText && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`px-3 py-1 rounded text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1 transition active:scale-95
                        ${copiedTransfers 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-slate-700/80 hover:bg-slate-750 text-slate-200 border border-slate-650"}`}
                    >
                      {copiedTransfers ? (
                        <>
                          <Check size={11} className="text-emerald-400 animate-pulse" />
                          Copied Console!
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          Copy Entire History
                        </>
                      )}
                    </button>
                  )}
                </div>
                <textarea
                  id="lead-transfer-text-console"
                  readOnly
                  value={compiledText}
                  rows={5}
                  placeholder="Console pipeline clear. No inactive auto-transfers captured yet."
                  className={`w-full p-3 font-mono text-[10px] leading-relaxed rounded-lg border focus:ring-1 focus:ring-rose-505/30 outline-none
                    ${darkMode ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-700 shadow-inner"}`}
                />
              </div>
            );
          })()}

          {leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner").length > 0 ? (
            <div className="space-y-4">
              {leadEditLogs.filter(log => log.editorName === "System Auto-Transfer Agent" || log.editorName === "System Auto-Reassigner").map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-xl border font-sans text-xs transition duration-155
                    ${darkMode ? "bg-slate-950/60 border-slate-850 hover:border-slate-800" : "bg-slate-50/60 border-slate-205 hover:border-slate-300 shadow-sm"}`}
                >
                  {/* Log Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100/10 mb-3 text-slate-400">
                    <div className="flex items-center gap-2">
                       <div className="p-1 px-2 rounded bg-rose-500/10 text-rose-400 font-bold font-mono text-[9px] uppercase border border-rose-500/20 flex items-center gap-1">
                        <Clock size={10} />
                        <span>Auto-Reassigned</span>
                      </div>
                      <span className={`font-semibold ${darkMode ? "text-white" : "text-slate-800"}`}>
                        Lead: <strong className="text-teal-500">{log.leadName}</strong>
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2.5 text-[10px] font-mono">
                      <span>Authority: <strong className="text-rose-455">System Agent</strong></span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono text-[10px]">{log.timestamp}</span>
                    </div>
                  </div>

                  {/* Changes List */}
                  <div className="space-y-2">
                    {log.changes.map((change, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 pl-3 py-1 border-l-2 border-rose-500">
                        <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase min-w-[200px]">
                          {formatFieldName(change.field)}:
                        </span>
                        
                        <div className="flex-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-slate-450 line-through truncate max-w-[220px]" title={change.oldValue}>
                            {change.oldValue || <span className="italic text-slate-500">None</span>}
                          </span>
                          <span className="text-slate-405 font-bold font-mono">→</span>
                          <span className="text-teal-450 font-bold bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded max-w-[320px] truncate" title={change.newValue}>
                            {change.newValue || <span className="italic text-teal-600">None</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              No automatic transfer logs captured. Auto-transfer rules have been permanently removed from the system.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Bulk Selection Box */}
          {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") && (
            <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 text-xs transition-all duration-155
              ${darkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="bulk-select-all-checkbox"
                  className="w-4 h-4 rounded border-slate-350 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLeadIds(filteredLeads.map(l => l.id));
                    } else {
                      setSelectedLeadIds([]);
                    }
                  }}
                />
                <label htmlFor="bulk-select-all-checkbox" className="font-semibold cursor-pointer select-none">
                  Select All {filteredLeads.length} Filtered Leads ({selectedLeadIds.length} selected)
                </label>
              </div>

              {selectedLeadIds.length > 0 && (
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    id="bulk-transfer-selected-btn"
                    onClick={() => {
                      setBulkTransferMessage(null);
                      setBulkTargetAgents([]);
                      setBulkSearchQuery("");
                      setBulkTransferUseSelected(true);
                      setIsBulkTransferModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 cursor-pointer transition flex items-center gap-1.5 active:scale-95"
                  >
                    <ArrowLeftRight size={13} className="text-indigo-500" />
                    Bulk Transfer Selected ({selectedLeadIds.length})
                  </button>
                  <button
                    type="button"
                    id="bulk-delete-leads-btn"
                    onClick={() => {
                      if (onBulkDeleteLeads) {
                        onBulkDeleteLeads(selectedLeadIds);
                        setSelectedLeadIds([]);
                      } else {
                        selectedLeadIds.forEach(id => onDeleteLead(id));
                        setSelectedLeadIds([]);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer transition flex items-center gap-1.5 active:scale-95"
                  >
                    <Trash2 size={13} className="text-rose-500" />
                    Bulk Delete Selected ({selectedLeadIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLeadIds([])}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-slate-200/5 hover:bg-slate-800 text-slate-400 cursor-pointer transition active:scale-95"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => (
            <div 
              key={lead.id}
              id={`lead-card-${lead.id}`}
              className={`p-6 rounded-2xl border transition-all flex flex-col justify-between group relative overflow-hidden
                ${darkMode 
                  ? "bg-slate-900/90 border-slate-850 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20" 
                  : "bg-white border-slate-150 shadow-sm hover:border-slate-300 hover:shadow-md"}`}
            >
              
              {/* Top Row: Lead Header and Score */}
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {currentUser && (currentUser.role === "super_admin" || currentUser.role === "admin") && (
                      <input
                        type="checkbox"
                        onClick={(e) => e.stopPropagation()}
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadIds(prev => [...prev, lead.id]);
                          } else {
                            setSelectedLeadIds(prev => prev.filter(id => id !== lead.id));
                          }
                        }}
                        className="mt-1 w-4 h-4 rounded border-slate-350 text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      {lead.company && (
                        <span className="text-[10px] font-mono tracking-wider text-slate-400 font-semibold uppercase">
                          {lead.company}
                        </span>
                      )}
                      <h4 className="font-display font-bold text-lg leading-tight mt-0.5 group-hover:text-teal-500 transition duration-150 flex flex-wrap items-center gap-2">
                        <span>{lead.name}</span>
                        {lead.projectName && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                            {lead.projectName}
                          </span>
                        )}
                      </h4>
                      <p className={`text-xs mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 ${darkMode ? "text-slate-300" : "text-slate-650"}`}>
                        <span>{lead.position || "Private Client"}</span>
                        <span className="text-slate-500 font-light">|</span>
                        <span className="text-teal-400 font-mono text-[10px]">Assignee: {lead.assignedAgent}</span>
                        {lead.assignmentTimestamp && (
                          <span className="text-[10px] font-mono bg-teal-500/10 px-1.5 py-0.5 rounded text-teal-300 border border-teal-500/20 flex items-center gap-1">
                            <Clock size={10} className="text-teal-450" />
                            Assigned: {new Date(lead.assignmentTimestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true
                            })}
                          </span>
                        )}
                        {(() => {
                          const waHref = getAgentWhatsAppHref(lead.assignedAgent, lead);
                          if (!waHref) return null;
                          return (
                            <a 
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Instant Direct Message / WhatsApp Alert to ${lead.assignedAgent}`}
                              className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                              💬 Notify WA
                            </a>
                          );
                        })()}
                        {isDuplicatePhone(lead.phone, lead.id) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-455 border border-rose-500/20 text-[9px] font-medium font-sans animate-pulse">
                            <AlertCircle size={10} />
                            Duplicate Number
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider uppercase font-semibold ${getStatusBadgeClass(lead.status)}`}>
                      {lead.status || "(Select Status)"}
                    </span>

                    <div className="text-[10px] font-mono font-medium">
                      Priority Index: <span className={getScoreColor(lead.score || 50)}>{lead.score || 50}</span>
                    </div>
                  </div>
                </div>

                {/* Main statistics / details row */}
                <div className="grid grid-cols-2 gap-4 my-4 p-3 rounded-xl bg-slate-100/5 dark:bg-slate-950/40 border border-slate-100/5">
                  <div className="flex items-center gap-2">
                    <IndianRupee size={14} className="text-teal-500" />
                    <div>
                      <p className="text-[10px] text-slate-400 leading-none">BUDGET ALLOCATED</p>
                      <p className="text-xs font-bold font-mono text-teal-400 tracking-tight mt-0.5">{formatBudgetSafely(lead.budget)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-indigo-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 leading-none">LEAD SOURCE</p>
                      <p className="text-xs font-bold truncate mt-0.5 max-w-[120px] text-indigo-300">{lead.source}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-amber-500" />
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-slate-400 leading-none">LOCATION</p>
                      <p className="text-xs truncate font-medium mt-0.5 max-w-[120px]">{lead.location || "N/A"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 leading-none">LEAD PRIORITY</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mt-0.5 ${getTemperatureBadgeClass(lead.temperature)}`}>
                        {lead.temperature || "(Select Priority)"}
                      </span>
                    </div>
                  </div>

                  {lead.assignmentTimestamp && (
                    <div className="flex items-center gap-2 col-span-2 sm:col-span-1 border-t border-slate-100/5 pt-2 sm:border-t-0 sm:pt-0">
                      <Clock size={14} className="text-teal-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 leading-none">ASSIGNED TIME</p>
                        <p className="text-xs font-bold text-teal-300 mt-1 font-mono">
                          {new Date(lead.assignmentTimestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {lead.dateCreated && (
                    <div className="flex items-center gap-2 col-span-2 sm:col-span-1 border-t border-slate-100/5 pt-2 sm:border-t-0 sm:pt-0">
                      <Calendar size={14} className="text-slate-400" />
                      <div>
                        <p className="text-[10px] text-slate-400 leading-none">CREATED ON</p>
                        <p className="text-xs font-bold text-slate-350 mt-1 font-mono">
                          {lead.dateCreated}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Notes Block */}
                <div className="space-y-1 mt-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono">Latest Consultation Synopsis (Notes)</p>
                  <p className={`text-xs font-light italic leading-relaxed line-clamp-2 ${darkMode ? "text-slate-350" : "text-slate-600"}`}>
                    "{getDisplayNotes(lead.notes) || "No advisory brief recorded yet."}"
                  </p>
                </div>
              </div>

              {/* Communication contacts list & Bottom Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100/10 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 gap-2">
                  <div className="flex items-center gap-3">
                    <a href={`mailto:${lead.email}`} className="hover:text-teal-400 flex items-center gap-1">
                      <Mail size={12} />
                      {lead.email}
                    </a>
                    <a 
                      href={`tel:${lead.phone}`} 
                      className={`flex items-center gap-1 px-1 py-0.5 rounded transition ${
                        isDuplicatePhone(lead.phone, lead.id) 
                          ? "text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 hover:text-rose-350 font-medium" 
                          : "hover:text-teal-400"
                      }`}
                      title={isDuplicatePhone(lead.phone, lead.id) ? "This phone number exists on multiple leads " : undefined}
                    >
                      <Phone size={12} className={isDuplicatePhone(lead.phone, lead.id) ? "text-rose-400 animate-bounce" : "text-slate-400"} />
                      <span className={isDuplicatePhone(lead.phone, lead.id) ? "font-semibold decoration-dashed underline decoration-rose-500/40 text-rose-300" : ""}>
                        {lead.phone}
                      </span>
                    </a>
                  </div>

                  <div className="font-mono text-[9px] uppercase tracking-wider text-right">
                    Last Comm: {lead.lastCommunication}
                  </div>
                </div>

                {/* Interaction & AI Assistant triggers */}
                <div className="flex flex-col sm:flex-row gap-2 mt-1.5 pt-1.5">
                  <button 
                    id={`trigger-ai-email-${lead.id}`}
                    onClick={() => generateAIFollowUp(lead)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-700 border border-teal-50/10 text-white flex items-center justify-center gap-2 cursor-pointer transition active:scale-95 shadow-md shadow-teal-500/10"
                  >
                    <Sparkles size={11} className="text-amber-300 animate-pulse" />
                    Draft AI Advisory Email
                  </button>

                  <div className="flex flex-1 sm:flex-initial gap-1.5 justify-end">
                    {(() => {
                      const activeReminders = appointments.filter(app => app.leadId === lead.id && !app.isCompleted);
                      const hasReminders = activeReminders.length > 0;
                      return (
                        <button
                          id={`reminder-lead-${lead.id}`}
                          onClick={() => openReminderModal(lead)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition duration-155 cursor-pointer border relative flex items-center justify-center gap-1.5 shadow-sm active:scale-95
                            ${hasReminders
                              ? (darkMode 
                                ? "bg-indigo-950/40 border-indigo-500 hover:bg-indigo-900/60 text-indigo-300" 
                                : "bg-indigo-50 border-indigo-300 hover:bg-indigo-100/80 text-indigo-700")
                              : (darkMode 
                                ? "bg-slate-800 hover:bg-indigo-950/45 border-slate-700 hover:border-indigo-550 text-indigo-400" 
                                : "bg-slate-50 hover:bg-indigo-50 border-slate-200 hover:border-indigo-500 text-indigo-600")}`}
                          title={hasReminders ? `${activeReminders.length} Active Reminder(s) - Click to manage or update` : "Create/Set Reminder"}
                        >
                          <Bell size={12} className={hasReminders ? "animate-pulse" : ""} />
                          <span>{hasReminders ? `${activeReminders.length} Reminder(s)` : "Create Reminder"}</span>
                        </button>
                      );
                    })()}

                    <button
                      id={`edit-lead-${lead.id}`}
                      onClick={() => setEditingLead(currentUser?.role === "super_admin" || currentUser?.role === "admin" ? lead : { ...lead, notes: getDisplayNotes(lead.notes) })}
                      className={`p-2 rounded-xl transition duration-155 cursor-pointer border flex items-center justify-center
                        ${darkMode 
                          ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200" 
                          : "bg-slate-50 hover:bg-slate-150 border-slate-200 text-slate-700"}`}
                      title="Edit Real Estate Parameters"
                    >
                      <Edit3 size={13} />
                    </button>

                    {currentUser?.role !== "sales_team" && (
                      <button
                        id={`delete-lead-${lead.id}`}
                        onClick={() => onDeleteLead(lead.id)}
                        className={`p-2 rounded-xl transition duration-155 cursor-pointer border hover:border-rose-500/30 hover:text-rose-500 flex items-center justify-center
                          ${darkMode 
                            ? "bg-slate-800 border-slate-705 text-slate-400" 
                            : "bg-slate-50 border-slate-200 text-slate-500"}`}
                        title="Delete Entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400 lg:col-span-2">
            {currentUser?.role === "sales_team" || currentUser?.role === "team_leader" ? (
              <div className="flex flex-col items-center justify-center gap-1.5">
                <span className="text-sm font-semibold tracking-wide uppercase font-mono text-slate-500">No lead assigned.</span>
                <p className="text-[11px] text-slate-450 max-w-xs">There are currently no real estate clients assigned to you or your direct report cohort matching these parameters.</p>
              </div>
            ) : (
              "No matches found. Clear filters or add a fresh real estate client."
            )}
          </div>
        )}
      </div>
        </div>
      )}

      {/* MODAL: Draft AI Advisor Email */}
      {selectedLeadForAI && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-none">
          <div 
            id="ai-email-modal"
            className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => setSelectedLeadForAI(null)}
              className="absolute top-4 right-4 text-slate-400 dark:hover:text-white hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100/10 mb-4">
              <div className="p-2 bg-gradient-to-tr from-teal-500 to-amber-400 rounded-xl text-slate-900">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">AI Strategic Auto-Followup</h3>
                <p className="text-xs text-slate-450">Elite Pro Automated Client Response Assistant</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Parameters input column */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">Target Client Profile</label>
                  <p className="text-sm font-semibold">{selectedLeadForAI.name} ({selectedLeadForAI.company})</p>
                  <p className="text-xs text-slate-400">Source: {selectedLeadForAI.source} | Budget: {selectedLeadForAI.budget}</p>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">Response Communication Style</label>
                  <select
                    id="ai-email-mood"
                    value={emailMood}
                    onChange={(e) => setEmailMood(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-lg border font-sans font-medium transition duration-200 cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200"}`}
                  >
                    <option value="persuasive and authoritative">👔 Authoritative & Strategic Partner Theme</option>
                    <option value="urgency and high priority">⚡ High Pipeline Velocity & Alignment Tour</option>
                    <option value="technical and architectural details">🏗️ Granular Technical Specifications Focus</option>
                    <option value="warm, relationship oriented">🤝 High Relationship Building Theme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">Incorporate Real-time Brief Notes</label>
                  <textarea
                    id="ai-email-notes"
                    rows={4}
                    value={emailNotes}
                    onChange={(e) => setEmailNotes(e.target.value)}
                    placeholder="Enter proprietary brief directives or leave empty to default to original lead consultation notes."
                    className={`w-full px-3 py-2 text-xs rounded-lg border font-sans font-light transition duration-200
                      ${darkMode ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <button
                  id="recompile-ai-email-btn"
                  onClick={() => generateAIFollowUp(selectedLeadForAI)}
                  disabled={isGeneratingEmail}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-550 text-white font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingEmail ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Drafting custom advisory brief...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} className="text-amber-300" />
                      Configure & Generate Email Draft
                    </>
                  )}
                </button>
              </div>

              {/* Output Preview Column */}
              <div className="flex flex-col justify-between border-l border-slate-100/10 pl-0 md:pl-4">
                <div className="flex-1 flex flex-col min-h-[220px]">
                  <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-1">Live Preview</label>
                  
                  {isGeneratingEmail ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-100/10 rounded-xl p-4 text-center">
                      <Loader2 size={24} className="animate-spin text-teal-500 mb-2" />
                      <p className="text-xs font-semibold">Gemini AI Engine Spinning...</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Crafting professional commercial real estate follow-up prose aligned with target variables.</p>
                    </div>
                  ) : emailBody ? (
                    <div className="flex-1 flex flex-col border border-dashed rounded-xl p-3 bg-slate-950/20 max-h-[260px] overflow-y-auto w-full text-left leading-relaxed text-xs">
                      <div className="pb-1.5 mb-1.5 border-b border-slate-100/5">
                        <span className="font-bold text-teal-400">Subject:</span> {emailSubject}
                      </div>
                      <div className="whitespace-pre-line font-light">{emailBody}</div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-150 rounded-xl p-4 text-center">
                      <AlertCircle size={20} className="text-slate-400 mb-1" />
                      <p className="text-xs text-slate-400">Ready to initiate generation protocol.</p>
                    </div>
                  )}
                </div>

                {/* Final Copy / Log Button */}
                {emailBody && (
                  <div className="mt-3 space-y-2">
                    {emailSuccessMsg && (
                      <div className="text-[11px] text-emerald-400 text-center font-semibold bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/15 animate-pulse">
                        {emailSuccessMsg}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        id="copy-to-clipboard-btn"
                        onClick={() => {
                          const fullTxt = `Subject: ${emailSubject}\n\n${emailBody}`;
                          navigator.clipboard.writeText(fullTxt);
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 cursor-pointer
                          ${darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-100 border-slate-200"}`}
                      >
                        <Copy size={13} />
                        Copy Draft
                      </button>

                      <button
                        id="send-simulate-email-btn"
                        onClick={handleSimulateSendEmail}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send size={13} />
                        Log Campaign Sync
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Lead — extracted to AddLeadModal for isolated re-renders on typing */}
      <AddLeadModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddNewLead}
        darkMode={darkMode}
        currentUser={currentUser}
        finalAgents={finalAgents}
        isDuplicatePhone={isDuplicatePhone}
        isAuthorizedToAssign={isAuthorizedToAssign}
      />

      {/* MODAL: Edit Lead */}
      {editingLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all animate-none">
          <div 
            id="edit-lead-modal"
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => setEditingLead(null)}
              className="absolute top-4 right-4 text-slate-450 dark:hover:text-white hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="font-display font-bold text-lg border-b border-slate-100/10 pb-3 mb-4">Edit Capital Real Estate Parameters</h3>

            {formError && (
              <div id="form-validation-error-edit" className="mb-4 p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle size={14} className="shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Customer Name <span className="text-teal-400 text-[9px] font-sans font-normal">(Compulsory if no Phone)</span>
                  </label>
                  <input
                    id="edit-lead-name"
                    type="text"
                    value={editingLead.name || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Project Name</label>
                  <input
                    id="edit-lead-project"
                    type="text"
                    placeholder="Enter project name (e.g. EMAAR IBC)"
                    value={editingLead.projectName || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, projectName: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Corporate Position</label>
                  <input
                    id="edit-lead-position"
                    type="text"
                    value={editingLead.position || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, position: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Allocated Capital Budget</label>
                  <input
                    id="edit-lead-budget"
                    type="text"
                    value={editingLead.budget || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, budget: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    id="edit-lead-email"
                    type="email"
                    value={editingLead.email || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                    Phone Number <span className="text-teal-400 text-[9px] font-sans font-normal">(Compulsory if no Name)</span>
                  </label>
                  <input
                    id="edit-lead-phone"
                    type="text"
                    value={editingLead.phone || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}
                      ${isDuplicatePhone(editingLead.phone, editingLead.id) ? "border-amber-500/55 text-amber-300 bg-amber-500/5 focus:ring-amber-500" : ""}`}
                  />
                  {isDuplicatePhone(editingLead.phone, editingLead.id) && (
                    <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-sans font-medium">
                      <AlertCircle size={11} className="shrink-0 text-amber-500" />
                      Warning: Number registered on another lead in CRM.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Lead Source</label>
                  <select
                    id="edit-lead-source"
                    value={editingLead.source}
                    onChange={(e) => setEditingLead({ ...editingLead, source: e.target.value as Lead["source"] })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  >
                    <option value="Meta Ad">Meta Ad</option>
                    <option value="Google Ad">Google Ad</option>
                    <option value="IVR Board">IVR Board</option>
                    <option value="IVR">IVR</option>
                    <option value="Reference">Reference</option>
                    <option value="Website">Website</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Personal">Personal</option>
                    <option value="Cold Call">Cold Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Physical Location</label>
                  <input
                    id="edit-lead-location"
                    type="text"
                    placeholder="e.g. Noida Sector 62, India (Optional)"
                    value={editingLead.location || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, location: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border 
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Lead Status</label>
                  <select
                    id="edit-lead-status"
                    value={editingLead.status || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, status: e.target.value as Lead["status"] })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 font-medium"}`}
                  >
                    <option value="">(Select Status)</option>
                    <option value="New Lead">New Lead</option>
                    <option value="Interested">Interested</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Detailed Share">Detailed Share</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Meeting Done">Meeting Done</option>
                    <option value="Site Visit">Site Visit</option>
                    <option value="Closed Client">Closed Client</option>
                    <option value="Call Back">Call Back</option>
                    <option value="Junk">Junk</option>
                    <option value="Duplicate">Duplicate</option>
                    <option value="Not Pick">Not Pick</option>
                    <option value="Switched Off">Switched Off</option>
                    <option value="Low Budget">Low Budget</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Lead Priority</label>
                  <select
                    id="edit-lead-temperature"
                    value={editingLead.temperature || ""}
                    onChange={(e) => setEditingLead({ ...editingLead, temperature: e.target.value as Lead["temperature"] })}
                    className={`w-full px-3 py-2 text-xs rounded-lg border cursor-pointer
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                  >
                    <option value="">(Select Priority)</option>
                    <option value="Hot">🔥 Hot</option>
                    <option value="Warm">☀️ Warm</option>
                    <option value="Cold">❄️ Cold</option>
                    <option value="Dead">🫙 Dead</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider">Assign To (Agent)</label>
                  {!isAuthorizedToAssign && (
                    <span className="text-[9px] text-rose-450 flex items-center gap-1 font-mono uppercase">
                      <Lock size={10} /> Locked
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="edit-lead-agent"
                    type="text"
                    placeholder="Select or type agent name..."
                    value={editingLead.assignedAgent || ""}
                    onChange={(e) => {
                      if (isAuthorizedToAssign) {
                        setEditingLead({ ...editingLead, assignedAgent: e.target.value });
                      }
                    }}
                    disabled={!isAuthorizedToAssign}
                    className={`w-full pr-10 px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}
                      ${!isAuthorizedToAssign ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900" : ""}`}
                  />
                  {isAuthorizedToAssign && (
                    <button
                      type="button"
                      onClick={() => setShowEditAgentDropdown(!showEditAgentDropdown)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-300 hover:text-slate-600 pointer-events-auto"
                    >
                      <ChevronDown size={14} className={`transform transition-transform ${showEditAgentDropdown ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  {showEditAgentDropdown && isAuthorizedToAssign && (
                    <div className={`absolute z-30 w-full mt-1 max-h-40 overflow-y-auto rounded-lg shadow-xl border text-xs divide-y
                      ${darkMode ? "bg-slate-900 border-slate-800 text-slate-200 divide-slate-800/50" : "bg-white border-slate-200 text-slate-800 divide-slate-100"}`}>
                      {finalAgents.map((agent) => (
                        <button
                          key={agent}
                          type="button"
                          onClick={() => {
                            setEditingLead({ ...editingLead, assignedAgent: agent });
                            setShowEditAgentDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-left transition select-none ${darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}
                        >
                          {agent}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!isAuthorizedToAssign && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Only administrators and team leaders can assign or change lead ownership.
                  </p>
                )}
                {editingLead.assignmentTimestamp && (
                  <p className="text-[10px] text-teal-400 mt-1.5 flex items-center gap-1 font-mono">
                    <Clock size={11} className="text-teal-400" />
                    Assigned On: {new Date(editingLead.assignmentTimestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true
                    })}
                  </p>
                )}
              </div>

               <div>
                 <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Notes (Consultation Synopsis Brief)</label>
                 <textarea
                   id="edit-lead-notes"
                   rows={3}
                   value={editingLead.notes || ""}
                   onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })}
                   className={`w-full px-3 py-2 text-xs rounded-lg border 
                     ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`}
                 />
               </div>

              <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100/10">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer
                    ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
                >
                  Save Real Estate Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Lead Ingestion Console (CSV/Excel Imports) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all overflow-y-auto">
          <div 
            id="bulk-import-modal"
            className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative my-8
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => {
                setIsImportModalOpen(false);
                setImportPreviewData([]);
                setFileName("");
                setImportError(null);
              }}
              className="absolute top-4 right-4 text-slate-400 dark:hover:text-slate-200 hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-2 pb-3 border-b border-slate-100/10">
              <FileSpreadsheet className="text-emerald-500" size={24} />
              <h3 className="font-display font-bold text-lg">Bulk Lead Ingestion Console</h3>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Import investor logs instantly via spreadsheet templates. Supports columns: 
              <span className="font-mono text-[10px] text-teal-400 block mt-1 bg-slate-950/40 p-2 rounded border border-slate-800">
                CUSTOMER NAME, PROJECT NAME, EMAIL ADDRESS, PHONE NUMBER, LEAD SOURCE, PHYSICAL LOCATION, LEAD STATUS, LEAD PRIORITY, BUDGET, NOTES (CONSULTATION SYNOPSIS BRIEF), ASSIGN AGENT
              </span>
            </p>

            {/* Template downloader utility */}
            <div className={`p-3 rounded-xl mb-4 border flex items-center justify-between gap-4
              ${darkMode ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50 border-slate-150"}`}
            >
              <div>
                <h5 className="text-[11px] font-semibold text-teal-400">Not sure about column layout configurations?</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">Grab our pre-packaged spreadsheet format containing pre-header mappings directly.</p>
              </div>
              <button
                type="button"
                onClick={downloadImportTemplate}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[10px] uppercase cursor-pointer whitespace-nowrap active:scale-95 transition"
              >
                Download CSV Template
              </button>
            </div>

            {/* Drop Zone Box */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition duration-150
                ${dragActive 
                  ? "border-emerald-500 bg-emerald-500/10" 
                  : darkMode 
                    ? "border-slate-800 bg-slate-950/40 hover:border-slate-700" 
                    : "border-slate-250 bg-slate-50 hover:bg-slate-100/70"}`}
              onClick={() => document.getElementById("file-loader-element")?.click()}
            >
              <Upload className={`mb-3 ${dragActive ? "text-emerald-400 animate-bounce" : "text-slate-400"}`} size={32} />
              <p className="text-xs font-semibold mb-1">
                {fileName ? `Loaded: ${fileName}` : "Drag and drop your spreadsheet file here"}
              </p>
              <p className="text-[10px] text-slate-400">Allows .CSV, .XLSX, or .XLS file types up to 10MB</p>
              
              <input
                id="file-loader-element"
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Error prompt */}
            {importError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold font-mono block">Spreadsheet Invalidation Blocked:</span>
                  <span className="text-[11px] block mt-0.5">{importError}</span>
                </div>
              </div>
            )}

            {/* Success Preview */}
            {importPreviewData.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Check size={14} className="bg-emerald-500/10 p-0.5 rounded-full" />
                    Ingested Spreadsheet Cache: {importPreviewData.length} records parsed
                  </span>
                  <span className="p-1 px-2 uppercase tracking-wide bg-amber-500/10 text-amber-500 font-bold font-mono text-[8px] rounded border border-amber-500/15">
                    🔐 Assigned to: {currentUser?.name || "Self"}
                  </span>
                </div>

                {/* Micro preview grid of parsed leads */}
                <div className={`border rounded-xl max-h-[160px] overflow-y-auto overflow-x-auto text-left
                  ${darkMode ? "border-slate-800 bg-slate-950/40 text-slate-300" : "border-slate-150 bg-slate-50 text-slate-700"}`}
                >
                  <table className="w-full text-[10px] font-sans">
                    <thead className={`sticky top-0 font-mono tracking-wider text-[9px] border-b uppercase font-semibold
                      ${darkMode ? "bg-slate-900 border-slate-850 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-500"}`}
                    >
                      <tr>
                        <th className="p-2 border-r border-slate-800/20">Name</th>
                        <th className="p-2 border-r border-slate-800/20 font-sans">Contact Phone</th>
                        <th className="p-2 border-r border-slate-800/20 font-mono">Project Name</th>
                        <th className="p-2 border-r border-slate-800/20">Source</th>
                        <th className="p-2 border-r border-slate-800/20">Advisor Assigned</th>
                        <th className="p-2 border-r border-slate-800/20">Location</th>
                        <th className="p-2 border-r border-slate-800/20">Budget</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/10">
                      {importPreviewData.map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-500/5">
                          <td className="p-2 border-r border-slate-800/10 font-medium whitespace-nowrap">{lead.name}</td>
                          <td className="p-2 border-r border-slate-800/10 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={isDuplicatePhone(lead.phone) ? "text-rose-400 font-semibold" : ""}>
                                {lead.phone || "N/A"}
                              </span>
                              {isDuplicatePhone(lead.phone) && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-rose-500/10 text-rose-450 border border-rose-500/15 font-sans font-semibold text-[8px] tracking-tight animate-pulse">
                                  <AlertCircle size={8} />
                                  DUPLICATE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 border-r border-slate-800/10 font-mono italic text-[9px] whitespace-nowrap text-teal-400">{lead.projectName || "N/A"}</td>
                          <td className="p-2 border-r border-slate-800/10 whitespace-nowrap">{lead.source}</td>
                          <td className="p-2 border-r border-slate-800/10 font-semibold text-teal-400 whitespace-nowrap">{lead.assignedAgent}</td>
                          <td className="p-2 border-r border-slate-800/10 whitespace-nowrap">{lead.location}</td>
                          <td className="p-2 border-r border-slate-800/10 font-mono tracking-tight text-amber-500 font-semibold whitespace-nowrap">{formatBudgetSafely(lead.budget)}</td>
                          <td className="p-2 whitespace-nowrap">
                            <span className="px-1.5 py-0.2 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[8px] font-mono tracking-wider font-semibold">
                              {lead.status || "(Select Status)"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action controls */}
            <div className="flex gap-2.5 justify-end pt-4 mt-4 border-t border-slate-100/10">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportPreviewData([]);
                  setFileName("");
                  setImportError(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition
                  ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205 text-slate-805"}`}
              >
                Discard
              </button>
              <button
                type="button"
                disabled={importPreviewData.length === 0}
                onClick={handleCommitImport}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition
                  ${importPreviewData.length > 0 
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95" 
                    : "bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed"}`}
              >
                <Check size={14} />
                Register {importPreviewData.length > 0 ? `${importPreviewData.length} Parsed Leads` : "Spreadsheet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Set Reminder / Quick Appointment Operator */}
      {reminderModalLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all overflow-y-auto">
          <div 
            id="quick-reminder-modal"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative my-8 animate-in fade-in zoom-in duration-200
              ${darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => setReminderModalLead(null)}
              className="absolute top-4 right-4 text-slate-400 dark:hover:text-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <h3 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2 mb-2">
              <Bell size={16} className="text-indigo-500 animate-bounce" />
              Set Reminder / Agenda
            </h3>
            <p className="text-[10px] text-slate-400 mb-4 font-mono uppercase tracking-wider">
              Create an agenda entry or phone appointment reminder connected to this prospect.
            </p>

            {reminderAlert && (
              <div 
                className={`p-3.5 rounded-xl mb-4 text-xs font-semibold flex items-start gap-2 border leading-relaxed
                  ${reminderAlert.type === "success" 
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
                    : "bg-rose-500/15 border-rose-500/30 text-rose-400"}`}
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{reminderAlert.message}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                  Associated Lead
                </label>
                <div className={`p-2.5 rounded-xl border text-xs font-semibold
                  ${darkMode ? "bg-slate-950/80 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                >
                  {reminderModalLead.name} {reminderModalLead.company ? `• ${reminderModalLead.company}` : ""}
                </div>
              </div>

              {(() => {
                const leadReminders = appointments.filter(app => app.leadId === reminderModalLead.id && !app.isCompleted);
                if (leadReminders.length === 0) return null;
                return (
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5 flex justify-between items-center">
                      <span>Active Reminders ({leadReminders.length})</span>
                      <div className="flex items-center gap-1.5">
                        {onDeleteAppointment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const handleRemoveAll = () => {
                                const ids = leadReminders.map(rem => rem.id);
                                onDeleteAppointment(ids, true);
                                startNewReminderForm();
                              };
                              if (triggerConfirm) {
                                triggerConfirm(
                                  "Remove All Reminders",
                                  `⚠️ Are you sure you want to delete ALL (${leadReminders.length}) reminders set for this lead?`,
                                  handleRemoveAll
                                );
                              } else if (window.confirm(`⚠️ Are you sure you want to delete ALL (${leadReminders.length}) reminders set for this lead?`)) {
                                handleRemoveAll();
                              }
                            }}
                            className="text-[9px] font-sans text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 font-bold cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-md border border-rose-500/20"
                          >
                            <Trash2 size={9} />
                            Remove All
                          </button>
                        )}
                        {editingReminderId && (
                          <button
                            type="button"
                            onClick={startNewReminderForm}
                            className="text-[9px] font-sans text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-md"
                          >
                            + Create New
                          </button>
                        )}
                      </div>
                    </label>
                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                      {leadReminders.map(rem => {
                        const isCurrentlyEditing = rem.id === editingReminderId;
                        return (
                          <div
                            key={rem.id}
                            onClick={() => {
                              setEditingReminderId(rem.id);
                              setReminderTitle(rem.title);
                              setReminderType(rem.type);
                              setReminderDate(rem.date);
                              setReminderTime(rem.time);
                              setReminderNotes(rem.notes || "");
                              setReminderAlert(null);
                            }}
                            className={`p-2 rounded-xl border text-[11px] flex items-center justify-between cursor-pointer transition-all duration-150
                              ${isCurrentlyEditing
                                ? (darkMode 
                                  ? "bg-indigo-950/45 border-indigo-500 text-indigo-300"
                                  : "bg-indigo-50 border-indigo-400 text-indigo-700")
                                : (darkMode
                                  ? "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400"
                                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600")}`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                              <span className="font-semibold truncate">{rem.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono whitespace-nowrap bg-slate-500/10 px-1.5 py-0.5 rounded">
                                {rem.date} {rem.time}
                              </span>
                              {onDeleteAppointment && (
                                <button
                                  type="button"
                                  title="Delete reminder"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const handleDelete = () => {
                                      onDeleteAppointment(rem.id, true);
                                      if (editingReminderId === rem.id) {
                                        startNewReminderForm();
                                      }
                                    };
                                    if (triggerConfirm) {
                                      triggerConfirm(
                                        "Delete Reminder",
                                        `Are you sure you want to delete reminder "${rem.title}"?`,
                                        handleDelete
                                      );
                                    } else if (window.confirm(`Delete reminder "${rem.title}"?`)) {
                                      handleDelete();
                                    }
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5 flex justify-between items-center">
                  <span>Reminder Title / Task Name *</span>
                  {editingReminderId && (
                    <span className="text-[9.5px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold">
                      Editing Mode
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="e.g. Call Client about Noida Property"
                  className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 
                    ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                    Target Date *
                  </label>
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [color-scheme:dark]
                      ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                    Target Time *
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 [color-scheme:dark]
                      ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                  Task Category
                </label>
                <select
                  value={reminderType}
                  onChange={(e) => setReminderType(e.target.value as AppointmentType)}
                  className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 
                    ${darkMode ? "bg-slate-950 border-slate-855 text-slate-200" : "bg-slate-50 border-slate-220 text-slate-800"}`}
                >
                  <option value="followup">Follow-Up Task</option>
                  <option value="call">Phone Call Alignment</option>
                  <option value="meeting">Personal Meeting</option>
                  <option value="site_visit">Property Site Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 font-bold mb-1.5">
                  Reminder Synopsis (Notes)
                </label>
                <textarea
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  placeholder="e.g. Schedule call to describe layout map"
                  rows={3}
                  className={`w-full p-2.5 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none
                    ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReminderModalLead(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition
                    ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205 text-slate-805"}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateOrUpdateReminder}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition shadow-md shadow-indigo-600/15 active:scale-95"
                >
                  {editingReminderId ? "Update Reminder" : "Set Reminder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Bulk Lead Reassignment Operator */}
      {isBulkTransferModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all overflow-y-auto">
          <div 
            id="bulk-transfer-modal"
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl relative my-8
              ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}
          >
            <button 
              onClick={() => {
                setIsBulkTransferModalOpen(false);
                setBulkTransferMessage(null);
                setBulkTargetAgents([]);
                setBulkSearchQuery("");
                setBulkTransferUseSelected(false);
              }}
              className="absolute top-4 right-4 text-slate-400 dark:hover:text-slate-200 hover:text-slate-800 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-2 pb-3 border-b border-slate-100/10">
              <ArrowLeftRight className="text-indigo-500" size={24} />
              <h3 className="font-display font-bold text-lg">Bulk Status Reassigner</h3>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Batch transfer investor portfolios instantly from target statuses or specific advisors and distribute them equally across selected online Sales Consultants.
            </p>

            {/* Mode Selector Toggle if selectedLeadIds exist */}
            {selectedLeadIds.length > 0 && (
              <div className={`p-1 rounded-xl mb-4 flex gap-1 border ${darkMode ? "bg-slate-950/80 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTransferUseSelected(false);
                    setBulkTransferMessage(null);
                  }}
                  className={`flex-1 py-1.5 px-3 text-[11.5px] font-semibold rounded-lg transition-all ${
                    !bulkTransferUseSelected
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-250 dark:hover:text-white"
                  }`}
                >
                  Status Filter Mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTransferUseSelected(true);
                    setBulkTransferMessage(null);
                  }}
                  className={`flex-1 py-1.5 px-3 text-[11.5px] font-semibold rounded-lg transition-all ${
                    bulkTransferUseSelected
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-250 dark:hover:text-white"
                  }`}
                >
                  Selected Leads ({selectedLeadIds.length})
                </button>
              </div>
            )}

            <div className="space-y-4">
              {!bulkTransferUseSelected ? (
                <>
                  {/* SELECT SOURCE LEAD STATUS */}
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1.5 font-semibold">
                      1. Filter by Lead Status
                    </label>
                    <select
                      value={bulkSourceStatus}
                      onChange={(e) => {
                        setBulkSourceStatus(e.target.value);
                        setBulkSourceAgent("All");
                        setBulkTransferMessage(null);
                      }}
                      className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 
                        ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Interested">Interested</option>
                      <option value="Follow Up">Follow Up</option>
                      <option value="Detailed Share">Detailed Share</option>
                      <option value="Meeting Done">Meeting Done</option>
                      <option value="Site Visit">Site Visit</option>
                      <option value="Call Back">Call Back</option>
                      <option value="Closed Client">Closed Client</option>
                      <option value="Not Pick">Not Pick</option>
                      <option value="Switched Off">Switched Off</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Low Budget">Low Budget</option>
                      <option value="Junk">Junk</option>
                      <option value="Duplicate">Duplicate</option>
                    </select>
                  </div>

                  {/* FILTER BY CURRENT ASSIGNEE */}
                  <div>
                    <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1.5 font-semibold">
                      2. From Current Occupant / Owner
                    </label>
                    <select
                      value={bulkSourceAgent}
                      onChange={(e) => {
                        setBulkSourceAgent(e.target.value);
                        setBulkTransferMessage(null);
                      }}
                      className={`w-full p-2.5 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 
                        ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                    >
                      <option value="All">All Owners (Reallocate complete status bucket)</option>
                      <option value="Unassigned">Unassigned (Only direct unowned leads)</option>
                      {bulkCurrentAssigneesForSelectedStatus
                        .filter(name => name.trim().toLowerCase() !== "unassigned")
                        .map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              ) : (
                <div className={`p-4 rounded-xl border border-dashed text-center flex flex-col items-center justify-center py-6
                  ${darkMode ? "bg-slate-950/40 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                >
                  <p className="text-xs font-semibold mb-1">Hand-Selected Leads Mode Active</p>
                  <p className="text-[10px] text-slate-400 max-w-xs">
                    You are reallocating specifically the {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? "s" : ""} currently checked on the CRM screen.
                  </p>
                </div>
              )}

              {/* DYNAMIC MATCH COUNT INDICATOR */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs
                ${bulkMatchingLeads.length > 0 
                  ? darkMode 
                    ? "bg-indigo-950/20 border-indigo-500/20 text-indigo-300"
                    : "bg-indigo-50 border-indigo-100 text-indigo-700"
                  : darkMode 
                    ? "bg-slate-950 text-slate-500 border-slate-850"
                    : "bg-slate-100 text-slate-500 border-slate-200"}`}
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${bulkMatchingLeads.length > 0 ? "bg-indigo-500 animate-pulse" : "bg-slate-400"}`} />
                  Leads detected:
                </span>
                <span className="font-mono font-bold text-sm">
                  {bulkMatchingLeads.length} Lead{bulkMatchingLeads.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* SELECT TARGET ADVISORS USING CHECKBOXES */}
              <div>
                <label className="block text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-1.5 font-semibold">
                  3. Select Recipient Sales Team or TLs
                </label>

                {/* SEARCH INPUT */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    placeholder="Search advisors or TLs..."
                    className={`w-full p-2.5 pl-8 rounded-xl text-xs font-medium border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 
                      ${darkMode ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"}`}
                  />
                  <div className="absolute left-2.5 top-3.5 text-slate-400">
                    <Search size={14} />
                  </div>
                  {bulkSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBulkSearchQuery("")}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-200 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* QUICK SELECTION BUTTONS */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      const availableList = bulkActiveAssignees.filter(u => {
                        if (bulkSourceAgent !== "All" && bulkSourceAgent !== "Unassigned") {
                          return u.name.trim().toLowerCase() !== bulkSourceAgent.trim().toLowerCase();
                        }
                        return true;
                      });
                      const eligibleFiltered = availableList.filter(u => {
                        if (!bulkSearchQuery.trim()) return true;
                        return (u.name || "").toLowerCase().includes(bulkSearchQuery.toLowerCase());
                      });
                      const allNames = eligibleFiltered.map(u => u.name);
                      setBulkTargetAgents(prev => Array.from(new Set([...prev, ...allNames])));
                      setBulkTransferMessage(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase transition cursor-pointer
                      ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"}`}
                  >
                    Select All Visible
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTargetAgents([]);
                      setBulkTransferMessage(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase transition cursor-pointer
                      ${darkMode ? "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800"}`}
                  >
                    Deselect All
                  </button>
                </div>

                {/* SCROLLABLE LIST OF CHECKBOXES */}
                <div className={`border rounded-xl p-2 max-h-40 overflow-y-auto space-y-1 custom-scrollbar
                  ${darkMode ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-200"}`}
                >
                  {(() => {
                    const availableList = bulkActiveAssignees.filter(u => {
                      if (bulkSourceAgent !== "All" && bulkSourceAgent !== "Unassigned") {
                        return u.name.trim().toLowerCase() !== bulkSourceAgent.trim().toLowerCase();
                      }
                      return true;
                    });
                    const eligibleFiltered = availableList.filter(u => {
                      if (!bulkSearchQuery.trim()) return true;
                      return (u.name || "").toLowerCase().includes(bulkSearchQuery.toLowerCase());
                    });

                    if (eligibleFiltered.length === 0) {
                      return (
                        <div className="text-center py-6 text-slate-500 text-xs font-medium">
                          No matching active teammates found.
                        </div>
                      );
                    }

                    return eligibleFiltered.map((user) => {
                      const isChecked = bulkTargetAgents.includes(user.name);
                      return (
                        <label
                          key={user.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition select-none
                            ${isChecked 
                              ? darkMode ? "bg-indigo-950/20 text-indigo-200" : "bg-indigo-50 text-indigo-900 font-semibold"
                              : darkMode ? "hover:bg-slate-900/60 text-slate-300" : "hover:bg-slate-100 text-slate-700"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setBulkTransferMessage(null);
                              if (e.target.checked) {
                                setBulkTargetAgents(prev => [...prev, user.name]);
                              } else {
                                setBulkTargetAgents(prev => prev.filter(name => name !== user.name));
                              }
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                          />
                          <div className="flex-1 flex justify-between items-center min-w-0">
                            <span className="text-xs truncate">{user.name}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider
                              ${user.role === "team_leader" 
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}
                            >
                              {user.role === "team_leader" ? "TL" : "Sales"}
                            </span>
                          </div>
                        </label>
                      );
                    });
                  })()}
                </div>

                {/* SUMMARY COUNTER */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1 px-1">
                  <span>Selected recipients: {bulkTargetAgents.length}</span>
                </div>
              </div>

              {/* DYNAMIC EQUAL DISTRIBUTION FORECAST DISPLAY */}
              {bulkTargetAgents.length > 0 && bulkMatchingLeads.length > 0 && (
                <div className={`p-3 rounded-xl border text-xs leading-normal animate-fadeIn flex gap-2 items-start
                  ${darkMode 
                    ? "bg-indigo-950/10 border-indigo-500/20 text-indigo-300/90" 
                    : "bg-indigo-50 border-indigo-100 text-indigo-700"}`}
                >
                  <ArrowLeftRight size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold mb-0.5 text-[11px] uppercase tracking-wider">Equal Distribution Forecast:</div>
                    <p className="opacity-90">
                      {(() => {
                        const numLeads = bulkMatchingLeads.length;
                        const numAgents = bulkTargetAgents.length;
                        const base = Math.floor(numLeads / numAgents);
                        const remainder = numLeads % numAgents;
                        if (remainder === 0) {
                          return `Perfect Split! Each of the ${numAgents} selected advisors will receive exactly ${base} lead${base !== 1 ? "s" : ""}.`;
                        } else {
                          return `${remainder} advisor${remainder !== 1 ? "s" : ""} will receive ${base + 1} lead${base + 1 !== 1 ? "s" : ""}, and the other ${numAgents - remainder} will receive ${base} lead${base !== 1 ? "s" : ""} each (equal round-robin allocation).`;
                        }
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* FEEDBACK STATUS PROMPTS */}
              {bulkTransferMessage && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-fadeIn
                  ${bulkTransferMessage.type === "success" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span className="leading-normal">{bulkTransferMessage.text}</span>
                </div>
              )}
            </div>

            {/* ACTION FOOTER */}
            <div className="flex gap-2.5 justify-end pt-4 mt-6 border-t border-slate-100/10">
              <button
                type="button"
                disabled={bulkTransferWorking}
                onClick={() => {
                  setIsBulkTransferModalOpen(false);
                  setBulkTransferMessage(null);
                  setBulkTargetAgents([]);
                  setBulkSearchQuery("");
                  setBulkTransferUseSelected(false);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition
                  ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205 text-slate-855"}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Close Panel
              </button>
              <button
                type="button"
                disabled={bulkTransferWorking || bulkMatchingLeads.length === 0 || bulkTargetAgents.length === 0}
                onClick={handleCommitBulkTransfer}
                className={`px-5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer select-none
                  ${bulkMatchingLeads.length > 0 && bulkTargetAgents.length > 0 && !bulkTransferWorking
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-md shadow-indigo-600/15" 
                    : "bg-slate-800 text-slate-500 border border-slate-800 cursor-not-allowed"}`}
              >
                {bulkTransferWorking ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Executing Reallocation...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Apply Bulk Reassignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
