import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { PRESET_USERS } from "./data";
import { Lead, LeadSource, LeadStatus, LeadTemperature, User as CRMUser } from "./types";

// Initialize Firebase App securely (avoiding duplicate initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets scope (in addition to standard profiles/emails)
provider.addScope("https://www.googleapis.com/auth/spreadsheets.readonly");

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize state listener to restore auth state
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google to fetch spreadsheet-access permissions
export const googleSheetsSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google Sheets access credential delegation from authentication callback.");
    }
    cachedAccessToken = credential.accessToken;
    // Persist token in session cache
    sessionStorage.setItem("google_sheets_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: any) {
    console.error("Google sheets login exception:", err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

// Retrieve current cached Google token
export const getCachedGoogleToken = (): string | null => {
  if (!cachedAccessToken) {
    cachedAccessToken = sessionStorage.getItem("google_sheets_token");
  }
  return cachedAccessToken;
};

// Sign out from Google Session
export const googleSheetsSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  sessionStorage.removeItem("google_sheets_token");
};

// Parse spreadsheet URL to extract spreadsheet ID
export function extractSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return "";
  const clean = urlOrId.trim();
  // Format matching: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return clean; // If it's already just the spreadsheet ID
}

// Simple CSV Parser to decode public Google Spreadsheet exports
function parseCSV(csvText: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1] || "";

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal.trim());
      lines.push(row);
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (row.length > 0 || currentVal) {
    row.push(currentVal.trim());
    lines.push(row);
  }
  return lines;
}

