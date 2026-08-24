// Hostel Mess & Shift Manager - Web Application Logic
// Complete state management, Multi-Role RBAC (Admin, Manager, Resident, Cook), 
// Real-time Expense Ledger & 3-Step Auto-Accounting (No fake dummy data)

const CLEAN_INITIAL_STATE = {
  currentUser: {
    id: "usr_admin",
    name: "Super Admin",
    mobile: "9876543210",
    role: "ADMIN",
    assignedRoom: "Admin Office",
    userIdCode: "ADM_001",
    status: "ACTIVE",
    currentShift: "OFF_DUTY"
  },
  users: [
    {
      id: "usr_admin",
      name: "Super Admin",
      mobile: "9876543210",
      role: "ADMIN",
      assignedRoom: "Admin Office",
      userIdCode: "ADM_001",
      status: "ACTIVE",
      currentShift: "OFF_DUTY"
    }
  ],
  attendanceLog: [], // Real Attendance & OT Log
  meals: [],
  pendingLeaves: [],
  expensesLog: [], // Real actual expenses ledger
  roomRentPerPerson: 1500,
  activeKitchenMeal: "LUNCH",
  selectedOtHours: 2,
  selectedRoleFilter: "ALL",
  selectedExpenseCategoryFilter: "ALL",
  selectedAttendanceDateFilter: "ALL",
  selectedAttendanceUserFilter: "ALL",
  selectedAttendanceTypeFilter: "ALL"
};

// Load or initialize state from LocalStorage
let state = (function() {
  try {
    const saved = localStorage.getItem("hostel_mess_state_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure arrays exist
      if (!parsed.attendanceLog) parsed.attendanceLog = [];
      if (!parsed.expensesLog) parsed.expensesLog = [];
      if (!parsed.users || parsed.users.length === 0) parsed.users = CLEAN_INITIAL_STATE.users;
      if (!parsed.selectedAttendanceDateFilter) parsed.selectedAttendanceDateFilter = "ALL";
      if (!parsed.selectedAttendanceUserFilter) parsed.selectedAttendanceUserFilter = "ALL";
      if (!parsed.selectedAttendanceTypeFilter) parsed.selectedAttendanceTypeFilter = "ALL";
      return parsed;
    }
  } catch (e) {
    console.error("State parse error:", e);
  }
  return JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
})();

// Helper to find active user by mobile number
function findUserByMobile(mobile, excludeUserId = null) {
  if (!mobile) return null;
  const cleanMobile = String(mobile).trim().replace(/\D/g, "");
  if (!cleanMobile) return null;
  return (state.users || []).find(u => {
    if (u.status === "DELETED") return false;
    if (excludeUserId && u.id === excludeUserId) return false;
    const uMob = String(u.mobile || "").trim().replace(/\D/g, "");
    return uMob && uMob === cleanMobile;
  });
}

// Check if currently authenticated user has authorization to onboard new employees/residents
function isAuthorizedToOnboardUsers() {
  const currentUser = state.currentUser || state.users[0];
  return currentUser && (currentUser.role === "ADMIN" || currentUser.role === "MANAGER");
}

// Strict Role Limits (Max 1 Admin, Max 3 Manager, Unlimited Employees)
const ROLE_LIMITS = {
  ADMIN: 1,
  MANAGER: 3,
  RESIDENT: Infinity,
  EMPLOYEE: Infinity,
  COOK: Infinity
};

function getRoleCount(role) {
  const normRole = (role === "EMPLOYEE") ? "RESIDENT" : role;
  return (state.users || []).filter(u => {
    const uRole = (u.role === "EMPLOYEE") ? "RESIDENT" : u.role;
    return uRole === normRole && u.status !== "DELETED";
  }).length;
}

function checkRoleQuotaAvailable(targetRole, currentUserId = null) {
  const normRole = (targetRole === "EMPLOYEE") ? "RESIDENT" : targetRole;
  const limit = ROLE_LIMITS[normRole] || Infinity;
  if (limit === Infinity) return { allowed: true };

  // If editing an existing user and their role isn't changing, quota doesn't increase
  if (currentUserId) {
    const existing = (state.users || []).find(u => u.id === currentUserId);
    if (existing) {
      const existingNormRole = (existing.role === "EMPLOYEE") ? "RESIDENT" : existing.role;
      if (existingNormRole === normRole) {
        return { allowed: true };
      }
    }
  }

  const currentCount = getRoleCount(normRole);
  if (currentCount >= limit) {
    const roleName = normRole === "ADMIN" ? "Super Admin" : "Hostel Manager";
    return {
      allowed: false,
      message: `🚫 Registration Blocked: Maximum ${limit} ${roleName} account${limit === 1 ? '' : 's'} allowed in the system. Currently registered: ${currentCount}/${limit}.\n\nPlease select Resident/Employee (Unlimited) or another available role.`
    };
  }
  return { allowed: true };
}

function updateRoleQuotaUI() {
  const adminCount = getRoleCount("ADMIN");
  const mgrCount = getRoleCount("MANAGER");
  const resCount = getRoleCount("RESIDENT");

  const quotaBox = document.getElementById("role-quota-info-box");
  if (quotaBox) {
    quotaBox.innerHTML = `🛡️ <strong>System Role Quotas:</strong> Super Admin: <b>${adminCount}/1</b> ${adminCount >= 1 ? '(FULL 🔒)' : ''} • Hostel Manager: <b>${mgrCount}/3</b> ${mgrCount >= 3 ? '(FULL 🔒)' : ''} • Employees: <b>${resCount} (Unlimited)</b>`;
  }

  const roleSelect = document.getElementById("form-user-role");
  if (roleSelect) {
    Array.from(roleSelect.options).forEach(opt => {
      if (opt.value === "ADMIN") {
        opt.textContent = `Super Admin (व्यवस्थापक - Max 1 | Current: ${adminCount}/1 ${adminCount >= 1 ? '🔒 Full' : '✓ Available'})`;
      } else if (opt.value === "MANAGER") {
        opt.textContent = `Hostel Manager (प्रबंधक - Max 3 | Current: ${mgrCount}/3 ${mgrCount >= 3 ? '🔒 Full' : '✓ Available'})`;
      } else if (opt.value === "RESIDENT") {
        opt.textContent = `Hostel Resident / Employee (रहवासी - Unlimited)`;
      } else if (opt.value === "COOK") {
        opt.textContent = `Kitchen Cook (रसोईया - Unlimited)`;
      }
    });
  }
}

// OTP Verification Service (Mock/Demo + Production Extensible Architecture)
const OtpAuthService = {
  activeSession: null,
  countdownInterval: null,

  generateOtp() {
    // Generate clean 4-digit code (e.g. 1234 demo or dynamic 4-digit)
    return Math.floor(1000 + Math.random() * 9000).toString();
  },

  sendOtp(userData) {
    const otp = this.generateOtp();
    this.activeSession = {
      userData: userData,
      otp: otp,
      phone: userData.mobile,
      generatedAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    };
    
    // PRODUCTION INTEGRATION HOOK:
    // When deploying to production with Firebase Auth Phone verification or SMS API (e.g., Fast2SMS/Twilio):
    // Example: sendSmsApi(userData.mobile, `Your Hostel Manager OTP is ${otp}. Valid for 5 mins.`);
    console.log(`[SMS Gateway Mock] Sent OTP ${otp} to +91 ${userData.mobile}`);
    return otp;
  },

  verify(inputOtp) {
    if (!this.activeSession) {
      return { success: false, message: "No active verification session found. Please request OTP again." };
    }
    if (Date.now() > this.activeSession.expiresAt) {
      return { success: false, message: "OTP has expired! Please request a new verification code." };
    }
    this.activeSession.attempts++;
    if (this.activeSession.attempts > 4) {
      this.activeSession = null;
      return { success: false, message: "Too many failed attempts. Please request a new OTP." };
    }
    // Accept either the dynamic generated code or standard testing code '1234'
    if (inputOtp.trim() === this.activeSession.otp || inputOtp.trim() === "1234") {
      const data = this.activeSession.userData;
      this.activeSession = null;
      return { success: true, userData: data };
    }
    return { success: false, message: "Invalid OTP code entered! For testing, use the simulated code or '1234'." };
  }
};

// ==========================================
// 1. FIREBASE CONFIGURATION & FIRESTORE REALTIME SYNC
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBmsF0FdATAAz3cRNHPJzAykO6FGOouHE",
  authDomain: "hostel-management-96f81.firebaseapp.com",
  projectId: "hostel-management-96f81",
  storageBucket: "hostel-management-96f81.firebasestorage.app",
  messagingSenderId: "952292948322",
  appId: "1:952292948322:web:ed54a71de1a647c887543b"
};

let db = null;
let auth = null;
let isFirebaseConnected = false;

function updateCloudSyncStatus(isOnline, message) {
  isFirebaseConnected = isOnline;
  const dot = document.getElementById("cloud-sync-dot");
  const text = document.getElementById("cloud-sync-text");
  const time = document.getElementById("cloud-sync-time");
  if (dot) {
    dot.className = isOnline ? "pulse-indicator" : "pulse-indicator offline";
  }
  if (text) {
    text.textContent = message || (isOnline ? "☁️ Firebase Firestore: Live Realtime Synced" : "⚠️ Local Storage Cache Active");
  }
  if (time) {
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

const FirebaseSyncService = {
  unsubscribers: [],

  init() {
    try {
      if (typeof firebase === "undefined") {
        console.warn("Firebase SDK not ready yet, retrying...");
        updateCloudSyncStatus(false, "⏳ Initializing Firebase Cloud...");
        setTimeout(() => this.init(), 1000);
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      auth = firebase.auth();

      // Enable offline persistence if supported
      try {
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
          if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
            console.warn("Firestore offline persistence info:", err.code);
          }
        });
      } catch (e) {}

      updateCloudSyncStatus(true, "☁️ Firebase Firestore: Live Cloud Sync Active");
      console.log("✓ Firebase Connected & Initialized:", firebaseConfig.projectId);

      this.setupListeners();
    } catch (e) {
      console.error("Firebase init failed:", e);
      updateCloudSyncStatus(false, "⚠️ Local Cache Mode (Firestore Sync Error)");
    }
  },

  setupListeners() {
    if (!db) return;

    // 1. Users Collection Listener
    const unsubUsers = db.collection("users").onSnapshot(snapshot => {
      if (snapshot.empty) {
        this.seedInitialSuperAdmin();
        return;
      }
      const cloudUsers = [];
      snapshot.forEach(doc => {
        cloudUsers.push({ id: doc.id, ...doc.data() });
      });
      state.users = cloudUsers;

      const currentId = state.currentUser ? state.currentUser.id : "usr_admin";
      const matched = state.users.find(u => u.id === currentId);
      if (matched) {
        state.currentUser = matched;
      } else if (state.users.length > 0) {
        state.currentUser = state.users[0];
      }

      saveLocalState();
      renderUI();
      updateRoleQuotaUI();
      updateCloudSyncStatus(true, "☁️ Cloud Synced • Users Updated");
    }, err => {
      console.error("Firestore users listen error:", err);
    });

    // 2. Attendance & OT Collection Listener
    const unsubAttendance = db.collection("attendance").onSnapshot(snapshot => {
      const cloudAttendance = [];
      snapshot.forEach(doc => {
        cloudAttendance.push({ id: doc.id, ...doc.data() });
      });
      state.attendanceLog = cloudAttendance;
      saveLocalState();
      renderUI();
      updateCloudSyncStatus(true, "☁️ Cloud Synced • Attendance Realtime");
    }, err => {
      console.error("Firestore attendance listen error:", err);
    });

    // 3. Expenses Ledger Collection Listener
    const unsubExpenses = db.collection("expenses").onSnapshot(snapshot => {
      const cloudExpenses = [];
      snapshot.forEach(doc => {
        cloudExpenses.push({ id: doc.id, ...doc.data() });
      });
      state.expensesLog = cloudExpenses;
      saveLocalState();
      renderUI();
      updateCloudSyncStatus(true, "☁️ Cloud Synced • Expense Ledger Live");
    }, err => {
      console.error("Firestore expenses listen error:", err);
    });

    // 4. Leaves Collection Listener
    const unsubLeaves = db.collection("leaves").onSnapshot(snapshot => {
      const cloudLeaves = [];
      snapshot.forEach(doc => {
        cloudLeaves.push({ id: doc.id, ...doc.data() });
      });
      state.pendingLeaves = cloudLeaves;
      saveLocalState();
      renderUI();
      updateCloudSyncStatus(true, "☁️ Cloud Synced • Leave Requests Live");
    }, err => {
      console.error("Firestore leaves listen error:", err);
    });

    // 5. Meals Collection Listener
    const unsubMeals = db.collection("meals").onSnapshot(snapshot => {
      const cloudMeals = [];
      snapshot.forEach(doc => {
        cloudMeals.push({ id: doc.id, ...doc.data() });
      });
      state.meals = cloudMeals;
      saveLocalState();
      renderUI();
    }, err => {
      console.error("Firestore meals listen error:", err);
    });

    // 6. Settings Document Listener
    const unsubSettings = db.collection("settings").doc("hostel_config").onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data && typeof data.roomRentPerPerson === "number") {
          state.roomRentPerPerson = data.roomRentPerPerson;
        }
        saveLocalState();
        renderUI();
      }
    }, err => {
      console.error("Firestore settings listen error:", err);
    });

    this.unsubscribers = [unsubUsers, unsubAttendance, unsubExpenses, unsubLeaves, unsubMeals, unsubSettings];
  },

  async seedInitialSuperAdmin() {
    if (!db) return;
    try {
      const adminUser = CLEAN_INITIAL_STATE.currentUser;
      await db.collection("users").doc(adminUser.id).set(adminUser, { merge: true });
      await db.collection("settings").doc("hostel_config").set({
        roomRentPerPerson: 1500,
        createdAt: Date.now()
      }, { merge: true });
      console.log("✓ Initial Super Admin seeded in Firestore!");
    } catch (e) {
      console.error("Error seeding initial data:", e);
    }
  },

  async saveUser(user) {
    if (!user || !user.id) return;
    if (db) {
      try {
        await db.collection("users").doc(user.id).set(user, { merge: true });
      } catch (err) {
        console.error("Firestore saveUser error:", err);
      }
    }
  },

  async deleteUser(userId) {
    if (!userId) return;
    if (db) {
      try {
        await db.collection("users").doc(userId).delete();
      } catch (err) {
        console.error("Firestore deleteUser error:", err);
      }
    }
  },

  async saveAttendance(record) {
    if (!record || !record.id) return;
    if (db) {
      try {
        await db.collection("attendance").doc(record.id).set(record, { merge: true });
      } catch (err) {
        console.error("Firestore saveAttendance error:", err);
      }
    }
  },

  async deleteAttendance(recordId) {
    if (!recordId) return;
    if (db) {
      try {
        await db.collection("attendance").doc(recordId).delete();
      } catch (err) {
        console.error("Firestore deleteAttendance error:", err);
      }
    }
  },

  async saveExpense(expense) {
    if (!expense || !expense.id) return;
    if (db) {
      try {
        await db.collection("expenses").doc(expense.id).set(expense, { merge: true });
      } catch (err) {
        console.error("Firestore saveExpense error:", err);
      }
    }
  },

  async deleteExpense(expenseId) {
    if (!expenseId) return;
    if (db) {
      try {
        await db.collection("expenses").doc(expenseId).delete();
      } catch (err) {
        console.error("Firestore deleteExpense error:", err);
      }
    }
  },

  async saveLeave(leave) {
    if (!leave || !leave.id) return;
    if (db) {
      try {
        await db.collection("leaves").doc(leave.id).set(leave, { merge: true });
      } catch (err) {
        console.error("Firestore saveLeave error:", err);
      }
    }
  },

  async deleteLeave(leaveId) {
    if (!leaveId) return;
    if (db) {
      try {
        await db.collection("leaves").doc(leaveId).delete();
      } catch (err) {
        console.error("Firestore deleteLeave error:", err);
      }
    }
  },

  async saveMeal(meal) {
    if (!meal || !meal.id) return;
    if (db) {
      try {
        await db.collection("meals").doc(meal.id).set(meal, { merge: true });
      } catch (err) {
        console.error("Firestore saveMeal error:", err);
      }
    }
  },

  async saveSettings(settings) {
    if (db) {
      try {
        await db.collection("settings").doc("hostel_config").set(settings, { merge: true });
      } catch (err) {
        console.error("Firestore saveSettings error:", err);
      }
    }
  }
};

