import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ----------------------------------------
// Mongoose / MongoDB Connection & Schema Setup
// ----------------------------------------
const rawMongoUri = process.env.MONGODB_URI;
const mongoUri = (rawMongoUri && (rawMongoUri.startsWith("mongodb://") || rawMongoUri.startsWith("mongodb+srv://")))
  ? rawMongoUri
  : "mongodb://localhost:27017/hostel_ai";
let isUsingMongo = false;

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  room_no: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["student", "admin"], default: "student" }
}, { timestamps: true });

const complaintSchema = new mongoose.Schema({
  complaint_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  student_name: { type: String, required: true },
  room_no: { type: String, required: true },
  complaint_text: { type: String, required: true },
  category: { type: String, required: true },
  priority: { type: String, enum: ["Red", "Orange", "Green"], required: true },
  priority_score: { type: Number, required: true },
  status: { type: String, enum: ["Pending", "In Progress", "Resolved"], default: "Pending" },
  explanation: { type: String },
  created_at: { type: String },
  updated_at: { type: String }
}, { timestamps: true });

const UserModel = (mongoose.models.User || mongoose.model("User", userSchema)) as any;
const ComplaintModel = (mongoose.models.Complaint || mongoose.model("Complaint", complaintSchema)) as any;

async function connectToMongo() {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000
    });
    isUsingMongo = true;
    console.log("[+] Successfully connected to MongoDB at:", mongoUri);
  } catch (err: any) {
    console.warn("[!] MongoDB Connection Failed (falling back to JSON database db.json):", err.message);
    isUsingMongo = false;
  }
}

// ----------------------------------------
// Persistent JSON Database Config (Fallback)
// ----------------------------------------
const DB_FILE = path.join(process.cwd(), "db.json");

interface DbSchema {
  users: any[];
  complaints: any[];
}

const DEFAULT_DB: DbSchema = {
  users: [],
  complaints: []
};

function readDb(): DbSchema {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading DB file, using default data.", err);
    return DEFAULT_DB;
  }
}

function writeDb(data: DbSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing DB file", err);
  }
}

// Ensure local JSON DB is initialized as fallback
readDb();

