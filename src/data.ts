import { Lead, Appointment, CommunicationLog, SalesStat, User } from "./types";

export const PRESET_USERS: User[] = [
  {
    id: "user-super-admin",
    name: "Viren Mehta",
    email: "viren@eliteproinfra.com",
    phone: "+919999999999",
    role: "super_admin",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    department: "Executive Board",
    password: "superadmin123"
  },
  {
    id: "user-admin",
    name: "Admin",
    email: "rajan.srivastava@eliteproinfra.com",
    phone: "+919876543210",
    role: "admin",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    department: "Operations Management",
    password: "admin123"
  },
  
  // -- TEAM 1: Ricky Matharu --
  {
    id: "tl-ricky",
    name: "Ricky Matharu",
    email: "ricky.matharu@eliteproinfra.com",
    phone: "+919876543211",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-kaushal",
    name: "Kaushal Midha",
    email: "kaushal.midha@eliteproinfra.com",
    phone: "+919876543212",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-kunal",
    name: "Kunal Wadhwa",
    email: "kunal.wadhwa@eliteproinfra.com",
    phone: "+919876543213",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-khushboo",
    name: "Khushboo Kapoor",
    email: "khushboo.kapoor@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-rohit",
    name: "Rohit Yadav",
    email: "rohit.yadav@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-mahesh",
    name: "Mahesh Kumar",
    email: "mahesh.kumar@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-yogesh-singh",
    name: "Yogesh Kumar Singh",
    email: "yogesh.singh@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-ritika",
    name: "Ritika Ojha",
    email: "ritika.ojha@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-ricky",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 2: Prabhjot Singh --
  {
    id: "tl-prabhjot",
    name: "Prabhjot Singh",
    email: "prabhjot.singh@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-argho",
    name: "Argho",
    email: "argho@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-jeevak",
    name: "Jeevak Raina",
    email: "jeevak.raina@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-dharmendra",
    name: "Dharmendra Singh",
    email: "dharmendra.singh@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-tejasvi",
    name: "Tejasvi Yadav",
    email: "tejasvi.yadav@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-harsh",
    name: "Harsh Malik",
    email: "harsh.malik@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-yaman",
    name: "Yaman Tewatia",
    email: "yaman.tewatia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-harpal",
    name: "Harpal Prajapat",
    email: "harpal.prajapat@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-suhavani",
    name: "Suhavani Alhuwalia",
    email: "suhavani.alhuwalia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-prabhjot",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 3: Shammy Verma --
  {
    id: "tl-shammy",
    name: "Shammy Verma",
    email: "shammy.verma@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-ankit",
    name: "Ankit Ghudayia",
    email: "ankit.ghudayia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-shammy",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-deepanshu",
    name: "Deepanshu Garg",
    email: "deepanshu.garg@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-shammy",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-pratham",
    name: "Pratham Agarwal",
    email: "pratham.agarwal@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-shammy",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 4: Sanjeev Mehta / Haarish Khan --
  {
    id: "tl-sanjeev-haarish",
    name: "Sanjeev Mehta / Haarish Khan",
    email: "sanjeev.haarish@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-tanuj",
    name: "Tanuj Makkar",
    email: "tanuj.makkar@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-sanjeev-haarish",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-govind",
    name: "Govind",
    email: "govind@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-sanjeev-haarish",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-gautam",
    name: "Gautam",
    email: "gautam@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-sanjeev-haarish",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 5: Vinay Grewal --
  {
    id: "tl-vinay",
    name: "Vinay Grewal",
    email: "vinay.grewal@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-yogesh-kumar",
    name: "Yogesh Kumar",
    email: "yogesh.kumar@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-dhiraj",
    name: "Dhiraj Kumar",
    email: "dhiraj.kumar@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-mehar",
    name: "Mehar Singh Tewatia",
    email: "mehar.tewatia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-pankaj",
    name: "Pankaj Tewatia",
    email: "pankaj.tewatia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-manoj",
    name: "Manoj Kumar",
    email: "manoj.kumar@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-amit",
    name: "Amit Sisodiya",
    email: "amit.sisodiya@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-dharmender",
    name: "Dharmender Dhariwal",
    email: "dharmender.dhariwal@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-vikas",
    name: "Vikas Tewatia",
    email: "vikas.tewatia@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-garima",
    name: "Garima Madan Sharma",
    email: "garima.sharma@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vinay",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 6: Vishal Laller/Yuvansh Kapoor --
  {
    id: "tl-vishal-yuvansh",
    name: "Vishal Laller/Yuvansh Kapoor",
    email: "vishal.yuvansh@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-jagdish",
    name: "Jagdish Sharma",
    email: "jagdish.sharma@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-vishal-yuvansh",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- TEAM 7: Pardeep Sharma --
  {
    id: "tl-pardeep",
    name: "Pardeep Sharma",
    email: "pardeep.sharma@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "sales-yashveer",
    name: "Yashveer Singh",
    email: "yashveer.singh@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-pardeep",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },
  {
    id: "sales-nishant",
    name: "Nishant Singh",
    email: "nishant.singh@eliteproinfra.com",
    role: "sales_team",
    teamLeaderId: "tl-pardeep",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Commercial Realty Sales",
    password: "password123"
  },

  // -- ADDITIONAL INDEPENDENT TEAM LEADERS --
  {
    id: "tl-chirag",
    name: "Chirag Mehta",
    email: "chirag.mehta@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-pawan",
    name: "Pawan Tanwar",
    email: "pawan.tanwar@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-dev",
    name: "Dev Verma",
    email: "dev.verma@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-sourav",
    name: "Sourav Tulli",
    email: "sourav.tulli@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-sahil",
    name: "Sahil Arora",
    email: "sahil.arora@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-pratibha",
    name: "Pratibha Pawa",
    email: "pratibha.pawa@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  },
  {
    id: "tl-karan",
    name: "Karan Rana",
    email: "karan.rana@eliteproinfra.com",
    role: "team_leader",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
    department: "Sales Team Leader",
    password: "password123"
  }
];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_COMMUNICATION_LOGS: CommunicationLog[] = [];

export const SALES_METRICS_HISTORY: SalesStat[] = [
  { month: "Jan", leadsAdded: 0, dealsWon: 0, revenue: 0, target: 40.0 },
  { month: "Feb", leadsAdded: 0, dealsWon: 0, revenue: 0, target: 40.0 },
  { month: "Mar", leadsAdded: 0, dealsWon: 0, revenue: 0, target: 64.0 },
  { month: "Apr", leadsAdded: 0, dealsWon: 0, revenue: 0, target: 80.0 },
  { month: "May", leadsAdded: 0, dealsWon: 0, revenue: 0, target: 96.0 },
];