// ==========================================
// 2. LIVE GPS GEOLOCATION ENGINE
// ==========================================
async function fetchCurrentGpsLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        available: false,
        latitude: null,
        longitude: null,
        accuracy: null,
        mapUrl: null,
        display: "GPS not supported on device",
        error: "NO_GEOLOCATION_SUPPORT"
      });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 12);
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const display = `${lat.toFixed(4)}°, ${lng.toFixed(4)}° (±${accuracy}m)`;

        resolve({
          available: true,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          mapUrl: mapUrl,
          display: display,
          timestamp: position.timestamp || Date.now()
        });
      },
      (error) => {
        console.warn("GPS Location fetch notice:", error.message);
        let errorReason = "Location permission denied";
        if (error.code === error.TIMEOUT) errorReason = "GPS Request Timed Out";
        else if (error.code === error.POSITION_UNAVAILABLE) errorReason = "Position Unavailable";

        resolve({
          available: false,
          latitude: null,
          longitude: null,
          accuracy: null,
          mapUrl: null,
          display: `📍 Location Unavailable (${errorReason})`,
          error: error.message
        });
      },
      options
    );
  });
}

// Local State & Persistence
function saveLocalState() {
  localStorage.setItem("hostel_mess_state_v2", JSON.stringify(state));
}

function saveState() {
  saveLocalState();
}

// Check if user is pending Super Admin approval
function isUserPendingApproval(user) {
  return user && user.status === "PENDING_APPROVAL";
}

// Master Super Admin: Approve User Registration
function approveUserRegistration(userId) {
  const current = state.currentUser || state.users[0];
  if (current.role !== "ADMIN") {
    alert("🔒 Access Denied: Only Master Super Admin has authority to approve new user registrations.");
    return;
  }

  const u = (state.users || []).find(x => x.id === userId);
  if (!u) return;

  u.status = "ACTIVE";
  u.approvedBy = current.name;
  u.approvedAt = Date.now();

  // Initialize meals for today if employee/resident
  if (u.role === "RESIDENT" || u.role === "EMPLOYEE") {
    const isAutoOn = u.currentShift === "OFF_DUTY" || u.currentShift === "NIGHT";
    ["LUNCH", "DINNER"].forEach(type => {
      const mealObj = {
        id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 5),
        userId: u.id,
        userName: u.name,
        roomNumber: u.assignedRoom || "101",
        mealType: type,
        status: isAutoOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: u.currentShift || "OFF_DUTY"
      };
      state.meals.push(mealObj);
      FirebaseSyncService.saveMeal(mealObj);
    });
  }

  FirebaseSyncService.saveUser(u);
  saveState();
  renderUI();
  alert(`✓ User Account Approved & Activated!\n\nUser "${u.name}" (+91 ${u.mobile}) is now ACTIVE in Firebase Cloud with role "${u.role}". They can now log in, punch duty shifts, and book hostel meals.`);
}

// Master Super Admin: Reject User Registration
function rejectUserRegistration(userId) {
  const current = state.currentUser || state.users[0];
  if (current.role !== "ADMIN") {
    alert("🔒 Access Denied: Only Master Super Admin has authority to reject registrations.");
    return;
  }

  const u = (state.users || []).find(x => x.id === userId);
  if (!u) return;

  if (confirm(`Reject and delete registration request for "${u.name}" (+91 ${u.mobile})?`)) {
    state.users = state.users.filter(x => x.id !== userId);
    FirebaseSyncService.deleteUser(userId);
    saveState();
    renderUI();
    alert(`✓ Registration request for "${u.name}" rejected and removed from Firebase.`);
  }
}

function getTodayString() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Attendance & Duty Hours (8h Standard Shift + OT) Calculation Helpers
function formatTimeAMPM(dateObj) {
  if (!dateObj) return "--:--";
  const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

function formatTimeShort(dateObj) {
  if (!dateObj) return "--:--";
  const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function calculateDutyShift(inTimestamp, outTimestamp) {
  const diffMs = outTimestamp - inTimestamp;
  const totalHours = Math.max(0, diffMs / (1000 * 60 * 60));
  const roundedTotal = Math.round(totalHours * 100) / 100;
  const regularHours = Math.min(roundedTotal, 8.00);
  const otHours = Math.max(0, Math.round((roundedTotal - 8.00) * 100) / 100);
  return {
    totalHours: roundedTotal,
    regularHours: regularHours,
    otHours: otHours
  };
}

function getActivePunch(userId) {
  return (state.attendanceLog || []).find(a => a.userId === userId && a.status === "ACTIVE");
}

function getTodayUserPunches(userId) {
  const today = getTodayString();
  return (state.attendanceLog || []).filter(a => a.userId === userId && a.date === today);
}

// Live Digital Clock & Real-time Duty Counter
function updateLiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  const clockTimeEl = document.getElementById("resident-clock-time");
  const clockDateEl = document.getElementById("resident-clock-date");
  if (clockTimeEl) clockTimeEl.textContent = timeStr;
  if (clockDateEl) clockDateEl.textContent = dateStr;

  // If currentUser has an active shift running, update live counter
  const user = state.currentUser || state.users[0];
  if (user) {
    const activePunch = getActivePunch(user.id);
    if (activePunch) {
      const calc = calculateDutyShift(activePunch.punchInTimestamp, now.getTime());
      const totalEl = document.getElementById("duty-total-hours");
      const otEl = document.getElementById("duty-ot-hours");
      if (totalEl) totalEl.textContent = `${calc.totalHours.toFixed(2)}h`;
      if (otEl) {
        otEl.textContent = `${calc.otHours.toFixed(2)}h OT`;
        otEl.style.color = calc.otHours > 0 ? "#F59E0B" : "#94A3B8";
      }
    }
  }
}
setInterval(updateLiveClock, 1000);

// Global Calculations from Real Expense Ledger & Meals (Strictly counts only APPROVED expenses)
function calculateExpenseTotals() {
  const totals = {
    GROCERY: 0,
    ELECTRICITY: 0,
    WATER: 0,
    COOK_SALARY: 0,
    MAINTENANCE: 0,
    OTHER: 0,
    grandTotal: 0
  };

  (state.expensesLog || []).forEach(exp => {
    // Zero Fraud Rule: Count only APPROVED expenses (or legacy entries with no status)
    if (exp.status && exp.status !== "APPROVED") return;

    const amt = parseFloat(exp.amount) || 0;
    if (totals[exp.category] !== undefined) {
      totals[exp.category] += amt;
    } else {
      totals.OTHER += amt;
    }
    totals.grandTotal += amt;
  });

  return totals;
}

function getTotalConsumedPlates() {
  const validMeals = (state.meals || []).filter(m => m.status === "ON" || m.status === "PACK_TIFFIN" || m.status === "LATE_COVERED");
  return validMeals.length;
}

function getDynamicPlateRate() {
  const expenses = calculateExpenseTotals();
  const totalPlates = getTotalConsumedPlates();
  if (totalPlates <= 0 || expenses.GROCERY <= 0) {
    return 0.00;
  }
  return Math.round((expenses.GROCERY / totalPlates) * 100) / 100;
}

// Navigation & Tab Switching with Clean URL & Hash Routing
const navBtns = document.querySelectorAll(".nav-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

const TAB_HASH_MAP = {
  "resident": "resident-tab",
  "kitchen": "kitchen-tab",
  "manager": "manager-tab",
  "expense": "expense-tab",
  "expenses": "expense-tab",
  "admin": "admin-tab"
};

const TAB_ID_TO_HASH = {
  "resident-tab": "resident",
  "kitchen-tab": "kitchen",
  "manager-tab": "manager",
  "expense-tab": "expense",
  "admin-tab": "admin"
};

function switchTab(targetTabId, updateUrlHash = true) {
  const targetEl = document.getElementById(targetTabId);
  if (!targetEl) return;

  navBtns.forEach(b => {
    if (b.getAttribute("data-tab") === targetTabId) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });

  tabPanes.forEach(p => {
    if (p.id === targetTabId) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });

  if (updateUrlHash && window.history && window.history.replaceState) {
    const slug = TAB_ID_TO_HASH[targetTabId] || "resident";
    const cleanPath = window.location.pathname.replace(/\/index\.html\/?$/, '/') || '/';
    window.history.replaceState(null, '', cleanPath + '#' + slug);
  }

  renderUI();
}

function handleUrlRouting() {
  // 1. Clean /index.html from URL path if present to keep clean root domain
  if (window.location.pathname.endsWith('/index.html')) {
    const cleanPath = window.location.pathname.replace(/\/index\.html\/?$/, '/') || '/';
    window.history.replaceState(null, '', cleanPath + window.location.search + window.location.hash);
  }

  // 2. Resolve target tab from hash
  const rawHash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (rawHash && TAB_HASH_MAP[rawHash]) {
    switchTab(TAB_HASH_MAP[rawHash], false);
  }
}

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    switchTab(targetTab, true);
  });
});