// ----------------------------------------
// Unified Database Abstraction Layer
// ----------------------------------------
async function findUserByEmail(email: string) {
  if (isUsingMongo) {
    try {
      return await UserModel.findOne({ email: { $regex: new RegExp(`^${email}$`, "i") } }).lean();
    } catch (e) {
      console.error("Mongoose findUserByEmail error:", e);
    }
  }
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

async function userEmailExists(email: string) {
  if (isUsingMongo) {
    try {
      const count = await UserModel.countDocuments({ email: { $regex: new RegExp(`^${email}$`, "i") } });
      return count > 0;
    } catch (e) {
      console.error("Mongoose userEmailExists error:", e);
    }
  }
  const db = readDb();
  return db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
}

async function createUser(userObj: any) {
  if (isUsingMongo) {
    try {
      const newUser = new UserModel(userObj);
      await newUser.save();
      return newUser.toObject();
    } catch (e) {
      console.error("Mongoose createUser error, falling back to JSON...", e);
    }
  }
  const db = readDb();
  db.users.push(userObj);
  writeDb(db);
  return userObj;
}

async function getComplaints(filter: { user_id?: string; role?: string; search?: string; priority?: string; status?: string }) {
  if (isUsingMongo) {
    try {
      const query: any = {};
      if (filter.role === "student" && filter.user_id) {
        query.user_id = filter.user_id;
      }
      if (filter.priority) {
        query.priority = filter.priority;
      }
      if (filter.status) {
        query.status = filter.status;
      }
      if (filter.search) {
        const q = filter.search;
        query.$or = [
          { complaint_id: { $regex: q, $options: "i" } },
          { complaint_text: { $regex: q, $options: "i" } },
          { student_name: { $regex: q, $options: "i" } },
          { room_no: { $regex: q, $options: "i" } }
        ];
      }
      return await ComplaintModel.find(query).sort({ priority_score: -1, createdAt: -1 }).lean();
    } catch (e) {
      console.error("Mongoose getComplaints error, falling back to JSON...", e);
    }
  }

  // Fallback
  const db = readDb();
  let list = db.complaints;

  if (filter.role === "student" && filter.user_id) {
    list = list.filter(c => c.user_id === filter.user_id);
  }

  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(c => 
      c.complaint_id.toLowerCase().includes(q) ||
      c.complaint_text.toLowerCase().includes(q) ||
      c.student_name.toLowerCase().includes(q) ||
      c.room_no.toLowerCase().includes(q)
    );
  }

  if (filter.priority) {
    list = list.filter(c => c.priority === filter.priority);
  }

  if (filter.status) {
    list = list.filter(c => c.status === filter.status);
  }

  list.sort((a, b) => {
    if (b.priority_score !== a.priority_score) {
      return b.priority_score - a.priority_score;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return list;
}

async function createComplaint(complaintObj: any) {
  if (isUsingMongo) {
    try {
      const newComplaint = new ComplaintModel(complaintObj);
      await newComplaint.save();
      return newComplaint.toObject();
    } catch (e) {
      console.error("Mongoose createComplaint error, falling back to JSON...", e);
    }
  }
  const db = readDb();
  db.complaints.push(complaintObj);
  writeDb(db);
  return complaintObj;
}

async function updateComplaintStatus(complaint_id: string, status: string) {
  const updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
  if (isUsingMongo) {
    try {
      const updated = await ComplaintModel.findOneAndUpdate(
        { complaint_id },
        { status, updated_at },
        { new: true }
      ).lean();
      return updated;
    } catch (e) {
      console.error("Mongoose updateComplaintStatus error, falling back to JSON...", e);
    }
  }
  const db = readDb();
  const complaint = db.complaints.find(c => c.complaint_id === complaint_id);
  if (complaint) {
    complaint.status = status;
    complaint.updated_at = updated_at;
    writeDb(db);
    return complaint;
  }
  return null;
}

async function getAnalyticsData() {
  if (isUsingMongo) {
    try {
      const complaints = await ComplaintModel.find({}).lean();
      const total = complaints.length;
      const pending = complaints.filter((c: any) => c.status === "Pending").length;
      const in_progress = complaints.filter((c: any) => c.status === "In Progress").length;
      const resolved = complaints.filter((c: any) => c.status === "Resolved").length;
      const red = complaints.filter((c: any) => c.priority === "Red").length;
      const orange = complaints.filter((c: any) => c.priority === "Orange").length;
      const green = complaints.filter((c: any) => c.priority === "Green").length;

      return { total, pending, in_progress, resolved, red, orange, green };
    } catch (e) {
      console.error("Mongoose getAnalyticsData error, falling back to JSON...", e);
    }
  }

  const db = readDb();
  const complaints = db.complaints;
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === "Pending").length;
  const in_progress = complaints.filter(c => c.status === "In Progress").length;
  const resolved = complaints.filter(c => c.status === "Resolved").length;
  const red = complaints.filter(c => c.priority === "Red").length;
  const orange = complaints.filter(c => c.priority === "Orange").length;
  const green = complaints.filter(c => c.priority === "Green").length;

  return { total, pending, in_progress, resolved, red, orange, green };
}

// ----------------------------------------
// Gemini AI & Local NLP Rules Configuration
// ----------------------------------------
const hasGeminiKey = !!process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (hasGeminiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    console.log("[+] Gemini AI SDK initialized successfully.");
  } catch (err) {
    console.error("[-] Failed to initialize Gemini client, falling back to local NLP.", err);
  }
} else {
  console.log("[-] GEMINI_API_KEY environment variable is not defined. Using local NLP rule-based classifier.");
}

// Local NLP Keyword Dictionaries
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Electricity: ["electricity", "fan", "light", "bulb", "socket", "plug", "switch", "power", "fuse", "wire", "geyser", "shock", "spark", "transformer", "tripped", "short circuit"],
  Water: ["water", "leak", "leakage", "tap", "washroom", "toilet", "flush", "basin", "overflow", "plumber", "sewage", "pipe", "geyser", "supply", "hot water"],
  WiFi: ["wifi", "internet", "network", "router", "connection", "disconnected", "speed", "slow", "signal", "login", "portal", "ethernet"],
  Cleanliness: ["clean", "dirty", "sweep", "dust", "cleaning", "trash", "garbage", "smell", "odor", "insect", "cockroach", "mosquito", "bug", "washroom", "waste"],
  Mess: ["food", "mess", "dinner", "lunch", "breakfast", "meal", "catering", "insect in food", "water filter", "taste", "kitchen"],
  Furniture: ["chair", "table", "bed", "cupboard", "desk", "hinges", "wardrobe", "curtain", "broken chair", "wood", "furniture"],
  Security: ["security", "theft", "guard", "gate", "lock", "stray", "dog", "stranger", "outsider", "fire", "smoke", "cctv", "camera", "intruder", "alarm"]
};

const RED_KEYWORDS = [
  "fire", "short circuit", "spark", "electric shock", "intruder", 
  "stranger in hostel", "stray dog inside", "water supply completely stopped", 
  "no electricity", "transformer exploded", "theft", "smoke detector ringing"
];

const ORANGE_KEYWORDS = [
  "leakage", "wifi not working", "bathroom overflow", "internet down",
  "no hot water", "dirty washroom", "slow speed"
];

