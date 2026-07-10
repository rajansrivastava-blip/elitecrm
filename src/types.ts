export type UserRole = 'super_admin' | 'admin' | 'sales_team' | 'team_leader';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string;
  department: string;
  password?: string;
  teamLeaderId?: string; // ID of the team leader
  active?: boolean;
}

export type LeadSource = 
  | 'Meta Ad' 
  | 'Google Ad' 
  | 'IVR Board' 
  | 'IVR' 
  | 'Reference' 
  | 'Website' 
  | 'Social Media' 
  | 'Personal' 
  | 'Cold Call';

export type LeadStatus = 
  | 'Interested' 
  | 'Follow Up' 
  | 'Detailed Share' 
  | 'Not Interested' 
  | 'Meeting Done' 
  | 'Site Visit' 
  | 'Call Back' 
  | 'Junk' 
  | 'Duplicate'
  | 'Not Pick'
  | 'New Lead'
  | 'Closed Client'
  | 'Switched Off'
  | 'Low Budget';

export type LeadTemperature = 'Hot' | 'Warm' | 'Cold' | 'Dead';

export interface Lead {
  id: string;
  name: string; // Customer Name
  company?: string; // Optional Company name (if applicable)
  position?: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  temperature: LeadTemperature;
  budget: string;
  location: string;
  assignedAgent: string; // Assign To
  notes: string;
  projectName?: string; // Optional Project Name
  dateCreated: string;
  dateUpdated: string;
  lastCommunication: string;
  score?: number; // Priority rating (1-100)
  assignmentTimestamp?: number;
  assignedTlId?: string;
  lastActionTimestamp?: number;
  reassignedTimestamp?: number;
  createdById?: string;
  createdByUserRole?: string;
}

export type AppointmentType = 'meeting' | 'site_visit' | 'call' | 'followup';

export interface Appointment {
  id: string;
  leadId?: string;
  leadName?: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: AppointmentType;
  notes: string;
  isCompleted: boolean;
  reminderActive: boolean;
}

export interface CommunicationLog {
  id: string;
  leadId: string;
  date: string;
  type: 'email' | 'call' | 'meeting' | 'site_visit' | 'proposal';
  content: string;
  sender: string;
}

export interface SalesStat {
  month: string;
  leadsAdded: number;
  dealsWon: number;
  revenue: number; // in Millions
  target: number; // in Millions
}

export interface LeadEditFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface LeadEditLog {
  id: string;
  leadId: string;
  leadName: string;
  editorName: string;
  editorRole: string;
  timestamp: string;
  changes: LeadEditFieldChange[];
}

export interface AppNotification {
  id: string;
  recipientName: string; // User's name assigned to
  title: string;
  message: string;
  leadId?: string;
  leadName?: string;
  source?: string;
  timestamp: string;
  isRead: boolean;
  type: 'assignment' | 'manual' | 'sync' | 'update';
}