window.addEventListener("hashchange", () => {
  const rawHash = (window.location.hash || "").replace(/^#/, "").toLowerCase();
  if (rawHash && TAB_HASH_MAP[rawHash]) {
    switchTab(TAB_HASH_MAP[rawHash], false);
  }
});

// Primary UI Render Dispatcher
function renderUI() {
  renderHeader();
  renderResidentScreen();
  renderKitchenScreen();
  renderManagerScreen();
  renderExpenseScreen();
  renderAdminScreen();
}

// 1. Header Rendering
function renderHeader() {
  const user = state.currentUser || state.users[0];
  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
  
  document.getElementById("header-avatar").textContent = initials;
  document.getElementById("header-user-name").textContent = user.name;
  document.getElementById("header-user-role").textContent = `${user.role} • ${user.assignedRoom || 'Room Unassigned'}`;
  
  const roleBadge = document.getElementById("current-role-badge");
  if (roleBadge) {
    roleBadge.textContent = user.role;
    roleBadge.className = `role-pill ${user.role.toLowerCase()}`;
  }

  // Manage Nav Button Opacity & Lock Indicators based on user role
  const mgrBtn = document.getElementById("nav-manager-btn");
  const expBtn = document.getElementById("nav-expense-btn");
  const admBtn = document.getElementById("nav-admin-btn");

  if (user.role === "RESIDENT" || user.role === "EMPLOYEE") {
    if (mgrBtn) { mgrBtn.style.opacity = "0.5"; mgrBtn.title = "🔒 Manager Ops (Restricted)"; }
    if (expBtn) { expBtn.style.opacity = "0.9"; expBtn.title = "Expense View"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.title = "🔒 Super Admin (Restricted)"; }
  } else if (user.role === "MANAGER") {
    if (mgrBtn) { mgrBtn.style.opacity = "1"; mgrBtn.title = "Manager Operations"; }
    if (expBtn) { expBtn.style.opacity = "1"; expBtn.title = "Expense Ledger"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.title = "🔒 Super Admin (Restricted)"; }
  } else if (user.role === "ADMIN") {
    if (mgrBtn) { mgrBtn.style.opacity = "1"; mgrBtn.title = "Manager Operations"; }
    if (expBtn) { expBtn.style.opacity = "1"; expBtn.title = "Expense Ledger"; }
    if (admBtn) { admBtn.style.opacity = "1"; admBtn.title = "Super Admin Panel"; }
  } else if (user.role === "COOK") {
    if (mgrBtn) { mgrBtn.style.opacity = "0.5"; mgrBtn.title = "🔒 Manager Ops (Restricted)"; }
    if (expBtn) { expBtn.style.opacity = "0.7"; expBtn.title = "Expense View"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.title = "🔒 Super Admin (Restricted)"; }
  }
}

// Helper to check if a user is currently ON LEAVE
function isUserOnLeave(u) {
  const user = u || state.currentUser || state.users[0];
  return user && user.status === "ON_LEAVE";
}

// 2. Resident Screen Rendering (with Leave Lockout, Pending Approval & View-Only Mode)
function renderResidentScreen() {
  const user = state.currentUser || state.users[0];
  const onLeave = isUserOnLeave(user);
  const pendingApproval = isUserPendingApproval(user);

  // Dynamic Leave Lockout & Pending Approval Banner Container
  const lockoutContainer = document.getElementById("resident-leave-lockout-container");
  if (lockoutContainer) {
    if (pendingApproval) {
      lockoutContainer.innerHTML = `
        <div class="leave-lockout-banner" style="border-left: 4px solid #F59E0B; background: #FFFBEB;">
          <div class="leave-lockout-header">
            <span class="leave-lockout-icon">⏳</span>
            <div>
              <div class="leave-lockout-title" style="color:#92400E;">ACCOUNT REGISTRATION PENDING APPROVAL</div>
              <div class="badge badge-alert" style="margin-top:2px;">STATUS: AWAITING MASTER SUPER ADMIN</div>
            </div>
          </div>
          <p class="leave-lockout-desc" style="color:#78350F;">
            Welcome, <strong>${user.name}</strong> (+91 ${user.mobile})! Your account registration has been saved to Firebase Cloud.<br>
            The <strong>Master Super Admin</strong> must approve your registration before your live duty clock, meal booking, and hostel services are unlocked.
          </p>
        </div>
      `;
    } else if (onLeave) {
      lockoutContainer.innerHTML = `
        <div class="leave-lockout-banner">
          <div class="leave-lockout-header">
            <span class="leave-lockout-icon">🏖️</span>
            <div>
              <div class="leave-lockout-title">LEAVE LOCKOUT ACTIVE: VIEW-ONLY MODE</div>
              <div class="badge badge-leave" style="margin-top:2px;">STATUS: ON LEAVE (गाँव / छुट्टी पर)</div>
            </div>
          </div>
          <p class="leave-lockout-desc">
            आप वर्तमान में छुट्टी (On Leave) पर हैं। आपका <strong>Meal Booking (नाश्ता/दोपहर/रात का खाना)</strong>, <strong>Duty Attendance (Punch In/Out)</strong> और <strong>Shift Roster</strong> पूर्णतः लॉक/फ़्रीज़ है।
          </p>
          <div class="mt-3" style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn-resume-leave" id="btn-banner-resume-leave">
              🏡 Request Leave End / Return to Duty (गाँव से वापसी की अर्जी)
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-banner-add-purchase" style="background:#FFFFFF; color:#1E293B; font-weight:700;">
              🛒 Add Mess Purchase
            </button>
          </div>
        </div>
      `;
      // Wire banner action buttons
      document.getElementById("btn-banner-resume-leave")?.addEventListener("click", () => {
        document.getElementById("leave-end-return-date").value = getTodayString();
        openModal("modal-leave-end");
      });
      document.getElementById("btn-banner-add-purchase")?.addEventListener("click", () => {
        document.getElementById("exp-form-date").value = getTodayString();
        document.getElementById("exp-form-amount").value = "";
        document.getElementById("exp-form-note").value = "";
        openModal("modal-add-expense");
      });
    } else {
      lockoutContainer.innerHTML = "";
    }
  }

  // 1. Render Live Attendance & OT Status for Current User
  const activePunch = getActivePunch(user.id);
  const todayPunches = getTodayUserPunches(user.id);
  const lastPunch = todayPunches[todayPunches.length - 1];

  const pulseDot = document.getElementById("resident-pulse-dot");
  const statusBadge = document.getElementById("resident-punch-status-badge");
  const statusText = document.getElementById("resident-punch-status-text");
  const btnPunchIn = document.getElementById("btn-employee-punch-in");
  const btnPunchOut = document.getElementById("btn-employee-punch-out");
  const inTimeEl = document.getElementById("duty-in-time");
  const outTimeEl = document.getElementById("duty-out-time");
  const totalHoursEl = document.getElementById("duty-total-hours");
  const otHoursEl = document.getElementById("duty-ot-hours");
  const gpsStatusEl = document.getElementById("resident-gps-status");

  if (pendingApproval) {
    if (pulseDot) pulseDot.className = "live-pulse-dot inactive";
    if (statusBadge) {
      statusBadge.textContent = "⏳ PENDING APPROVAL";
      statusBadge.className = "badge badge-alert";
    }
    if (statusText) statusText.textContent = "Account awaiting Super Admin approval";
    if (btnPunchIn) {
      btnPunchIn.disabled = true;
      btnPunchIn.className = "btn btn-primary full-width btn-disabled-lockout";
      btnPunchIn.innerHTML = `🔒 Punch In (Pending Approval)`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = true;
      btnPunchOut.className = "btn btn-secondary full-width btn-disabled-lockout";
      btnPunchOut.innerHTML = `🔒 Punch Out (Locked)`;
    }
    if (inTimeEl) inTimeEl.textContent = "Locked";
    if (outTimeEl) outTimeEl.textContent = "Locked";
    if (totalHoursEl) totalHoursEl.textContent = "0.0h";
    if (otHoursEl) {
      otHoursEl.textContent = "Locked";
      otHoursEl.style.color = "#94A3B8";
    }
    if (gpsStatusEl) {
      gpsStatusEl.innerHTML = `<span>⏳</span><span>Live GPS Duty Punch disabled until Admin approves account</span>`;
    }
  } else if (onLeave) {
    if (pulseDot) pulseDot.className = "live-pulse-dot inactive";
    if (statusBadge) {
      statusBadge.textContent = "🏖️ ON LEAVE (FROZEN)";
      statusBadge.className = "badge badge-leave";
    }
    if (statusText) statusText.textContent = "Duty Punch In/Out is locked while on leave";
    if (btnPunchIn) {
      btnPunchIn.disabled = true;
      btnPunchIn.className = "btn btn-primary full-width btn-disabled-lockout";
      btnPunchIn.innerHTML = `🔒 Punch In (Frozen - On Leave)`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = true;
      btnPunchOut.className = "btn btn-secondary full-width btn-disabled-lockout";
      btnPunchOut.innerHTML = `🔒 Punch Out (Frozen)`;
    }
    if (inTimeEl) inTimeEl.textContent = "On Leave";
    if (outTimeEl) outTimeEl.textContent = "On Leave";
    if (totalHoursEl) totalHoursEl.textContent = "0.0h";
    if (otHoursEl) {
      otHoursEl.textContent = "Locked";
      otHoursEl.style.color = "#94A3B8";
    }
    if (gpsStatusEl) {
      gpsStatusEl.innerHTML = `<span>🏖️</span><span>Duty clock & GPS logging frozen while on leave</span>`;
    }
  } else if (activePunch) {
    if (pulseDot) pulseDot.className = "live-pulse-dot";
    if (statusBadge) {
      statusBadge.textContent = "ON DUTY (ACTIVE)";
      statusBadge.className = "badge badge-success";
    }
    if (statusText) statusText.textContent = `Shift Active since ${activePunch.punchInTime}`;
    if (btnPunchIn) {
      btnPunchIn.disabled = true;
      btnPunchIn.className = "btn btn-primary full-width";
      btnPunchIn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Punch In (Active)`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = false;
      btnPunchOut.className = "btn btn-secondary full-width";
      btnPunchOut.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12"/></svg> Punch Out`;
    }
    if (inTimeEl) inTimeEl.textContent = activePunch.punchInTime;
    if (outTimeEl) outTimeEl.textContent = "Active...";

    const calc = calculateDutyShift(activePunch.punchInTimestamp, Date.now());
    if (totalHoursEl) totalHoursEl.textContent = `${calc.totalHours.toFixed(2)}h`;
    if (otHoursEl) {
      otHoursEl.textContent = `${calc.otHours.toFixed(2)}h OT`;
      otHoursEl.style.color = calc.otHours > 0 ? "#F59E0B" : "#94A3B8";
    }

    if (gpsStatusEl) {
      if (activePunch.gpsInLocation && activePunch.gpsInLocation.available) {
        gpsStatusEl.innerHTML = `
          <span>📍</span>
          <span>Duty Punch-In GPS: 
            <a href="${activePunch.gpsInLocation.mapUrl}" target="_blank" rel="noopener" class="gps-pill" style="margin-left:4px;">
              ${activePunch.gpsInLocation.display} (View Map ↗)
            </a>
          </span>
        `;
      } else {
        gpsStatusEl.innerHTML = `<span>📍</span><span>Live GPS Tracker Active (Ready for automatic Geolocation recording)</span>`;
      }
    }
  } else if (lastPunch && lastPunch.status === "COMPLETED") {
    if (pulseDot) pulseDot.className = "live-pulse-dot inactive";
    if (statusBadge) {
      statusBadge.textContent = "SHIFT COMPLETED";
      statusBadge.className = "badge badge-blue";
    }
    if (statusText) statusText.textContent = `Shift Finished: ${lastPunch.totalWorkedHours.toFixed(2)}h (${lastPunch.otHours.toFixed(2)}h OT)`;
    if (btnPunchIn) {
      btnPunchIn.disabled = false;
      btnPunchIn.className = "btn btn-primary full-width";
      btnPunchIn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Punch In (Next Shift)`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = true;
      btnPunchOut.className = "btn btn-secondary full-width";
      btnPunchOut.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12"/></svg> Punch Out`;
    }
    if (inTimeEl) inTimeEl.textContent = lastPunch.punchInTime;
    if (outTimeEl) outTimeEl.textContent = lastPunch.punchOutTime;
    if (totalHoursEl) totalHoursEl.textContent = `${lastPunch.totalWorkedHours.toFixed(2)}h`;
    if (otHoursEl) {
      otHoursEl.textContent = `${lastPunch.otHours.toFixed(2)}h OT`;
      otHoursEl.style.color = lastPunch.otHours > 0 ? "#F59E0B" : "#94A3B8";
    }
    if (gpsStatusEl) {
      if (lastPunch.gpsInLocation && lastPunch.gpsInLocation.available) {
        gpsStatusEl.innerHTML = `
          <span>📍</span>
          <span>Last In GPS: <a href="${lastPunch.gpsInLocation.mapUrl}" target="_blank" rel="noopener" class="gps-pill">${lastPunch.gpsInLocation.display}</a></span>
        `;
      } else {
        gpsStatusEl.innerHTML = `<span>📍</span><span>Live GPS Tracker: Shift recorded in Firebase Cloud</span>`;
      }
    }
  } else {
    if (pulseDot) pulseDot.className = "live-pulse-dot inactive";
    if (statusBadge) {
      statusBadge.textContent = "NOT PUNCHED IN";
      statusBadge.className = "badge badge-alert";
    }
    if (statusText) statusText.textContent = "No active duty punch for today";
    if (btnPunchIn) {
      btnPunchIn.disabled = false;
      btnPunchIn.className = "btn btn-primary full-width";
      btnPunchIn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Punch In (Start Duty)`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = true;
      btnPunchOut.className = "btn btn-secondary full-width";
      btnPunchOut.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="6" width="12" height="12"/></svg> Punch Out`;
    }
    if (inTimeEl) inTimeEl.textContent = "--:--";
    if (outTimeEl) outTimeEl.textContent = "--:--";
    if (totalHoursEl) totalHoursEl.textContent = "0.0h";
    if (otHoursEl) {
      otHoursEl.textContent = "0.0h OT";
      otHoursEl.style.color = "#94A3B8";
    }
    if (gpsStatusEl) {
      gpsStatusEl.innerHTML = `<span>📍</span><span>Live GPS Location auto-tracking enabled for Punch In/Out</span>`;
    }
  }

  // 2. Render Shift & Meal Logic
  const shiftDisplay = document.getElementById("resident-shift-display");
  const shiftIndicator = document.getElementById("shift-badge-indicator");
  if (shiftDisplay) shiftDisplay.textContent = onLeave ? `${user.currentShift || "OFF_DUTY"} (LOCKED)` : (user.currentShift || "OFF_DUTY");
  if (shiftIndicator) shiftIndicator.textContent = onLeave ? "ON LEAVE" : (user.currentShift || "OFF_DUTY");

  const isAutoOn = !onLeave && (user.currentShift === "OFF_DUTY" || user.currentShift === "NIGHT");
  const pill = document.getElementById("resident-logic-pill");
  if (pill) {
    if (onLeave) {
      pill.textContent = "🔒 View-Only Mode";
      pill.className = "pill-badge badge-leave";
    } else {
      pill.textContent = isAutoOn ? "Auto-ON (Night/Off)" : "Auto-OFF (Day Shift)";
      pill.className = `pill-badge ${isAutoOn ? "badge-success" : "badge-alert"}`;
    }
  }

  const ruleBox = document.getElementById("rule-explanation-box");
  if (ruleBox) {
    if (onLeave) {
      ruleBox.innerHTML = "🏖️ <strong>ON LEAVE ACTIVE:</strong> You are on leave. Meals, shifts, and attendance are completely frozen. Click <strong>'Request Leave End'</strong> upon return.";
    } else {
      ruleBox.innerHTML = isAutoOn
        ? "💡 <strong>Rule:</strong> Off-Duty / Night Shift has <strong>Auto-ON</strong> meals. You can skip if dining outside."
        : "⚠️ <strong>Rule:</strong> Day Shifts (Morning/Evening) are <strong>Auto-OFF</strong>. Toggle ON before cut-off to eat.";
    }
  }

  // Update shift buttons active and disabled state
  document.querySelectorAll(".shift-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-shift") === user.currentShift);
    if (onLeave) {
      btn.classList.add("btn-disabled-lockout");
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.classList.remove("btn-disabled-lockout");
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });

  // Render Resident Meals
  const userMeals = (state.meals || []).filter(m => m.userId === user.id);
  const listEl = document.getElementById("resident-meal-list");
  listEl.innerHTML = "";

  const defaultMeals = [
    { type: "LUNCH", time: "12:00 PM - 2:30 PM", cutOff: "Cut-off: 8:30 AM" },
    { type: "DINNER", time: "7:30 PM - 10:00 PM", cutOff: "Cut-off: 4:30 PM" }
  ];

  defaultMeals.forEach(dm => {
    let existing = userMeals.find(m => m.mealType === dm.type);
    let status = onLeave ? "OFF (LEAVE)" : (existing ? existing.status : (isAutoOn ? "ON" : "OFF"));
    let isOn = !onLeave && (status === "ON" || status === "PACK_TIFFIN" || status === "LATE_COVERED");

    const item = document.createElement("div");
    item.className = `meal-item ${isOn ? "on" : ""} ${onLeave ? "locked-leave-item" : ""}`;
    item.innerHTML = `
      <div class="meal-info">
        <strong>${dm.type} (${status})</strong>
        <span>${dm.time} • ${dm.cutOff}</span>
      </div>
      <button class="meal-toggle-btn ${isOn ? "btn-toggle-on" : "btn-toggle-off"} ${onLeave ? "btn-disabled-lockout" : ""}" 
              ${onLeave ? 'disabled title="Locked while ON LEAVE"' : `onclick="toggleMeal('${dm.type}')"`}>
        ${onLeave ? "🔒 Locked (On Leave)" : (isOn ? "✓ Eating (Meal ON)" : "✕ Skip (Meal OFF)")}
      </button>
    `;
    listEl.appendChild(item);
  });

  // Update quick leave button text based on status
  const qLeaveBtn = document.getElementById("btn-quick-leave-request");
  if (qLeaveBtn) {
    if (onLeave) {
      qLeaveBtn.innerHTML = `🏡 Return from Leave (गाँव से वापसी)`;
    } else {
      qLeaveBtn.innerHTML = `🏖️ Request Leave (गाँव / छुट्टी)`;
    }
  }

  // Calculate live dynamic bill based on ACTUAL approved expenses
  const expTotals = calculateExpenseTotals();
  const plateRate = getDynamicPlateRate();
  const myPlatesCount = onLeave ? 0 : userMeals.filter(m => m.status === "ON" || m.status === "PACK_TIFFIN" || m.status === "LATE_COVERED").length;

  const activeResidents = (state.users || []).filter(u => u.status === "ACTIVE" && u.role === "RESIDENT").length || 
                          (state.users || []).filter(u => u.status === "ACTIVE").length || 1;

  const myMealCost = myPlatesCount * plateRate;
  const myElectShare = expTotals.ELECTRICITY / activeResidents;
  const myWaterShare = expTotals.WATER / activeResidents;
  const myCookShare = expTotals.COOK_SALARY / activeResidents;
  const roomRent = (user.role === "RESIDENT" || user.role === "EMPLOYEE") ? (state.roomRentPerPerson || 1500) : 0;
  
  const myTotalBill = myMealCost + myElectShare + myWaterShare + myCookShare + roomRent;

  document.getElementById("resident-bill-amount").textContent = `₹${myTotalBill.toFixed(2)}`;
  document.getElementById("resident-plates-count").textContent = `${myPlatesCount} Plates`;
}

function toggleMeal(mealType) {
  const user = state.currentUser;
  if (isUserOnLeave(user)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. All meal bookings are frozen in View-Only mode.");
    return;
  }
  if (isUserPendingApproval(user)) {
    alert("🔒 Registration Pending: Super Admin must approve your registration before meal booking is active.");
    return;
  }

  let meal = state.meals.find(m => m.userId === user.id && m.mealType === mealType);
  if (meal) {
    meal.status = (meal.status === "OFF" || meal.status === "SKIP") ? "ON" : "OFF";
    meal.otHours = 0;
    FirebaseSyncService.saveMeal(meal);
  } else {
    meal = {
      id: "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      userId: user.id,
      userName: user.name,
      roomNumber: user.assignedRoom || "101",
      mealType: mealType,
      status: "ON",
      otHours: 0,
      shiftAtTime: user.currentShift || "OFF_DUTY"
    };
    state.meals.push(meal);
    FirebaseSyncService.saveMeal(meal);
  }
  saveState();
  renderUI();
}

function setShift(shift) {
  if (isUserOnLeave(state.currentUser)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Shift modifications are frozen.");
    return;
  }
  if (isUserPendingApproval(state.currentUser)) {
    alert("🔒 Registration Pending: Super Admin must approve your registration first.");
    return;
  }

  state.currentUser.currentShift = shift;
  // Update in users list
  const u = state.users.find(x => x.id === state.currentUser.id);
  if (u) {
    u.currentShift = shift;
    FirebaseSyncService.saveUser(u);
  }

  const isAutoOn = shift === "OFF_DUTY" || shift === "NIGHT";
  
  // Auto sync today's meals based on rules
  ["LUNCH", "DINNER"].forEach(type => {
    let meal = state.meals.find(m => m.userId === state.currentUser.id && m.mealType === type);
    if (!meal) {
      meal = {
        id: "m_" + Date.now() + "_" + type,
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        roomNumber: state.currentUser.assignedRoom || "101",
        mealType: type,
        status: isAutoOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: shift
      };
      state.meals.push(meal);
    } else {
      if (meal.status !== "PACK_TIFFIN" && meal.status !== "LATE_COVERED") {
        meal.status = isAutoOn ? "ON" : "OFF";
      }
      meal.shiftAtTime = shift;
    }
    FirebaseSyncService.saveMeal(meal);
  });

  saveState();
  renderUI();
}