function localNlpAnalyze(text: string) {
  const textLower = text.toLowerCase();
  
  // 1. Predict Category
  let bestCategory = "Others";
  let maxScore = 0;
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (textLower.includes(kw) ? 1 : 0), 0);
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  // 2. Predict Priority & Score
  let priority: "Red" | "Orange" | "Green" = "Green";
  let score = 1;

  if (RED_KEYWORDS.some(kw => textLower.includes(kw))) {
    priority = "Red";
    score = 3;
  } else if (ORANGE_KEYWORDS.some(kw => textLower.includes(kw))) {
    priority = "Orange";
    score = 2;
  }

  return {
    category: bestCategory,
    priority,
    priority_score: score,
    explanation: "Auto-classified using localized keyword-matching NLP rules."
  };
}

async function runAiClassification(text: string) {
  if (!ai) {
    return localNlpAnalyze(text);
  }

  try {
    const prompt = `Analyze this hostel complaint text: "${text}". 
Classify it into one of these categories: [Electricity, Water, WiFi, Cleanliness, Mess, Furniture, Security, Others].
Classify its severity priority into one of: [Red, Orange, Green]. 
- Red represents emergency utility failures or safety hazards (e.g., spark, complete outage, fire).
- Orange represents major inconveniences (e.g., leak, wifi down, plumbing overflow).
- Green represents minor repairs or aesthetic issues (e.g., broken chair, loose handle).

Provide your classification strictly in JSON format.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            priority: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["category", "priority", "explanation"]
        }
      }
    });

    const resultText = response.text?.trim() || "";
    const parsed = JSON.parse(resultText);

    // Normalize values
    let category = parsed.category;
    if (!["Electricity", "Water", "WiFi", "Cleanliness", "Mess", "Furniture", "Security", "Others"].includes(category)) {
      category = localNlpAnalyze(text).category;
    }

    let priority: "Red" | "Orange" | "Green" = "Green";
    if (parsed.priority === "Red" || parsed.priority === "High") priority = "Red";
    else if (parsed.priority === "Orange" || parsed.priority === "Medium") priority = "Orange";

    let priority_score = 1;
    if (priority === "Red") priority_score = 3;
    else if (priority === "Orange") priority_score = 2;

    return {
      category,
      priority,
      priority_score,
      explanation: parsed.explanation || "Analyzed using Gemini AI LLM model."
    };
  } catch (err) {
    console.error("[!] Gemini API classification error, falling back to local NLP.", err);
    return localNlpAnalyze(text);
  }
}

// ----------------------------------------
// Authentication API Endpoints
// ----------------------------------------
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);

  if (user && user.password === password) {
    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        room_no: user.room_no,
        role: user.role
      }
    });
  }
  res.status(401).json({ success: false, message: "Invalid email or password." });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, email, room_no, password, role } = req.body;
  
  const exists = await userEmailExists(email);
  if (exists) {
    return res.status(400).json({ success: false, message: "Institutional email already exists." });
  }

  const assignedRole = role === "admin" ? "admin" : "student";
  const newUser = {
    id: (assignedRole === "admin" ? "admin-" : "user-") + Math.random().toString(36).substring(2, 9),
    name,
    email,
    room_no: assignedRole === "admin" ? (room_no || "Warden Office") : room_no,
    password,
    role: assignedRole
  };

  await createUser(newUser);

  res.json({ success: true, user: newUser });
});

// ----------------------------------------
// Complaints Management API Endpoints
// ----------------------------------------
app.get("/api/complaints", async (req, res) => {
  const { user_id, role, search, priority, status } = req.query;
  const list = await getComplaints({
    user_id: user_id as string,
    role: role as string,
    search: search as string,
    priority: priority as string,
    status: status as string
  });
  res.json(list);
});

app.post("/api/complaints/submit", async (req, res) => {
  const { user_id, student_name, room_no, complaint_text } = req.body;
  
  if (!complaint_text || complaint_text.trim() === "") {
    return res.status(400).json({ error: "Complaint text cannot be empty." });
  }

  // AI Classification Run
  const aiResult = await runAiClassification(complaint_text);

  const prefix = aiResult.category.substring(0, 1).toUpperCase();
  const randNum = Math.floor(100 + Math.random() * 900);
  const complaint_id = `${prefix}-${randNum}`;

  const newComplaint = {
    complaint_id,
    user_id,
    student_name,
    room_no,
    complaint_text,
    category: aiResult.category,
    priority: aiResult.priority,
    priority_score: aiResult.priority_score,
    status: "Pending",
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
    explanation: aiResult.explanation
  };

  await createComplaint(newComplaint);

  res.json({ success: true, complaint: newComplaint });
});

app.post("/api/complaints/update-status", async (req, res) => {
  const { complaint_id, status } = req.body;
  const updated = await updateComplaintStatus(complaint_id, status);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Complaint not found." });
  }
  res.json({ success: true, complaint: updated });
});

app.get("/api/analytics", async (req, res) => {
  const stats = await getAnalyticsData();
  res.json(stats);
});

// ----------------------------------------
// Front-end Asset Serving & Vite Setup
// ----------------------------------------
async function startServer() {
  // Connect to MongoDB first
  await connectToMongo();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[+] Application server running on http://localhost:${PORT}`);
  });
}

startServer();