// REST Interface callback to fetch values from Google Sheet
export async function fetchGoogleSheetValues(
  spreadsheetId: string,
  range: string,
  accessToken?: string | null
): Promise<any[][]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  let sheetName = range || "Sheet1";
  if (sheetName.includes("!")) {
    sheetName = sheetName.split("!")[0];
  }

  const tryApiCall = async () => {
    if (!accessToken) {
      throw new Error("No Google access token provided/available");
    }
    const cleanRange = encodeURIComponent(range || "Sheet1!A1:Z100");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${cleanRange}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorDetails = await response.json().catch(() => ({}));
      throw new Error(errorDetails?.error?.message || `HTTP ${response.status} Request Rejected`);
    }

    const result = await response.json();
    return result.values || [];
  };

  const tryPublicCsvCall = async () => {
    let response;
    let fallbackToDirect = false;
    try {
      const url = `/api/proxy-sheet-csv?spreadsheetId=${cleanId}&sheet=${encodeURIComponent(sheetName)}`;
      response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          fallbackToDirect = true;
        } else {
          const errorDetails = await response.json().catch(() => ({}));
          throw new Error(errorDetails?.error || `Public export server proxy rejected with status ${response.status}`);
        }
      }
    } catch (err) {
      fallbackToDirect = true;
    }

    if (fallbackToDirect) {
      console.log(`[Google Sheets Direct Fallback] Backend proxy returned 404 or failed. Attempting direct browser CSV pull from Google Sheets.`);
      const directUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/export?format=csv` + 
        (sheetName ? `&sheet=${encodeURIComponent(String(sheetName))}` : "");
      try {
        const directRes = await fetch(directUrl);
        if (!directRes.ok) {
          throw new Error(`Google Sheets export returned status ${directRes.status}. Please make sure 'Anyone with the link can view' is enabled in Google Spreadsheet Share settings.`);
        }
        const csvText = await directRes.text();
        return parseCSV(csvText);
      } catch (directErr: any) {
        throw new Error(`Direct Google Sheets fetch failed: ${directErr.message || String(directErr)}. Web-host returned HTTP 404 (Node server is bypassed or disabled on static hosting).`);
      }
    }

    const csvText = await response!.text();
    return parseCSV(csvText);
  };

  if (accessToken) {
    try {
      return await tryApiCall();
    } catch (apiErr: any) {
      console.warn("[Google Sheets API Failed, trying public CSV exporter fallback...]", apiErr);
      try {
        return await tryPublicCsvCall();
      } catch (csvErr: any) {
        throw new Error(`${apiErr.message || String(apiErr)}. Fallback also failed: ${csvErr.message}`);
      }
    }
  } else {
    // No access token present: attempt public spreadsheet export instantly
    return await tryPublicCsvCall();
  }
}

// Fuzzy header match helper
function findHeaderIndex(headers: string[], syns: string[]): number {
  if (!headers || headers.length === 0) return -1;
  const normalizedHeaders = headers.map(h => h ? String(h).trim().toLowerCase().replace(/[\s_-]/g, "") : "");
  
  // Pass 1: Try exact match (after normalization)
  for (const syn of syns) {
    const normSyn = syn.toLowerCase().replace(/[\s_-]/g, "");
    const idx = normalizedHeaders.findIndex(h => h === normSyn);
    if (idx !== -1) return idx;
  }
  
  // Pass 2: Try partial match where the header contains the synonym symbol as a keyword
  // (e.g. header is "project name" or "physical location", synonym is "project" or "location")
  for (const syn of syns) {
    const normSyn = syn.toLowerCase().replace(/[\s_-]/g, "");
    if (!normSyn) continue;
    
    const idx = normalizedHeaders.findIndex(h => {
      if (!h) return false;
      // The header h must contain the synonym, and h must be at least as long as syn
      // to avoid matching a shorter header to a longer synonym (e.g., matching header "name" to synonym "projectname")
      return h.includes(normSyn) && h.length >= normSyn.length;
    });
    if (idx !== -1) return idx;
  }
  
  return -1;
}

// Convert dynamic spreadsheet rows to CRM Leads
export function mapSpreadsheetRowsToLeads(
  rows: any[][],
  systemUsers?: CRMUser[]
): Omit<Lead, "id" | "dateCreated" | "dateUpdated">[] {
  if (rows.length < 2) return [];

  // Extract first row as headers and normalize
  const rawHeaders = rows[0].map((h: any) => String(h || "").trim());
  const headerClean = rawHeaders.map(h => h.toLowerCase());

  // Find column array mappings
  const nameIdx = findHeaderIndex(rawHeaders, ["name", "leadname", "client", "customer", "prospect"]);
  const emailIdx = findHeaderIndex(rawHeaders, ["email", "emailaddress", "mail", "contactemail"]);
  const phoneIdx = findHeaderIndex(rawHeaders, ["phone", "phonenumber", "contact", "mobile", "tel"]);
  const companyIdx = findHeaderIndex(rawHeaders, ["company", "organization", "org", "firm"]);
  const positionIdx = findHeaderIndex(rawHeaders, ["position", "designation", "title", "role"]);
  const sourceIdx = findHeaderIndex(rawHeaders, ["source", "leadsource", "channel", "origin"]);
  const budgetIdx = findHeaderIndex(rawHeaders, ["budget", "investment", "price", "limit"]);
  const locationIdx = findHeaderIndex(rawHeaders, ["location", "city", "address", "state"]);
  const notesIdx = findHeaderIndex(rawHeaders, ["notes", "comments", "remarks", "description", "details"]);
  const projectIdx = findHeaderIndex(rawHeaders, ["project", "projectname", "property", "projectName"]);
  const statusIdx = findHeaderIndex(rawHeaders, ["status", "leadstatus", "stage"]);
  const tempIdx = findHeaderIndex(rawHeaders, ["temperature", "temp", "rating", "priority"]);
  const agentIdx = findHeaderIndex(rawHeaders, ["assignagent", "assignedagent", "agent", "salesperson", "advisor", "sales", "assignedagentname", "namename"]);

  const resultLeads: Omit<Lead, "id" | "dateCreated" | "dateUpdated">[] = [];

  // Process rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0) continue;

    // Must have at least a Name and either Email or Phone to register a valid Lead
    const name = nameIdx !== -1 ? String(row[nameIdx] || "").trim() : "";
    if (!name) continue; // Skip rows without name

    const email = emailIdx !== -1 ? String(row[emailIdx] || "").trim() : "";
    const phone = phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : "";

    // Normalize Source
    let source: LeadSource = "Website";
    if (sourceIdx !== -1) {
      const parsedSrc = String(row[sourceIdx] || "").trim().toLowerCase();
      if (parsedSrc.includes("meta") || parsedSrc.includes("facebook") || parsedSrc.includes("instagram")) {
        source = "Meta Ad";
      } else if (parsedSrc.includes("google") || parsedSrc.includes("search")) {
        source = "Google Ad";
      } else if (parsedSrc.includes("board")) {
        source = "IVR Board";
      } else if (parsedSrc.includes("ivr")) {
        source = "IVR";
      } else if (parsedSrc.includes("reference") || parsedSrc.includes("friend")) {
        source = "Reference";
      } else if (parsedSrc.includes("social") || parsedSrc.includes("linkedin")) {
        source = "Social Media";
      } else if (parsedSrc.includes("personal")) {
        source = "Personal";
      } else if (parsedSrc.includes("cold")) {
        source = "Cold Call";
      } else {
        source = "Website"; // Defaults to Website as a CRM compliance fallback
      }
    }

    // Normalize Status
    let status: LeadStatus = "New Lead";
    if (statusIdx !== -1) {
      const parsedStatus = String(row[statusIdx] || "").trim().toLowerCase();
      if (parsedStatus.includes("new lead") || parsedStatus.includes("newlead")) status = "New Lead";
      else if (parsedStatus.includes("interested")) status = "Interested";
      else if (parsedStatus.includes("follow")) status = "Follow Up";
      else if (parsedStatus.includes("share") || parsedStatus.includes("detail")) status = "Detailed Share";
      else if (parsedStatus.includes("not interested")) status = "Not Interested";
      else if (parsedStatus.includes("closed client") || parsedStatus.includes("closed") || parsedStatus.includes("client closed")) status = "Closed Client";
      else if (parsedStatus.includes("meeting")) status = "Meeting Done";
      else if (parsedStatus.includes("visit") || parsedStatus.includes("site")) status = "Site Visit";
      else if (parsedStatus.includes("callback")) status = "Call Back";
      else if (parsedStatus.includes("junk") || parsedStatus.includes("spam")) status = "Junk";
      else if (parsedStatus.includes("not pick") || parsedStatus.includes("no pick") || parsedStatus.includes("notpick") || parsedStatus.includes("nopick")) status = "Not Pick";
      else if (parsedStatus.includes("duplicate")) status = "Duplicate";
      else if (parsedStatus.includes("switched off") || parsedStatus.includes("switchedoff") || parsedStatus.includes("switch off")) status = "Switched Off";
      else if (parsedStatus.includes("low budget") || parsedStatus.includes("lowbudget")) status = "Low Budget";
    }

    // Normalize Temperature
    let temperature: LeadTemperature = "Warm";
    if (tempIdx !== -1) {
      const parsedTemp = String(row[tempIdx] || "").trim().toLowerCase();
      if (parsedTemp.includes("hot")) temperature = "Hot";
      else if (parsedTemp.includes("cold")) temperature = "Cold";
      else if (parsedTemp.includes("dead")) temperature = "Dead";
    }

    const company = companyIdx !== -1 ? String(row[companyIdx] || "").trim() : "";
    const position = positionIdx !== -1 ? String(row[positionIdx] || "").trim() : "";
    const budget = budgetIdx !== -1 ? String(row[budgetIdx] || "").trim() : "";
    const location = locationIdx !== -1 ? String(row[locationIdx] || "").trim() : "";
    const notes = notesIdx !== -1 ? String(row[notesIdx] || "").trim() : "Ingested from Google Sheets pipeline.";
    const projectName = projectIdx !== -1 ? String(row[projectIdx] || "").trim() : "";

    // Stop automatically assigning leads to assignee members. All new ingested leads default to "Pending Assignment" for manual allocation.
    let assignedAgent = "Pending Assignment";
    const lastCommunication = new Date().toISOString().split("T")[0];

    resultLeads.push({
      name,
      company,
      position,
      email,
      phone,
      source,
      status,
      temperature,
      budget,
      location,
      assignedAgent,
      notes,
      projectName,
      lastCommunication,
      score: 50 // default intake score
    });
  }

  return resultLeads;
}

export function isDuplicateLead(
  newLead: { name: string; email?: string; phone?: string },
  existingLeads: any[]
): boolean {
  const getDigits = (p?: string) => {
    if (!p) return "";
    let digits = p.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.substring(2);
    }
    if (digits.length === 11 && digits.startsWith("0")) {
      return digits.substring(1);
    }
    // Clean any prefix 91 if the remaining part is 10 digits
    if (digits.length > 10 && digits.startsWith("91")) {
      return digits.substring(2);
    }
    // Clean prefix 0 if remaining part is 10 digits
    if (digits.length > 10 && digits.startsWith("0")) {
      return digits.substring(1);
    }
    return digits;
  };

  const getCleanEmail = (e?: string) => {
    if (!e) return "";
    const clean = e.toLowerCase().trim();
    if (
      clean === "n/a" ||
      clean === "noemail" ||
      clean === "not available" ||
      clean === "none" ||
      clean === "null" ||
      clean.includes("example.com")
    ) {
      return "";
    }
    return clean;
  };

  const getCleanName = (n: string) => {
    return (n || "").toLowerCase().replace(/\s+/g, " ").trim();
  };

  const nlName = getCleanName(newLead.name);
  const nlEmail = getCleanEmail(newLead.email);
  const nlPhone = getDigits(newLead.phone);

  const isGenericNameValue = (nameStr: string) => {
    const clean = nameStr.toLowerCase().trim();
    const generic = ["n/a", "na", "none", "anonymous", "prospect", "temp", "unknown", "customer", "client", "-", ".", "(n/a)"];
    return generic.includes(clean) || clean.startsWith("prospect") || !clean;
  };

  // If there is no name, email, and phone at all, treat it as an empty target to avoid garbage intake
  if (!nlName && !nlEmail && !nlPhone) {
    return true; 
  }

  return existingLeads.some(l => {
    const lName = getCleanName(l.name);
    const lEmail = getCleanEmail(l.email);
    const lPhone = getDigits(l.phone);

    // 1. If valid phone numbers match, they are duplicates
    if (nlPhone && lPhone && nlPhone.length >= 7 && lPhone.length >= 7) {
      if (nlPhone === lPhone || nlPhone.endsWith(lPhone) || lPhone.endsWith(nlPhone)) {
        return true;
      }
      // Fail-safe comparison of the last 10 digits (highly robust for Indian mobile configurations)
      const nlLast10 = nlPhone.length >= 10 ? nlPhone.substring(nlPhone.length - 10) : "";
      const lLast10 = lPhone.length >= 10 ? lPhone.substring(lPhone.length - 10) : "";
      if (nlLast10 && lLast10 && nlLast10 === lLast10) {
        return true;
      }
    }

    // 2. If valid emails match, they are duplicates
    if (nlEmail && lEmail) {
      if (nlEmail === lEmail) {
        return true;
      }
    }

    // 3. Name-based matching (only if name is not generic or a placeholder):
    if (nlName && lName && nlName === lName && !isGenericNameValue(nlName) && !isGenericNameValue(lName)) {
      return true;
    }

    return false;
  });
}