// Shift button listeners
document.querySelectorAll(".shift-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (isUserOnLeave(state.currentUser)) {
      alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Shift changes are locked.");
      return;
    }
    setShift(btn.getAttribute("data-shift"));
  });
});

// 3. Kitchen Screen Rendering
function renderKitchenScreen() {
  const activeMeal = state.activeKitchenMeal || "LUNCH";
  const activeMeals = (state.meals || []).filter(m => m.mealType === activeMeal && m.status !== "OFF" && m.status !== "SKIP");

  const normal = activeMeals.filter(m => m.status === "ON").length;
  const tiffins = activeMeals.filter(m => m.status === "PACK_TIFFIN").length;
  const late = activeMeals.filter(m => m.status === "LATE_COVERED").length;
  const total = normal + tiffins + late;

  document.getElementById("kitchen-total-count").textContent = `${activeMeal}: ${total} TOTAL PLATES`;
  document.getElementById("k-metric-normal").textContent = normal;
  document.getElementById("k-metric-tiffins").textContent = tiffins;
  document.getElementById("k-metric-late").textContent = late;
  document.getElementById("kitchen-roster-count").textContent = `${activeMeals.length} active entries`;

  // Populate Table
  const tbody = document.getElementById("kitchen-roster-tbody");
  tbody.innerHTML = "";

  if (activeMeals.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-sub" style="padding:24px;">No meal requests for ${activeMeal} yet. Residents can turn meals ON from their portal.</td></tr>`;
    return;
  }

  activeMeals.forEach(meal => {
    const tr = document.createElement("tr");
    const badgeClass = meal.status === 'ON' ? 'badge-success' : (meal.status === 'PACK_TIFFIN' ? 'badge-blue' : 'badge-lilac');
    tr.innerHTML = `
      <td><strong>${meal.userName}</strong></td>
      <td>Room ${meal.roomNumber}</td>
      <td>${meal.shiftAtTime || 'Normal'} ${meal.otHours ? `(OT ${meal.otHours}h)` : ''}</td>
      <td><span class="badge ${badgeClass}">${meal.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Meal Filter Chips for Kitchen
document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.activeKitchenMeal = chip.getAttribute("data-meal");
    renderKitchenScreen();
  });
});

// 4. Manager Operations Screen (Leaves Approvals + Mess Expense Approvals)
function renderManagerScreen() {
  const user = state.currentUser || state.users[0];
  const isNormalEmployee = user.role === "RESIDENT" || user.role === "EMPLOYEE" || user.role === "COOK";

  const leavesContainer = document.getElementById("manager-leaves-list");
  const pendingExpContainer = document.getElementById("manager-pending-expenses-list");
  const rList = document.getElementById("manager-resident-list");
  const addResBtn = document.getElementById("btn-mgr-add-resident");

  const pendingLeaves = (state.pendingLeaves || []);
  const pendingExpenses = (state.expensesLog || []).filter(e => e.status === "PENDING");

  if (isNormalEmployee) {
    document.getElementById("mgr-active-count").textContent = "🔒 Locked";
    document.getElementById("mgr-pending-count").textContent = "🔒 Locked";
    const mgrExpCount = document.getElementById("mgr-pending-expenses-count");
    if (mgrExpCount) mgrExpCount.textContent = "🔒 Locked";
    if (addResBtn) addResBtn.style.display = "none";

    if (leavesContainer) {
      leavesContainer.innerHTML = `
        <div class="locked-tab-card">
          <div class="locked-icon-bubble">🔒</div>
          <h4 style="margin:0;">Manager Operations Portal Locked</h4>
          <p class="text-sub">
            Access Restricted: Only Super Admin and Hostel Manager can view, approve leave requests, and approve purchase expenses.<br>
            Normal employees can submit requests from the <strong>Resident Home</strong> and <strong>Expense Ledger</strong>.
          </p>
        </div>
      `;
    }
    if (pendingExpContainer) {
      pendingExpContainer.innerHTML = `<div class="text-sub text-center" style="padding:16px;">Expense Approvals are restricted to Admin & Manager.</div>`;
    }
    if (rList) {
      rList.innerHTML = `<div class="text-sub text-center" style="padding:16px;">Resident Master Roster is restricted to Admin & Manager.</div>`;
    }
    return;
  }

  if (addResBtn) addResBtn.style.display = "inline-flex";
  const activeResidents = state.users.filter(u => u.status === 'ACTIVE' && (u.role === 'RESIDENT' || u.role === 'EMPLOYEE'));
  const onLeaveResidents = state.users.filter(u => u.status === 'ON_LEAVE' && (u.role === 'RESIDENT' || u.role === 'EMPLOYEE'));

  document.getElementById("mgr-active-count").textContent = `${activeResidents.length} Active (${onLeaveResidents.length} On Leave)`;
  document.getElementById("mgr-pending-count").textContent = `${pendingLeaves.length} Requests`;
  const mgrExpCount = document.getElementById("mgr-pending-expenses-count");
  if (mgrExpCount) mgrExpCount.textContent = `${pendingExpenses.length} Pending`;

  const leavesBadge = document.getElementById("mgr-leaves-badge");
  if (leavesBadge) leavesBadge.textContent = `${pendingLeaves.length} Pending`;
  const expBadge = document.getElementById("mgr-expenses-badge");
  if (expBadge) expBadge.textContent = `${pendingExpenses.length} Pending`;

  // 1. Pending Leave & Return Requests
  leavesContainer.innerHTML = "";
  if (pendingLeaves.length === 0) {
    leavesContainer.innerHTML = `<div class="empty-state">No pending leave or return requests.</div>`;
  } else {
    pendingLeaves.forEach(lev => {
      const isReturn = lev.type === "LEAVE_END";
      const item = document.createElement("div");
      item.className = "approval-card pending";
      
      if (isReturn) {
        item.innerHTML = `
          <div class="approval-card-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge badge-success">🏡 RETURN TO DUTY REQUEST</span>
              <span class="text-sub">${new Date(lev.createdAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <strong style="font-size:15px; margin-top:4px; display:block;">${lev.userName} (Room ${lev.userRoom || '101'})</strong>
            <p class="text-sub" style="margin-top:2px;">
              Requested Return Date: <strong>${lev.returnDate || 'Today'}</strong> • Resuming Shift: <strong>${lev.resumingShift || 'MORNING'}</strong>
            </p>
            <p style="font-size:12px; color:#475569; margin-top:4px;">Note: "${lev.reason || 'Ready for duty'}"</p>
          </div>
          <div class="approval-card-actions">
            <button class="btn btn-success btn-sm" onclick="processLeave('${lev.id}', true)">✓ Approve Return (Unlock)</button>
            <button class="btn btn-alert btn-sm" onclick="processLeave('${lev.id}', false)">✕ Reject</button>
          </div>
        `;
      } else {
        item.innerHTML = `
          <div class="approval-card-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge badge-leave">🏖️ LEAVE APPLICATION</span>
              <span class="text-sub">${new Date(lev.createdAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <strong style="font-size:15px; margin-top:4px; display:block;">${lev.userName} (Room ${lev.userRoom || '101'})</strong>
            <p class="text-sub" style="margin-top:2px;">
              Leave Period: <strong>${lev.startDate} to ${lev.endDate}</strong> (${lev.totalDays || 1} days)
            </p>
            <p style="font-size:12px; color:#475569; margin-top:4px;">Reason: "${lev.reason || 'Personal / Village'}"</p>
          </div>
          <div class="approval-card-actions">
            <button class="btn btn-primary btn-sm" onclick="processLeave('${lev.id}', true)">✓ Approve Leave (Lock)</button>
            <button class="btn btn-alert btn-sm" onclick="processLeave('${lev.id}', false)">✕ Reject</button>
          </div>
        `;
      }
      leavesContainer.appendChild(item);
    });
  }

  // 2. Pending Mess / Grocery Expense Approvals
  if (pendingExpContainer) {
    pendingExpContainer.innerHTML = "";
    if (pendingExpenses.length === 0) {
      pendingExpContainer.innerHTML = `<div class="empty-state">No pending mess purchase requests. Zero awaiting approval.</div>`;
    } else {
      pendingExpenses.forEach(exp => {
        const item = document.createElement("div");
        item.className = "approval-card pending";
        item.innerHTML = `
          <div class="approval-card-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${getCategoryBadgeClass(exp.category)}">${formatCategoryName(exp.category)}</span>
              <span class="badge badge-pending">⏳ PENDING APPROVAL</span>
              <span class="text-sub">${exp.date}</span>
            </div>
            <strong style="font-size:15px; margin-top:4px; display:block;">${exp.description}</strong>
            <p class="text-sub" style="margin-top:2px;">
              Submitted by: <strong>${exp.recordedBy}</strong> • Payment: ${exp.paymentMode || 'UPI'}
            </p>
          </div>
          <div class="approval-card-actions">
            <div class="approval-price font-mono">₹${parseFloat(exp.amount).toFixed(2)}</div>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <button class="btn btn-success btn-sm" onclick="processExpense('${exp.id}', true)">✓ Approve</button>
              <button class="btn btn-alert btn-sm" onclick="processExpense('${exp.id}', false)">✕ Reject</button>
            </div>
          </div>
        `;
        pendingExpContainer.appendChild(item);
      });
    }
  }

  // 3. Resident Directory
  rList.innerHTML = "";
  const allHostelResidents = state.users.filter(u => u.role === 'RESIDENT' || u.role === 'EMPLOYEE');
  if (allHostelResidents.length === 0) {
    rList.innerHTML = `<div class="empty-state">No residents added yet. Click "+ New Resident" to register members with OTP verification.</div>`;
  } else {
    allHostelResidents.forEach(u => {
      const div = document.createElement("div");
      div.className = "account-item";
      const isOnLeave = u.status === "ON_LEAVE";
      const statusPill = isOnLeave 
        ? `<span class="badge badge-leave">🏖️ ON LEAVE</span>` 
        : (u.status === "BLOCKED" ? `<span class="badge badge-alert">BLOCKED</span>` : `<span class="badge badge-success">ACTIVE</span>`);

      div.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:6px;">
            <strong>${u.name} (Room ${u.assignedRoom || '101'})</strong>
            ${statusPill}
          </div>
          <p class="text-sub">${u.userIdCode || 'EMP'} • 📱 +91 ${u.mobile} ${u.isOtpVerified ? '• <span class="text-success font-bold">✓ OTP Verified</span>' : ''}</p>
        </div>
        <span class="role-tag">${isOnLeave ? 'LOCKED' : (u.currentShift || 'OFF_DUTY')}</span>
      `;
      rList.appendChild(div);
    });
  }
}

// Process Leave Start & Leave End Requests
function processLeave(id, approve) {
  if (state.currentUser.role !== "ADMIN" && state.currentUser.role !== "MANAGER") {
    alert("🔒 Access Denied: Only Super Admin and Hostel Manager can approve or reject leaves.");
    return;
  }

  const lev = (state.pendingLeaves || []).find(l => l.id === id);
  if (!lev) return;

  state.pendingLeaves = state.pendingLeaves.filter(l => l.id !== id);

  if (approve) {
    const isReturn = lev.type === "LEAVE_END";
    const targetUser = state.users.find(u => u.id === lev.userId);

    if (isReturn) {
      // Return to Duty Approved: Unlock user
      if (targetUser) {
        targetUser.status = "ACTIVE";
        if (lev.resumingShift) targetUser.currentShift = lev.resumingShift;
        FirebaseSyncService.saveUser(targetUser);
      }
      if (state.currentUser.id === lev.userId) {
        state.currentUser.status = "ACTIVE";
        if (lev.resumingShift) state.currentUser.currentShift = lev.resumingShift;
      }
      alert(`✓ Duty Return Approved for ${lev.userName}!\nEmployee status restored to ACTIVE and all permissions (Meals, Punch In/Out, Shifts) are UNLOCKED.`);
    } else {
      // Leave Start Approved: Set user ON_LEAVE and Freeze permissions
      if (targetUser) {
        targetUser.status = "ON_LEAVE";
        FirebaseSyncService.saveUser(targetUser);
      }
      if (state.currentUser.id === lev.userId) {
        state.currentUser.status = "ON_LEAVE";
      }
      // Auto-turn OFF meals to prevent food wastage
      (state.meals || []).forEach(m => {
        if (m.userId === lev.userId) {
          m.status = "OFF";
          FirebaseSyncService.saveMeal(m);
        }
      });
      // Complete any running duty punch
      const activePunch = getActivePunch(lev.userId);
      if (activePunch) {
        const now = Date.now();
        const calc = calculateDutyShift(activePunch.punchInTimestamp, now);
        activePunch.punchOutTime = formatTimeAMPM(now);
        activePunch.punchOutTimestamp = now;
        activePunch.totalWorkedHours = calc.totalHours;
        activePunch.regularHours = calc.regularHours;
        activePunch.otHours = calc.otHours;
        activePunch.status = "COMPLETED";
        FirebaseSyncService.saveAttendance(activePunch);
      }
      alert(`✓ Leave Approved for ${lev.userName}!\nEmployee status set to 'ON LEAVE'. Meals, Duty Attendance, and update controls are now FROZEN in View-Only mode.`);
    }
  } else {
    alert(`Leave / Return request for ${lev.userName} has been Rejected.`);
  }

  FirebaseSyncService.deleteLeave(id);
  saveState();
  renderUI();
}

// Process Mess Purchase / Expense Requests (Approve / Reject)
function processExpense(id, approve) {
  if (state.currentUser.role !== "ADMIN" && state.currentUser.role !== "MANAGER") {
    alert("🔒 Access Denied: Only Super Admin and Hostel Manager can approve or reject expense submissions.");
    return;
  }

  const exp = (state.expensesLog || []).find(e => e.id === id);
  if (!exp) return;

  if (approve) {
    exp.status = "APPROVED";
    exp.approvedBy = state.currentUser.name;
    exp.approvedAt = Date.now();
    alert(`✓ Expense Approved!\n₹${parseFloat(exp.amount).toFixed(2)} for "${exp.description}" is now officially recorded in the Hostel Ledger and Dynamic Plate Rate calculations.`);
  } else {
    exp.status = "REJECTED";
    exp.approvedBy = state.currentUser.name;
    exp.approvedAt = Date.now();
    alert(`✕ Expense Rejected: ₹${parseFloat(exp.amount).toFixed(2)} for "${exp.description}" has been rejected and will NOT be added to calculations.`);
  }

  FirebaseSyncService.saveExpense(exp);
  saveState();
  renderUI();
}

// 5. Expense Ledger Screen (Actual Expenses Tracking & Approval Workflow)
function renderExpenseScreen() {
  const user = state.currentUser || state.users[0];
  const isManagerOrAdmin = user.role === "ADMIN" || user.role === "MANAGER";

  const expTotals = calculateExpenseTotals();
  const dynamicRate = getDynamicPlateRate();

  document.getElementById("exp-metric-total").textContent = `₹${expTotals.grandTotal.toFixed(2)}`;
  document.getElementById("exp-metric-grocery").textContent = `₹${expTotals.GROCERY.toFixed(2)}`;
  document.getElementById("exp-metric-plate-rate").textContent = `₹${dynamicRate.toFixed(2)}`;

  const addExpBtn = document.getElementById("btn-open-add-expense");
  const settingRentInput = document.getElementById("setting-room-rent");
  const saveRentBtn = document.getElementById("btn-save-room-rent");

  if (!isManagerOrAdmin) {
    if (addExpBtn) {
      addExpBtn.style.display = "inline-flex";
      addExpBtn.textContent = "+ Submit Mess Purchase";
    }
    if (settingRentInput) {
      settingRentInput.value = state.roomRentPerPerson || 1500;
      settingRentInput.disabled = true;
    }
    if (saveRentBtn) saveRentBtn.style.display = "none";
  } else {
    if (addExpBtn) {
      addExpBtn.style.display = "inline-flex";
      addExpBtn.textContent = "+ Add Mess Purchase / Expense";
    }
    if (settingRentInput && !settingRentInput.matches(":focus")) {
      settingRentInput.value = state.roomRentPerPerson || 1500;
      settingRentInput.disabled = false;
    }
    if (saveRentBtn) saveRentBtn.style.display = "inline-flex";
  }

  // 1. Pending Approvals Panel in Expense Tab
  const pendingPanel = document.getElementById("expense-pending-approvals-panel");
  const pendingListEl = document.getElementById("expense-tab-pending-list");
  const pendingBadgeEl = document.getElementById("exp-tab-pending-count-badge");

  const pendingExpenses = (state.expensesLog || []).filter(e => e.status === "PENDING");
  if (pendingBadgeEl) pendingBadgeEl.textContent = `${pendingExpenses.length} Pending`;

  if (pendingPanel && pendingListEl) {
    if (pendingExpenses.length === 0) {
      pendingListEl.innerHTML = `
        <div class="empty-state" style="padding:16px;">
          ✓ All mess purchases have been reviewed. Zero pending approvals.
        </div>
      `;
    } else {
      pendingListEl.innerHTML = "";
      pendingExpenses.forEach(exp => {
        const item = document.createElement("div");
        item.className = "approval-card pending";
        item.innerHTML = `
          <div class="approval-card-info">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${getCategoryBadgeClass(exp.category)}">${formatCategoryName(exp.category)}</span>
              <span class="badge badge-pending">⏳ PENDING APPROVAL</span>
              <span class="text-sub">${exp.date}</span>
            </div>
            <strong style="font-size:15px; margin-top:4px; display:block;">${exp.description}</strong>
            <p class="text-sub" style="margin-top:2px;">
              Submitted by: <strong>${exp.recordedBy}</strong> • Payment: ${exp.paymentMode || 'UPI'}
            </p>
          </div>
          <div class="approval-card-actions">
            <div class="approval-price font-mono">₹${parseFloat(exp.amount).toFixed(2)}</div>
            ${isManagerOrAdmin ? `
              <div style="display:flex; gap:6px; margin-top:4px;">
                <button class="btn btn-success btn-sm" onclick="processExpense('${exp.id}', true)">✓ Approve</button>
                <button class="btn btn-alert btn-sm" onclick="processExpense('${exp.id}', false)">✕ Reject</button>
              </div>
            ` : `<span class="badge badge-pending" style="font-size:10px;">Awaiting Manager/Admin</span>`}
          </div>
        `;
        pendingListEl.appendChild(item);
      });
    }
  }

  // 2. Filter & Render Full Expense Log
  const categoryFilter = state.selectedExpenseCategoryFilter || "ALL";
  let entries = state.expensesLog || [];

  if (categoryFilter === "APPROVED") {
    entries = entries.filter(e => !e.status || e.status === "APPROVED");
  } else if (categoryFilter === "PENDING") {
    entries = entries.filter(e => e.status === "PENDING");
  } else if (categoryFilter !== "ALL") {
    entries = entries.filter(e => e.category === categoryFilter);
  }

  const container = document.getElementById("expense-ledger-items");
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No expenses found for this filter.</p>
        <p class="text-sub mt-1">Click <strong>"+ Add Mess Purchase / Expense"</strong> to submit entries.</p>
      </div>
    `;
    return;
  }

  entries.slice().reverse().forEach(exp => {
    const card = document.createElement("div");
    const catClass = (exp.category || "other").toLowerCase();
    const status = exp.status || "APPROVED";
    card.className = `expense-entry-card ${catClass} ${status === 'PENDING' ? 'pending-border' : (status === 'REJECTED' ? 'rejected-border' : '')}`;

    const isKitchenExp = exp.category === "GROCERY" || exp.category === "COOK_SALARY";
    const canDeleteThisExp = user.role === "ADMIN" || (user.role === "MANAGER" && isKitchenExp);

    const statusBadge = status === "APPROVED"
      ? `<span class="badge badge-success">✓ APPROVED</span>`
      : (status === "PENDING"
          ? `<span class="badge badge-pending">⏳ PENDING APPROVAL</span>`
          : `<span class="badge badge-rejected">✕ REJECTED</span>`);

    let approvalActions = "";
    if (status === "PENDING" && isManagerOrAdmin) {
      approvalActions = `
        <div style="display:flex; gap:6px;">
          <button class="btn btn-success btn-sm" onclick="processExpense('${exp.id}', true)" title="Approve expense">✓ Approve</button>
          <button class="btn btn-alert btn-sm" onclick="processExpense('${exp.id}', false)" title="Reject expense">✕ Reject</button>
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span class="badge ${getCategoryBadgeClass(exp.category)}">${formatCategoryName(exp.category)}</span>
          ${statusBadge}
          <span class="text-sub">${exp.date}</span>
          <span class="text-sub">• ${exp.paymentMode || 'UPI'}</span>
        </div>
        <p style="font-size:14px; font-weight:700; margin-top:4px; color:var(--text-primary);">${exp.description}</p>
        <p class="text-sub" style="font-size:12px;">
          Submitted by: <strong>${exp.recordedBy || 'Admin'}</strong>
          ${exp.approvedBy ? ` • <span style="color:#059669; font-weight:600;">Approved by ${exp.approvedBy}</span>` : ''}
        </p>
      </div>
      <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <span style="font-size:16px; font-weight:800; color:var(--text-primary);">₹${parseFloat(exp.amount).toFixed(2)}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${approvalActions}
          ${canDeleteThisExp ? `<button class="btn btn-alert btn-sm" onclick="deleteExpense('${exp.id}')" title="Delete Expense">🗑️</button>` : ''}
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function formatCategoryName(cat) {
  switch (cat) {
    case "GROCERY": return "🛒 Grocery & Fuel";
    case "ELECTRICITY": return "⚡ Electricity";
    case "WATER": return "💧 Water / Gas";
    case "COOK_SALARY": return "👨‍🍳 Cook Salary";
    case "MAINTENANCE": return "🏢 Maintenance";
    default: return "📦 Other";
  }
}

function getCategoryBadgeClass(cat) {
  switch (cat) {
    case "GROCERY": return "badge-blue";
    case "ELECTRICITY": return "badge-amber";
    case "WATER": return "badge-blue";
    case "COOK_SALARY": return "badge-lilac";
    case "MAINTENANCE": return "badge-success";
    default: return "badge-primary-light";
  }
}

function deleteExpense(id) {
  const user = state.currentUser || state.users[0];
  const exp = (state.expensesLog || []).find(e => e.id === id);
  if (!exp) return;

  if (user.role === "ADMIN") {
    if (confirm(`Delete expense "${exp.description}" (₹${exp.amount})?`)) {
      state.expensesLog = state.expensesLog.filter(e => e.id !== id);
      saveState();
      renderUI();
    }
    return;
  }

  if (user.role === "MANAGER") {
    const isKitchenExp = exp.category === "GROCERY" || exp.category === "COOK_SALARY";
    if (isKitchenExp) {
      if (confirm(`Delete Kitchen/Grocery expense "${exp.description}" (₹${exp.amount})?`)) {
        state.expensesLog = state.expensesLog.filter(e => e.id !== id);
        saveState();
        renderUI();
      }
      return;
    } else {
      alert("🔒 Restricted Access: Hostel Manager can only delete Cook/Kitchen/Grocery related expenses. Utility and other system expenses are View-Only.");
      return;
    }
  }

  alert("🔒 Access Denied: Only Super Admin and Hostel Manager can delete expenses.");
}

// Expense Category Filter Chips
document.querySelectorAll(".exp-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".exp-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.selectedExpenseCategoryFilter = chip.getAttribute("data-exp-cat");
    renderExpenseScreen();
  });
});

// Save Room Rent
document.getElementById("btn-save-room-rent")?.addEventListener("click", () => {
  if (state.currentUser.role !== "ADMIN" && state.currentUser.role !== "MANAGER") {
    alert("🔒 Access Denied: Only Admin and Manager can configure room rent.");
    return;
  }
  const val = parseFloat(document.getElementById("setting-room-rent").value) || 0;
  state.roomRentPerPerson = val;
  saveState();
  renderUI();
  alert("✓ Standard Monthly Room Rent updated to ₹" + val);
});

// 6. Admin Screen Rendering (User & Role Management CRUD + Attendance & OT Report)
function renderAdminScreen() {
  const user = state.currentUser || state.users[0];
  const isResidentOrCook = user.role === "RESIDENT" || user.role === "EMPLOYEE" || user.role === "COOK";
  const isAdmin = user.role === "ADMIN";
  const isManager = user.role === "MANAGER";

  const activeUsers = (state.users || []).filter(u => u.status === 'ACTIVE').length;
  const totalPlates = getTotalConsumedPlates();
  const plateRate = getDynamicPlateRate();

  document.getElementById("admin-members-count").textContent = isResidentOrCook ? "🔒" : activeUsers;
  document.getElementById("admin-plates-count").textContent = isResidentOrCook ? "🔒" : totalPlates;
  document.getElementById("admin-rate-display").textContent = isResidentOrCook ? "🔒" : `₹${plateRate.toFixed(2)}`;

  const addUsrBtn = document.getElementById("btn-open-add-user");
  const recPunchBtn = document.getElementById("btn-open-manual-att");
  const resetDbBtn = document.getElementById("btn-reset-db");
  const dbControlsCard = document.getElementById("admin-db-controls-card");

  if (addUsrBtn) addUsrBtn.style.display = isResidentOrCook ? "none" : "inline-flex";
  if (recPunchBtn) recPunchBtn.style.display = isResidentOrCook ? "none" : "inline-flex";
  if (resetDbBtn) resetDbBtn.style.display = isAdmin ? "inline-flex" : "none";
  if (dbControlsCard) dbControlsCard.style.display = isAdmin ? "block" : "none";

  // 1. Render Attendance & OT Report Table
  renderAttendanceReport();

  // 1B. Render Master Super Admin Pending User Registrations
  renderPendingUserApprovals();

  // 2. Render User & Role Directory
  const uList = document.getElementById("admin-users-list");
  if (!uList) return;
  uList.innerHTML = "";

  if (isResidentOrCook) {
    uList.innerHTML = `
      <div class="locked-tab-card">
        <div class="locked-icon-bubble">🔒</div>
        <h4 style="margin:0;">Super Admin Control Locked</h4>
        <p class="text-sub">
          Access Restricted: Master User Role Administration, Permissions, and System Settings are strictly protected.<br>
          Normal employees can only view their own dashboard and perform Punch In/Out.
        </p>
      </div>
    `;
    return;
  }

  const roleFilter = state.selectedRoleFilter || "ALL";
  let filteredUsers = state.users || [];
  if (roleFilter !== "ALL") {
    filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
  }

  if (filteredUsers.length === 0) {
    uList.innerHTML = `
      <div class="empty-state">
        <p>No users found for selected role.</p>
        <p class="text-sub mt-1">Click <strong>"+ Add New User"</strong> to register new employees with OTP verification.</p>
      </div>
    `;
    return;
  }

  filteredUsers.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-card-item";
    const roleBadgeClass = u.role === 'ADMIN' ? 'badge-amber' : (u.role === 'MANAGER' ? 'badge-lilac' : (u.role === 'COOK' ? 'badge-blue' : 'badge-success'));
    const isBlocked = u.status === "BLOCKED";

    const isMe = user.id === u.id;
    const isCook = u.role === "COOK";

    let canEdit = false;
    let canDelete = false;
    let canLock = false;

    if (isAdmin) {
      // Super Admin: full access to view, edit, delete, lock/unlock all
      canEdit = true;
      canLock = !isMe;
      canDelete = !isMe && u.role !== 'ADMIN';
    } else if (isManager) {
      // Hostel Manager: restricted access (edit self/Cook, delete Cook only; rest View Only)
      if (isMe) {
        canEdit = true;
        canLock = false;
        canDelete = false;
      } else if (isCook) {
        canEdit = true;
        canLock = false;
        canDelete = true;
      } else {
        canEdit = false;
        canLock = false;
        canDelete = false;
      }
    }

    let actionsHtml = "";
    if (canEdit) {
      actionsHtml += `<button class="btn btn-secondary btn-sm" onclick="openEditUserModal('${u.id}')">✏️ ${isMe ? 'My Profile' : 'Edit'}</button>`;
    }
    if (canLock) {
      actionsHtml += `<button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}')">${isBlocked ? '🔓 Unblock' : '🔒 Lock'}</button>`;
    }
    if (canDelete) {
      actionsHtml += `<button class="btn btn-alert btn-sm" onclick="deleteUser('${u.id}')" title="Delete User">🗑️</button>`;
    }
    if (!canEdit && !canLock && !canDelete) {
      actionsHtml = `<span class="badge badge-gray" style="font-size:10px; padding:4px 8px;">👁️ View Only</span>`;
    }

    div.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>${u.name}</strong>
          <span class="badge ${roleBadgeClass}">${u.role}</span>
          ${isBlocked ? '<span class="badge badge-alert">BLOCKED</span>' : '<span class="badge badge-success">ACTIVE</span>'}
          ${u.isOtpVerified ? '<span class="badge badge-blue" style="font-size:9px;">✓ OTP VERIFIED</span>' : ''}
        </div>
        <p class="text-sub" style="margin-top:2px;">
          Room: <strong>${u.assignedRoom || 'N/A'}</strong> • ID: ${u.userIdCode || 'N/A'} • 📱 +91 ${u.mobile} • Shift: ${u.currentShift || 'OFF_DUTY'}
        </p>
      </div>
      <div class="user-card-actions">
        ${actionsHtml}
      </div>
    `;
    uList.appendChild(div);
  });
}

function renderAttendanceReport() {
  const user = state.currentUser || state.users[0];
  const isResidentOrCook = user.role === "RESIDENT" || user.role === "EMPLOYEE" || user.role === "COOK";
  const isAdmin = user.role === "ADMIN";

  const today = getTodayString();
  const log = state.attendanceLog || [];

  // Metrics for Today
  const todayPunches = log.filter(a => a.date === today);
  const uniqueUsersToday = new Set(todayPunches.map(a => a.userId)).size;
  
  let todayWorkedHours = 0;
  let todayOtHours = 0;

  todayPunches.forEach(a => {
    if (a.status === "ACTIVE") {
      const calc = calculateDutyShift(a.punchInTimestamp, Date.now());
      todayWorkedHours += calc.totalHours;
      todayOtHours += calc.otHours;
    } else {
      todayWorkedHours += (a.totalWorkedHours || 0);
      todayOtHours += (a.otHours || 0);
    }
  });

  const punchedTodayEl = document.getElementById("admin-att-punched-today");
  const workedHrsEl = document.getElementById("admin-att-total-worked-hrs");
  const otHrsEl = document.getElementById("admin-att-total-ot-hrs");

  if (punchedTodayEl) punchedTodayEl.textContent = isResidentOrCook ? "🔒" : uniqueUsersToday;
  if (workedHrsEl) workedHrsEl.textContent = isResidentOrCook ? "🔒" : `${todayWorkedHours.toFixed(1)}h`;
  if (otHrsEl) otHrsEl.textContent = isResidentOrCook ? "🔒" : `${todayOtHours.toFixed(1)}h`;

  const tbody = document.getElementById("admin-attendance-tbody");
  if (!tbody) return;

  if (isResidentOrCook) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-sub" style="padding:28px;">
          🔒 Attendance Master Audit is locked for employee accounts.<br>
          View your personal live punch-in status and overtime hours on the <strong>Resident Home</strong> dashboard.
        </td>
      </tr>
    `;
    return;
  }

  // Populate User Filter Select
  const userSelect = document.getElementById("admin-att-filter-user");
  if (userSelect) {
    const currentVal = state.selectedAttendanceUserFilter || "ALL";
    userSelect.innerHTML = `<option value="ALL">All Employees</option>`;
    (state.users || []).forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role} - Room ${u.assignedRoom || '101'})`;
      if (u.id === currentVal) opt.selected = true;
      userSelect.appendChild(opt);
    });
  }

  // Filter Attendance Log
  let filtered = log.slice().reverse();

  // Date Filter
  if (state.selectedAttendanceDateFilter && state.selectedAttendanceDateFilter !== "ALL") {
    filtered = filtered.filter(a => a.date === state.selectedAttendanceDateFilter);
  }

  // User Filter
  if (state.selectedAttendanceUserFilter && state.selectedAttendanceUserFilter !== "ALL") {
    filtered = filtered.filter(a => a.userId === state.selectedAttendanceUserFilter);
  }

  // Type / OT Filter
  if (state.selectedAttendanceTypeFilter === "OT_ONLY") {
    filtered = filtered.filter(a => {
      if (a.status === "ACTIVE") {
        const calc = calculateDutyShift(a.punchInTimestamp, Date.now());
        return calc.otHours > 0;
      }
      return (a.otHours || 0) > 0;
    });
  } else if (state.selectedAttendanceTypeFilter === "ACTIVE_ONLY") {
    filtered = filtered.filter(a => a.status === "ACTIVE");
  }

  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-sub" style="padding:28px;">
          No attendance punch records found for the selected filter.<br>
          Employees can Punch In/Out from their portal, or Admin/Manager can click <strong>"+ Record Punch"</strong>.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(att => {
    const tr = document.createElement("tr");
    const isActive = att.status === "ACTIVE";
    let worked = att.totalWorkedHours || 0;
    let regular = att.regularHours || 0;
    let ot = att.otHours || 0;

    if (isActive) {
      const calc = calculateDutyShift(att.punchInTimestamp, Date.now());
      worked = calc.totalHours;
      regular = calc.regularHours;
      ot = calc.otHours;
    }

    const otBadge = ot > 0
      ? `<span class="ot-highlight-badge">+${ot.toFixed(2)}h OT</span>`
      : `<span class="text-sub">0.0h</span>`;

    const statusBadge = isActive
      ? `<span class="badge badge-success">🟢 On Duty</span>`
      : `<span class="badge badge-blue">🔵 Completed</span>`;

    const outDisplay = isActive ? `<span class="text-success font-bold">Active Live</span>` : (att.punchOutTime || "--:--");

    const inGpsHtml = (att.gpsInLocation && att.gpsInLocation.available)
      ? `<div style="margin-top:2px;"><a href="${att.gpsInLocation.mapUrl}" target="_blank" rel="noopener" class="gps-pill" title="GPS Accuracy: ±${att.gpsInLocation.accuracy || 10}m">📍 ${att.gpsInLocation.latitude.toFixed(4)}, ${att.gpsInLocation.longitude.toFixed(4)}</a></div>`
      : ``;

    const outGpsHtml = (att.gpsOutLocation && att.gpsOutLocation.available)
      ? `<div style="margin-top:2px;"><a href="${att.gpsOutLocation.mapUrl}" target="_blank" rel="noopener" class="gps-pill" title="GPS Accuracy: ±${att.gpsOutLocation.accuracy || 10}m">📍 ${att.gpsOutLocation.latitude.toFixed(4)}, ${att.gpsOutLocation.longitude.toFixed(4)}</a></div>`
      : ``;

    tr.innerHTML = `
      <td>
        <strong>${att.date}</strong>
        <div class="text-sub">${att.shiftType || 'Normal Shift'}</div>
      </td>
      <td>
        <strong>${att.userName}</strong>
        <div class="text-sub">${att.userRole || 'RESIDENT'} • Room ${att.assignedRoom || '101'} • ${att.userIdCode || ''}</div>
      </td>
      <td>
        <span class="font-mono">${att.punchInTime || '--:--'}</span>
        ${inGpsHtml}
      </td>
      <td>
        <span class="font-mono">${outDisplay}</span>
        ${outGpsHtml}
      </td>
      <td><strong class="font-mono">${worked.toFixed(2)} hrs</strong></td>
      <td><span class="text-sub font-mono">${regular.toFixed(2)} hrs</span></td>
      <td>${otBadge}</td>
      <td>${statusBadge}</td>
      <td>
        ${isAdmin ? `<button class="btn btn-alert btn-sm" onclick="deleteAttendance('${att.id}')" title="Delete record">🗑️</button>` : `<span class="text-sub">-</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPendingUserApprovals() {
  const container = document.getElementById("admin-pending-users-list");
  const countBadge = document.getElementById("admin-pending-users-count");
  if (!container) return;

  const pendingUsers = (state.users || []).filter(u => u.status === "PENDING_APPROVAL");
  if (countBadge) {
    countBadge.textContent = `${pendingUsers.length} Pending`;
    countBadge.className = pendingUsers.length > 0 ? "badge badge-alert" : "badge badge-success";
  }

  container.innerHTML = "";
  if (pendingUsers.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:14px; font-size:12px;">
        ✓ Zero pending user registrations. All user accounts in Firebase Cloud are approved and active.
      </div>
    `;
    return;
  }

  pendingUsers.forEach(u => {
    const card = document.createElement("div");
    card.className = "pending-user-card";
    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : getTodayString();

    card.innerHTML = `
      <div class="pending-user-info">
        <div style="display:flex; align-items:center; gap:8px;">
          <h4>${u.name}</h4>
          <span class="badge badge-alert">⏳ AWAITING SUPER ADMIN APPROVAL</span>
        </div>
        <p class="pending-user-meta" style="margin-top:4px;">
          📱 Mobile: <strong>+91 ${u.mobile}</strong> • Role: <strong>${u.role}</strong> • Room: <strong>${u.assignedRoom || '101'}</strong> • Shift: <strong>${u.currentShift || 'OFF_DUTY'}</strong>
        </p>
        <p class="text-sub" style="font-size:10px; margin-top:2px; color:#64748B;">
          Applied on: ${dateStr} ${u.isOtpVerified ? '• <span style="color:#059669; font-weight:700;">✓ Phone OTP Verified</span>' : ''}
        </p>
      </div>
      <div class="pending-user-actions">
        <button class="btn btn-success btn-sm" onclick="approveUserRegistration('${u.id}')">
          ✓ Approve & Activate
        </button>
        <button class="btn btn-alert btn-sm" onclick="rejectUserRegistration('${u.id}')" title="Reject Request">
          ✕ Reject
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function deleteAttendance(id) {
  if (state.currentUser.role !== "ADMIN") {
    alert("🔒 Access Denied: Only Super Admin can delete attendance records.");
    return;
  }
  if (confirm("Are you sure you want to delete this attendance record?")) {
    state.attendanceLog = (state.attendanceLog || []).filter(a => a.id !== id);
    FirebaseSyncService.deleteAttendance(id);
    saveState();
    renderUI();
  }
}

function toggleUserStatus(userId) {
  if (state.currentUser.role !== "ADMIN") {
    alert("🔒 Access Denied: Only Super Admin can block or unblock users.");
    return;
  }
  const u = state.users.find(x => x.id === userId);
  if (u) {
    u.status = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    FirebaseSyncService.saveUser(u);
    saveState();
    renderUI();
  }
}

function deleteUser(userId) {
  const current = state.currentUser || state.users[0];
  const u = state.users.find(x => x.id === userId);
  if (!u) return;

  if (current.role === "ADMIN") {
    if (u.id === current.id) {
      alert("Cannot delete your own active Super Admin account!");
      return;
    }
    if (confirm(`Delete user "${u.name}" (${u.role}) permanently?`)) {
      state.users = state.users.filter(x => x.id !== userId);
      state.meals = (state.meals || []).filter(m => m.userId !== userId);
      state.pendingLeaves = (state.pendingLeaves || []).filter(l => l.userId !== userId);
      state.attendanceLog = (state.attendanceLog || []).filter(a => a.userId !== userId);
      if (state.currentUser.id === userId) {
        state.currentUser = state.users[0];
      }
      FirebaseSyncService.deleteUser(userId);
      saveState();
      renderUI();
      alert(`✓ User "${u.name}" deleted.`);
    }
    return;
  }

  if (current.role === "MANAGER") {
    if (u.role === "COOK") {
      if (confirm(`Delete Kitchen Cook "${u.name}" permanently?`)) {
        state.users = state.users.filter(x => x.id !== userId);
        state.meals = (state.meals || []).filter(m => m.userId !== userId);
        FirebaseSyncService.deleteUser(userId);
        saveState();
        renderUI();
        alert(`✓ Cook "${u.name}" deleted.`);
      }
      return;
    } else {
      alert("🔒 Restricted Access: Hostel Manager can only delete Kitchen/Cook staff. All other employee and system accounts are View-Only.");
      return;
    }
  }

  alert("🔒 Access Denied: Only Super Admin can delete user accounts.");
}

// Role Filter Buttons
document.querySelectorAll(".role-filter-bar .filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role-filter-bar .filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedRoleFilter = btn.getAttribute("data-role-filter");
    renderAdminScreen();
  });
});

// Modal Helpers
function openModal(id) {
  document.getElementById(id)?.classList.add("active");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
}
document.querySelectorAll(".close-btn").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.target.closest(".modal")?.classList.remove("active");
  });
});

function resetUserModalToStep1() {
  const step1 = document.getElementById("otp-step-1");
  const step2 = document.getElementById("otp-step-2");
  if (step1) step1.classList.add("active");
  if (step2) step2.classList.remove("active");
  const otpInput = document.getElementById("input-verify-otp");
  if (otpInput) otpInput.value = "";
  if (OtpAuthService.countdownInterval) {
    clearInterval(OtpAuthService.countdownInterval);
  }
}

function startOtpCountdown() {
  if (OtpAuthService.countdownInterval) clearInterval(OtpAuthService.countdownInterval);
  let seconds = 30;
  const timerDisplay = document.getElementById("otp-timer-display");
  const resendBtn = document.getElementById("btn-resend-otp");
  if (resendBtn) resendBtn.disabled = true;

  if (timerDisplay) timerDisplay.textContent = `Resend code in ${seconds}s`;
  OtpAuthService.countdownInterval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(OtpAuthService.countdownInterval);
      if (timerDisplay) timerDisplay.textContent = "Didn't receive code? Click resend.";
      if (resendBtn) resendBtn.disabled = false;
    } else {
      if (timerDisplay) timerDisplay.textContent = `Resend code in ${seconds}s`;
    }
  }, 1000);
}

// 7. Add / Edit User Form Handlers with OTP Verification & Strict Role Quotas
document.getElementById("btn-open-add-user")?.addEventListener("click", () => {
  if (!isAuthorizedToOnboardUsers()) {
    alert("🔒 Access Denied: Public registration is restricted.\n\nOnly Super Admin and Hostel Manager have authorization to onboard new employees/residents.");
    return;
  }
  resetUserModalToStep1();
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Onboard New Employee / User (Admin/Manager)";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  document.getElementById("form-user-mobile").value = "";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "📲 Send Verification OTP";
  openModal("modal-user-form");
});

document.getElementById("btn-mgr-add-resident")?.addEventListener("click", () => {
  if (!isAuthorizedToOnboardUsers()) {
    alert("🔒 Access Denied: Public registration is restricted.\n\nOnly Super Admin and Hostel Manager have authorization to onboard new employees/residents.");
    return;
  }
  resetUserModalToStep1();
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Onboard New Resident (Manager Onboarding)";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  document.getElementById("form-user-mobile").value = "";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "📲 Send Verification OTP";
  openModal("modal-user-form");
});

document.getElementById("btn-switch-modal-register")?.addEventListener("click", () => {
  if (!isAuthorizedToOnboardUsers()) {
    alert("🔒 Registration Restricted: Public self-registration is closed.\n\nOnly Super Admin and Hostel Manager are authorized to onboard and register new employees/residents. Please contact your Hostel Manager to register your account.");
    return;
  }
  closeModal("modal-switch-user");
  resetUserModalToStep1();
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Onboard New Employee (Authorized Onboarding)";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  document.getElementById("form-user-mobile").value = "";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "📲 Send Verification OTP";
  openModal("modal-user-form");
});

function openEditUserModal(userId) {
  const u = state.users.find(x => x.id === userId);
  if (!u) return;

  const current = state.currentUser || state.users[0];
  if (current.role !== "ADMIN") {
    const isMe = current.id === u.id;
    const isCook = u.role === "COOK";
    if (!isMe && !isCook) {
      alert("🔒 Restricted Access: Hostel Manager can only edit their own profile and Cook/Kitchen staff. Other employee records are View-Only.");
      return;
    }
  }

  resetUserModalToStep1();
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = `Edit User: ${u.name}`;
  document.getElementById("form-user-id").value = u.id;
  document.getElementById("form-user-name").value = u.name;
  document.getElementById("form-user-mobile").value = u.mobile;
  document.getElementById("form-user-role").value = u.role;
  document.getElementById("form-user-room").value = u.assignedRoom || "";
  document.getElementById("form-user-code").value = u.userIdCode || "";
  document.getElementById("form-user-shift").value = u.currentShift || "OFF_DUTY";
  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "💾 Save User Changes";
  openModal("modal-user-form");
}

// Step 1: Proceed to OTP or Save Direct Edit
document.getElementById("btn-proceed-otp")?.addEventListener("click", () => {
  const editId = document.getElementById("form-user-id").value;
  const name = document.getElementById("form-user-name").value.trim();
  const mobile = document.getElementById("form-user-mobile").value.trim();
  const role = document.getElementById("form-user-role").value;
  const room = document.getElementById("form-user-room").value.trim();
  const code = document.getElementById("form-user-code").value.trim();
  const shift = document.getElementById("form-user-shift").value;

  if (!name) {
    alert("Please enter user's Full Name!");
    return;
  }
  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    alert("Please enter a valid 10-digit Mobile Number (e.g. 9876543210) for OTP verification!");
    return;
  }

  // 1. Strict Security Rule: Restrict Public Registration
  if (!editId && !isAuthorizedToOnboardUsers()) {
    alert("🔒 Access Denied: Public registration is restricted.\n\nOnly Super Admin and Hostel Manager have authorization to onboard new accounts.");
    return;
  }

  // 2. Strict Security Rule: Duplicate Mobile Number Check
  if (!editId) {
    const existingUser = findUserByMobile(mobile);
    if (existingUser) {
      alert(`🚫 Number already registered. Please login instead.\n\nMobile number (+91 ${mobile}) is already registered to "${existingUser.name}" (${existingUser.role}). Duplicate registration is blocked.`);
      return;
    }
  } else {
    const existingOther = findUserByMobile(mobile, editId);
    if (existingOther) {
      alert(`🚫 Update Blocked: Mobile number (+91 ${mobile}) is already assigned to another user ("${existingOther.name}").`);
      return;
    }
  }

  // 3. Strict Role Quota Check (Max 2 Admin, Max 3 Manager, Unlimited Employees)
  const quotaCheck = checkRoleQuotaAvailable(role, editId);
  if (!quotaCheck.allowed) {
    alert(quotaCheck.message);
    return;
  }

  if (editId) {
    // Direct Edit Mode (Admin / Manager)
    const current = state.currentUser || state.users[0];
    if (current.role !== "ADMIN") {
      const isMe = current.id === editId;
      const existingUser = state.users.find(x => x.id === editId);
      const isCook = existingUser && existingUser.role === "COOK";
      if (!isMe && !isCook) {
        alert("🔒 Restricted Access: Hostel Manager can only edit their own profile and Cook/Kitchen staff.");
        return;
      }
    }

    const existing = state.users.find(x => x.id === editId);
    if (existing) {
      existing.name = name;
      existing.mobile = mobile;
      existing.role = role;
      existing.assignedRoom = room || "101";
      existing.userIdCode = code || existing.userIdCode;
      existing.currentShift = shift;

      if (state.currentUser.id === editId) {
        state.currentUser = existing;
      }
      FirebaseSyncService.saveUser(existing);
    }

    saveState();
    renderUI();
    closeModal("modal-user-form");
    alert(`✓ User details for "${name}" updated successfully!`);
    return;
  }

  // New Registration Flow -> Send OTP
  const userData = { name, mobile, role, room, code, shift };
  const otpCode = OtpAuthService.sendOtp(userData);

  // Configure Step 2 UI
  const targetMobEl = document.getElementById("otp-target-mobile");
  if (targetMobEl) targetMobEl.textContent = `+91 ${mobile}`;
  const codeEl = document.getElementById("simulated-otp-code");
  if (codeEl) codeEl.textContent = otpCode;
  const otpInput = document.getElementById("input-verify-otp");
  if (otpInput) otpInput.value = "";

  // Switch to Step 2
  document.getElementById("otp-step-1")?.classList.remove("active");
  document.getElementById("otp-step-2")?.classList.add("active");

  startOtpCountdown();
});

// Auto-fill OTP Helper
document.getElementById("btn-autofill-otp")?.addEventListener("click", () => {
  const currentOtp = OtpAuthService.activeSession ? OtpAuthService.activeSession.otp : "1234";
  const input = document.getElementById("input-verify-otp");
  if (input) input.value = currentOtp;
});

// Back to Step 1
document.getElementById("btn-back-otp-step")?.addEventListener("click", () => {
  document.getElementById("otp-step-2")?.classList.remove("active");
  document.getElementById("otp-step-1")?.classList.add("active");
  if (OtpAuthService.countdownInterval) clearInterval(OtpAuthService.countdownInterval);
});

// Resend OTP
document.getElementById("btn-resend-otp")?.addEventListener("click", () => {
  if (!OtpAuthService.activeSession) return;
  const newOtp = OtpAuthService.sendOtp(OtpAuthService.activeSession.userData);
  const codeEl = document.getElementById("simulated-otp-code");
  if (codeEl) codeEl.textContent = newOtp;
  const otpInput = document.getElementById("input-verify-otp");
  if (otpInput) otpInput.value = "";
  startOtpCountdown();
  alert(`✓ New OTP sent to +91 ${OtpAuthService.activeSession.phone}! Code: ${newOtp}`);
});

// Step 2: Verify OTP & Complete Registration
document.getElementById("btn-verify-and-register")?.addEventListener("click", () => {
  const enteredOtp = document.getElementById("input-verify-otp")?.value.trim();
  if (!enteredOtp) {
    alert("Please enter the 4-digit verification code!");
    return;
  }

  const result = OtpAuthService.verify(enteredOtp);
  if (!result.success) {
    alert("❌ " + result.message);
    return;
  }

  const uData = result.userData;

  // Re-verify authorization and duplicate mobile before creation
  if (!isAuthorizedToOnboardUsers()) {
    alert("🔒 Access Denied: Public registration is restricted. Only Super Admin and Hostel Manager can onboard users.");
    return;
  }

  const duplicateCheck = findUserByMobile(uData.mobile);
  if (duplicateCheck) {
    alert(`🚫 Number already registered. Please login instead.\n\nMobile number (+91 ${uData.mobile}) is already registered.`);
    return;
  }

  // Re-verify quota before creation
  const quotaCheck = checkRoleQuotaAvailable(uData.role);
  if (!quotaCheck.allowed) {
    alert(quotaCheck.message);
    return;
  }

  const prefix = uData.role === "ADMIN" ? "ADM" : (uData.role === "MANAGER" ? "MGR" : (uData.role === "COOK" ? "CK" : "EMP"));
  const generatedCode = uData.code || `${prefix}_${Math.floor(100 + Math.random() * 900)}`;

  // Rule 3: Master Super Admin directly creates ACTIVE users; registrations from others/self require Super Admin Approval
  const currentActor = state.currentUser || state.users[0];
  const isMasterAdminCreating = currentActor && currentActor.role === "ADMIN";
  const userInitialStatus = isMasterAdminCreating ? "ACTIVE" : "PENDING_APPROVAL";

  const newUser = {
    id: "usr_" + Date.now(),
    name: uData.name,
    mobile: uData.mobile,
    role: uData.role,
    assignedRoom: uData.room || (uData.role === "ADMIN" ? "Office" : (uData.role === "COOK" ? "Kitchen" : "101")),
    userIdCode: generatedCode,
    status: userInitialStatus,
    currentShift: uData.shift,
    isOtpVerified: true,
    verifiedAt: Date.now(),
    createdAt: Date.now()
  };

  state.users.push(newUser);
  FirebaseSyncService.saveUser(newUser);

  // If new user is resident, initialize today's meals based on shift
  if (uData.role === "RESIDENT" || uData.role === "EMPLOYEE") {
    const isAutoOn = (uData.shift === "OFF_DUTY" || uData.shift === "NIGHT") && userInitialStatus === "ACTIVE";
    ["LUNCH", "DINNER"].forEach(type => {
      const meal = {
        id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 4),
        userId: newUser.id,
        userName: newUser.name,
        roomNumber: newUser.assignedRoom,
        mealType: type,
        status: isAutoOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: uData.shift
      };
      state.meals.push(meal);
      FirebaseSyncService.saveMeal(meal);
    });
  }

  saveState();
  renderUI();
  closeModal("modal-user-form");
  resetUserModalToStep1();

  if (userInitialStatus === "PENDING_APPROVAL") {
    alert(`✓ Registration Saved to Firebase Cloud!\n\nUser "${newUser.name}" (+91 ${newUser.mobile}) registered.\nStatus: PENDING APPROVAL. The Master Super Admin must approve this account before duty clock and meal booking are unlocked.`);
  } else {
    alert(`✓ Phone Verification & Onboarding Complete!\nEmployee "${newUser.name}" (+91 ${newUser.mobile}) onboarded and synced to Firebase with role ${newUser.role}.`);
  }
});

// 8. Add Real Expense Form Handlers (Mess / Grocery Expense Workflow)
document.getElementById("btn-open-add-expense")?.addEventListener("click", () => {
  document.getElementById("exp-form-date").value = getTodayString();
  document.getElementById("exp-form-amount").value = "";
  document.getElementById("exp-form-note").value = "";
  openModal("modal-add-expense");
});

document.getElementById("btn-save-expense")?.addEventListener("click", () => {
  const date = document.getElementById("exp-form-date").value || getTodayString();
  const category = document.getElementById("exp-form-category").value;
  const amount = parseFloat(document.getElementById("exp-form-amount").value);
  const note = document.getElementById("exp-form-note").value.trim();
  const mode = document.getElementById("exp-form-mode").value;

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid expense amount!");
    return;
  }
  if (!note) {
    alert("Please enter an item name / bill voucher description!");
    return;
  }

  const user = state.currentUser || state.users[0];
  const isManagerOrAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
  const initialStatus = isManagerOrAdmin ? "APPROVED" : "PENDING";

  const newExpense = {
    id: "exp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    date: date,
    category: category,
    amount: amount,
    description: note,
    paymentMode: mode,
    recordedBy: user ? user.name : "Admin",
    recordedById: user ? user.id : "usr_admin",
    recordedByRole: user ? user.role : "RESIDENT",
    status: initialStatus,
    approvedBy: isManagerOrAdmin ? (user ? user.name : "Admin") : null,
    approvedAt: isManagerOrAdmin ? Date.now() : null,
    createdAt: Date.now()
  };

  if (!state.expensesLog) state.expensesLog = [];
  state.expensesLog.push(newExpense);
  FirebaseSyncService.saveExpense(newExpense);

  saveState();
  renderUI();
  closeModal("modal-add-expense");

  if (initialStatus === "PENDING") {
    alert(`✓ Mess purchase request of ₹${amount.toFixed(2)} ("${note}") submitted for approval!\n\nStatus: PENDING. It has been routed to the Hostel Manager & Super Admin dashboard. Once approved, it will be added to the hostel ledger and plate rate calculations.`);
  } else {
    alert(`✓ Recorded and approved actual expense of ₹${amount.toFixed(2)} under ${formatCategoryName(category)}!`);
  }
});

// 9. Switch User Modal Handlers
document.getElementById("btn-switch-user")?.addEventListener("click", () => {
  const list = document.getElementById("switch-account-list");
  list.innerHTML = "";
  state.users.forEach(u => {
    const item = document.createElement("div");
    item.className = `account-item ${state.currentUser.id === u.id ? "selected" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${u.name}</strong>
        <p class="text-sub">${u.role} • Room ${u.assignedRoom || 'N/A'} • 📱 +91 ${u.mobile || 'N/A'}</p>
      </div>
      <span class="role-tag">${u.role}</span>
    `;
    item.onclick = () => {
      state.currentUser = u;
      saveState();
      renderUI();
      closeModal("modal-switch-user");
    };
    list.appendChild(item);
  });

  const regBtn = document.getElementById("btn-switch-modal-register");
  const isAuth = isAuthorizedToOnboardUsers();
  if (regBtn) {
    if (isAuth) {
      regBtn.style.display = "block";
      regBtn.innerHTML = `➕ Onboard New User (Super Admin & Manager Only)`;
    } else {
      regBtn.style.display = "none";
    }
  }

  const regRestrictedNotice = document.getElementById("switch-modal-restricted-notice");
  if (regRestrictedNotice) {
    regRestrictedNotice.style.display = isAuth ? "none" : "block";
  }

  openModal("modal-switch-user");
});

// 10. View Itemized Invoice Modal (Real Calculations)
document.getElementById("btn-view-invoice")?.addEventListener("click", () => {
  const user = state.currentUser;
  const userMeals = (state.meals || []).filter(m => m.userId === user.id && (m.status === "ON" || m.status === "PACK_TIFFIN" || m.status === "LATE_COVERED"));
  const myPlates = userMeals.length;

  const expTotals = calculateExpenseTotals();
  const totalPlatesAll = getTotalConsumedPlates();
  const plateRate = getDynamicPlateRate();
  const myMealCost = myPlates * plateRate;

  const activeResidents = (state.users || []).filter(u => u.status === "ACTIVE" && u.role === "RESIDENT").length ||
                          (state.users || []).filter(u => u.status === "ACTIVE").length || 1;

  const elecShare = expTotals.ELECTRICITY / activeResidents;
  const waterShare = expTotals.WATER / activeResidents;
  const cookShare = expTotals.COOK_SALARY / activeResidents;
  const rent = (user.role === "RESIDENT" || user.role === "EMPLOYEE") ? (state.roomRentPerPerson || 1500) : 0;
  const grandTotal = myMealCost + elecShare + waterShare + cookShare + rent;

  const tbody = document.getElementById("invoice-breakdown-tbody");
  tbody.innerHTML = `
    <tr>
      <td>🛒 Mess Grocery & Ration</td>
      <td>${myPlates} plates × ₹${plateRate.toFixed(2)} (from ₹${expTotals.GROCERY.toFixed(2)} real grocery total)</td>
      <td class="text-right font-bold">₹${myMealCost.toFixed(2)}</td>
    </tr>
    <tr>
      <td>⚡ Electricity Share</td>
      <td>1/${activeResidents} share of ₹${expTotals.ELECTRICITY.toFixed(2)} recorded bill</td>
      <td class="text-right font-bold">₹${elecShare.toFixed(2)}</td>
    </tr>
    <tr>
      <td>💧 Water & LPG Share</td>
      <td>1/${activeResidents} share of ₹${expTotals.WATER.toFixed(2)} recorded bill</td>
      <td class="text-right font-bold">₹${waterShare.toFixed(2)}</td>
    </tr>
    <tr>
      <td>👨‍🍳 Cook & Staff Salary</td>
      <td>1/${activeResidents} share of ₹${expTotals.COOK_SALARY.toFixed(2)} recorded salary</td>
      <td class="text-right font-bold">₹${cookShare.toFixed(2)}</td>
    </tr>
    <tr>
      <td>🏢 Standard Room Rent</td>
      <td>Monthly standard facility</td>
      <td class="text-right font-bold">₹${rent.toFixed(2)}</td>
    </tr>
  `;

  document.getElementById("invoice-modal-total").textContent = `₹${grandTotal.toFixed(2)}`;
  openModal("modal-invoice");
});

// 11. Overtime / Late Plate Handlers
document.getElementById("btn-quick-late-plate")?.addEventListener("click", () => {
  if (isUserOnLeave(state.currentUser)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Overtime meal requests are locked in View-Only mode.");
    return;
  }
  openModal("modal-ot");
});

document.querySelectorAll(".ot-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".ot-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    const hours = parseInt(chip.getAttribute("data-hours"));
    state.selectedOtHours = hours;
    const expl = document.getElementById("ot-explanation");
    expl.innerHTML = hours >= 4
      ? `🍱 <strong>Long OT (${hours}h):</strong> Kitchen will <strong>Pack Tiffin</strong> for your work site.`
      : `🍲 <strong>Short OT (${hours}h):</strong> Kitchen will pack a <strong>Late Plate</strong> (ढक कर रखा जाएगा).`;
  });
});

document.getElementById("btn-confirm-ot")?.addEventListener("click", () => {
  const user = state.currentUser;
  if (isUserOnLeave(user)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Overtime meal requests are frozen.");
    return;
  }

  const hours = state.selectedOtHours || 2;
  const status = hours >= 4 ? "PACK_TIFFIN" : "LATE_COVERED";
  
  let meal = state.meals.find(m => m.userId === user.id && m.mealType === "DINNER");
  if (meal) {
    meal.status = status;
    meal.otHours = hours;
    FirebaseSyncService.saveMeal(meal);
  } else {
    meal = {
      id: "m_" + Date.now(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.assignedRoom || "101",
      mealType: "DINNER",
      status: status,
      otHours: hours,
      shiftAtTime: user.currentShift || "OFF_DUTY"
    };
    state.meals.push(meal);
    FirebaseSyncService.saveMeal(meal);
  }
  saveState();
  renderUI();
  closeModal("modal-ot");
  alert(`✓ Overtime Dinner Meal recorded (${status})!`);
});

// Quick Action Bar Handlers in Resident Screen
document.getElementById("btn-quick-add-purchase")?.addEventListener("click", () => {
  document.getElementById("exp-form-date").value = getTodayString();
  document.getElementById("exp-form-amount").value = "";
  document.getElementById("exp-form-note").value = "";
  openModal("modal-add-expense");
});

document.getElementById("btn-quick-leave-request")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  if (isUserOnLeave(user)) {
    document.getElementById("leave-end-return-date").value = getTodayString();
    openModal("modal-leave-end");
  } else {
    document.getElementById("leave-start").value = getTodayString();
    document.getElementById("leave-end").value = getTodayString();
    openModal("modal-leave");
  }
});

// 12. Leave Submission Handlers (Leave Start & Leave End Requests)
document.getElementById("btn-open-leave")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  if (isUserOnLeave(user)) {
    document.getElementById("leave-end-return-date").value = getTodayString();
    openModal("modal-leave-end");
  } else {
    document.getElementById("leave-start").value = getTodayString();
    document.getElementById("leave-end").value = getTodayString();
    openModal("modal-leave");
  }
});

// Submit Leave Application (Leave Start)
document.getElementById("btn-submit-leave")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  const start = document.getElementById("leave-start").value || getTodayString();
  const end = document.getElementById("leave-end").value || getTodayString();
  const reason = document.getElementById("leave-reason").value.trim() || "Village / Family Visit";

  const d1 = new Date(start);
  const d2 = new Date(end);
  const diffTime = Math.max(0, d2 - d1);
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (!state.pendingLeaves) state.pendingLeaves = [];
  const newLeave = {
    id: "lev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "LEAVE_START",
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userRoom: user.assignedRoom || "101",
    startDate: start,
    endDate: end,
    totalDays: totalDays,
    reason: reason,
    status: "PENDING",
    createdAt: Date.now()
  };
  state.pendingLeaves.push(newLeave);
  FirebaseSyncService.saveLeave(newLeave);

  saveState();
  renderUI();
  closeModal("modal-leave");
  alert(`✓ Leave application submitted to Manager/Admin!\n\nLeave Dates: ${start} to ${end} (${totalDays} days).\nOnce approved, your status will switch to 'ON LEAVE' and meal bookings will be locked to prevent wastage.`);
});

// Submit Return to Duty Request (Leave End)
document.getElementById("btn-submit-leave-end")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  const returnDate = document.getElementById("leave-end-return-date").value || getTodayString();
  const resumingShift = document.getElementById("leave-end-shift").value || "MORNING";
  const note = document.getElementById("leave-end-note").value.trim() || "Returned from leave, ready for duty";

  if (!state.pendingLeaves) state.pendingLeaves = [];
  const newLeaveEnd = {
    id: "lev_end_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    type: "LEAVE_END",
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    userRoom: user.assignedRoom || "101",
    returnDate: returnDate,
    resumingShift: resumingShift,
    reason: note,
    status: "PENDING",
    createdAt: Date.now()
  };
  state.pendingLeaves.push(newLeaveEnd);
  FirebaseSyncService.saveLeave(newLeaveEnd);

  saveState();
  renderUI();
  closeModal("modal-leave-end");
  alert(`✓ Duty Return Request submitted to Manager/Admin!\n\nReturn Date: ${returnDate} (Shift: ${resumingShift}).\nOnce approved by the Hostel Manager/Super Admin, your permissions (Punch In/Out, Meal booking, Shifts) will be fully restored.`);
});

// 13. Guest Plates Handlers
document.getElementById("btn-open-guest-modal")?.addEventListener("click", () => {
  if (isUserOnLeave(state.currentUser)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Guest meals cannot be requested.");
    return;
  }
  openModal("modal-guest");
});

document.getElementById("btn-confirm-guest")?.addEventListener("click", () => {
  if (isUserOnLeave(state.currentUser)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Guest meals cannot be added.");
    return;
  }
  const count = parseInt(document.getElementById("guest-count").value) || 2;
  const note = document.getElementById("guest-note").value || "Guests";
  for (let i = 0; i < count; i++) {
    const guestMeal = {
      id: "m_guest_" + Date.now() + "_" + i,
      userId: "guest_" + Date.now() + "_" + i,
      userName: `Guest (${note})`,
      roomNumber: "Guest",
      mealType: state.activeKitchenMeal || "LUNCH",
      status: "ON",
      otHours: 0,
      shiftAtTime: "OFF_DUTY"
    };
    state.meals.push(guestMeal);
    FirebaseSyncService.saveMeal(guestMeal);
  }
  saveState();
  renderUI();
  closeModal("modal-guest");
  alert(`✓ Added +${count} guest plates to ${state.activeKitchenMeal} counter!`);
});

// 14. Attendance & Overtime (OT) Module Event Listeners
// Employee Punch In (Auto GPS + Firestore Sync)
document.getElementById("btn-employee-punch-in")?.addEventListener("click", async () => {
  const user = state.currentUser || state.users[0];
  if (isUserPendingApproval(user)) {
    alert("🔒 Registration Pending: Your account is awaiting Super Admin approval before you can Punch In for duty.");
    return;
  }
  if (isUserOnLeave(user)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Duty Punch In is blocked until Manager/Admin approves your return request.");
    return;
  }

  const active = getActivePunch(user.id);
  if (active) {
    alert("⚠️ You already have an active duty shift running! Please punch out before starting a new shift.");
    return;
  }

  const btnPunchIn = document.getElementById("btn-employee-punch-in");
  const origHtml = btnPunchIn ? btnPunchIn.innerHTML : "";
  if (btnPunchIn) {
    btnPunchIn.disabled = true;
    btnPunchIn.innerHTML = `<span>🛰️ Fetching Live GPS Location...</span>`;
  }

  const gpsLocation = await fetchCurrentGpsLocation();
  const now = new Date();
  const newRecord = {
    id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    assignedRoom: user.assignedRoom || "101",
    userIdCode: user.userIdCode || "EMP",
    shiftType: user.currentShift || "MORNING",
    date: getTodayString(),
    punchInTime: formatTimeAMPM(now),
    punchInTimestamp: now.getTime(),
    punchOutTime: null,
    punchOutTimestamp: null,
    punchInLocation: gpsLocation,
    gpsInLocation: gpsLocation,
    punchOutLocation: null,
    gpsOutLocation: null,
    totalWorkedHours: 0,
    regularHours: 0,
    otHours: 0,
    status: "ACTIVE",
    note: "Live GPS Punch In"
  };

  if (!state.attendanceLog) state.attendanceLog = [];
  state.attendanceLog.push(newRecord);
  saveState();
  FirebaseSyncService.saveAttendance(newRecord);
  renderUI();

  const gpsNotice = gpsLocation.available 
    ? `\n📍 GPS Coordinates Captured: ${gpsLocation.display}` 
    : `\n⚠️ GPS: ${gpsLocation.display}`;

  alert(`✓ Punch In recorded at ${formatTimeShort(now)}!\nDuty shift started. Standard shift is 8.0 hours; extra time will be auto-calculated as Overtime (OT).${gpsNotice}`);
});

// Employee Punch Out (Auto GPS + Firestore Sync)
document.getElementById("btn-employee-punch-out")?.addEventListener("click", async () => {
  const user = state.currentUser || state.users[0];
  if (isUserPendingApproval(user)) {
    alert("🔒 Registration Pending: Your account is awaiting Super Admin approval.");
    return;
  }
  if (isUserOnLeave(user)) {
    alert("🔒 Leave Lockout Active: You are currently ON LEAVE. Duty Punch Out is blocked in View-Only mode.");
    return;
  }

  const active = getActivePunch(user.id);
  if (!active) {
    alert("⚠️ No active punch-in found for today.");
    return;
  }

  const btnPunchOut = document.getElementById("btn-employee-punch-out");
  if (btnPunchOut) {
    btnPunchOut.disabled = true;
    btnPunchOut.innerHTML = `<span>🛰️ Fetching Live GPS Location...</span>`;
  }

  const gpsOutLocation = await fetchCurrentGpsLocation();
  const now = new Date();
  const calc = calculateDutyShift(active.punchInTimestamp, now.getTime());

  active.punchOutTime = formatTimeAMPM(now);
  active.punchOutTimestamp = now.getTime();
  active.punchOutLocation = gpsOutLocation;
  active.gpsOutLocation = gpsOutLocation;
  active.totalWorkedHours = calc.totalHours;
  active.regularHours = calc.regularHours;
  active.otHours = calc.otHours;
  active.status = "COMPLETED";

  saveState();
  FirebaseSyncService.saveAttendance(active);
  renderUI();

  const otMsg = calc.otHours > 0
    ? `\n⚡ Overtime: +${calc.otHours.toFixed(2)} OT Hours recorded!`
    : `\nStandard shift (8h) completed.`;

  const gpsNotice = gpsOutLocation.available 
    ? `\n📍 Punch Out GPS Captured: ${gpsOutLocation.display}` 
    : `\n⚠️ GPS: ${gpsOutLocation.display}`;

  alert(`✓ Punch Out recorded at ${formatTimeShort(now)}!\nTotal Worked: ${calc.totalHours.toFixed(2)} hrs (Standard: ${calc.regularHours.toFixed(2)}h)${otMsg}${gpsNotice}`);
});

// Attendance Report Filters
document.getElementById("admin-att-filter-date")?.addEventListener("change", (e) => {
  state.selectedAttendanceDateFilter = e.target.value || "ALL";
  document.getElementById("btn-att-filter-all-dates")?.classList.remove("active");
  document.getElementById("btn-att-filter-today")?.classList.remove("active");
  renderAttendanceReport();
});

document.getElementById("btn-att-filter-all-dates")?.addEventListener("click", () => {
  document.getElementById("btn-att-filter-all-dates")?.classList.add("active");
  document.getElementById("btn-att-filter-today")?.classList.remove("active");
  const dateInput = document.getElementById("admin-att-filter-date");
  if (dateInput) dateInput.value = "";
  state.selectedAttendanceDateFilter = "ALL";
  renderAttendanceReport();
});

document.getElementById("btn-att-filter-today")?.addEventListener("click", () => {
  document.getElementById("btn-att-filter-all-dates")?.classList.remove("active");
  document.getElementById("btn-att-filter-today")?.classList.add("active");
  const today = getTodayString();
  const dateInput = document.getElementById("admin-att-filter-date");
  if (dateInput) dateInput.value = today;
  state.selectedAttendanceDateFilter = today;
  renderAttendanceReport();
});

document.getElementById("admin-att-filter-user")?.addEventListener("change", (e) => {
  state.selectedAttendanceUserFilter = e.target.value;
  renderAttendanceReport();
});

document.getElementById("admin-att-filter-type")?.addEventListener("change", (e) => {
  state.selectedAttendanceTypeFilter = e.target.value;
  renderAttendanceReport();
});

// Manual Attendance Modal Handlers
document.getElementById("btn-open-manual-att")?.addEventListener("click", () => {
  const userSelect = document.getElementById("man-att-user");
  if (userSelect) {
    userSelect.innerHTML = "";
    (state.users || []).forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role} • Room ${u.assignedRoom || '101'})`;
      userSelect.appendChild(opt);
    });
  }

  document.getElementById("man-att-date").value = getTodayString();
  document.getElementById("man-att-in-time").value = "08:00";
  document.getElementById("man-att-out-time").value = "17:00";
  document.getElementById("man-att-shift").value = "MORNING";
  document.getElementById("man-att-note").value = "";
  updateManualAttendancePreview();
  openModal("modal-manual-attendance");
});

