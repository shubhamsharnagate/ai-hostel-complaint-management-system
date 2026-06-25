import React, { useState, useEffect } from "react";
import { 
  Zap, 
  Droplets, 
  Wifi, 
  Sparkles, 
  ShieldAlert, 
  Trash2, 
  Armchair, 
  FileText, 
  LayoutDashboard, 
  Plus, 
  LogOut, 
  LogIn,
  Search, 
  Filter, 
  RefreshCw, 
  User, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Menu,
  X,
  BookOpen,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User as UserType, Complaint, DashboardStats } from "./types";

export default function App() {
  // ----------------------------------------
  // State Management
  // ----------------------------------------
  const [user, setUser] = useState<UserType | null>(() => {
    const stored = localStorage.getItem("hostel_user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        return null;
      }
    }
    return null;
  });
  const [authTab, setAuthTab] = useState<"login" | "register" | "admin_register">("login");
  const [currentView, setCurrentView] = useState<"dashboard" | "submit" | "history" | "admin" | "auth">(() => {
    const stored = localStorage.getItem("hostel_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.role === "admin" ? "admin" : "dashboard";
      } catch (err) {
        return "dashboard";
      }
    }
    return "dashboard";
  });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Auth Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerRoom, setRegisterRoom] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [adminPasskey, setAdminPasskey] = useState("");
  const [adminDesignation, setAdminDesignation] = useState("Warden Office");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Complaint Submit Form State
  const [complaintText, setComplaintText] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filter & Search States (Admin & Student History)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Responsive Sidebar Menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live NLP Preview State
  const [nlpPreview, setNlpPreview] = useState<{
    category: string;
    priority: "Red" | "Orange" | "Green";
    score: number;
    desc: string;
  } | null>(null);

  // ----------------------------------------
  // Bootstrapping / Initialization
  // ----------------------------------------
  useEffect(() => {
    // Check if user is stored in local storage
    const stored = localStorage.getItem("hostel_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.role === "admin") {
          setCurrentView("admin");
        } else {
          setCurrentView("dashboard");
        }
      } catch (err) {
        console.error("Failed to parse stored auth user");
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [user, currentView, searchQuery, filterPriority, filterStatus]);

  // ----------------------------------------
  // Live NLP Preview Engine
  // ----------------------------------------
  useEffect(() => {
    const text = complaintText.toLowerCase();
    if (!text.trim()) {
      setNlpPreview(null);
      return;
    }

    const redKeywords = ["fire", "electricity", "shock", "spark", "short circuit", "power cut", "outsider", "stray dog", "theft", "danger", "blackout"];
    const orangeKeywords = ["leakage", "wifi", "internet", "clogged", "dirty toilet", "not working", "speed", "slow"];

    let predictedCategory = "Others";
    let priority: "Red" | "Orange" | "Green" = "Green";
    let score = 1;
    let desc = "Minor maintenance task. Automatically scheduled for standard maintenance rotation.";

    // Simple keyword categorization
    const categories: Record<string, string[]> = {
      Electricity: ["electricity", "fan", "light", "bulb", "socket", "plug", "switch", "power", "fuse", "wire", "geyser", "shock", "spark", "transformer", "tripped", "short circuit", "blackout"],
      Water: ["water", "leak", "leakage", "tap", "washroom", "toilet", "flush", "basin", "overflow", "plumber", "sewage", "pipe", "supply", "hot water"],
      WiFi: ["wifi", "internet", "network", "router", "connection", "disconnected", "speed", "slow", "signal", "login", "portal", "ethernet"],
      Cleanliness: ["clean", "dirty", "sweep", "dust", "cleaning", "trash", "garbage", "smell", "odor", "insect", "cockroach", "mosquito", "bug", "waste"],
      Mess: ["food", "mess", "dinner", "lunch", "breakfast", "meal", "catering", "insect in food", "water filter", "taste", "kitchen"],
      Furniture: ["chair", "table", "bed", "cupboard", "desk", "hinges", "wardrobe", "curtain", "wood", "furniture"],
      Security: ["security", "theft", "guard", "gate", "lock", "stray", "dog", "stranger", "outsider", "fire", "smoke", "cctv", "camera", "intruder", "alarm"]
    };

    let maxScore = 0;
    for (const [cat, keywords] of Object.entries(categories)) {
      const matchCount = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
      if (matchCount > maxScore) {
        maxScore = matchCount;
        predictedCategory = cat;
      }
    }

    if (redKeywords.some(kw => text.includes(kw))) {
      priority = "Red";
      score = 3;
      desc = "Critical hazard or complete outage. AI has flagged this for immediate escalation & warden alert.";
    } else if (orangeKeywords.some(kw => text.includes(kw))) {
      priority = "Orange";
      score = 2;
      desc = "Moderate disruption. Scheduled for same-day quick repair queue.";
    }

    setNlpPreview({
      category: predictedCategory,
      priority,
      score,
      desc
    });

  }, [complaintText]);

  // ----------------------------------------
  // API Core Methods
  // ----------------------------------------
  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (user) {
        params.append("user_id", user.id);
        params.append("role", user.role);
      }
      if (searchQuery) params.append("search", searchQuery);
      if (filterPriority) params.append("priority", filterPriority);
      if (filterStatus) params.append("status", filterStatus);

      const [complaintsRes, statsRes] = await Promise.all([
        fetch(`/api/complaints?${params.toString()}`),
        fetch("/api/analytics")
      ]);

      if (complaintsRes.ok) {
        const data = await complaintsRes.json();
        setComplaints(data);
      }
      if (statsRes.ok) {
        const statData = await statsRes.json();
        setStats(statData);
      }
    } catch (err) {
      console.error("Error loading system metrics", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("hostel_user", JSON.stringify(data.user));
        setUser(data.user);
        if (data.user.role === "admin") {
          setCurrentView("admin");
        } else {
          setCurrentView("dashboard");
        }
      } else {
        setAuthError(data.message || "Invalid credentials.");
      }
    } catch (err) {
      setAuthError("Failed to connect to authentication server.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    const is_admin = authTab === "admin_register";

    if (is_admin) {
      if (!registerName || !registerEmail || !registerPassword || !adminPasskey) {
        setAuthError("Please fill out all admin registration fields.");
        return;
      }
      if (adminPasskey !== "ADMIN123") {
        setAuthError("Invalid Admin Passkey. (Hint: Use 'ADMIN123')");
        return;
      }
    } else {
      if (!registerName || !registerEmail || !registerRoom || !registerPassword) {
        setAuthError("Please fill out all institutional registry fields.");
        return;
      }
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          room_no: is_admin ? adminDesignation : registerRoom,
          password: registerPassword,
          role: is_admin ? "admin" : "student"
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthSuccess(`${is_admin ? "Admin" : "Student"} account created! Please log in.`);
        setAuthTab("login");
        setLoginEmail(registerEmail);
        setLoginPassword(registerPassword);
        // Clear registration fields
        setRegisterName("");
        setRegisterEmail("");
        setRegisterRoom("");
        setRegisterPassword("");
        setAdminPasskey("");
      } else {
        setAuthError(data.message || "Registration failed.");
      }
    } catch (err) {
      setAuthError("Server communication failure.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("hostel_user");
    setUser(null);
    setCurrentView("dashboard");
    setMobileMenuOpen(false);
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) {
      setErrorMsg("Complaint explanation details cannot be blank.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/complaints/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
          student_name: user?.name,
          room_no: user?.room_no,
          complaint_text: complaintText
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Complaint successfully registered under #${data.complaint.complaint_id}!`);
        setComplaintText("");
        setTimeout(() => {
          setCurrentView("history");
        }, 1500);
      } else {
        setErrorMsg("Failed to lodge complaint. Please retry.");
      }
    } catch (err) {
      setErrorMsg("Failed to communicate with AI Classification Core.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (complaintId: string, newStatus: "Pending" | "In Progress" | "Resolved") => {
    try {
      const res = await fetch("/api/complaints/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint_id: complaintId, status: newStatus })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Status update broadcast failed", err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Electricity":
        return <Zap className="w-4 h-4 text-amber-500" />;
      case "Water":
        return <Droplets className="w-4 h-4 text-blue-500" />;
      case "WiFi":
        return <Wifi className="w-4 h-4 text-indigo-500" />;
      case "Cleanliness":
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case "Mess":
        return <BookOpen className="w-4 h-4 text-orange-500" />;
      case "Furniture":
        return <Armchair className="w-4 h-4 text-amber-700" />;
      case "Security":
        return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  // ----------------------------------------
  // Render Authentication Screen
  // ----------------------------------------
  const renderAuthScreen = () => {
    return (
      <div className="flex flex-col justify-center items-center py-6 w-full">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Hostel AI System</h1>
            <p className="text-sm text-slate-400">Institutional Maintenance & Dispatch Queue</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-lg mb-6 gap-1">
            <button
              onClick={() => { setAuthTab("login"); setAuthError(""); setAuthSuccess(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                authTab === "login" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthTab("register"); setAuthError(""); setAuthSuccess(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                authTab === "register" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Student Register
            </button>
            <button
              onClick={() => { setAuthTab("admin_register"); setAuthError(""); setAuthSuccess(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                authTab === "admin_register" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              Admin Register
            </button>
          </div>

          {authError && (
            <div className="bg-rose-950/50 border border-rose-800/80 text-rose-300 p-3 rounded-lg text-sm mb-4">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 p-3 rounded-lg text-sm mb-4">
              {authSuccess}
            </div>
          )}

          {authTab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Institutional Email Address
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="name@college.edu"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-lg py-3 text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                Access Account
              </button>
            </form>
          )}

          {authTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. rahul@student.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Hostel Block & Room No.
                </label>
                <input
                  type="text"
                  value={registerRoom}
                  onChange={(e) => setRegisterRoom(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. A-304"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-lg py-3 text-sm transition-all"
              >
                Create Student Account
              </button>
            </form>
          )}

          {authTab === "admin_register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Warden / Admin Full Name
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. Dr. Alok Ranjan"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. warden@college.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Warden Designation / Office No.
                </label>
                <input
                  type="text"
                  value={adminDesignation}
                  onChange={(e) => setAdminDesignation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="e.g. Chief Warden Office, Block-A"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                  <span>Secret Warden Passkey</span>
                </label>
                <input
                  type="password"
                  value={adminPasskey}
                  onChange={(e) => setAdminPasskey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all"
                  placeholder="Enter Passkey"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-lg py-3 text-sm transition-all shadow-lg shadow-indigo-600/20"
              >
                Create Admin Account
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------
  // Render Application Dashboard Layout
  // ----------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-64 bg-slate-900 text-white flex flex-col p-6 flex-shrink-0 z-30 transition-all ${
        mobileMenuOpen ? "fixed inset-0" : "hidden md:flex"
      }`}>
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 font-bold text-xl">🏢 Hostel AI</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          {user ? (
            user.role === "admin" ? (
              <button
                onClick={() => { setCurrentView("admin"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  currentView === "admin" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                System Overview
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setCurrentView("dashboard"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                    currentView === "dashboard" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Home Dashboard
                </button>
                <button
                  onClick={() => { setCurrentView("submit"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                    currentView === "submit" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Submit Complaint
                </button>
                <button
                  onClick={() => { setCurrentView("history"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                    currentView === "history" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  History & Tracking
                </button>
              </>
            )
          ) : (
            <>
              <button
                onClick={() => { setCurrentView("dashboard"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  currentView === "dashboard" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Home Dashboard
              </button>
              <button
                onClick={() => { setCurrentView("auth"); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  currentView === "auth" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <LogIn className="w-4 h-4" />
                Sign In / Register
              </button>
            </>
          )}
        </nav>

        <div className="pt-4 border-t border-slate-800 mt-auto">
          {user ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-950 flex justify-center items-center text-indigo-300 font-bold border border-indigo-800/50">
                  {user.name ? user.name[0] : "U"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[120px]">{user.name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user.role} {user.role === "student" && `(Rm ${user.room_no})`}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-rose-950/30 hover:text-rose-400 border border-slate-700/80 rounded-lg py-2.5 text-xs font-semibold text-slate-300 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 text-center">Are you an institutional resident?</p>
              <button
                onClick={() => { setCurrentView("auth"); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/10"
              >
                <LogIn className="w-3.5 h-3.5" />
                Access Portal
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800">
          <span className="font-bold text-lg text-indigo-400">🏢 Hostel AI</span>
          <button onClick={() => setMobileMenuOpen(true)} className="text-slate-400 hover:text-white">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {currentView === "dashboard" && (user ? "Student Dashboard" : "Institutional Maintenance Portal")}
                {currentView === "submit" && "Lodge Maintenance Complaint"}
                {currentView === "history" && "Complaint Tracking Logs"}
                {currentView === "admin" && "Hostel Administration Panel"}
                {currentView === "auth" && "Account Portal Access"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {currentView === "dashboard" && (user ? "Real-time summary of your registered service tickets." : "Lodge maintenance requests and track live resolution updates.")}
                {currentView === "submit" && "Describe your issue. AI categorizes and scales resolution dispatch priority."}
                {currentView === "history" && "Track live status updates and resolution stages."}
                {currentView === "admin" && "Manage prioritized AI-sorted complaints and updates."}
                {currentView === "auth" && "Sign in or register an institutional student or admin account."}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                System Active
              </span>
              <button 
                onClick={fetchData}
                className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm rounded-lg hover:shadow transition-all"
                title="Force refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ----------------------------------------
              STUDENT DASHBOARD VIEW
          ---------------------------------------- */}
          {currentView === "dashboard" && (
            <div className="space-y-8">
              {/* Stats bento layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Lodged</p>
                    <h3 className="text-3xl font-bold text-slate-900">{stats?.total ?? 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between border-l-4 border-l-orange-500">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Backlog</p>
                    <h3 className="text-3xl font-bold text-slate-900">{(stats?.pending ?? 0) + (stats?.in_progress ?? 0)}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resolved Tickets</p>
                    <h3 className="text-3xl font-bold text-slate-900">{stats?.resolved ?? 0}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Quick Action Bar */}
              <div className="bg-indigo-900/10 border border-indigo-900/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Experience our custom AI Classifier</h4>
                    <p className="text-sm text-slate-500">Submit descriptions in natural language and watch the NLP engine map priorities instantaneously.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!user) {
                      setAuthError("Please sign in or register to lodge a complaint.");
                      setCurrentView("auth");
                    } else {
                      setCurrentView("submit");
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Lodge Complaint
                </button>
              </div>

              {/* Recent Entries */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  {user ? "Your Recent Actions" : "Recent Public Complaints Feed"}
                </h3>
                
                {complaints.length > 0 ? (
                  <div className="space-y-4">
                    {complaints.slice(0, 3).map((item) => (
                      <div 
                        key={item.complaint_id} 
                        className={`bg-white border border-slate-200 hover:shadow rounded-xl p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${
                          item.priority === "Red" ? "border-l-rose-500" : item.priority === "Orange" ? "border-l-amber-500" : "border-l-emerald-500"
                        }`}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              #{item.complaint_id}
                            </span>
                            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                              {getCategoryIcon(item.category)}
                              {item.category}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              item.priority === "Red" ? "bg-rose-50 text-rose-700" : item.priority === "Orange" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {item.priority} Priority
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium line-clamp-2">{item.complaint_text}</p>
                          <div className="text-xs text-slate-400">
                            Logged At: {item.created_at}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:flex-col sm:items-end justify-between border-t sm:border-none pt-3 sm:pt-0 border-slate-100">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === "Pending" ? "bg-amber-100 text-amber-700" : item.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="text-center pt-2">
                      <button 
                        onClick={() => {
                          if (!user) {
                            setAuthError("Please sign in or register to view details.");
                            setCurrentView("auth");
                          } else {
                            setCurrentView("history");
                          }
                        }} 
                        className="text-indigo-600 hover:text-indigo-500 font-bold text-sm transition-all"
                      >
                        {user ? "View Entire Tracking History →" : "Sign In to View Tracking History →"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                    <h4 className="text-slate-600 font-semibold mb-2">No complaints filed yet</h4>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">Whenever you experience water leakage, internet cuts, power trippings, or furniture brokenness, use our portal to register it.</p>
                    <button
                      onClick={() => {
                        if (!user) {
                          setAuthError("Please sign in or register to lodge a complaint.");
                          setCurrentView("auth");
                        } else {
                          setCurrentView("submit");
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    >
                      {user ? "Lodge First Ticket" : "Sign In to Lodge Complaint"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------
              STUDENT COMPLAINT FORM VIEW
          ---------------------------------------- */}
          {currentView === "submit" && (
            !user ? (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Sign In Required</h3>
                <p className="text-sm text-slate-500 mb-6">You must be logged in as a student to lodge maintenance complaints.</p>
                <button
                  onClick={() => setCurrentView("auth")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
                >
                  Go to Sign In
                </button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-white border border-slate-200 shadow-sm rounded-xl p-6 md:p-8">
              
              <form onSubmit={handleSubmitComplaint} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Describe your issue in detail
                  </label>
                  <textarea
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-4 text-sm text-slate-900 outline-none transition-all resize-none h-40"
                    placeholder="Describe specific problems (e.g. WiFi router in corridor B is flashing red and speed is zero, or water geyser in ground floor shower is sparking when switched on...)"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-2 flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>Provide clear indicators (e.g., "power failure", "water leakage", "broken desk"). The NLP engine classifies parameters dynamically as you type.</span>
                  </p>
                </div>

                {/* Animated NLP Live AI Preview Box */}
                <AnimatePresence>
                  {nlpPreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Live AI Prediction Preview
                        </span>
                        <div className="flex gap-2">
                          <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                            {getCategoryIcon(nlpPreview.category)}
                            {nlpPreview.category}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            nlpPreview.priority === "Red" ? "bg-rose-50 text-rose-700" : nlpPreview.priority === "Orange" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            {nlpPreview.priority} Priority
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{nlpPreview.desc}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {errorMsg && (
                  <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm border border-rose-100">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm border border-emerald-100">
                    {successMsg}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white font-semibold rounded-lg py-3 text-sm transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {submitting ? "Analyzing..." : "⚡ Submit AI Complaint"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setComplaintText(""); setCurrentView("dashboard"); }}
                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>

            </div>
            )
          )}

          {/* ----------------------------------------
              STUDENT COMPLAINT HISTORY VIEW
          ---------------------------------------- */}
          {currentView === "history" && (
            !user ? (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-bounce" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Sign In Required</h3>
                <p className="text-sm text-slate-500 mb-6">Please sign in to track and view your detailed tracking logs history.</p>
                <button
                  onClick={() => setCurrentView("auth")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
                >
                  Go to Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-6">
              {complaints.length > 0 ? (
                <div className="space-y-4">
                  {complaints.map((item) => (
                    <div 
                      key={item.complaint_id} 
                      className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 ${
                        item.priority === "Red" ? "border-l-rose-500" : item.priority === "Orange" ? "border-l-amber-500" : "border-l-emerald-500"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded">
                              #{item.complaint_id}
                            </span>
                            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                              {getCategoryIcon(item.category)}
                              {item.category}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              item.priority === "Red" ? "bg-rose-50 text-rose-700" : item.priority === "Orange" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                            }`}>
                              {item.priority} Priority
                            </span>
                          </div>
                          
                          <p className="text-sm text-slate-700 font-medium">{item.complaint_text}</p>
                          
                          {/* Explanation of classification */}
                          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-500 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                            <span><strong>AI Verdict:</strong> {item.explanation || "Classified using predictive rules."}</span>
                          </div>

                          <div className="flex gap-4 text-xs text-slate-400 pt-1">
                            <span>Logged: <strong>{item.created_at}</strong></span>
                            <span>Last Updated: <strong>{item.updated_at}</strong></span>
                          </div>
                        </div>

                        <div className="flex md:flex-col md:items-end justify-between border-t md:border-none pt-3 md:pt-0 border-slate-100">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            item.status === "Pending" ? "bg-amber-100 text-amber-700" : item.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <h4 className="text-slate-600 font-semibold mb-2">No complaints lodged</h4>
                  <p className="text-slate-400 text-sm mb-6">You don't have any complaints registered in our database currently.</p>
                  <button
                    onClick={() => setCurrentView("submit")}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  >
                    Lodge First Ticket
                  </button>
                </div>
              )}
            </div>
            )
          )}

          {/* ----------------------------------------
              ADMIN (WARDEN) VIEW
          ---------------------------------------- */}
          {currentView === "admin" && (
            (!user || user.role !== "admin") ? (
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-950 mb-2">Access Denied</h3>
                <p className="text-sm text-slate-500 mb-6">Warden / Administrator privileges are required to view this panel.</p>
                <button
                  onClick={() => {
                    setAuthTab("login");
                    setCurrentView("auth");
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-all"
                >
                  Warden Log In
                </button>
              </div>
            ) : (
              <div className="space-y-8">
              {/* Analytics grid */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.total ?? 0}</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-amber-500">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pending</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.pending ?? 0}</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-blue-500">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">In Progress</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.in_progress ?? 0}</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-emerald-500">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Resolved</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.resolved ?? 0}</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-rose-500">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">🔴 Red</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.red ?? 0}</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm border-l-4 border-l-amber-600">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">🟠 Orange</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats?.orange ?? 0}</h3>
                </div>
              </div>

              {/* Filters panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search complaint ID, text description, student name..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-sm text-slate-900 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="flex-1 md:flex-none px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-sm outline-none cursor-pointer"
                  >
                    <option value="">All Priorities</option>
                    <option value="Red">🔴 High (Red)</option>
                    <option value="Orange">🟠 Medium (Orange)</option>
                    <option value="Green">🟢 Low (Green)</option>
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 md:flex-none px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-lg text-sm outline-none cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>

                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setFilterPriority("");
                      setFilterStatus("");
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-all"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Complaints dispatch list */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900">⚡ AI Priority Dispatch Queue</h3>
                  <span className="text-xs text-slate-500 italic">*Sorted dynamically by ML Priority level</span>
                </div>

                {complaints.length > 0 ? (
                  <div className="space-y-4">
                    {complaints.map((item) => (
                      <div 
                        key={item.complaint_id} 
                        className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm border-l-4 ${
                          item.priority === "Red" ? "border-l-rose-500" : item.priority === "Orange" ? "border-l-amber-500" : "border-l-emerald-500"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded">
                                #{item.complaint_id}
                              </span>
                              <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                                {getCategoryIcon(item.category)}
                                {item.category}
                              </span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                item.priority === "Red" ? "bg-rose-50 text-rose-700" : item.priority === "Orange" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                              }`}>
                                {item.priority} Priority
                              </span>
                              <span className="text-xs text-slate-400">
                                Student: <strong>{item.student_name}</strong> (Room {item.room_no})
                              </span>
                            </div>
                            
                            <p className="text-sm text-slate-700 font-medium bg-slate-50 border border-slate-100 p-3 rounded-lg leading-relaxed">{item.complaint_text}</p>
                            
                            {/* Explanation of classification */}
                            {item.explanation && (
                              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                <span><strong>AI Engine Analysis:</strong> {item.explanation}</span>
                              </p>
                            )}

                            <div className="flex gap-4 text-xs text-slate-400 pt-1">
                              <span>Lodged: {item.created_at}</span>
                              <span>Last Update: {item.updated_at}</span>
                            </div>
                          </div>

                          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between border-t lg:border-none pt-4 lg:pt-0 border-slate-100 gap-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              item.status === "Pending" ? "bg-amber-100 text-amber-700" : item.status === "In Progress" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {item.status}
                            </span>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:block">Action:</label>
                              <select
                                value={item.status}
                                onChange={(e) => handleUpdateStatus(item.complaint_id, e.target.value as any)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer transition-all"
                              >
                                <option value="Pending">Mark Pending</option>
                                <option value="In Progress">Mark In Progress</option>
                                <option value="Resolved">Mark Resolved</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                    <h4 className="text-slate-600 font-semibold mb-2">No complaints matched search criteria</h4>
                    <p className="text-slate-400 text-sm">Reset filters to view active maintenance pipeline queue.</p>
                  </div>
                )}
              </div>
            </div>
            )
          )}

          {currentView === "auth" && (
            <div className="max-w-md mx-auto">
              {renderAuthScreen()}
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
