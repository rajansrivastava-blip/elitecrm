import React, { useState } from "react";
import { Lead, User } from "../types";
import { X, AlertCircle, ChevronDown, Lock } from "lucide-react";

interface AddLeadFormState {
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  status: Lead["status"] | "";
  source: Lead["source"];
  temperature: Lead["temperature"] | "";
  budget: string;
  notes: string;
  location: string;
  assignedAgent: string;
  score: number;
  projectName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lead: Omit<Lead, "id" | "dateCreated" | "lastUpdated">) => void;
  darkMode?: boolean;
  currentUser: User | null;
  finalAgents: string[];
  isDuplicatePhone: (phone: string) => boolean;
  isAuthorizedToAssign: boolean;
}

const INITIAL_FORM = (currentUser: User | null): AddLeadFormState => ({
  name: "",
  company: "",
  position: "",
  email: "",
  phone: "",
  status: "New Lead",
  source: "Website",
  temperature: "",
  budget: "",
  notes: "",
  location: "",
  assignedAgent: currentUser?.role === "sales_team" ? currentUser.name : "Pending Assignment",
  score: 75,
  projectName: ""
});

export default function AddLeadModal({
  isOpen,
  onClose,
  onSubmit,
  darkMode,
  currentUser,
  finalAgents,
  isDuplicatePhone,
  isAuthorizedToAssign
}: Props) {
  const [form, setForm] = useState<AddLeadFormState>(() => INITIAL_FORM(currentUser));
  const [formError, setFormError] = useState<string | null>(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setForm(INITIAL_FORM(currentUser));
    setFormError(null);
    setShowAgentDropdown(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = form.name.trim();
    const finalPhone = form.phone.trim();
    if (!finalName && !finalPhone) {
      setFormError("Minimum identifying criteria required: Please provide either a Customer Name or a Phone Number to register the lead.");
      return;
    }
    setFormError(null);
    onSubmit({
      ...form,
      name: finalName || `Lead (${finalPhone})`,
      phone: finalPhone,
      status: (form.status || "") as Lead["status"],
      temperature: (form.temperature || "") as Lead["temperature"],
      location: form.location || "",
      budget: form.budget || "",
      lastCommunication: new Date().toISOString().split("T")[0]
    } as any);
    setForm(INITIAL_FORM(currentUser));
    setFormError(null);
    setShowAgentDropdown(false);
  };

  const set = (field: keyof AddLeadFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const inputCls = `w-full px-3 py-2 text-xs rounded-lg border ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all">
      <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative
        ${darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800"}`}>

        <button onClick={handleClose} className="absolute top-4 right-4 text-slate-450 dark:hover:text-white hover:text-slate-800 transition-colors">
          <X size={20} />
        </button>

        <h3 className="font-display font-bold text-lg border-b border-slate-100/10 pb-3 mb-4">Register Capital Investor Lead</h3>

        {formError && (
          <div className="mb-4 p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-500" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Customer Name <span className="text-teal-400 text-[9px] font-sans font-normal">(Compulsory if no Phone)</span>
              </label>
              <input id="new-lead-name" type="text" placeholder="Enter customer name"
                value={form.name} onChange={set("name")} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Project Name</label>
              <input id="new-lead-project" type="text" placeholder="Enter project name (e.g. EMAAR IBC)"
                value={form.projectName} onChange={set("projectName")} className={inputCls} />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
              <input id="new-lead-email" type="email" placeholder="name@corporation.com"
                value={form.email} onChange={set("email")} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                Phone Number <span className="text-teal-400 text-[9px] font-sans font-normal">(Compulsory if no Name)</span>
              </label>
              <input id="new-lead-phone" type="text" placeholder="e.g. +91 99999 99999"
                value={form.phone} onChange={set("phone")}
                className={`${inputCls} focus:outline-none focus:ring-1 focus:ring-teal-500 ${isDuplicatePhone(form.phone) ? "border-amber-500/55 text-amber-300 bg-amber-500/5 focus:ring-amber-500" : ""}`} />
              {isDuplicatePhone(form.phone) && (
                <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1 font-sans font-medium">
                  <AlertCircle size={11} className="shrink-0" /> Number already registered in CRM.
                </p>
              )}
            </div>
          </div>

          {/* Source + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Lead Source</label>
              <select id="new-lead-source" value={form.source} onChange={set("source")}
                className={`${inputCls} cursor-pointer`}>
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
              <input id="new-lead-location" type="text" placeholder="e.g. Noida Sector 62, India (Optional)"
                value={form.location} onChange={set("location")} className={inputCls} />
            </div>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Lead Status</label>
              <select id="new-lead-status" value={form.status} onChange={set("status")}
                className={`${inputCls} cursor-pointer`}>
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
              <select id="new-lead-temperature" value={form.temperature} onChange={set("temperature")}
                className={`${inputCls} cursor-pointer`}>
                <option value="">(Select Priority)</option>
                <option value="Hot">🔥 Hot</option>
                <option value="Warm">☀️ Warm</option>
                <option value="Cold">❄️ Cold</option>
                <option value="Dead">🫙 Dead</option>
              </select>
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Budget</label>
              <input id="new-lead-budget" type="text" placeholder="e.g. ₹15.0 Cr (Optional)"
                value={form.budget} onChange={set("budget")} className={inputCls} />
            </div>
          </div>

          {/* Agent */}
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
              <input id="new-lead-agent" type="text" placeholder="Select or type agent name..."
                value={form.assignedAgent}
                onChange={(e) => { if (isAuthorizedToAssign) setForm(prev => ({ ...prev, assignedAgent: e.target.value })); }}
                disabled={!isAuthorizedToAssign}
                className={`w-full pr-10 px-3 py-2 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-teal-500
                  ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200"}
                  ${!isAuthorizedToAssign ? "opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-900" : ""}`} />
              {isAuthorizedToAssign && (
                <button type="button" onClick={() => setShowAgentDropdown(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:hover:text-slate-300 hover:text-slate-600">
                  <ChevronDown size={14} className={`transform transition-transform ${showAgentDropdown ? "rotate-180" : ""}`} />
                </button>
              )}
              {showAgentDropdown && isAuthorizedToAssign && (
                <div className={`absolute z-30 w-full mt-1 max-h-40 overflow-y-auto rounded-lg shadow-xl border text-xs divide-y
                  ${darkMode ? "bg-slate-900 border-slate-800 text-slate-200 divide-slate-800/50" : "bg-white border-slate-200 text-slate-800 divide-slate-100"}`}>
                  {finalAgents.map(agent => (
                    <button key={agent} type="button"
                      onClick={() => { setForm(prev => ({ ...prev, assignedAgent: agent })); setShowAgentDropdown(false); }}
                      className={`w-full px-3 py-2 text-left transition select-none ${darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100"}`}>
                      {agent}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!isAuthorizedToAssign && (
              <p className="text-[10px] text-slate-400 mt-1">Only administrators and team leaders can assign or change lead ownership.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Notes (Consultation Synopsis Brief)</label>
            <textarea id="new-lead-notes" rows={3} value={form.notes} onChange={set("notes")}
              placeholder="Record essential client demands and notes here..."
              className={inputCls} />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100/10">
            <button type="button" onClick={handleClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer
                ${darkMode ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-white" : "bg-slate-100 hover:bg-slate-150 border-slate-205"}`}>
              Cancel
            </button>
            <button type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer">
              Register Lead Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