function updateManualAttendancePreview() {
  const inVal = document.getElementById("man-att-in-time")?.value || "08:00";
  const outVal = document.getElementById("man-att-out-time")?.value || "17:00";

  const inParts = inVal.split(":").map(Number);
  const outParts = outVal.split(":").map(Number);

  let inMinutes = inParts[0] * 60 + inParts[1];
  let outMinutes = outParts[0] * 60 + outParts[1];

  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60; // Cross midnight
  }

  const totalHrs = Math.max(0, (outMinutes - inMinutes) / 60);
  const roundedTotal = Math.round(totalHrs * 100) / 100;
  const regular = Math.min(roundedTotal, 8.00);
  const ot = Math.max(0, Math.round((roundedTotal - 8.00) * 100) / 100);

  const prevBox = document.getElementById("man-att-preview-calc");
  if (prevBox) {
    prevBox.innerHTML = `⏱️ <strong>Shift Calculation:</strong> In: ${inVal} → Out: ${outVal} = <strong>${roundedTotal.toFixed(2)} hrs</strong> (${regular.toFixed(2)}h Standard + <span style="color:#B45309; font-weight:800;">${ot.toFixed(2)}h OT</span>)`;
  }
}

document.getElementById("man-att-in-time")?.addEventListener("input", updateManualAttendancePreview);
document.getElementById("man-att-out-time")?.addEventListener("input", updateManualAttendancePreview);

document.getElementById("btn-save-manual-att")?.addEventListener("click", () => {
  const userId = document.getElementById("man-att-user").value;
  const date = document.getElementById("man-att-date").value || getTodayString();
  const inVal = document.getElementById("man-att-in-time").value || "08:00";
  const outVal = document.getElementById("man-att-out-time").value;
  const shift = document.getElementById("man-att-shift").value;
  const note = document.getElementById("man-att-note").value.trim();

  const user = (state.users || []).find(u => u.id === userId);
  if (!user) {
    alert("Please select an employee!");
    return;
  }

  const inParts = inVal.split(":").map(Number);
  const dIn = new Date(`${date}T${inVal}:00`);
  const inTs = isNaN(dIn.getTime()) ? Date.now() : dIn.getTime();

  let outTs = null;
  let outTimeFormatted = null;
  let totalWorked = 0;
  let regular = 0;
  let ot = 0;
  let status = "ACTIVE";

  if (outVal) {
    let dOut = new Date(`${date}T${outVal}:00`);
    if (dOut.getTime() < inTs) {
      dOut = new Date(dOut.getTime() + 24 * 3600 * 1000);
    }
    outTs = dOut.getTime();
    outTimeFormatted = formatTimeAMPM(dOut);
    const calc = calculateDutyShift(inTs, outTs);
    totalWorked = calc.totalHours;
    regular = calc.regularHours;
    ot = calc.otHours;
    status = "COMPLETED";
  }

  const newRecord = {
    id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    assignedRoom: user.assignedRoom || "101",
    userIdCode: user.userIdCode || "EMP",
    shiftType: shift,
    date: date,
    punchInTime: formatTimeAMPM(dIn),
    punchInTimestamp: inTs,
    punchOutTime: outTimeFormatted,
    punchOutTimestamp: outTs,
    totalWorkedHours: totalWorked,
    regularHours: regular,
    otHours: ot,
    status: status,
    note: note || "Manual Admin Entry"
  };

  if (!state.attendanceLog) state.attendanceLog = [];
  state.attendanceLog.push(newRecord);
  FirebaseSyncService.saveAttendance(newRecord);
  saveState();
  renderUI();
  closeModal("modal-manual-attendance");
  alert(`✓ Attendance recorded for ${user.name} on ${date}!\nTotal: ${totalWorked.toFixed(2)}h (${regular.toFixed(2)}h Standard + ${ot.toFixed(2)}h OT).`);
});

// 15. Reset Database Handler (Super Admin Only)
document.getElementById("btn-reset-db")?.addEventListener("click", () => {
  if (state.currentUser.role !== "ADMIN") {
    alert("🔒 Access Denied: Only Super Admin has master authority to reset all local data.");
    return;
  }
  if (confirm("⚠️ Super Admin Master Action: Are you sure you want to reset all local data? This will clear all attendance punches, custom expenses, leaves, and custom users, and initialize with clean Super Admin settings.")) {
    state = JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
    saveState();
    renderUI();
    alert("✓ Database reset cleanly! You can now add real users, actual expenses, and attendance punches.");
  }
});

// Initial boot render & routing
renderUI();
handleUrlRouting();

// 16. Progressive Web App (PWA) Service Worker Registration & Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Register root or relative service worker
    const swUrl = window.location.pathname.includes('/webapp') ? '../service-worker.js' : 'service-worker.js';
    navigator.serviceWorker.register(swUrl)
      .then((reg) => {
        console.log('✓ Hostel Manager PWA Service Worker Registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.log('PWA Service Worker Registration failed (falling back to standard cache):', err);
      });
  });
}

// Listen for Online/Offline state changes for robust connectivity awareness
window.addEventListener('online', () => {
  console.log('Network status: Back online');
});
window.addEventListener('offline', () => {
  console.log('Network status: Offline mode active (localStorage + PWA Cache)');
});
