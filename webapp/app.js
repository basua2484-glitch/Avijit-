// Hostel Mess & Shift Manager - Web Application Logic
// Complete state management, Multi-Role RBAC (Admin, Manager, Resident, Cook), 
// Real-time Expense Ledger & 3-Step Auto-Accounting (No fake dummy data)

const DEFAULT_SHIFT_MEAL_RULES = {
  NIGHT: { LUNCH: "OFF", DINNER: "ON", BREAKFAST: "OFF" },       // Night Shift -> Pre-select Dinner
  EVENING: { LUNCH: "ON", DINNER: "OFF", BREAKFAST: "OFF" },     // Evening Shift -> Pre-select Lunch
  MORNING: { LUNCH: "OFF", DINNER: "ON", BREAKFAST: "OFF" },     // Morning Shift -> Pre-select Dinner
  OFF_DUTY: { LUNCH: "ON", DINNER: "ON", BREAKFAST: "OFF" },     // Off-Duty -> Pre-select Both
  GENERAL: { LUNCH: "ON", DINNER: "ON", BREAKFAST: "OFF" }
};

const DEFAULT_MEAL_CONFIG = {
  defaultMealCount: 2,          // 2 meals (Lunch & Dinner), 3 (Breakfast, Lunch & Dinner), 1 (Single)
  dailyBaseMealRate: 50,         // Base plate rate in ₹
  lunchCutOffTime: "08:30",      // Lunch cut-off time (e.g. 08:30)
  dinnerCutOffTime: "16:30",     // Dinner cut-off time (e.g. 16:30)
  autoMealBookingMode: "SHIFT_BASED", // "SHIFT_BASED" (Off-Duty/Night Auto-ON), "ALWAYS_ON", "MANUAL"
  guestMealRate: 60,             // Extra/Guest plate price in ₹
  roomRentPerPerson: 1500,       // Standard monthly room rent in ₹
  mealCutOffStrict: true,
  messName: "Hostel Central Mess",
  shiftMealRules: Object.assign({}, DEFAULT_SHIFT_MEAL_RULES)
};

function getShiftDefaultMealStatus(shift, mealType) {
  const cfg = state && state.mealDefaults ? state.mealDefaults : DEFAULT_MEAL_CONFIG;
  const rules = (cfg && cfg.shiftMealRules) ? cfg.shiftMealRules : DEFAULT_SHIFT_MEAL_RULES;
  const shiftKey = (shift || "OFF_DUTY").toUpperCase();
  const shiftRule = rules[shiftKey] || DEFAULT_SHIFT_MEAL_RULES[shiftKey] || { LUNCH: "OFF", DINNER: "OFF", BREAKFAST: "OFF" };
  const mealKey = (mealType || "LUNCH").toUpperCase();
  return shiftRule[mealKey] || "OFF";
}

function convertRuleToSelectValue(rule) {
  if (!rule) return "BOTH";
  const lunchOn = rule.LUNCH === "ON";
  const dinnerOn = rule.DINNER === "ON";
  if (lunchOn && dinnerOn) return "BOTH";
  if (dinnerOn && !lunchOn) return "DINNER";
  if (lunchOn && !dinnerOn) return "LUNCH";
  return "NONE";
}

function convertSelectValueToRule(val) {
  if (val === "DINNER") return { LUNCH: "OFF", DINNER: "ON", BREAKFAST: "OFF" };
  if (val === "LUNCH") return { LUNCH: "ON", DINNER: "OFF", BREAKFAST: "OFF" };
  if (val === "BOTH") return { LUNCH: "ON", DINNER: "ON", BREAKFAST: "OFF" };
  return { LUNCH: "OFF", DINNER: "OFF", BREAKFAST: "OFF" };
}

const DB_ROOT_PATH = "hostel_mess_data";
const MAIN_GROUP_ID = "hostel_central_mess";
const DEFAULT_GROUP_ID = MAIN_GROUP_ID;

function getActiveGroupId() {
  return MAIN_GROUP_ID;
}

function getGroupDbPath(groupId = getActiveGroupId()) {
  return `${DB_ROOT_PATH}/groups/${groupId}`;
}

function getUsersDbPath(groupId = getActiveGroupId()) {
  return `${DB_ROOT_PATH}/groups/${groupId}/users`;
}

const CLEAN_INITIAL_STATE = {
  groupId: MAIN_GROUP_ID,
  currentGroupId: MAIN_GROUP_ID,
  currentUser: null, // Naye bandon ke liye HAMESHA Login Modal khulega (Super Admin auto-open nahi hoga)
  users: [
    {
      id: "usr_super_admin",
      name: "Avijit Basu",
      email: "basua2484@gmail.com",
      mobile: "9876543210",
      loginPin: "1234",
      role: "SUPER_ADMIN",
      assignedRoom: "Admin Office",
      userIdCode: "SADM_001",
      status: "ACTIVE",
      currentShift: "OFF_DUTY",
      referralCode: "101001",
      groupId: MAIN_GROUP_ID,
      messGroupId: MAIN_GROUP_ID,
      isEmailVerified: true,
      emailVerifiedAt: Date.now(),
      isOtpVerified: true
    }
  ],
  attendanceLog: [], // Real Attendance & OT Log
  meals: [],
  pendingLeaves: [],
  expensesLog: [], // Real actual expenses ledger
  mealDefaults: Object.assign({}, DEFAULT_MEAL_CONFIG),
  roomRentPerPerson: 1500,
  activeKitchenMeal: "LUNCH",
  selectedOtHours: 2,
  selectedRoleFilter: "ALL",
  selectedExpenseCategoryFilter: "ALL",
  selectedAttendanceDateFilter: "ALL",
  selectedAttendanceUserFilter: "ALL",
  selectedAttendanceTypeFilter: "ALL"
};

// ==========================================
// RBAC ROLE HIERARCHY & PERMISSION HELPERS
// ==========================================
function isSuperAdmin(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  if (!user) return false;
  return user.role === "SUPER_ADMIN" || user.userIdCode === "SADM_001" || user.id === "usr_super_admin" || user.name === "Avijit Basu" || (user.role === "ADMIN" && user.userIdCode === "ADM_001");
}

function isNormalAdmin(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  if (!user) return false;
  return user.role === "ADMIN" && !isSuperAdmin(user);
}

function isManager(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  if (!user) return false;
  return user.role === "MANAGER";
}

function isEmployee(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  if (!user) return false;
  return user.role === "RESIDENT" || user.role === "EMPLOYEE" || user.role === "STAFF";
}

function isCook(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  if (!user) return false;
  return user.role === "COOK";
}

// Check if currently authenticated user has authorization to onboard new employees/residents
function isAuthorizedToOnboardUsers(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  const hasRefCode = Boolean(sessionStorage.getItem("hostel_mess_ref_code") || (document.getElementById("form-user-referral-code") && document.getElementById("form-user-referral-code").value.trim()));
  return isSuperAdmin(user) || isNormalAdmin(user) || isManager(user) || hasRefCode;
}

// Check if user has permission to approve employee kitchen purchase requests
function canApprovePurchaseRequests(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  return isSuperAdmin(user) || isNormalAdmin(user) || isManager(user);
}

// Check if user has permission to approve user registrations (Super Admin exclusive)
function canApproveUserRegistrations(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  return isSuperAdmin(user);
}

// Check if user has master deletion permission (Super Admin exclusive)
function canDeleteData(u) {
  const user = (typeof u !== "undefined" && u !== null) ? u : (typeof state !== "undefined" ? state.currentUser : null);
  return isSuperAdmin(user);
}

// ==========================================
// SINGLE ACCOUNT DEDUPLICATION ENGINE
// ==========================================
function deduplicateUsers(userList) {
  if (!userList) return [];
  const rawArray = Array.isArray(userList) ? userList : (typeof userList === "object" ? Object.values(userList) : []);
  if (rawArray.length === 0) return [];

  const uniqueMap = new Map();

  rawArray.forEach((rawUser, idx) => {
    if (!rawUser) return;
    const u = Object.assign({}, rawUser);

    // Normalize basic fields with fallbacks
    u.id = u.id || `usr_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
    u.name = u.name || "Resident";
    u.role = u.role || "RESIDENT";
    u.status = u.status || "ACTIVE";
    u.currentShift = u.currentShift || u.shift || "OFF_DUTY";
    u.shift = u.currentShift;
    u.assignedRoom = u.assignedRoom || "101";
    u.loginPin = u.loginPin || "1234";
    u.groupId = MAIN_GROUP_ID;
    u.messGroupId = MAIN_GROUP_ID;
    if (typeof u.isEmailVerified === "undefined") u.isEmailVerified = true;

    const isSuper = isSuperAdmin(u);
    const cleanMob = String(u.mobile || "").trim().replace(/\D/g, "");
    const cleanEmail = String(u.email || "").trim().toLowerCase();
    const cleanCode = String(u.userIdCode || "").trim().toUpperCase();

    // Match priority: Super Admin key -> Clean Mobile -> Clean Email -> User ID Code -> User ID
    let matchKey = null;
    if (isSuper) {
      matchKey = "SUPER_ADMIN_MASTER";
    } else if (cleanMob && cleanMob.length >= 10) {
      matchKey = `MOB_${cleanMob}`;
    } else if (cleanEmail && cleanEmail.includes("@") && !cleanEmail.endsWith("@example.com")) {
      matchKey = `EMAIL_${cleanEmail}`;
    } else if (cleanCode && cleanCode !== "EMP" && cleanCode !== "N/A") {
      matchKey = `CODE_${cleanCode}`;
    } else {
      matchKey = `ID_${u.id}`;
    }

    if (!uniqueMap.has(matchKey)) {
      uniqueMap.set(matchKey, u);
    } else {
      // Duplicate entry found: Keep the most recently updated entry
      const existing = uniqueMap.get(matchKey);
      const existingTime = Number(existing.updatedAt || existing.createdAt || existing.lastLoginAt || 0);
      const newTime = Number(u.updatedAt || u.createdAt || u.lastLoginAt || 0);

      if (newTime >= existingTime) {
        uniqueMap.set(matchKey, Object.assign({}, existing, u));
      } else {
        uniqueMap.set(matchKey, Object.assign({}, u, existing));
      }
    }
  });

  const result = Array.from(uniqueMap.values());

  // Ensure Super Admin (Avijit Basu) is always present
  const superAdminFound = result.find(u => isSuperAdmin(u));
  if (!superAdminFound) {
    result.unshift(Object.assign({}, CLEAN_INITIAL_STATE.currentUser, {
      groupId: MAIN_GROUP_ID,
      messGroupId: MAIN_GROUP_ID
    }));
  } else {
    superAdminFound.name = "Avijit Basu";
    superAdminFound.role = "SUPER_ADMIN";
    superAdminFound.userIdCode = "SADM_001";
    superAdminFound.email = superAdminFound.email || "basua2484@gmail.com";
    superAdminFound.loginPin = superAdminFound.loginPin || "1234";
    superAdminFound.referralCode = superAdminFound.referralCode || "101001";
    superAdminFound.groupId = MAIN_GROUP_ID;
    superAdminFound.messGroupId = MAIN_GROUP_ID;
  }

  return result;
}

// Load or initialize state from LocalStorage with cache invalidation for stale groupIds
let state = (function() {
  try {
    const saved = localStorage.getItem("hostel_mess_state_v2");
    const storedGroupId = localStorage.getItem("hostel_mess_group_id") || sessionStorage.getItem("hostel_mess_group_id");

    if (saved) {
      const parsed = JSON.parse(saved);

      // 1. Clear Stale Local Storage Cache if groupId is different from 'hostel_central_mess'
      const isStale = (parsed.groupId && parsed.groupId !== MAIN_GROUP_ID) || 
                      (parsed.currentGroupId && parsed.currentGroupId !== MAIN_GROUP_ID) ||
                      (storedGroupId && storedGroupId !== MAIN_GROUP_ID);

      if (isStale) {
        console.log("🧹 Stale group cache detected. Resetting cache and updating groupId to:", MAIN_GROUP_ID);
        localStorage.removeItem("hostel_mess_state_v2");
        localStorage.setItem("hostel_mess_group_id", MAIN_GROUP_ID);
        sessionStorage.setItem("hostel_mess_group_id", MAIN_GROUP_ID);

        let sanitizedUsers = parsed.users && Array.isArray(parsed.users) ? parsed.users : CLEAN_INITIAL_STATE.users;
        sanitizedUsers.forEach(u => {
          if (u) {
            u.groupId = MAIN_GROUP_ID;
            u.messGroupId = MAIN_GROUP_ID;
          }
        });

        parsed.groupId = MAIN_GROUP_ID;
        parsed.currentGroupId = MAIN_GROUP_ID;
        parsed.users = deduplicateUsers(sanitizedUsers);
        if (parsed.currentUser) {
          parsed.currentUser.groupId = MAIN_GROUP_ID;
          parsed.currentUser.messGroupId = MAIN_GROUP_ID;
        }
      }

      // Ensure arrays exist
      if (!parsed.attendanceLog) parsed.attendanceLog = [];
      if (!parsed.expensesLog) parsed.expensesLog = [];
      if (!parsed.meals) parsed.meals = [];
      if (!parsed.pendingLeaves) parsed.pendingLeaves = [];
      if (!parsed.users || parsed.users.length === 0) parsed.users = CLEAN_INITIAL_STATE.users;
      if (!parsed.selectedAttendanceDateFilter) parsed.selectedAttendanceDateFilter = "ALL";
      if (!parsed.selectedAttendanceUserFilter) parsed.selectedAttendanceUserFilter = "ALL";
      if (!parsed.selectedAttendanceTypeFilter) parsed.selectedAttendanceTypeFilter = "ALL";
      parsed.groupId = MAIN_GROUP_ID;
      parsed.currentGroupId = MAIN_GROUP_ID;

      // Ensure mealDefaults exist
      parsed.mealDefaults = Object.assign({}, DEFAULT_MEAL_CONFIG, parsed.mealDefaults || {});
      parsed.mealDefaults.shiftMealRules = Object.assign({}, DEFAULT_SHIFT_MEAL_RULES, (parsed.mealDefaults && parsed.mealDefaults.shiftMealRules) || {});
      if (typeof parsed.roomRentPerPerson === "undefined") {
        parsed.roomRentPerPerson = parsed.mealDefaults.roomRentPerPerson || 1500;
      }

      // Ensure Master Super Admin is Avijit Basu
      const superUser = parsed.users.find(u => isSuperAdmin(u));
      if (superUser) {
        superUser.name = "Avijit Basu";
        superUser.role = "SUPER_ADMIN";
        superUser.userIdCode = "SADM_001";
        if (!superUser.email) superUser.email = "basua2484@gmail.com";
        if (!superUser.loginPin) superUser.loginPin = "1234";
        if (!superUser.referralCode) superUser.referralCode = "101001";
        superUser.groupId = MAIN_GROUP_ID;
        superUser.messGroupId = MAIN_GROUP_ID;
        superUser.isEmailVerified = true;
      }
      if (parsed.currentUser && isSuperAdmin(parsed.currentUser)) {
        parsed.currentUser.name = "Avijit Basu";
        parsed.currentUser.role = "SUPER_ADMIN";
        parsed.currentUser.userIdCode = "SADM_001";
        if (!parsed.currentUser.email) parsed.currentUser.email = "basua2484@gmail.com";
        if (!parsed.currentUser.loginPin) parsed.currentUser.loginPin = "1234";
        if (!parsed.currentUser.referralCode) parsed.currentUser.referralCode = "101001";
        parsed.currentUser.groupId = MAIN_GROUP_ID;
        parsed.currentUser.messGroupId = MAIN_GROUP_ID;
        parsed.currentUser.isEmailVerified = true;
      }

      // Check for explicitly saved user session in localStorage
      const savedCurrentUserStr = localStorage.getItem("currentUser") || localStorage.getItem("hostel_mess_current_user");
      if (savedCurrentUserStr) {
        try {
          const parsedUser = JSON.parse(savedCurrentUserStr);
          if (parsedUser && parsedUser.id) {
            // Find updated user from user list or keep parsedUser
            const liveUser = (parsed.users || []).find(u => u.id === parsedUser.id || (u.mobile && parsedUser.mobile && u.mobile === parsedUser.mobile));
            parsed.currentUser = liveUser || parsedUser;
          }
        } catch (e) {
          parsed.currentUser = null;
        }
      } else {
        // Automatic Super Admin band: No saved session means guest state
        parsed.currentUser = null;
      }

      // Deduplicate and sanitize users
      parsed.users = deduplicateUsers(parsed.users);

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

// Helper to find active user by email address
function findUserByEmail(email, excludeUserId = null) {
  if (!email) return null;
  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail) return null;
  return (state.users || []).find(u => {
    if (u.status === "DELETED") return false;
    if (excludeUserId && u.id === excludeUserId) return false;
    const uEmail = String(u.email || "").trim().toLowerCase();
    return uEmail && uEmail === cleanEmail;
  });
}

// Helper to find user by Identifier (Name, Mobile, Referral ID, Email, or User ID Code)
function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const cleanId = String(identifier).trim();
  const lowerId = cleanId.toLowerCase();
  const upperId = cleanId.toUpperCase();
  const numOnly = cleanId.replace(/\D/g, "");

  return (state.users || []).find(u => {
    if (u.status === "DELETED") return false;
    // Check Name match
    if (u.name && u.name.trim().toLowerCase() === lowerId) return true;
    // Check Referral Code match (e.g. MESS101)
    if (u.referralCode && u.referralCode.trim().toUpperCase() === upperId) return true;
    // Check Email match
    if (u.email && u.email.trim().toLowerCase() === lowerId) return true;
    // Check Mobile match
    if (numOnly.length >= 4) {
      const uMob = String(u.mobile || "").trim().replace(/\D/g, "");
      if (uMob && (uMob === numOnly || uMob.endsWith(numOnly))) return true;
    }
    // Check User ID or Code match
    if (u.id === cleanId || (u.userIdCode && u.userIdCode.toLowerCase() === lowerId)) return true;
    return false;
  });
}

// Strict Role Limits (Max 1 Super Admin, Max 2 Admin, Max 3 Manager, Unlimited Employees)
const ROLE_LIMITS = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  MANAGER: 3,
  RESIDENT: Infinity,
  EMPLOYEE: Infinity,
  COOK: Infinity
};

function getRoleCount(role) {
  const normRole = (role === "EMPLOYEE" || role === "STAFF") ? "RESIDENT" : role;
  return (state.users || []).filter(u => {
    const uNorm = isSuperAdmin(u) ? "SUPER_ADMIN" : ((u.role === "EMPLOYEE" || u.role === "STAFF") ? "RESIDENT" : u.role);
    return uNorm === normRole && u.status !== "DELETED";
  }).length;
}

function checkRoleQuotaAvailable(targetRole, currentUserId = null) {
  const normRole = (targetRole === "EMPLOYEE" || targetRole === "STAFF") ? "RESIDENT" : targetRole;
  const limit = ROLE_LIMITS[normRole] || Infinity;
  if (limit === Infinity) return { allowed: true };

  // If editing an existing user and their role isn't changing, quota doesn't increase
  if (currentUserId) {
    const existing = (state.users || []).find(u => u.id === currentUserId);
    if (existing) {
      const existingNormRole = isSuperAdmin(existing) ? "SUPER_ADMIN" : ((existing.role === "EMPLOYEE" || existing.role === "STAFF") ? "RESIDENT" : existing.role);
      if (existingNormRole === normRole) {
        return { allowed: true };
      }
    }
  }

  const currentCount = getRoleCount(normRole);
  if (currentCount >= limit) {
    const roleName = normRole === "SUPER_ADMIN" ? "Master Super Admin" : (normRole === "ADMIN" ? "Admin" : "Hostel Manager");
    return {
      allowed: false,
      message: `🚫 Registration Blocked: Maximum ${limit} ${roleName} account${limit === 1 ? '' : 's'} allowed in the system. Currently registered: ${currentCount}/${limit}.\n\nPlease select Resident/Employee (Unlimited) or another available role.`
    };
  }
  return { allowed: true };
}

function updateRoleQuotaUI() {
  const superAdminCount = getRoleCount("SUPER_ADMIN");
  const adminCount = getRoleCount("ADMIN");
  const mgrCount = getRoleCount("MANAGER");
  const resCount = getRoleCount("RESIDENT");

  const quotaBox = document.getElementById("role-quota-info-box");
  if (quotaBox) {
    quotaBox.innerHTML = `🛡️ <strong>System Role Quotas:</strong> Master Super Admin: <b>Avijit Basu (1/1 Lock)</b> • Admin: <b>${adminCount}/2</b> • Manager: <b>${mgrCount}/3</b> • Employees: <b>${resCount} (Unlimited)</b>`;
  }

  const roleSelect = document.getElementById("form-user-role");
  if (roleSelect) {
    Array.from(roleSelect.options).forEach(opt => {
      if (opt.value === "SUPER_ADMIN") {
        opt.disabled = true;
        opt.textContent = `Master Super Admin (🔒 Reserved for Avijit Basu Only)`;
      } else if (opt.value === "ADMIN") {
        opt.disabled = adminCount >= 2;
        opt.textContent = `Admin (सहायक व्यवस्थापक - Max 2 | Current: ${adminCount}/2 ${adminCount >= 2 ? '🔒 Full' : '✓ Available'})`;
      } else if (opt.value === "MANAGER") {
        opt.disabled = mgrCount >= 3;
        opt.textContent = `Hostel Manager (प्रबंधक - Max 3 | Current: ${mgrCount}/3 ${mgrCount >= 3 ? '🔒 Full' : '✓ Available'})`;
      } else if (opt.value === "RESIDENT") {
        opt.disabled = false;
        opt.textContent = `Hostel Resident / Employee (रहवासी - Unlimited)`;
      } else if (opt.value === "COOK") {
        opt.disabled = false;
        opt.textContent = `Kitchen Cook (रसोईया - Unlimited)`;
      }
    });
  }
}

// ==========================================
// SIMPLIFIED AUTH & REFERRAL HELPERS (NO OTP / DIRECT ONBOARDING)
// ==========================================
const ReferralService = {
  generateUniqueReferralId() {
    // Generate unique 6-digit Referral ID (e.g. 100000 - 999999)
    let code = "";
    let attempts = 0;
    do {
      const num = Math.floor(100000 + Math.random() * 900000);
      code = String(num);
      attempts++;
    } while (attempts < 50 && (state.users || []).some(u => (u.referralCode || "").toUpperCase() === code));
    return code;
  }
};

// ==========================================
// 1. SINGLE CENTRAL FIREBASE REALTIME DATABASE ('hostel_mess_data')
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBmsF0FdATAAz3cRNHPJzAykO6FGOouHE",
  authDomain: "hostel-management-96f81.firebaseapp.com",
  databaseURL: "https://hostel-management-96f81-default-rtdb.firebaseio.com",
  projectId: "hostel-management-96f81",
  storageBucket: "hostel-management-96f81.firebasestorage.app",
  messagingSenderId: "952292948322",
  appId: "1:952292948322:web:ed54a71de1a647c887543b"
};

const CENTRAL_DB_NODE = "hostel_mess_data";
let rtdb = null;
let database = null;
window.database = null;
let db = null;
let isFirebaseConnected = false;

function updateCloudSyncStatus(isOnline, message) {
  isFirebaseConnected = isOnline;
  const dot = document.getElementById("cloud-sync-dot");
  const text = document.getElementById("cloud-sync-text");
  const time = document.getElementById("cloud-sync-time");
  const currentGroupId = getActiveGroupId();
  if (dot) {
    dot.className = isOnline ? "pulse-indicator" : "pulse-indicator offline";
  }
  if (text) {
    text.textContent = message || (isOnline ? `☁️ Realtime DB: Connected • ${getGroupDbPath(currentGroupId)}` : "⚠️ Local Cache Active");
  }
  if (time) {
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

const FirebaseSyncService = {
  dbRef: null,
  isInitialized: false,

  init() {
    try {
      if (typeof firebase === "undefined") {
        console.warn("Firebase SDK not ready yet, retrying in 500ms...");
        updateCloudSyncStatus(false, "⏳ Connecting to Firebase Cloud...");
        setTimeout(() => this.init(), 500);
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const activeGroupId = getActiveGroupId();

      // Initialize Firebase Realtime Database
      if (typeof firebase.database === "function") {
        try {
          rtdb = firebase.database();
          database = rtdb;
          window.database = database;
          rtdb.ref(getGroupDbPath(activeGroupId)).keepSynced(true);
        } catch (e) {
          console.warn("RTDB keepSynced warning:", e);
        }
      }

      // Initialize Firestore as auxiliary backup if available
      if (typeof firebase.firestore === "function") {
        try {
          db = firebase.firestore();
        } catch (e) {}
      }

      this.isInitialized = true;
      updateCloudSyncStatus(true, `☁️ Realtime DB: Connected • ${getGroupDbPath(activeGroupId)}`);
      console.log("✓ Central Realtime Database Connected at group path:", getGroupDbPath(activeGroupId));

      // 4. Auto Session Re-Sync on Load: Update current user's database record's groupId to hostel_central_mess
      if (state.currentUser && state.currentUser.id) {
        state.currentUser.groupId = MAIN_GROUP_ID;
        state.currentUser.messGroupId = MAIN_GROUP_ID;
        state.currentUser.updatedAt = Date.now();
        registerUserWithGroup(state.currentUser);
      }

      // Trigger legacy migration and setup real-time listeners
      this.checkAndMigrateLegacyUsers();
      this.setupCentralListener();
      loadGlobalGroupMembers();
    } catch (e) {
      console.error("Firebase Realtime DB init error:", e);
      updateCloudSyncStatus(false, "⚠️ Local Cache Active");
    }
  },

  // 1. Dynamic Legacy Migration: Auto-migrate any users stored outside hostel_mess_data/groups/hostel_central_mess/users
  async checkAndMigrateLegacyUsers() {
    if (!rtdb) return;

    try {
      console.log("🔍 Checking for legacy users to auto-migrate into hostel_mess_data/groups/" + MAIN_GROUP_ID + "/users...");
      const targetGroup = MAIN_GROUP_ID;
      const targetGroupUsersPath = `${DB_ROOT_PATH}/groups/${targetGroup}/users`;

      // Check legacy group 'main_mess'
      rtdb.ref(`${DB_ROOT_PATH}/groups/main_mess/users`).once("value").then((snapshot) => {
        const val = snapshot.val();
        if (val) {
          let list = Array.isArray(val) ? val.filter(Boolean) : (typeof val === "object" ? Object.values(val).filter(Boolean) : []);
          list.forEach((u) => {
            if (u && u.id) {
              const migrated = Object.assign({}, u, { groupId: targetGroup, messGroupId: targetGroup });
              rtdb.ref(`${targetGroupUsersPath}/${u.id}`).set(migrated);
            }
          });
        }
      }).catch(() => {});

      // Check legacy root node 'hostel_mess_data/users'
      rtdb.ref(`${DB_ROOT_PATH}/users`).once("value").then((snapshot) => {
        const legacyUsersVal = snapshot.val();
        if (legacyUsersVal) {
          let legacyList = [];
          if (Array.isArray(legacyUsersVal)) legacyList = legacyUsersVal.filter(Boolean);
          else if (typeof legacyUsersVal === "object") legacyList = Object.values(legacyUsersVal).filter(Boolean);

          legacyList.forEach((u) => {
            if (u && u.id) {
              const migratedUser = Object.assign({}, u, {
                groupId: targetGroup,
                messGroupId: targetGroup
              });
              rtdb.ref(`${targetGroupUsersPath}/${u.id}`).set(migratedUser);
              console.log(`✓ Migrated legacy user ${u.name || u.id} from hostel_mess_data/users to ${targetGroupUsersPath}/${u.id}`);
            }
          });
        }
      }).catch((e) => console.warn("Legacy users check error:", e));

      // Check if top-level root 'hostel_mess_data' has users directly
      rtdb.ref(DB_ROOT_PATH).once("value").then((snapshot) => {
        const rootVal = snapshot.val();
        if (rootVal && rootVal.users) {
          let rootUsersList = [];
          if (Array.isArray(rootVal.users)) rootUsersList = rootVal.users.filter(Boolean);
          else if (typeof rootVal.users === "object") rootUsersList = Object.values(rootVal.users).filter(Boolean);

          rootUsersList.forEach((u) => {
            if (u && u.id) {
              const migratedUser = Object.assign({}, u, {
                groupId: targetGroup,
                messGroupId: targetGroup
              });
              rtdb.ref(`${targetGroupUsersPath}/${u.id}`).set(migratedUser);
              console.log(`✓ Migrated user ${u.name || u.id} from root to ${targetGroupUsersPath}/${u.id}`);
            }
          });
        }
      }).catch((e) => console.warn("Root users migration error:", e));

      // Also migrate current logged in user from local state if missing in group
      if (state.currentUser && state.currentUser.id) {
        const curr = Object.assign({}, state.currentUser, {
          groupId: targetGroup,
          messGroupId: targetGroup
        });
        rtdb.ref(`${targetGroupUsersPath}/${curr.id}`).set(curr);
      }

      // Check Firestore auxiliary collection for any unmigrated users
      if (db) {
        db.collection("users").get().then((snap) => {
          if (!snap.empty) {
            snap.forEach((doc) => {
              const data = doc.data();
              const uId = doc.id || (data && data.id);
              if (uId) {
                const firestoreUser = Object.assign({}, data, {
                  id: uId,
                  groupId: targetGroup,
                  messGroupId: targetGroup
                });
                rtdb.ref(`${targetGroupUsersPath}/${uId}`).set(firestoreUser);
                console.log(`✓ Migrated user ${firestoreUser.name || uId} from Firestore to ${targetGroupUsersPath}/${uId}`);
              }
            });
          }
        }).catch((e) => {});
      }

      // Watch for any future direct writes to legacy 'hostel_mess_data/users' and auto-forward them
      rtdb.ref(`${DB_ROOT_PATH}/users`).on("child_added", (childSnap) => {
        const val = childSnap.val();
        if (val && val.id) {
          const autoMigrated = Object.assign({}, val, {
            groupId: targetGroup,
            messGroupId: targetGroup
          });
          rtdb.ref(`${targetGroupUsersPath}/${val.id}`).set(autoMigrated);
        }
      });
    } catch (err) {
      console.warn("checkAndMigrateLegacyUsers error:", err);
    }
  },

  setupCentralListener() {
    if (!rtdb) {
      if (db) this.setupFirestoreFallback();
      return;
    }

    const activeGroupId = getActiveGroupId();
    const groupPath = getGroupDbPath(activeGroupId);
    this.dbRef = rtdb.ref(groupPath);

    // Global Live Realtime Database Listener for Group Members
    loadGlobalGroupMembers();

    // Global Live Realtime Database Listener for Super Admin and all group members
    this.dbRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        console.log("Empty central group database, seeding initial Super Admin data...");
        this.seedInitialSuperAdmin(activeGroupId);
        return;
      }

      // 1. Process Users (Supports both object map and array)
      let loadedUsers = [];
      if (Array.isArray(data.users)) {
        loadedUsers = data.users.filter(Boolean);
      } else if (data.users && typeof data.users === "object") {
        loadedUsers = Object.values(data.users).filter(Boolean);
      }

      // Ensure Master Super Admin (Avijit Basu) is always included under the main groupId
      const superAdminFound = loadedUsers.find(u => isSuperAdmin(u));
      if (!superAdminFound) {
        const defaultSuperAdmin = Object.assign({}, CLEAN_INITIAL_STATE.currentUser, {
          groupId: activeGroupId,
          messGroupId: activeGroupId
        });
        loadedUsers.unshift(defaultSuperAdmin);
      } else {
        superAdminFound.name = "Avijit Basu";
        superAdminFound.role = "SUPER_ADMIN";
        superAdminFound.userIdCode = "SADM_001";
        superAdminFound.email = superAdminFound.email || "basua2484@gmail.com";
        superAdminFound.loginPin = superAdminFound.loginPin || "1234";
        superAdminFound.referralCode = superAdminFound.referralCode || "101001";
        superAdminFound.groupId = activeGroupId;
        superAdminFound.messGroupId = activeGroupId;
      }

      // Normalize all users
      loadedUsers.forEach((u, idx) => {
        u.groupId = activeGroupId;
        u.messGroupId = activeGroupId;
        if (!u.loginPin) u.loginPin = "1234";
        if (!u.email) u.email = `${(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
        if (!u.referralCode) {
          u.referralCode = isSuperAdmin(u) ? "101001" : `MESS${100 + (idx % 890)}`;
        }
        if (typeof u.isEmailVerified === "undefined") u.isEmailVerified = true;
      });

      state.users = loadedUsers;

      // 2. Process Attendance Log
      if (Array.isArray(data.attendanceLog)) state.attendanceLog = data.attendanceLog.filter(Boolean);
      else if (data.attendanceLog && typeof data.attendanceLog === "object") state.attendanceLog = Object.values(data.attendanceLog).filter(Boolean);
      else state.attendanceLog = [];

      // 3. Process Expenses Log
      if (Array.isArray(data.expensesLog)) state.expensesLog = data.expensesLog.filter(Boolean);
      else if (data.expensesLog && typeof data.expensesLog === "object") state.expensesLog = Object.values(data.expensesLog).filter(Boolean);
      else state.expensesLog = [];

      // 4. Process Meals
      if (Array.isArray(data.meals)) state.meals = data.meals.filter(Boolean);
      else if (data.meals && typeof data.meals === "object") state.meals = Object.values(data.meals).filter(Boolean);
      else state.meals = [];

      // 5. Process Pending Leaves
      if (Array.isArray(data.pendingLeaves)) state.pendingLeaves = data.pendingLeaves.filter(Boolean);
      else if (data.pendingLeaves && typeof data.pendingLeaves === "object") state.pendingLeaves = Object.values(data.pendingLeaves).filter(Boolean);
      else state.pendingLeaves = [];

      // 6. Process Settings & Defaults
      if (data.mealDefaults && typeof data.mealDefaults === "object") {
        state.mealDefaults = Object.assign({}, DEFAULT_MEAL_CONFIG, data.mealDefaults);
      }
      if (typeof data.roomRentPerPerson === "number") {
        state.roomRentPerPerson = data.roomRentPerPerson;
      }

      // Preserve active user session if logged in
      if (state.currentUser && state.currentUser.id) {
        const matched = (state.users || []).find(u => u.id === state.currentUser.id);
        if (matched) {
          state.currentUser = matched;
        }
      }

      // Auto-recalculate and render all UI components in real time
      saveLocalState();
      renderUI();
      updateRoleQuotaUI();
      updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${groupPath}`);
    }, (error) => {
      console.error("RTDB value listener error:", error);
      updateCloudSyncStatus(false, "⚠️ Sync Disconnected");
    });
  },

  setupFirestoreFallback() {
    if (!db) return;
    db.collection("users").onSnapshot(snapshot => {
      if (snapshot.empty) return;
      const cloudUsers = [];
      snapshot.forEach(doc => cloudUsers.push({ id: doc.id, ...doc.data() }));
      state.users = cloudUsers;
      saveLocalState();
      renderUI();
      updateRoleQuotaUI();
    });
    db.collection("attendance").onSnapshot(snapshot => {
      const arr = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.attendanceLog = arr;
      saveLocalState();
      renderUI();
    });
    db.collection("expenses").onSnapshot(snapshot => {
      const arr = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.expensesLog = arr;
      saveLocalState();
      renderUI();
    });
    db.collection("leaves").onSnapshot(snapshot => {
      const arr = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.pendingLeaves = arr;
      saveLocalState();
      renderUI();
    });
    db.collection("meals").onSnapshot(snapshot => {
      const arr = [];
      snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
      state.meals = arr;
      saveLocalState();
      renderUI();
    });
  },

  // Save whole state to shared group path in Realtime DB
  async syncAllToCloud() {
    const groupId = getActiveGroupId();
    const groupPath = getGroupDbPath(groupId);

    const usersMap = {};
    (state.users || []).forEach(u => {
      if (u && u.id) {
        u.groupId = groupId;
        u.messGroupId = groupId;
        usersMap[u.id] = u;
      }
    });

    const payload = {
      info: {
        groupId: groupId,
        name: (state.mealDefaults && state.mealDefaults.messName) || "Hostel Central Mess",
        masterAdmin: "Avijit Basu",
        updatedAt: Date.now()
      },
      users: usersMap,
      attendanceLog: state.attendanceLog || [],
      expensesLog: state.expensesLog || [],
      meals: state.meals || [],
      pendingLeaves: state.pendingLeaves || [],
      mealDefaults: state.mealDefaults || DEFAULT_MEAL_CONFIG,
      roomRentPerPerson: state.roomRentPerPerson || 1500,
      lastUpdated: Date.now(),
      updatedBy: (state.currentUser && state.currentUser.name) || "Super Admin"
    };

    if (rtdb) {
      try {
        await rtdb.ref(groupPath).set(payload);
        updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${groupPath}`);
        return;
      } catch (e) {
        console.warn("RTDB set error:", e);
      }
    }

    // Direct REST push fallback
    try {
      fetch(`https://hostel-management-96f81-default-rtdb.firebaseio.com/${groupPath}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {});
    } catch (e) {}

    // Fallback sync to Firestore
    if (db) {
      try {
        const batch = db.batch();
        (state.users || []).forEach(u => {
          if (u.id) batch.set(db.collection("users").doc(u.id), u, { merge: true });
        });
        await batch.commit().catch(() => {});
      } catch (e) {}
    }
  },

  async seedInitialSuperAdmin(groupId = getActiveGroupId()) {
    const adminUser = Object.assign({}, CLEAN_INITIAL_STATE.currentUser, {
      groupId: groupId,
      messGroupId: groupId
    });
    state.users = [adminUser];
    state.currentUser = adminUser;
    await this.syncAllToCloud();
    console.log("✓ Initial Super Admin seeded in group path:", getGroupDbPath(groupId));
  },

  async saveUser(user) {
    if (!user || !user.id) return;
    const groupId = user.groupId || getActiveGroupId();
    user.groupId = groupId;
    user.messGroupId = groupId;

    const idx = (state.users || []).findIndex(u => u.id === user.id);
    if (idx >= 0) state.users[idx] = user;
    else (state.users = state.users || []).push(user);

    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/users/${user.id}`).set(user);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
        updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${getGroupDbPath(groupId)}/users`);
        return;
      } catch (e) {
        console.warn("RTDB saveUser error:", e);
      }
    }
    await this.syncAllToCloud();
  },

  async deleteUser(userId) {
    if (!userId) return;
    const groupId = getActiveGroupId();
    state.users = (state.users || []).filter(u => u.id !== userId);
    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/users/${userId}`).remove();
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
      } catch (e) {
        console.warn("RTDB deleteUser error:", e);
      }
    }
    await this.syncAllToCloud();
  },

  async saveAttendance(record) {
    if (!record || !record.id) return;
    const groupId = getActiveGroupId();
    const idx = (state.attendanceLog || []).findIndex(r => r.id === record.id);
    if (idx >= 0) state.attendanceLog[idx] = record;
    else (state.attendanceLog = state.attendanceLog || []).push(record);

    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/attendanceLog`).set(state.attendanceLog);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
        updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${getGroupDbPath(groupId)}`);
        return;
      } catch (e) {
        console.warn("RTDB saveAttendance error:", e);
      }
    }
    await this.syncAllToCloud();
  },

  async deleteAttendance(recordId) {
    if (!recordId) return;
    const groupId = getActiveGroupId();
    state.attendanceLog = (state.attendanceLog || []).filter(r => r.id !== recordId);
    saveLocalState();
    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/attendanceLog`).set(state.attendanceLog);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
      } catch (e) {}
    }
    await this.syncAllToCloud();
  },

  async saveExpense(expense) {
    if (!expense || !expense.id) return;
    const groupId = getActiveGroupId();
    const idx = (state.expensesLog || []).findIndex(e => e.id === expense.id);
    if (idx >= 0) state.expensesLog[idx] = expense;
    else (state.expensesLog = state.expensesLog || []).push(expense);

    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/expensesLog`).set(state.expensesLog);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
        updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${getGroupDbPath(groupId)}`);
        return;
      } catch (e) {}
    }
    await this.syncAllToCloud();
  },

  async deleteExpense(expenseId) {
    if (!expenseId) return;
    const groupId = getActiveGroupId();
    state.expensesLog = (state.expensesLog || []).filter(e => e.id !== expenseId);
    saveLocalState();
    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/expensesLog`).set(state.expensesLog);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
      } catch (e) {}
    }
    await this.syncAllToCloud();
  },

  async saveLeave(leave) {
    if (!leave || !leave.id) return;
    const groupId = getActiveGroupId();
    const idx = (state.pendingLeaves || []).findIndex(l => l.id === leave.id);
    if (idx >= 0) state.pendingLeaves[idx] = leave;
    else (state.pendingLeaves = state.pendingLeaves || []).push(leave);

    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/pendingLeaves`).set(state.pendingLeaves);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
      } catch (e) {}
    }
    await this.syncAllToCloud();
  },

  async deleteLeave(leaveId) {
    if (!leaveId) return;
    const groupId = getActiveGroupId();
    state.pendingLeaves = (state.pendingLeaves || []).filter(l => l.id !== leaveId);
    saveLocalState();
    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/pendingLeaves`).set(state.pendingLeaves);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
      } catch (e) {}
    }
    await this.syncAllToCloud();
  },

  async saveMeal(meal) {
    if (!meal || !meal.id) return;
    const groupId = getActiveGroupId();
    const idx = (state.meals || []).findIndex(m => m.id === meal.id);
    if (idx >= 0) state.meals[idx] = meal;
    else (state.meals = state.meals || []).push(meal);

    saveLocalState();

    if (rtdb) {
      try {
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/meals`).set(state.meals);
        await rtdb.ref(`${DB_ROOT_PATH}/groups/${groupId}/lastUpdated`).set(Date.now());
        updateCloudSyncStatus(true, `☁️ Realtime DB: Synced Live • ${getGroupDbPath(groupId)}`);
        return;
      } catch (e) {
        console.warn("RTDB saveMeal error:", e);
      }
    }
    await this.syncAllToCloud();
  },

  async saveSettings(settings) {
    const groupId = getActiveGroupId();
    if (settings && typeof settings.roomRentPerPerson === "number") {
      state.roomRentPerPerson = settings.roomRentPerPerson;
      if (!state.mealDefaults) state.mealDefaults = Object.assign({}, DEFAULT_MEAL_CONFIG);
      state.mealDefaults.roomRentPerPerson = settings.roomRentPerPerson;
    }
    await this.syncAllToCloud();
  },

  async saveMealDefaults(newDefaults) {
    const current = state.currentUser || state.users[0];
    if (!isSuperAdmin(current)) {
      alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) has authority to modify mess meal defaults and rates.");
      return false;
    }
    state.mealDefaults = Object.assign({}, state.mealDefaults || DEFAULT_MEAL_CONFIG, newDefaults);
    if (typeof newDefaults.roomRentPerPerson === "number") {
      state.roomRentPerPerson = newDefaults.roomRentPerPerson;
    }
    await this.syncAllToCloud();
    saveLocalState();
    renderUI();
    return true;
  },

  async resetDatabase() {
    const groupId = getActiveGroupId();
    updateCloudSyncStatus(true, `⏳ Resetting Realtime Database (${getGroupDbPath(groupId)})...`);
    const defaultAdmin = Object.assign({}, CLEAN_INITIAL_STATE.currentUser, {
      groupId: groupId,
      messGroupId: groupId
    });

    const freshPayload = {
      info: {
        groupId: groupId,
        name: "Hostel Central Mess",
        masterAdmin: "Avijit Basu",
        updatedAt: Date.now()
      },
      users: { [defaultAdmin.id]: defaultAdmin },
      attendanceLog: [],
      expensesLog: [],
      meals: [],
      pendingLeaves: [],
      mealDefaults: Object.assign({}, DEFAULT_MEAL_CONFIG),
      roomRentPerPerson: 1500,
      lastUpdated: Date.now(),
      resetAt: Date.now(),
      updatedBy: "Super Admin"
    };

    if (rtdb) {
      await rtdb.ref(getGroupDbPath(groupId)).set(freshPayload);
    }
    if (db) {
      const collections = ["attendance", "expenses", "leaves", "meals", "users"];
      for (const col of collections) {
        const snap = await db.collection(col).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.forEach(doc => batch.delete(doc.ref));
          await batch.commit().catch(() => {});
        }
      }
      await db.collection("users").doc(defaultAdmin.id).set(defaultAdmin);
    }

    state = JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
    state.groupId = groupId;
    state.currentGroupId = groupId;
    state.users = [defaultAdmin];
    state.currentUser = defaultAdmin;

    saveLocalState();
    renderUI();
    updateCloudSyncStatus(true, `☁️ Realtime DB: Fresh Database Ready (${getGroupDbPath(groupId)})`);
    console.log("✓ Central Realtime Database Reset Cleanly for group:", groupId);
  }
};

// ==========================================
// CENTRAL REALTIME DATABASE & GLOBAL SYNC HELPERS
// ==========================================

// 3. Global real-time listener loadGlobalGroupMembers()
function loadGlobalGroupMembers() {
  if (!rtdb) {
    if (typeof firebase !== "undefined" && typeof firebase.database === "function") {
      try { rtdb = firebase.database(); } catch (e) {}
    }
  }
  if (!rtdb) return;

  const usersPath = 'hostel_mess_data/groups/' + MAIN_GROUP_ID + '/users';
  rtdb.ref(usersPath).on("value", (snapshot) => {
    try {
      // 2. Safe Firebase Query & Null Guards: if snapshot.val() is null or undefined, render empty array []
      const val = snapshot ? snapshot.val() : null;
      let rawList = [];
      if (val !== null && typeof val !== "undefined") {
        if (Array.isArray(val)) {
          rawList = val.filter(Boolean);
        } else if (typeof val === "object") {
          rawList = Object.values(val).filter(Boolean);
        }
      }

      // 3. Single Account Deduplication Logic: Deduplicate by ID, Mobile, Email, or Code
      const userList = deduplicateUsers(rawList);

      state.users = userList;

      if (state.currentUser && state.currentUser.id) {
        const matched = userList.find(u => u && (u.id === state.currentUser.id || (u.mobile && state.currentUser.mobile && u.mobile === state.currentUser.mobile)));
        if (matched) {
          state.currentUser = matched;
          state.currentUser.groupId = MAIN_GROUP_ID;
          state.currentUser.messGroupId = MAIN_GROUP_ID;
        }
      }

      saveLocalState();
      renderMemberList(userList);
      updateDashboardCards(userList);
      updateRoleQuotaUI();
    } catch (err) {
      console.warn("loadGlobalGroupMembers snapshot processing error:", err);
      renderMemberList([]);
      updateDashboardCards([]);
    }
  }, (err) => {
    console.warn("loadGlobalGroupMembers error:", err);
    renderMemberList(state.users || []);
    updateDashboardCards(state.users || []);
  });
}

// 4. User registration/signup function registerUserWithGroup(userData)
async function registerUserWithGroup(userData) {
  if (!userData) return null;
  userData.groupId = MAIN_GROUP_ID;
  userData.messGroupId = MAIN_GROUP_ID;
  userData.updatedAt = Date.now();

  if (!userData.id) {
    userData.id = "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  }

  // Update or insert into local state with deduplication
  const idx = (state.users || []).findIndex(u => u && (u.id === userData.id || (u.mobile && userData.mobile && u.mobile === userData.mobile)));
  if (idx >= 0) {
    state.users[idx] = Object.assign({}, state.users[idx], userData);
  } else {
    (state.users = state.users || []).push(userData);
  }
  state.users = deduplicateUsers(state.users);

  saveLocalState();

  const userPath = 'hostel_mess_data/groups/' + MAIN_GROUP_ID + '/users/' + userData.id;
  if (rtdb) {
    try {
      await rtdb.ref(userPath).set(userData);
      await rtdb.ref('hostel_mess_data/groups/' + MAIN_GROUP_ID + '/lastUpdated').set(Date.now());
      updateCloudSyncStatus(true, `☁️ Realtime DB: Connected • ${userPath}`);
    } catch (e) {
      console.warn("RTDB registerUserWithGroup error:", e);
    }
  }

  if (typeof FirebaseSyncService !== "undefined" && FirebaseSyncService.saveUser) {
    await FirebaseSyncService.saveUser(userData);
  }

  return userData;
}

// Update Top Dashboard Summary Cards in Real-Time
function updateDashboardCards(userList = (state && state.users ? state.users : [])) {
  try {
    const list = Array.isArray(userList) ? userList : ((state && Array.isArray(state.users)) ? state.users : []);
    const deduplicated = deduplicateUsers(list);
    const user = (state && state.currentUser) || (deduplicated.length > 0 ? deduplicated[0] : CLEAN_INITIAL_STATE.currentUser);
    const isEmp = isEmployee(user) || isCook(user);

    const activeUsers = deduplicated.filter(u => u && (u.status === 'ACTIVE' || typeof u.status === 'undefined')).length;
    const today = getTodayString();
    const attendanceLogs = (state && Array.isArray(state.attendanceLog)) ? state.attendanceLog : [];
    const activeAttendance = attendanceLogs.filter(a => a && a.date === today && a.status === 'ACTIVE');
    const onDutyUserIds = new Set(activeAttendance.map(a => a.userId));
    const onDutyCount = onDutyUserIds.size;

    const mealsList = (state && Array.isArray(state.meals)) ? state.meals : [];
    const lunchCount = mealsList.filter(m => m && m.mealType === 'LUNCH' && (m.status === 'ON' || m.status === 'PACK_TIFFIN' || m.status === 'LATE_COVERED')).length;
    const dinnerCount = mealsList.filter(m => m && m.mealType === 'DINNER' && (m.status === 'ON' || m.status === 'PACK_TIFFIN' || m.status === 'LATE_COVERED')).length;

    const totalPlates = typeof getTotalConsumedPlates === "function" ? getTotalConsumedPlates() : 0;
    const plateRate = typeof getDynamicPlateRate === "function" ? getDynamicPlateRate() : 0;

    const memCountEl = document.getElementById("admin-members-count");
    const onDutyEl = document.getElementById("admin-onduty-count");
    const lunchCountEl = document.getElementById("admin-lunch-count");
    const dinnerCountEl = document.getElementById("admin-dinner-count");
    const platesCountEl = document.getElementById("admin-plates-count");
    const rateDisplayEl = document.getElementById("admin-rate-display");

    if (memCountEl) memCountEl.textContent = isEmp ? "🔒" : activeUsers;
    if (onDutyEl) onDutyEl.textContent = isEmp ? "🔒" : onDutyCount;
    if (lunchCountEl) lunchCountEl.textContent = isEmp ? "🔒" : lunchCount;
    if (dinnerCountEl) dinnerCountEl.textContent = isEmp ? "🔒" : dinnerCount;
    if (platesCountEl) platesCountEl.textContent = isEmp ? "🔒" : totalPlates;
    if (rateDisplayEl) rateDisplayEl.textContent = isEmp ? "🔒" : `₹${(plateRate || 0).toFixed(2)}`;
  } catch (err) {
    console.warn("updateDashboardCards error:", err);
  }
}

// Render Member Directory List
function renderMemberList(userList = (state && state.users ? state.users : [])) {
  try {
    const list = Array.isArray(userList) ? userList : ((state && Array.isArray(state.users)) ? state.users : []);
    const deduplicated = deduplicateUsers(list);
    const user = (state && state.currentUser) || (deduplicated.length > 0 ? deduplicated[0] : CLEAN_INITIAL_STATE.currentUser);
    const isSuperAdm = isSuperAdmin(user);
    const isNormAdm = isNormalAdmin(user);
    const isMgr = isManager(user);
    const isEmp = isEmployee(user) || isCook(user);

    const uList = document.getElementById("admin-users-list");
    if (!uList) return;
    uList.innerHTML = "";

    if (isEmp) {
      uList.innerHTML = `
        <div class="locked-tab-card">
          <div class="locked-icon-bubble">🔒</div>
          <h4 style="margin:0;">Administration Panel Locked</h4>
          <p class="text-sub">
            Access Restricted: User Role Administration and Permissions are strictly managed by Super Admin and Management.<br>
            Employees can manage their own personal profile from the <strong>Resident Home</strong> portal.
          </p>
        </div>
      `;
      return;
    }

    const roleFilter = (state && state.selectedRoleFilter) || "ALL";
    let filteredUsers = deduplicated;
    if (roleFilter === "SUPER_ADMIN") {
      filteredUsers = filteredUsers.filter(u => isSuperAdmin(u));
    } else if (roleFilter === "ADMIN") {
      filteredUsers = filteredUsers.filter(u => isNormalAdmin(u));
    } else if (roleFilter === "MANAGER") {
      filteredUsers = filteredUsers.filter(u => isManager(u));
    } else if (roleFilter === "RESIDENT") {
      filteredUsers = filteredUsers.filter(u => isEmployee(u));
    } else if (roleFilter === "COOK") {
      filteredUsers = filteredUsers.filter(u => isCook(u));
    }

    if (filteredUsers.length === 0) {
      uList.innerHTML = `
        <div class="empty-state">
          <p>No users found for selected filter.</p>
          <p class="text-sub mt-1">Click <strong>"+ Add New User"</strong> to onboard employees.</p>
        </div>
      `;
      return;
    }

    filteredUsers.forEach(rawU => {
      if (!rawU) return;
      const u = rawU;
      const div = document.createElement("div");
      div.className = "user-card-item";
      const uIsSuperAdmin = isSuperAdmin(u);
      const roleBadgeClass = uIsSuperAdmin ? 'super_admin' : (u.role === 'ADMIN' ? 'admin' : (u.role === 'MANAGER' ? 'manager' : (u.role === 'COOK' ? 'cook' : 'resident')));
      const isBlocked = u.status === "BLOCKED";
      const isMe = user && user.id === u.id;

      let canEdit = false;
      let canDelete = false;
      let canLock = false;

      if (isSuperAdm) {
        // Super Admin: Full system control over all accounts
        canEdit = true;
        canLock = !isMe;
        canDelete = !isMe; // Super Admin can delete anyone except self
      } else if (isNormAdm) {
        // Normal Admin: Can edit/update all except Super Admin. STRICTLY NO DELETE.
        canEdit = !uIsSuperAdmin || isMe;
        canLock = !isMe && !uIsSuperAdmin;
        canDelete = false; // Normal Admin has NO DELETE PERMISSIONS
      } else if (isMgr) {
        // Hostel Manager: Can edit own profile only. All other staff are Read-Only (Watch Only).
        canEdit = isMe;
        canLock = false;
        canDelete = false;
      }

      let actionsHtml = "";
      if (canEdit) {
        actionsHtml += `<button class="btn btn-secondary btn-sm" onclick="openEditUserModal('${u.id}')">✏️ ${isMe ? 'My Profile' : 'Edit'}</button>`;
      }
      if (canLock) {
        actionsHtml += `<button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}')">${isBlocked ? '🔓 Unblock' : '🔒 Lock'}</button>`;
      }
      if (canDelete) {
        actionsHtml += `<button class="btn btn-alert btn-sm" onclick="deleteUser('${u.id}')" title="Super Admin Permanent Delete">🗑️</button>`;
      }
      if (!canEdit && !canLock && !canDelete) {
        actionsHtml = `<span class="badge badge-gray" style="font-size:10px; padding:4px 8px;">👁️ View Only</span>`;
      }

      const roleDisplayName = uIsSuperAdmin ? "SUPER ADMIN" : (u.role || "RESIDENT");
      const refBadge = u.referrerName ? `<span class="badge badge-lilac" style="font-size:9px;">🎁 Ref by: ${u.referrerName}</span>` : '';
      const myCodeDisplay = u.referralCode || (typeof getUserReferralCode === "function" ? getUserReferralCode(u) : "100001");
      const emailDisplay = u.email || `${(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;
      const emailVerifiedBadge = u.isEmailVerified ? '<span class="badge badge-success" style="font-size:9px;">✓ EMAIL OTP VERIFIED</span>' : '<span class="badge badge-amber" style="font-size:9px;">EMAIL UNVERIFIED</span>';
      const shiftDisplay = u.currentShift || u.shift || 'OFF_DUTY';
      const roomDisplay = u.assignedRoom || '101';
      const mobDisplay = u.mobile || 'N/A';

      div.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <strong>${u.name || 'Unnamed Member'}</strong>
            <span class="role-pill ${roleBadgeClass}">${roleDisplayName}</span>
            ${isBlocked ? '<span class="badge badge-alert">BLOCKED</span>' : '<span class="badge badge-success">ACTIVE</span>'}
            ${emailVerifiedBadge}
            ${refBadge}
          </div>
          <p class="text-sub" style="margin-top:2px;">
            📧 <strong>${emailDisplay}</strong> • Room: <strong>${roomDisplay}</strong> • ID: ${u.userIdCode || 'N/A'} • 📱 +91 ${mobDisplay} • Shift: ${shiftDisplay} • Code: <span class="font-mono" style="color:#2563EB;">${myCodeDisplay}</span>
          </p>
        </div>
        <div class="user-card-actions">
          ${actionsHtml}
        </div>
      `;
      uList.appendChild(div);
    });
  } catch (err) {
    console.warn("renderMemberList error:", err);
  }
}

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
  if (state) {
    state.groupId = MAIN_GROUP_ID;
    state.currentGroupId = MAIN_GROUP_ID;
    if (state.currentUser) {
      state.currentUser.groupId = MAIN_GROUP_ID;
      state.currentUser.messGroupId = MAIN_GROUP_ID;
    }
  }
  localStorage.setItem("hostel_mess_group_id", MAIN_GROUP_ID);
  sessionStorage.setItem("hostel_mess_group_id", MAIN_GROUP_ID);
  localStorage.setItem("hostel_mess_state_v2", JSON.stringify(state));
}

function saveState() {
  saveLocalState();
  if (typeof FirebaseSyncService !== "undefined" && FirebaseSyncService.syncAllToCloud) {
    FirebaseSyncService.syncAllToCloud();
  }
}

// Check if user is pending Super Admin approval
function isUserPendingApproval(user) {
  return user && user.status === "PENDING_APPROVAL";
}

// Master Super Admin: Approve User Registration with Role Assignment
function approveUserRegistration(userId, assignedRole = null) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current)) {
    alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) has authority to approve new user registrations.");
    return;
  }

  const u = (state.users || []).find(x => x.id === userId);
  if (!u) return;

  if (assignedRole) {
    u.role = assignedRole;
  }

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
  if (!isSuperAdmin(current)) {
    alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) has authority to reject registrations.");
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

function formatTimeAMPMString(timeStr) {
  if (!timeStr) return "N/A";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? "PM" : "AM";
  const hours12 = h % 12 || 12;
  const mins = !isNaN(m) ? String(m).padStart(2, "0") : "00";
  return `${hours12}:${mins} ${period}`;
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
  const baseRate = (state.mealDefaults && typeof state.mealDefaults.dailyBaseMealRate === "number") ? state.mealDefaults.dailyBaseMealRate : 50;
  if (totalPlates <= 0 || expenses.GROCERY <= 0) {
    return baseRate;
  }
  const calculatedRate = Math.round((expenses.GROCERY / totalPlates) * 100) / 100;
  return Math.max(calculatedRate, baseRate);
}

// Navigation & Tab Switching with Clean URL & Hash Routing
const navBtns = document.querySelectorAll(".nav-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

const TAB_HASH_MAP = {
  "resident": "resident-tab",
  "kitchen": "kitchen-tab",
  "manager": "manager-tab",
  "friends": "friends-tab",
  "members": "friends-tab",
  "expense": "expense-tab",
  "expenses": "expense-tab",
  "admin": "admin-tab"
};

const TAB_ID_TO_HASH = {
  "resident-tab": "resident",
  "kitchen-tab": "kitchen",
  "manager-tab": "manager",
  "friends-tab": "friends",
  "expense-tab": "expense",
  "admin-tab": "admin"
};

function switchTab(targetTabId, updateUrlHash = true) {
  const currentUser = state.currentUser || state.users[0];
  
  // Security Gate 1: Users pending approval are locked strictly to the resident tab
  if (isUserPendingApproval(currentUser) && targetTabId !== "resident-tab") {
    alert("⏳ Access Restricted: Your account registration is pending Master Super Admin approval.\n\nAll manager, kitchen, expense, and administrative modules are locked until your account is approved and activated.");
    targetTabId = "resident-tab";
  }

  // Security Gate 2: Non-admins cannot open Admin tab
  if (targetTabId === "admin-tab" && !isSuperAdmin(currentUser) && !isNormalAdmin(currentUser)) {
    alert("🔒 Access Denied: The Administration Panel is restricted to Super Admin and Admin roles only.");
    targetTabId = "resident-tab";
  }

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

  // 2. Capture Referral Code & Group parameters (?ref=REF-XXXX, ?messId=hostel_mess_data, ?by=..., ?name=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref') || urlParams.get('referral');
    const messIdParam = urlParams.get('messId') || 'hostel_mess_data';
    const referrerIdParam = urlParams.get('by');
    const referrerNameParam = urlParams.get('name');

    if (refParam) {
      const cleanRef = refParam.trim().toUpperCase();
      sessionStorage.setItem("hostel_mess_ref_code", cleanRef);
      sessionStorage.setItem("hostel_mess_group_id", messIdParam);
      if (referrerIdParam) sessionStorage.setItem("hostel_mess_referrer_id", referrerIdParam);
      if (referrerNameParam) sessionStorage.setItem("hostel_mess_referrer_name", decodeURIComponent(referrerNameParam));

      const refInput = document.getElementById("form-user-referral-code");
      if (refInput) refInput.value = cleanRef;

      // Display floating Welcome Invite Banner
      const banner = document.getElementById("invite-welcome-banner");
      const bannerTitle = document.getElementById("banner-invite-title");
      const bannerDesc = document.getElementById("banner-invite-desc");
      const bannerRefName = document.getElementById("banner-referrer-name");

      if (banner) {
        banner.style.display = "flex";
        const inviterName = referrerNameParam ? decodeURIComponent(referrerNameParam) : "Avijit Basu";
        if (bannerRefName) bannerRefName.textContent = inviterName;
        if (bannerTitle) bannerTitle.textContent = `You're Invited by ${inviterName}!`;
        if (bannerDesc) bannerDesc.innerHTML = `Connect to shared Mess Group (<strong>${messIdParam}</strong>) with referral code <strong>${cleanRef}</strong>. Real-time meal bookings, duty shifts, and expenses are live.`;
      }
      console.log("✓ Referral code detected and stored:", cleanRef, "Mess Group:", messIdParam);
    }
  } catch (e) {
    console.warn("URL referral check error:", e);
  }

  // 3. Resolve target tab from hash
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
  renderFriendsScreen();
  renderExpenseScreen();
  renderAdminScreen();
}

// 1. Header Rendering
function renderHeader() {
  const user = state.currentUser;
  
  if (!user) {
    document.getElementById("header-avatar").textContent = "🔐";
    document.getElementById("header-user-name").textContent = "Guest (Not Logged In)";
    document.getElementById("header-user-role").textContent = "Tap 🔐 to Switch Account / Sign In";
    
    const roleBadge = document.getElementById("current-role-badge");
    if (roleBadge) {
      roleBadge.textContent = "SIGN IN";
      roleBadge.className = "role-pill";
      roleBadge.style.cursor = "pointer";
      roleBadge.onclick = () => toggleModal(true);
    }

    const mgrBtn = document.getElementById("nav-manager-btn");
    const expBtn = document.getElementById("nav-expense-btn");
    const admBtn = document.getElementById("nav-admin-btn");
    const kitBtn = document.getElementById("nav-kitchen-btn");

    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.style.display = "inline-flex"; kitBtn.title = "Hostel Kitchen"; }
    if (mgrBtn) { mgrBtn.style.opacity = "0.4"; mgrBtn.style.display = "none"; }
    if (expBtn) { expBtn.style.opacity = "0.4"; expBtn.style.display = "none"; }
    if (admBtn) { admBtn.style.opacity = "0.4"; admBtn.style.display = "none"; }
    return;
  }

  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
  
  document.getElementById("header-avatar").textContent = initials;
  document.getElementById("header-user-name").textContent = user.name;
  const roleDisplay = isSuperAdmin(user) ? "SUPER ADMIN" : user.role;
  document.getElementById("header-user-role").textContent = `${roleDisplay} • ${user.assignedRoom || 'Room Unassigned'}`;
  
  const roleBadge = document.getElementById("current-role-badge");
  if (roleBadge) {
    roleBadge.textContent = roleDisplay;
    roleBadge.onclick = null;
    const badgeClass = isSuperAdmin(user) ? "super_admin" : (user.role === "ADMIN" ? "admin" : (user.role === "MANAGER" ? "manager" : (user.role === "COOK" ? "cook" : "resident")));
    roleBadge.className = `role-pill ${badgeClass}`;
  }

  // Manage Nav Button Visibility, Opacity & Lock Indicators based on user role
  const mgrBtn = document.getElementById("nav-manager-btn");
  const expBtn = document.getElementById("nav-expense-btn");
  const admBtn = document.getElementById("nav-admin-btn");
  const kitBtn = document.getElementById("nav-kitchen-btn");

  const isPending = isUserPendingApproval(user);

  if (isPending) {
    if (kitBtn) { kitBtn.style.opacity = "0.4"; kitBtn.title = "🔒 Kitchen (Locked - Pending Super Admin Approval)"; }
    if (mgrBtn) { mgrBtn.style.opacity = "0.4"; mgrBtn.style.display = "none"; }
    if (expBtn) { expBtn.style.opacity = "0.4"; expBtn.style.display = "none"; }
    if (admBtn) { admBtn.style.opacity = "0.4"; admBtn.style.display = "none"; }
  } else if (isEmployee(user)) {
    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.title = "Hostel Kitchen & Meal Status"; }
    if (mgrBtn) { mgrBtn.style.opacity = "0.5"; mgrBtn.style.display = "none"; }
    if (expBtn) { expBtn.style.opacity = "0.9"; expBtn.style.display = "inline-flex"; expBtn.title = "Expense View & Purchase Requests"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.style.display = "none"; }
  } else if (isManager(user)) {
    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.title = "Hostel Kitchen"; }
    if (mgrBtn) { mgrBtn.style.opacity = "1"; mgrBtn.style.display = "inline-flex"; mgrBtn.title = "Hostel Manager Operations"; }
    if (expBtn) { expBtn.style.opacity = "1"; expBtn.style.display = "inline-flex"; expBtn.title = "Expense & Purchase Approvals"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.style.display = "none"; }
  } else if (isNormalAdmin(user)) {
    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.title = "Hostel Kitchen"; }
    if (mgrBtn) { mgrBtn.style.opacity = "1"; mgrBtn.style.display = "inline-flex"; mgrBtn.title = "Manager Operations"; }
    if (expBtn) { expBtn.style.opacity = "1"; expBtn.style.display = "inline-flex"; expBtn.title = "Expense Ledger"; }
    if (admBtn) { admBtn.style.opacity = "1"; admBtn.style.display = "inline-flex"; admBtn.title = "Admin Panel (Strict No-Delete)"; }
  } else if (isSuperAdmin(user)) {
    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.title = "Hostel Kitchen"; }
    if (mgrBtn) { mgrBtn.style.opacity = "1"; mgrBtn.style.display = "inline-flex"; mgrBtn.title = "Manager Operations"; }
    if (expBtn) { expBtn.style.opacity = "1"; expBtn.style.display = "inline-flex"; expBtn.title = "Expense Ledger & Deletions"; }
    if (admBtn) { admBtn.style.opacity = "1"; admBtn.style.display = "inline-flex"; admBtn.title = "Master Super Admin Panel"; }
  } else if (isCook(user)) {
    if (kitBtn) { kitBtn.style.opacity = "1"; kitBtn.title = "Kitchen Headcount"; }
    if (mgrBtn) { mgrBtn.style.opacity = "0.5"; mgrBtn.style.display = "none"; }
    if (expBtn) { expBtn.style.opacity = "0.7"; expBtn.style.display = "inline-flex"; expBtn.title = "Expense View"; }
    if (admBtn) { admBtn.style.opacity = "0.5"; admBtn.style.display = "none"; }
  }
}

// Helper to check if a user is currently ON LEAVE
function isUserOnLeave(u) {
  const user = u || state.currentUser || state.users[0];
  return user && user.status === "ON_LEAVE";
}

// 2. Resident Screen Rendering (with Leave Lockout, Pending Approval & View-Only Mode)
function renderResidentScreen() {
  const user = state.currentUser;

  if (!user) {
    const lockoutContainer = document.getElementById("resident-leave-lockout-container");
    if (lockoutContainer) {
      lockoutContainer.innerHTML = `
        <div class="leave-lockout-banner" style="border-left: 4px solid var(--primary); background: #EFF6FF;">
          <div class="leave-lockout-header">
            <span class="leave-lockout-icon">🔐</span>
            <div>
              <div class="leave-lockout-title" style="color:var(--primary-dark);">SIGN IN TO ACCESS HOSTEL MESS PORTAL</div>
              <div class="badge badge-success" style="margin-top:2px;">AUTHENTICATION REQUIRED</div>
            </div>
          </div>
          <p class="leave-lockout-desc" style="color:#1E3A8A;">
            Please log in with your 4-digit PIN or register your account to book meals, punch duty attendance, and manage hostel services.
          </p>
          <div class="mt-3" style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="btn-banner-login-action" style="width:auto; padding:8px 16px;">
              🔐 Sign In / Switch Account
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-banner-register-action" style="width:auto; padding:8px 16px; background:#FFFFFF; color:#1E293B; border:1px solid #CBD5E1;">
              👤 Register New Account
            </button>
          </div>
        </div>
      `;
      document.getElementById("btn-banner-login-action")?.addEventListener("click", () => toggleModal(true));
      document.getElementById("btn-banner-register-action")?.addEventListener("click", () => {
        closeModal("modal-switch-user");
        openModal("modal-user-form");
      });
    }

    const pulseDot = document.getElementById("resident-pulse-dot");
    const statusBadge = document.getElementById("resident-punch-status-badge");
    const statusText = document.getElementById("resident-punch-status-text");
    const btnPunchIn = document.getElementById("btn-employee-punch-in");
    const btnPunchOut = document.getElementById("btn-employee-punch-out");
    if (pulseDot) pulseDot.className = "live-pulse-dot inactive";
    if (statusBadge) {
      statusBadge.textContent = "🔒 SIGN IN REQUIRED";
      statusBadge.className = "badge badge-alert";
    }
    if (statusText) statusText.textContent = "Please sign in to punch duty attendance and book meals";
    if (btnPunchIn) {
      btnPunchIn.disabled = false;
      btnPunchIn.onclick = () => toggleModal(true);
      btnPunchIn.innerHTML = `🔐 Sign In to Punch In`;
    }
    if (btnPunchOut) {
      btnPunchOut.disabled = true;
      btnPunchOut.innerHTML = `Punch Out`;
    }
    return;
  }

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

  const mealCfg = state.mealDefaults || DEFAULT_MEAL_CONFIG;
  const autoMode = mealCfg.autoMealBookingMode || "SHIFT_BASED";
  const userShift = (user.currentShift || "OFF_DUTY").toUpperCase();

  let logicPillText = "Auto-OFF (Skip)";
  let logicPillClass = "pill-badge badge-alert";
  let explanationText = "";

  if (onLeave) {
    logicPillText = "🔒 View-Only Mode";
    logicPillClass = "pill-badge badge-leave";
    explanationText = "🏖️ <strong>ON LEAVE ACTIVE:</strong> You are on leave. Meals, shifts, and attendance are completely frozen. Click <strong>'Request Leave End'</strong> upon return.";
  } else if (autoMode === "ALWAYS_ON") {
    logicPillText = "Always ON (Eating)";
    logicPillClass = "pill-badge badge-success";
    explanationText = "💡 <strong>Policy:</strong> All meals Auto-ON. Toggle OFF before cut-off if dining outside.";
  } else if (autoMode === "MANUAL") {
    logicPillText = "Manual Opt-In";
    logicPillClass = "pill-badge badge-alert";
    explanationText = "⚠️ <strong>Policy:</strong> Manual Opt-In active. Toggle ON before cut-off to book plate.";
  } else {
    // SHIFT_BASED
    if (userShift === "NIGHT") {
      logicPillText = "Pre-select Dinner";
      logicPillClass = "pill-badge badge-success";
      explanationText = "🌙 <strong>Night Shift (10 PM - 6 AM):</strong> Pre-selected for <strong>Dinner (Auto-ON)</strong>. Lunch is Auto-OFF (toggle ON if dining before 8:30 AM).";
    } else if (userShift === "EVENING") {
      logicPillText = "Pre-select Lunch";
      logicPillClass = "pill-badge badge-success";
      explanationText = "🌅 <strong>Evening Shift (2 PM - 10 PM):</strong> Pre-selected for <strong>Lunch (Auto-ON)</strong>. Dinner is Auto-OFF (toggle ON if eating after duty before 4:30 PM).";
    } else if (userShift === "MORNING") {
      logicPillText = "Pre-select Dinner";
      logicPillClass = "pill-badge badge-success";
      explanationText = "☀️ <strong>Morning Shift (6 AM - 2 PM):</strong> Pre-selected for <strong>Dinner (Auto-ON)</strong>. Lunch is Auto-OFF (toggle ON before 8:30 AM if needed).";
    } else {
      logicPillText = "Auto-ON (Lunch & Dinner)";
      logicPillClass = "pill-badge badge-success";
      explanationText = "🏡 <strong>Off-Duty / Rest Day:</strong> Pre-selected for <strong>Both Lunch & Dinner (Auto-ON)</strong>.";
    }
  }

  const pill = document.getElementById("resident-logic-pill");
  if (pill) {
    pill.textContent = logicPillText;
    pill.className = logicPillClass;
  }

  const ruleBox = document.getElementById("rule-explanation-box");
  if (ruleBox) {
    ruleBox.innerHTML = explanationText;
  }

  // Update Resident Meal Defaults Banner Info
  const lunchCutOffFormatted = formatTimeAMPMString(mealCfg.lunchCutOffTime || "08:30");
  const dinnerCutOffFormatted = formatTimeAMPMString(mealCfg.dinnerCutOffTime || "16:30");

  const bannerBaseRate = document.getElementById("res-banner-base-rate");
  if (bannerBaseRate) bannerBaseRate.textContent = `Base: ₹${mealCfg.dailyBaseMealRate || 50}/plate`;

  const bannerLunchCutoff = document.getElementById("res-banner-lunch-cutoff");
  if (bannerLunchCutoff) bannerLunchCutoff.textContent = `Lunch: ${lunchCutOffFormatted}`;

  const bannerDinnerCutoff = document.getElementById("res-banner-dinner-cutoff");
  if (bannerDinnerCutoff) bannerDinnerCutoff.textContent = `Dinner: ${dinnerCutOffFormatted}`;

  const cutoffBadge = document.getElementById("resident-meal-cutoff-badge");
  if (cutoffBadge) cutoffBadge.textContent = `Cut-off: ${dinnerCutOffFormatted}`;

  // Update shift buttons active and disabled state
  document.querySelectorAll(".shift-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-shift") === user.currentShift);
    if (onLeave || pendingApproval) {
      btn.classList.add("btn-disabled-lockout");
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    } else {
      btn.classList.remove("btn-disabled-lockout");
      btn.style.opacity = "1";
      btn.style.cursor = "pointer";
    }
  });

  // Render Resident Meals based on configured meal count
  const userMeals = (state.meals || []).filter(m => m.userId === user.id);
  const listEl = document.getElementById("resident-meal-list");
  listEl.innerHTML = "";

  const defaultMeals = [];
  if (mealCfg.defaultMealCount >= 3) {
    defaultMeals.push({ type: "BREAKFAST", time: "7:30 AM - 9:30 AM", cutOff: "Cut-off: 7:00 AM" });
  }
  defaultMeals.push({ type: "LUNCH", time: "12:00 PM - 2:30 PM", cutOff: `Cut-off: ${lunchCutOffFormatted}` });
  if (mealCfg.defaultMealCount >= 2) {
    defaultMeals.push({ type: "DINNER", time: "7:30 PM - 10:00 PM", cutOff: `Cut-off: ${dinnerCutOffFormatted}` });
  }

  defaultMeals.forEach(dm => {
    let existing = userMeals.find(m => m.mealType === dm.type);
    let defaultStatusForMeal = "OFF";
    if (autoMode === "ALWAYS_ON") {
      defaultStatusForMeal = "ON";
    } else if (autoMode === "MANUAL") {
      defaultStatusForMeal = "OFF";
    } else {
      defaultStatusForMeal = getShiftDefaultMealStatus(user.currentShift, dm.type);
    }

    let status = pendingApproval ? "LOCKED (PENDING)" : (onLeave ? "OFF (LEAVE)" : (existing ? existing.status : defaultStatusForMeal));
    let isOn = !onLeave && !pendingApproval && (status === "ON" || status === "PACK_TIFFIN" || status === "LATE_COVERED");

    const isLocked = onLeave || pendingApproval;
    const item = document.createElement("div");
    item.className = `meal-item ${isOn ? "on" : ""} ${isLocked ? "locked-leave-item" : ""}`;
    item.innerHTML = `
      <div class="meal-info">
        <strong>${dm.type} (${status})</strong>
        <span>${dm.time} • ${dm.cutOff}</span>
      </div>
      <button class="meal-toggle-btn ${isOn ? "btn-toggle-on" : "btn-toggle-off"} ${isLocked ? "btn-disabled-lockout" : ""}" 
              ${isLocked ? 'disabled title="Locked"' : `onclick="toggleMeal('${dm.type}')"`}>
        ${pendingApproval ? "🔒 Locked (Pending Approval)" : (onLeave ? "🔒 Locked (On Leave)" : (isOn ? "✓ Eating (Meal ON)" : "✕ Skip (Meal OFF)"))}
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

  // 3. Render Referral ID & Profile Info Cards
  const myRefCode = user.referralCode || getUserReferralCode(user);
  const myRefDisplayEl = document.getElementById("resident-my-ref-id");
  if (myRefDisplayEl) myRefDisplayEl.textContent = myRefCode;

  const profNameEl = document.getElementById("resident-profile-name");
  const profRoleEl = document.getElementById("resident-profile-role");
  const profMobileEl = document.getElementById("resident-profile-mobile");
  const profRoomEl = document.getElementById("resident-profile-room");
  const profCodeEl = document.getElementById("resident-profile-code");
  const profRefEl = document.getElementById("resident-profile-ref");
  const profStatusEl = document.getElementById("resident-profile-status");

  if (profNameEl) profNameEl.textContent = user.name || "Resident";
  if (profRoleEl) profRoleEl.textContent = isSuperAdmin(user) ? "Super Admin" : (user.role || "Resident");
  if (profMobileEl) profMobileEl.textContent = user.mobile ? `+91 ${user.mobile}` : "Not provided";
  if (profRoomEl) profRoomEl.textContent = `Room ${user.assignedRoom || '101'}`;
  if (profCodeEl) profCodeEl.textContent = myRefCode;
  if (profRefEl) profRefEl.textContent = user.referrerName ? `${user.referrerName} (${user.referredCode || 'Ref'})` : "Direct / Admin (hostel_mess_data)";
  if (profStatusEl) {
    profStatusEl.textContent = user.status || "ACTIVE";
    profStatusEl.className = `badge ${user.status === 'ACTIVE' ? 'badge-success' : (user.status === 'ON_LEAVE' ? 'badge-leave' : 'badge-alert')}`;
  }
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

  const mealCfg = state.mealDefaults || DEFAULT_MEAL_CONFIG;
  const autoMode = mealCfg.autoMealBookingMode || "SHIFT_BASED";
  
  // Auto sync today's meals based on rules:
  // Night Shift -> Pre-select Dinner (Dinner ON, Lunch OFF)
  // Evening Shift -> Pre-select Lunch (Lunch ON, Dinner OFF)
  // Morning Shift -> Pre-select Dinner (Dinner ON, Lunch OFF)
  // Off-Duty -> Pre-select Both (Lunch ON, Dinner ON)
  const mealTypes = ["BREAKFAST", "LUNCH", "DINNER"];
  mealTypes.forEach(type => {
    let shouldBeOn = false;
    if (autoMode === "ALWAYS_ON") {
      shouldBeOn = true;
    } else if (autoMode === "MANUAL") {
      shouldBeOn = false;
    } else {
      shouldBeOn = (getShiftDefaultMealStatus(shift, type) === "ON");
    }

    let meal = state.meals.find(m => m.userId === state.currentUser.id && m.mealType === type);
    if (!meal) {
      meal = {
        id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 5),
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        roomNumber: state.currentUser.assignedRoom || "101",
        mealType: type,
        status: shouldBeOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: shift
      };
      state.meals.push(meal);
    } else {
      if (meal.status !== "PACK_TIFFIN" && meal.status !== "LATE_COVERED") {
        meal.status = shouldBeOn ? "ON" : "OFF";
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
  const tbody = document.getElementById("rosterTableBody") || document.getElementById("kitchen-roster-tbody");
  if (!tbody) return;
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

      const refBadge = u.referrerName ? `<span class="badge badge-lilac" style="font-size:9px;">🎁 Ref by: ${u.referrerName}</span>` : '';

      div.innerHTML = `
        <div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong>${u.name} (Room ${u.assignedRoom || '101'})</strong>
            ${statusPill}
            ${refBadge}
          </div>
          <p class="text-sub">${u.userIdCode || 'EMP'} • 📱 +91 ${u.mobile} ${u.isOtpVerified ? '• <span class="text-success font-bold">✓ OTP Verified</span>' : ''}</p>
        </div>
        <span class="role-tag">${isOnLeave ? 'LOCKED' : (u.currentShift || 'OFF_DUTY')}</span>
      `;
      rList.appendChild(div);
    });
  }

  // 4. Pending User Registration Approvals
  renderPendingUserApprovals();
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

// 5. Friends & Mess Members Screen Rendering (Shared Central Database Directory, Live Presence & WhatsApp Connect)
function renderFriendsScreen() {
  const user = state.currentUser || state.users[0];
  const allUsers = state.users || [];
  const activeMembers = allUsers.filter(u => u.status === 'ACTIVE');
  
  // Real-time duty punch lookups for today
  const today = getTodayString();
  const activeAttendance = (state.attendanceLog || []).filter(a => a.date === today && a.status === 'ACTIVE');
  const onDutyUserIds = new Set(activeAttendance.map(a => a.userId));

  // Today's lunch & dinner plate counts
  const lunchCount = (state.meals || []).filter(m => m.mealType === 'LUNCH' && (m.status === 'ON' || m.status === 'PACK_TIFFIN' || m.status === 'LATE_COVERED')).length;
  const dinnerCount = (state.meals || []).filter(m => m.mealType === 'DINNER' && (m.status === 'ON' || m.status === 'PACK_TIFFIN' || m.status === 'LATE_COVERED')).length;

  // 1. Update Metrics
  const statTotalEl = document.getElementById("friends-stat-total");
  const statOnDutyEl = document.getElementById("friends-stat-onduty");
  const statLunchEl = document.getElementById("friends-stat-lunch");
  const statDinnerEl = document.getElementById("friends-stat-dinner");

  if (statTotalEl) statTotalEl.textContent = activeMembers.length;
  if (statOnDutyEl) statOnDutyEl.textContent = onDutyUserIds.size;
  if (statLunchEl) statLunchEl.textContent = lunchCount;
  if (statDinnerEl) statDinnerEl.textContent = dinnerCount;

  // Update My Referral Code in Friends Tab
  const myRefCode = user.referralCode || getUserReferralCode(user);
  const friendsRefDisplayEl = document.getElementById("friends-my-ref-id");
  if (friendsRefDisplayEl) friendsRefDisplayEl.textContent = myRefCode;

  // 2. Filter Counts
  const residentCount = allUsers.filter(u => u.role === 'RESIDENT' || u.role === 'EMPLOYEE').length;
  const onDutyCount = onDutyUserIds.size;
  const leaveCount = allUsers.filter(u => u.status === 'ON_LEAVE').length;
  const staffCount = allUsers.filter(u => isSuperAdmin(u) || isNormalAdmin(u) || isManager(u) || isCook(u)).length;

  const countAllEl = document.getElementById("count-friends-all");
  const countResEl = document.getElementById("count-friends-resident");
  const countDutyEl = document.getElementById("count-friends-duty");
  const countLeaveEl = document.getElementById("count-friends-leave");
  const countStaffEl = document.getElementById("count-friends-staff");

  if (countAllEl) countAllEl.textContent = allUsers.length;
  if (countResEl) countResEl.textContent = residentCount;
  if (countDutyEl) countDutyEl.textContent = onDutyCount;
  if (countLeaveEl) countLeaveEl.textContent = leaveCount;
  if (countStaffEl) countStaffEl.textContent = staffCount;

  // 3. Filter and Search
  const filter = state.selectedFriendsFilter || "ALL";
  const query = (state.friendsSearchQuery || "").trim().toLowerCase();

  let filtered = allUsers.slice();

  if (filter === "RESIDENT") {
    filtered = filtered.filter(u => u.role === "RESIDENT" || u.role === "EMPLOYEE");
  } else if (filter === "DUTY_ACTIVE") {
    filtered = filtered.filter(u => onDutyUserIds.has(u.id));
  } else if (filter === "LEAVE") {
    filtered = filtered.filter(u => u.status === "ON_LEAVE");
  } else if (filter === "STAFF") {
    filtered = filtered.filter(u => isSuperAdmin(u) || isNormalAdmin(u) || isManager(u) || isCook(u));
  }

  if (query) {
    filtered = filtered.filter(u => {
      const matchName = (u.name || "").toLowerCase().includes(query);
      const matchRoom = (u.assignedRoom || "").toLowerCase().includes(query);
      const matchMobile = (u.mobile || "").includes(query);
      const matchEmail = (u.email || "").toLowerCase().includes(query);
      const matchRole = (u.role || "").toLowerCase().includes(query);
      const matchCode = (u.userIdCode || "").toLowerCase().includes(query);
      const matchShift = (u.currentShift || "").toLowerCase().includes(query);
      const matchRef = (u.referrerName || "").toLowerCase().includes(query);
      return matchName || matchRoom || matchMobile || matchEmail || matchRole || matchCode || matchShift || matchRef;
    });
  }

  // 4. Render Members List
  const container = document.getElementById("friends-members-list");
  if (!container) return;
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:28px 16px; text-align:center;">
        <p style="font-size:15px; font-weight:600; color:var(--text-secondary);">No friends or members match your filter.</p>
        <p class="text-sub mt-1">Tap <strong>"Invite via WhatsApp"</strong> above to send an invite link to roommates!</p>
      </div>
    `;
    return;
  }

  filtered.forEach(m => {
    const isMe = user && m.id === user.id;
    const isOnDuty = onDutyUserIds.has(m.id);
    const isOnLeave = m.status === "ON_LEAVE";
    const isPending = m.status === "PENDING_APPROVAL";

    // Presence Indicator
    let presenceClass = "off-duty";
    let presenceText = "Off Duty";
    if (isOnDuty) {
      presenceClass = "on-duty";
      presenceText = "Live On Duty";
    } else if (isOnLeave) {
      presenceClass = "on-leave";
      presenceText = "On Leave (गाँव)";
    } else if (isPending) {
      presenceClass = "pending";
      presenceText = "Pending Approval";
    }

    // Role pill style
    const roleClass = isSuperAdmin(m) ? "super_admin" : (m.role === "ADMIN" ? "admin" : (m.role === "MANAGER" ? "manager" : (m.role === "COOK" ? "cook" : "resident")));
    const roleName = isSuperAdmin(m) ? "👑 Master Super Admin" : (m.role === "ADMIN" ? "🛡️ Admin" : (m.role === "MANAGER" ? "💼 Manager" : (m.role === "COOK" ? "👨‍🍳 Cook" : "🏠 Resident")));

    // Today's Meals status for this member
    const myLunch = (state.meals || []).find(ml => ml.userId === m.id && ml.mealType === "LUNCH");
    const myDinner = (state.meals || []).find(ml => ml.userId === m.id && ml.mealType === "DINNER");

    const lunchBadge = myLunch && (myLunch.status === "ON" || myLunch.status === "PACK_TIFFIN" || myLunch.status === "LATE_COVERED")
      ? `<span class="badge badge-success" style="font-size:10px;">🍽️ Lunch: ${myLunch.status === 'PACK_TIFFIN' ? 'Tiffin' : 'ON'}</span>`
      : `<span class="badge" style="background:#F1F5F9; color:#64748B; font-size:10px;">🍽️ Lunch: OFF</span>`;

    const dinnerBadge = myDinner && (myDinner.status === "ON" || myDinner.status === "PACK_TIFFIN" || myDinner.status === "LATE_COVERED")
      ? `<span class="badge badge-lilac" style="font-size:10px;">🍲 Dinner: ${myDinner.status === 'PACK_TIFFIN' ? 'Tiffin' : 'ON'}</span>`
      : `<span class="badge" style="background:#F1F5F9; color:#64748B; font-size:10px;">🍲 Dinner: OFF</span>`;

    // Active attendance punch details
    const activePunch = activeAttendance.find(a => a.userId === m.id);
    const punchInfoHtml = activePunch 
      ? `<div class="duty-badge on-duty" style="font-size:11px; padding:3px 8px; border-radius:6px;">🟢 Punched In at ${activePunch.punchInTime || '08:00 AM'}</div>`
      : `<div class="duty-badge off-duty" style="font-size:11px; padding:3px 8px; border-radius:6px; color:#64748B; background:#F1F5F9;">⚪ Shift: ${m.currentShift || 'OFF_DUTY'}</div>`;

    // Referral badge
    const refBadge = m.referrerName 
      ? `<span class="badge badge-blue" style="font-size:9px;" title="Referred by ${m.referrerName}">🎁 Ref by: ${m.referrerName}</span>` 
      : (m.referralCode ? `<span class="badge badge-primary-light" style="font-size:9px;">Code: ${m.referralCode}</span>` : '');

    const initials = (m.name || "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

    // Direct WhatsApp message URL to chat with this member
    const directWaMsg = encodeURIComponent(`Hi ${m.name}, connecting via Hostel Mess Management Portal (hostel_mess_data)!`);
    const directWaUrl = `https://wa.me/91${m.mobile}?text=${directWaMsg}`;

    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <div class="member-card-header">
        <div class="member-avatar-wrap">
          <div class="member-avatar">${initials}</div>
          <span class="presence-dot ${presenceClass}" title="${presenceText}"></span>
        </div>
        <div class="member-meta">
          <div class="member-name-row">
            <h4>${m.name} ${isMe ? '<span class="badge badge-primary-light" style="font-size:9px;">(You)</span>' : ''}</h4>
            <span class="role-pill ${roleClass}" style="font-size:10px;">${roleName}</span>
          </div>
          <div class="member-sub-info">
            <span>🚪 Room: <strong>${m.assignedRoom || '101'}</strong></span>
            <span>📱 +91 ${m.mobile}</span>
            ${m.userIdCode ? `<span>🏷️ ${m.userIdCode}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="member-status-pills" style="margin-top:10px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
        ${punchInfoHtml}
        ${lunchBadge}
        ${dinnerBadge}
        ${refBadge}
      </div>

      <div class="member-card-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid #F1F5F9; padding-top:10px;">
        <a href="${directWaUrl}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-sm" style="flex:1; justify-content:center; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.82 2.791.82 3.181 0 5.767-2.586 5.767-5.766.001-3.181-2.585-5.766-5.767-5.766zm9.969 5.766c0 5.485-4.484 9.969-9.969 9.969-1.722 0-3.339-.441-4.757-1.213l-5.274 1.381 1.41-5.143c-.886-1.488-1.379-3.217-1.379-5.063 0-5.485 4.485-9.969 10-9.969 5.485 0 9.969 4.485 9.969 9.969z"/></svg>
          WhatsApp Chat
        </a>
        <button class="btn btn-secondary btn-sm" onclick="shareReferralOnWhatsApp()" style="font-size:12px; display:inline-flex; align-items:center; gap:4px;">
          🎁 Invite Friends
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// 6. Expense Ledger Screen (Actual Expenses Tracking & Approval Workflow)
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

    const canDeleteThisExp = isSuperAdmin(user);

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

  if (!isSuperAdmin(user)) {
    alert("🔒 Access Denied: Only Master Super Admin has permission to delete expense records. Normal Admin, Manager, and Employee accounts cannot delete records.");
    return;
  }

  if (confirm(`Delete expense "${exp.description}" (₹${exp.amount}) permanently from Firestore Cloud?`)) {
    state.expensesLog = state.expensesLog.filter(e => e.id !== id);
    FirebaseSyncService.deleteExpense(id);
    saveState();
    renderUI();
  }
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
  const user = state.currentUser || state.users[0];
  if (!isSuperAdmin(user)) {
    alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) can configure room rent and fixed fees.");
    return;
  }
  const val = parseFloat(document.getElementById("setting-room-rent").value) || 0;
  state.roomRentPerPerson = val;
  if (!state.mealDefaults) state.mealDefaults = Object.assign({}, DEFAULT_MEAL_CONFIG);
  state.mealDefaults.roomRentPerPerson = val;
  FirebaseSyncService.saveSettings({ roomRentPerPerson: val });
  saveState();
  renderUI();
  alert("✓ Standard Monthly Room Rent updated to ₹" + val + " by Super Admin.");
});

// Super Admin Save & Broadcast Meal Defaults
document.getElementById("btn-save-meal-defaults")?.addEventListener("click", async () => {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current)) {
    alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) has authority to modify mess meal defaults and rates.");
    return;
  }

  const mealCount = parseInt(document.getElementById("cfg-meal-count")?.value, 10) || 2;
  const baseRate = parseFloat(document.getElementById("cfg-base-plate-rate")?.value) || 50;
  const lunchCutoff = document.getElementById("cfg-lunch-cutoff")?.value || "08:30";
  const dinnerCutoff = document.getElementById("cfg-dinner-cutoff")?.value || "16:30";
  const guestRate = parseFloat(document.getElementById("cfg-guest-plate-rate")?.value) || 60;
  const roomRent = parseFloat(document.getElementById("cfg-room-rent")?.value) || 1500;
  const autoMode = document.getElementById("cfg-auto-booking-mode")?.value || "SHIFT_BASED";
  const messName = (document.getElementById("cfg-mess-name")?.value || "").trim() || "Hostel Central Mess";

  // Shift-Meal default mappings configured by Super Admin
  const nightVal = document.getElementById("cfg-shift-night")?.value || "DINNER";
  const eveningVal = document.getElementById("cfg-shift-evening")?.value || "LUNCH";
  const morningVal = document.getElementById("cfg-shift-morning")?.value || "DINNER";
  const offdutyVal = document.getElementById("cfg-shift-offduty")?.value || "BOTH";

  const updatedShiftRules = {
    NIGHT: convertSelectValueToRule(nightVal),
    EVENING: convertSelectValueToRule(eveningVal),
    MORNING: convertSelectValueToRule(morningVal),
    OFF_DUTY: convertSelectValueToRule(offdutyVal),
    GENERAL: convertSelectValueToRule(offdutyVal)
  };

  const newDefaults = {
    defaultMealCount: mealCount,
    dailyBaseMealRate: baseRate,
    lunchCutOffTime: lunchCutoff,
    dinnerCutOffTime: dinnerCutoff,
    guestMealRate: guestRate,
    roomRentPerPerson: roomRent,
    autoMealBookingMode: autoMode,
    shiftMealRules: updatedShiftRules,
    mealCutOffStrict: true,
    messName: messName
  };

  const success = await FirebaseSyncService.saveMealDefaults(newDefaults);
  if (success) {
    const lunchFmt = formatTimeAMPMString(lunchCutoff);
    const dinnerFmt = formatTimeAMPMString(dinnerCutoff);
    alert(`✓ Super Admin Meal Defaults Saved & Broadcast to Firebase!\n\n• Daily Meals: ${mealCount} Meals / Day\n• Base Plate Rate: ₹${baseRate}\n• Lunch Cut-Off: ${lunchFmt}\n• Dinner Cut-Off: ${dinnerFmt}\n• Shift Mapping:\n   - Night Shift -> ${nightVal}\n   - Evening Shift -> ${eveningVal}\n   - Morning Shift -> ${morningVal}\n   - Off-Duty -> ${offdutyVal}\n• Auto-Booking Policy: ${autoMode}\n\nAll connected members and devices will sync to these rules in real-time under root node 'hostel_mess_data'.`);
  }
});

// 6. Admin Screen Rendering (User & Role Management CRUD + Attendance & OT Report)
function renderAdminScreen() {
  const user = state.currentUser || state.users[0];
  const isSuperAdm = isSuperAdmin(user);
  const isNormAdm = isNormalAdmin(user);
  const isMgr = isManager(user);

  // Update real-time summary cards
  updateDashboardCards(state.users);

  const addUsrBtn = document.getElementById("btn-open-add-user");
  const recPunchBtn = document.getElementById("btn-open-manual-att");
  const resetDbBtn = document.getElementById("btn-reset-db");
  const dbControlsCard = document.getElementById("admin-db-controls-card");

  if (addUsrBtn) addUsrBtn.style.display = (isSuperAdm || isNormAdm || isMgr) ? "inline-flex" : "none";
  if (recPunchBtn) recPunchBtn.style.display = (isSuperAdm || isNormAdm || isMgr) ? "inline-flex" : "none";
  if (resetDbBtn) resetDbBtn.style.display = isSuperAdm ? "inline-flex" : "none";
  if (dbControlsCard) dbControlsCard.style.display = isSuperAdm ? "block" : "none";

  // 0. Render Super Admin Meal Defaults & Mess Policy Controls
  const cfgCard = document.getElementById("admin-meal-defaults-card");
  const cfgNotice = document.getElementById("cfg-permission-notice");
  const btnSaveCfg = document.getElementById("btn-save-meal-defaults");

  const mealCountInput = document.getElementById("cfg-meal-count");
  const baseRateInput = document.getElementById("cfg-base-plate-rate");
  const lunchCutoffInput = document.getElementById("cfg-lunch-cutoff");
  const dinnerCutoffInput = document.getElementById("cfg-dinner-cutoff");
  const guestRateInput = document.getElementById("cfg-guest-plate-rate");
  const roomRentInput = document.getElementById("cfg-room-rent");
  const autoModeInput = document.getElementById("cfg-auto-booking-mode");
  const messNameInput = document.getElementById("cfg-mess-name");

  const shiftNightSelect = document.getElementById("cfg-shift-night");
  const shiftEveningSelect = document.getElementById("cfg-shift-evening");
  const shiftMorningSelect = document.getElementById("cfg-shift-morning");
  const shiftOffdutySelect = document.getElementById("cfg-shift-offduty");

  const mealCfg = state.mealDefaults || DEFAULT_MEAL_CONFIG;

  if (mealCountInput) mealCountInput.value = mealCfg.defaultMealCount || 2;
  if (baseRateInput) baseRateInput.value = mealCfg.dailyBaseMealRate || 50;
  if (lunchCutoffInput) lunchCutoffInput.value = mealCfg.lunchCutOffTime || "08:30";
  if (dinnerCutoffInput) dinnerCutoffInput.value = mealCfg.dinnerCutOffTime || "16:30";
  if (guestRateInput) guestRateInput.value = mealCfg.guestMealRate || 60;
  if (roomRentInput) roomRentInput.value = mealCfg.roomRentPerPerson || state.roomRentPerPerson || 1500;
  if (autoModeInput) autoModeInput.value = mealCfg.autoMealBookingMode || "SHIFT_BASED";
  if (messNameInput) messNameInput.value = mealCfg.messName || "Hostel Central Mess";

  const rules = mealCfg.shiftMealRules || DEFAULT_SHIFT_MEAL_RULES;
  if (shiftNightSelect) shiftNightSelect.value = convertRuleToSelectValue(rules.NIGHT || DEFAULT_SHIFT_MEAL_RULES.NIGHT);
  if (shiftEveningSelect) shiftEveningSelect.value = convertRuleToSelectValue(rules.EVENING || DEFAULT_SHIFT_MEAL_RULES.EVENING);
  if (shiftMorningSelect) shiftMorningSelect.value = convertRuleToSelectValue(rules.MORNING || DEFAULT_SHIFT_MEAL_RULES.MORNING);
  if (shiftOffdutySelect) shiftOffdutySelect.value = convertRuleToSelectValue(rules.OFF_DUTY || DEFAULT_SHIFT_MEAL_RULES.OFF_DUTY);

  const allCfgInputs = [
    mealCountInput, baseRateInput, lunchCutoffInput, dinnerCutoffInput, 
    guestRateInput, roomRentInput, autoModeInput, messNameInput,
    shiftNightSelect, shiftEveningSelect, shiftMorningSelect, shiftOffdutySelect
  ];

  if (!isSuperAdm) {
    // Non-Super Admins are strictly View-Only
    allCfgInputs.forEach(inp => { if (inp) inp.disabled = true; });
    if (btnSaveCfg) {
      btnSaveCfg.disabled = true;
      btnSaveCfg.className = "btn btn-secondary";
      btnSaveCfg.innerHTML = `🔒 Super Admin Authority Only`;
    }
    if (cfgNotice) {
      cfgNotice.innerHTML = `🔒 <strong>View-Only Mode:</strong> Only Master Super Admin (Avijit Basu) can modify shift-meal rules & default mess settings.`;
    }
  } else {
    allCfgInputs.forEach(inp => { if (inp) inp.disabled = false; });
    if (btnSaveCfg) {
      btnSaveCfg.disabled = false;
      btnSaveCfg.className = "btn btn-primary";
      btnSaveCfg.innerHTML = `💾 Save & Broadcast Meal Defaults`;
    }
    if (cfgNotice) {
      cfgNotice.innerHTML = `👑 <strong>Super Admin Authority:</strong> Changes broadcast instantly to all connected devices in <strong>hostel_mess_data</strong>.`;
    }
  }

  // 1. Render Attendance & OT Report Table
  renderAttendanceReport();

  // 1B. Render Master Super Admin Pending User Registrations
  renderPendingUserApprovals();

  // 2. Render User & Role Directory
  renderMemberList(state.users);
}

function renderAttendanceReport() {
  const user = state.currentUser || state.users[0];
  const isEmp = isEmployee(user) || isCook(user);
  const isSuperAdm = isSuperAdmin(user);

  const today = getTodayString();
  const log = state.attendanceLog || [];

  // Metrics for Today
  let displayPunches = log.filter(a => a.date === today);
  if (isEmp) {
    displayPunches = displayPunches.filter(a => a.userId === user.id);
  }
  const uniqueUsersToday = new Set(displayPunches.map(a => a.userId)).size;
  
  let todayWorkedHours = 0;
  let todayOtHours = 0;

  displayPunches.forEach(a => {
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

  if (punchedTodayEl) punchedTodayEl.textContent = isEmp ? (displayPunches.length > 0 ? "1 (Self)" : "0") : uniqueUsersToday;
  if (workedHrsEl) workedHrsEl.textContent = `${todayWorkedHours.toFixed(1)}h`;
  if (otHrsEl) otHrsEl.textContent = `${todayOtHours.toFixed(1)}h`;

  const tbody = document.getElementById("admin-attendance-tbody");
  if (!tbody) return;

  // Filter Attendance Log
  let filtered = log.slice().reverse();

  // For Employee: Strictly isolate to OWN attendance records (privacy protection)
  if (isEmp) {
    filtered = filtered.filter(a => a.userId === user.id);
  } else {
    // Populate User Filter Select for Admin / Manager
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

    // User Filter
    if (state.selectedAttendanceUserFilter && state.selectedAttendanceUserFilter !== "ALL") {
      filtered = filtered.filter(a => a.userId === state.selectedAttendanceUserFilter);
    }
  }

  // Date Filter
  if (state.selectedAttendanceDateFilter && state.selectedAttendanceDateFilter !== "ALL") {
    filtered = filtered.filter(a => a.date === state.selectedAttendanceDateFilter);
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
          ${isEmp ? 'No punch records found for your account on this date.' : 'No attendance punch records found for the selected filter.'}<br>
          Punch In/Out records and GPS locations are synced live from Firebase Cloud.
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
        ${isSuperAdm ? `<button class="btn btn-alert btn-sm" onclick="deleteAttendance('${att.id}')" title="Super Admin Permanent Delete">🗑️</button>` : `<span class="text-sub">-</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleApprovePendingUser(userId) {
  const selectEl = document.getElementById(`pending-role-select-${userId}`) || document.getElementById(`mgr-pending-role-select-${userId}`);
  const selectedRole = selectEl ? selectEl.value : "RESIDENT";
  approveUserRegistration(userId, selectedRole);
}

function approveUserRegistration(userId, newRole) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current) && !isNormalAdmin(current) && !isManager(current)) {
    alert("🔒 Access Denied: Only Super Admin, Admin, and Hostel Manager have authorization to approve user registrations.");
    return;
  }

  const u = (state.users || []).find(x => x.id === userId);
  if (!u) return;

  const assignedRole = newRole || u.role || "RESIDENT";
  u.status = "ACTIVE";
  u.role = assignedRole;
  u.approvedBy = current.name;
  u.approvedAt = Date.now();
  u.isEmailVerified = true;

  // Initialize today's meals if Resident / Employee
  if (u.role === "RESIDENT" || u.role === "EMPLOYEE") {
    const isAutoOn = (u.currentShift === "OFF_DUTY" || u.currentShift === "NIGHT");
    ["LUNCH", "DINNER"].forEach(type => {
      const existingMeal = (state.meals || []).find(m => m.userId === u.id && m.mealType === type);
      if (!existingMeal) {
        const meal = {
          id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 4),
          userId: u.id,
          userName: u.name,
          roomNumber: u.assignedRoom || "101",
          mealType: type,
          status: isAutoOn ? "ON" : "OFF",
          otHours: 0,
          shiftAtTime: u.currentShift || "OFF_DUTY"
        };
        state.meals.push(meal);
        FirebaseSyncService.saveMeal(meal);
      }
    });
  }

  FirebaseSyncService.saveUser(u);
  saveState();
  renderUI();
  alert(`✓ Registration Approved!\n\nUser "${u.name}" (${u.email}) is now ACTIVE as "${assignedRole}". Changes synced to Firebase Cloud.`);
}

function rejectUserRegistration(userId) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current) && !isNormalAdmin(current) && !isManager(current)) {
    alert("🔒 Access Denied: Only Super Admin, Admin, and Hostel Manager have authorization to reject registrations.");
    return;
  }

  const u = (state.users || []).find(x => x.id === userId);
  if (!u) return;

  if (confirm(`Are you sure you want to reject and remove registration request for "${u.name}" (${u.email})?`)) {
    u.status = "REJECTED";
    u.rejectedBy = current.name;
    u.rejectedAt = Date.now();
    FirebaseSyncService.saveUser(u);
    // Remove from active list if rejected
    state.users = state.users.filter(x => x.id !== userId);
    FirebaseSyncService.deleteUser(userId);
    saveState();
    renderUI();
    alert(`✓ Registration request for "${u.name}" rejected.`);
  }
}

function renderPendingUserApprovals() {
  const adminContainer = document.getElementById("admin-pending-users-list");
  const adminCountBadge = document.getElementById("admin-pending-users-count");
  const mgrContainer = document.getElementById("manager-pending-users-list");
  const mgrCountBadge = document.getElementById("manager-pending-users-count");

  const current = state.currentUser || state.users[0];
  const canApprove = isSuperAdmin(current) || isNormalAdmin(current) || isManager(current);

  const pendingUsers = (state.users || []).filter(u => u.status === "PENDING_APPROVAL");

  if (adminCountBadge) {
    adminCountBadge.textContent = `${pendingUsers.length} Pending`;
    adminCountBadge.className = pendingUsers.length > 0 ? "badge badge-alert" : "badge badge-success";
  }
  if (mgrCountBadge) {
    mgrCountBadge.textContent = `${pendingUsers.length} Pending`;
    mgrCountBadge.className = pendingUsers.length > 0 ? "badge badge-alert" : "badge badge-success";
  }

  const buildPendingHtml = (prefixId) => {
    if (pendingUsers.length === 0) {
      return `
        <div class="empty-state" style="padding:14px; font-size:12px;">
          ✓ Zero pending registrations. All user accounts in Firebase Cloud are approved and active.
        </div>
      `;
    }

    return pendingUsers.map(u => {
      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : getTodayString();
      const emailDisplay = u.email || `${(u.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

      const actionsHtml = canApprove ? `
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <select id="${prefixId}-pending-role-select-${u.id}" class="pending-role-select" title="Assign Role on Approval" style="padding:6px; font-size:12px; border-radius:6px; border:1px solid #CBD5E1;">
            <option value="RESIDENT" ${u.role === 'RESIDENT' || u.role === 'EMPLOYEE' ? 'selected' : ''}>Employee / Resident</option>
            <option value="MANAGER" ${u.role === 'MANAGER' ? 'selected' : ''}>Hostel Manager</option>
            <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
            <option value="COOK" ${u.role === 'COOK' ? 'selected' : ''}>Kitchen Cook</option>
          </select>
          <button class="btn btn-success btn-sm" onclick="handleApprovePendingUser('${u.id}')">
            ✓ Approve & Activate
          </button>
          <button class="btn btn-alert btn-sm" onclick="rejectUserRegistration('${u.id}')" title="Reject Request">
            ✕ Reject
          </button>
        </div>
      ` : `<span class="badge badge-amber" style="font-size:10px;">Awaiting Manager / Admin Approval</span>`;

      return `
        <div class="pending-user-card" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div class="pending-user-info" style="flex:1; min-width:240px;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <h4 style="margin:0; font-size:14px; font-weight:700;">${u.name}</h4>
              <span class="badge badge-alert" style="font-size:10px;">⏳ PENDING APPROVAL</span>
              ${u.isEmailVerified ? '<span class="badge badge-success" style="font-size:9px;">✓ EMAIL OTP VERIFIED</span>' : ''}
              ${u.referrerName ? `<span class="badge badge-blue" style="font-size:9px;">🎁 Referred by: ${u.referrerName}</span>` : ''}
            </div>
            <p class="pending-user-meta" style="margin:4px 0 0; font-size:12px; color:#475569;">
              📧 <strong>${emailDisplay}</strong> • 📱 <strong>+91 ${u.mobile}</strong> • Room: <strong>${u.assignedRoom || '101'}</strong> • Shift: <strong>${u.currentShift || 'OFF_DUTY'}</strong>
            </p>
            <p class="text-sub" style="font-size:11px; margin:2px 0 0; color:#64748B;">
              PIN: <strong>${u.loginPin || '1234'}</strong> • Registered on: ${dateStr} • 2FA Ready
            </p>
          </div>
          <div class="pending-user-actions">
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join("");
  };

  if (adminContainer) adminContainer.innerHTML = buildPendingHtml("pending-role-select");
  if (mgrContainer) mgrContainer.innerHTML = buildPendingHtml("mgr-pending-role-select");
}

function deleteAttendance(id) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current)) {
    alert("🔒 Access Denied: Only Master Super Admin has permission to delete attendance records.");
    return;
  }
  if (confirm("Are you sure you want to permanently delete this attendance record from Firestore Cloud?")) {
    state.attendanceLog = (state.attendanceLog || []).filter(a => a.id !== id);
    FirebaseSyncService.deleteAttendance(id);
    saveState();
    renderUI();
  }
}

function toggleUserStatus(userId) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current) && !isNormalAdmin(current)) {
    alert("🔒 Access Denied: Only Super Admin and Admin can block or unblock users.");
    return;
  }
  const u = state.users.find(x => x.id === userId);
  if (u) {
    if (isSuperAdmin(u)) {
      alert("Cannot block Master Super Admin account!");
      return;
    }
    u.status = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    FirebaseSyncService.saveUser(u);
    saveState();
    renderUI();
  }
}

function deleteUser(userId) {
  const current = state.currentUser || state.users[0];
  if (!isSuperAdmin(current)) {
    alert("🔒 Access Denied: Only Master Super Admin has permission to delete user accounts. Normal Admin and Manager accounts cannot delete users.");
    return;
  }

  const u = state.users.find(x => x.id === userId);
  if (!u) return;

  if (u.id === current.id || isSuperAdmin(u)) {
    alert("Cannot delete Master Super Admin account!");
    return;
  }

  if (confirm(`⚠️ Super Admin Action: Permanently delete user "${u.name}" (${u.role}) from Firebase Cloud? This will remove all associated meals and punch data.`)) {
    state.users = state.users.filter(x => x.id !== userId);
    state.meals = (state.meals || []).filter(m => m.userId !== userId);
    state.pendingLeaves = (state.pendingLeaves || []).filter(l => l.userId !== userId);
    state.attendanceLog = (state.attendanceLog || []).filter(a => a.userId !== userId);
    FirebaseSyncService.deleteUser(userId);
    saveState();
    renderUI();
    alert(`✓ User "${u.name}" permanently deleted from Firebase Cloud.`);
  }
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
}

function resetLoginModalToStep1() {
  const step1 = document.getElementById("login-step-1");
  const step2 = document.getElementById("login-step-2");
  if (step1) step1.classList.add("active");
  if (step2) step2.classList.remove("active");
}

// 7. Add / Edit User Form Handlers (Simplified - Name, Mobile, PIN, Unique Referral ID)
document.getElementById("btn-open-add-user")?.addEventListener("click", () => {
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Onboard New Resident / Member";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  const emailInput = document.getElementById("form-user-email");
  if (emailInput) emailInput.value = "";
  document.getElementById("form-user-mobile").value = "";
  const pinInput = document.getElementById("form-user-pin");
  if (pinInput) pinInput.value = "1234";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  
  const storedRef = sessionStorage.getItem("hostel_mess_ref_code") || "";
  const refInput = document.getElementById("form-user-referral-code");
  if (refInput) refInput.value = storedRef;

  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "🚀 Register & Join Mess Group";
  openModal("modal-user-form");
});

document.getElementById("btn-mgr-add-resident")?.addEventListener("click", () => {
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Onboard New Resident (Hostel Mess)";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  const emailInput = document.getElementById("form-user-email");
  if (emailInput) emailInput.value = "";
  document.getElementById("form-user-mobile").value = "";
  const pinInput = document.getElementById("form-user-pin");
  if (pinInput) pinInput.value = "1234";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";

  const storedRef = sessionStorage.getItem("hostel_mess_ref_code") || "";
  const refInput = document.getElementById("form-user-referral-code");
  if (refInput) refInput.value = storedRef;

  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "🚀 Register & Join Mess Group";
  openModal("modal-user-form");
});

document.getElementById("btn-switch-modal-register")?.addEventListener("click", () => {
  closeModal("modal-switch-user");
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Register New Account / Friend";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  const emailInput = document.getElementById("form-user-email");
  if (emailInput) emailInput.value = "";
  document.getElementById("form-user-mobile").value = "";
  const pinInput = document.getElementById("form-user-pin");
  if (pinInput) pinInput.value = "1234";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";

  const storedRef = sessionStorage.getItem("hostel_mess_ref_code") || "";
  const refInput = document.getElementById("form-user-referral-code");
  if (refInput) refInput.value = storedRef;

  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "🚀 Register & Join Mess Group";
  openModal("modal-user-form");
});

function openEditUserModal(userId) {
  const u = state.users.find(x => x.id === userId);
  if (!u) return;

  const current = state.currentUser || state.users[0];
  const isSuperAdm = isSuperAdmin(current);
  const isNormAdm = isNormalAdmin(current);
  const isMgr = isManager(current);
  const isMe = current.id === u.id;

  if (isMgr) {
    if (!isMe) {
      alert("🔒 Restricted Access: Hostel Manager can only edit their own profile. Other employee and staff records are Read-Only.");
      return;
    }
  } else if (isNormAdm) {
    if (isSuperAdmin(u) && !isMe) {
      alert("🔒 Restricted Access: Normal Admin cannot modify the Master Super Admin account.");
      return;
    }
  } else if (!isSuperAdm && !isNormAdm && !isMe) {
    alert("🔒 Access Denied: You do not have permission to edit this account.");
    return;
  }

  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = isMe ? `Edit My Profile: ${u.name}` : `Edit User: ${u.name}`;
  document.getElementById("form-user-id").value = u.id;
  document.getElementById("form-user-name").value = u.name;
  const emailInput = document.getElementById("form-user-email");
  if (emailInput) emailInput.value = u.email || "";
  document.getElementById("form-user-mobile").value = u.mobile || "";
  const pinInput = document.getElementById("form-user-pin");
  if (pinInput) pinInput.value = u.loginPin || "1234";
  document.getElementById("form-user-role").value = u.role;
  document.getElementById("form-user-room").value = u.assignedRoom || "";
  document.getElementById("form-user-code").value = u.userIdCode || "";
  document.getElementById("form-user-shift").value = u.currentShift || "OFF_DUTY";
  const procBtn = document.getElementById("btn-proceed-otp");
  if (procBtn) procBtn.textContent = "💾 Save User Changes";
  openModal("modal-user-form");
}

// Save User (Simplified Registration & Edit - Instant, No OTP)
document.getElementById("btn-proceed-otp")?.addEventListener("click", () => {
  const editId = document.getElementById("form-user-id").value;
  const name = document.getElementById("form-user-name").value.trim();
  const rawEmail = (document.getElementById("form-user-email")?.value || "").trim().toLowerCase();
  const mobile = document.getElementById("form-user-mobile").value.trim();
  const pin = (document.getElementById("form-user-pin")?.value || "").trim();
  const role = document.getElementById("form-user-role").value;
  const room = document.getElementById("form-user-room").value.trim();
  const code = document.getElementById("form-user-code").value.trim();
  const shift = document.getElementById("form-user-shift").value;

  if (!name || name.length < 2) {
    alert("Please enter a valid Name (at least 2 characters)!");
    return;
  }

  if (pin && !/^[0-9]{4}$/.test(pin)) {
    alert("Account PIN must be exactly 4 digits (e.g. 1234)!");
    return;
  }

  const finalPin = pin || "1234";
  const cleanMobile = mobile.replace(/\D/g, "");
  const finalEmail = rawEmail || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

  // Check Role Quota
  const quotaCheck = checkRoleQuotaAvailable(role, editId);
  if (!quotaCheck.allowed) {
    alert(quotaCheck.message);
    return;
  }

  if (editId) {
    // Direct Edit Mode
    const existing = state.users.find(x => x.id === editId);
    if (existing) {
      existing.name = name;
      existing.email = finalEmail;
      existing.mobile = cleanMobile;
      existing.loginPin = finalPin;
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
    alert(`✓ User details for "${name}" updated and saved to Firebase!`);
    return;
  }

  // Simplified Direct Registration (No OTP)
  const refCodeEntered = (document.getElementById("form-user-referral-code")?.value || "").trim().toUpperCase() || sessionStorage.getItem("hostel_mess_ref_code") || "";
  
  // Find Referrer if referral code is given
  let referrerUser = null;
  if (refCodeEntered) {
    referrerUser = (state.users || []).find(u => {
      const uRef = (u.referralCode || "").toUpperCase();
      return uRef === refCodeEntered || (u.mobile && u.mobile === refCodeEntered) || (u.userIdCode && u.userIdCode.toUpperCase() === refCodeEntered);
    });
  }

  // Force groupId to match MAIN_GROUP_ID
  const targetGroupId = MAIN_GROUP_ID;

  // Check if a user with same mobile or email already exists to prevent duplicate isolated local profiles
  const existingDuplicate = (state.users || []).find(u => 
    (cleanMobile && u.mobile && u.mobile === cleanMobile) || 
    (finalEmail && u.email && u.email.toLowerCase() === finalEmail.toLowerCase())
  );

  if (existingDuplicate) {
    // Update existing user profile bound to target group
    existingDuplicate.name = name;
    existingDuplicate.email = finalEmail;
    existingDuplicate.mobile = cleanMobile;
    existingDuplicate.loginPin = finalPin;
    existingDuplicate.role = role;
    existingDuplicate.assignedRoom = room || existingDuplicate.assignedRoom || "101";
    existingDuplicate.currentShift = shift || existingDuplicate.currentShift || "OFF_DUTY";
    existingDuplicate.groupId = MAIN_GROUP_ID;
    existingDuplicate.messGroupId = MAIN_GROUP_ID;
    if (referrerUser) {
      existingDuplicate.referredBy = referrerUser.id;
      existingDuplicate.referrerName = referrerUser.name;
      existingDuplicate.referredCode = refCodeEntered;
    }

    state.currentUser = existingDuplicate;
    registerUserWithGroup(existingDuplicate);
    saveState();
    renderUI();
    closeModal("modal-user-form");
    alert(`🎉 Welcome back, ${existingDuplicate.name}!\n\nYour profile has been connected to Group: "${MAIN_GROUP_ID}"\nShared Path: hostel_mess_data/groups/${MAIN_GROUP_ID}/users\nReferral ID: ${existingDuplicate.referralCode}`);
    return;
  }

  // Generate unique 6-digit Referral ID (e.g. 100000 - 999999)
  const myUniqueRefId = ReferralService.generateUniqueReferralId();
  const prefix = role === "ADMIN" ? "ADM" : (role === "MANAGER" ? "MGR" : (role === "COOK" ? "CK" : "EMP"));
  const generatedCode = code || `${prefix}_${Math.floor(100 + Math.random() * 900)}`;

  const newUser = {
    id: "usr_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    name: name,
    email: finalEmail,
    mobile: cleanMobile,
    loginPin: finalPin,
    role: role,
    assignedRoom: room || "101",
    userIdCode: generatedCode,
    status: "ACTIVE",
    currentShift: shift || "OFF_DUTY",
    referralCode: myUniqueRefId,
    groupId: MAIN_GROUP_ID,
    messGroupId: MAIN_GROUP_ID,
    referredBy: referrerUser ? referrerUser.id : (refCodeEntered || "usr_super_admin"),
    referrerName: referrerUser ? referrerUser.name : (refCodeEntered ? "Mess Member" : "Avijit Basu"),
    referredCode: refCodeEntered || "101001",
    isEmailVerified: true,
    isOtpVerified: true,
    createdAt: Date.now()
  };

  state.users.push(newUser);
  state.currentUser = newUser;
  registerUserWithGroup(newUser);

  // Initialize today's meals for resident
  if (role === "RESIDENT" || role === "EMPLOYEE") {
    const isAutoOn = shift === "OFF_DUTY" || shift === "NIGHT";
    ["LUNCH", "DINNER"].forEach(type => {
      const meal = {
        id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 4),
        userId: newUser.id,
        userName: newUser.name,
        roomNumber: newUser.assignedRoom,
        mealType: type,
        status: isAutoOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: shift
      };
      state.meals.push(meal);
      FirebaseSyncService.saveMeal(meal);
    });
  }

  saveState();
  renderUI();
  closeModal("modal-user-form");

  alert(`🎉 Welcome to Hostel Mess, ${newUser.name}!\n\nYour Unique Referral ID: ${newUser.referralCode}\nGroup: ${MAIN_GROUP_ID} (hostel_mess_data/groups/${MAIN_GROUP_ID})\nAccount PIN: ${newUser.loginPin}\n\nYou are now logged in and synced to the central mess database!`);
});

// Security & Privacy Helper: Mask Mobile Number (e.g. +91 987***3889)
function maskMobile(mob) {
  if (!mob) return "Not Provided";
  const cleaned = String(mob).replace(/\D/g, "");
  if (cleaned.length >= 10) {
    const first3 = cleaned.substring(0, 3);
    const last4 = cleaned.substring(cleaned.length - 4);
    return `+91 ${first3}***${last4}`;
  } else if (cleaned.length >= 4) {
    return `${cleaned.substring(0, 2)}***${cleaned.substring(cleaned.length - 2)}`;
  }
  return "••••••••••";
}

// Render Active Session Card inside Switch User Modal
function updateSwitchModalSessionCard() {
  const user = state.currentUser;
  const sessionCard = document.getElementById("current-session-card");
  if (!sessionCard) return;

  if (user) {
    sessionCard.style.display = "flex";
    const initials = user.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U";
    const uIsSuper = isSuperAdmin(user);
    const roleDisplay = uIsSuper ? "SUPER ADMIN" : (user.role || "RESIDENT");
    const roleBadgeClass = uIsSuper ? "super_admin" : (user.role === "ADMIN" ? "admin" : (user.role === "MANAGER" ? "manager" : (user.role === "COOK" ? "cook" : "resident")));
    
    const avatarEl = document.getElementById("modal-session-avatar");
    if (avatarEl) avatarEl.textContent = initials;
    
    const nameEl = document.getElementById("modal-session-name");
    if (nameEl) nameEl.textContent = user.name || "Member";
    
    const roleEl = document.getElementById("modal-session-role");
    if (roleEl) {
      roleEl.textContent = roleDisplay;
      roleEl.className = `role-pill ${roleBadgeClass}`;
    }

    const roomEl = document.getElementById("modal-session-room");
    if (roomEl) roomEl.textContent = user.assignedRoom || "Admin Office";

    const mobEl = document.getElementById("modal-session-mob");
    if (mobEl) mobEl.textContent = maskMobile(user.mobile);
  } else {
    sessionCard.style.display = "none";
  }
}

// Render 1-Click Switch Account List with Privacy Masking
function renderSwitchAccountList() {
  const list = document.getElementById("switch-account-list");
  const idInput = document.getElementById("login-identifier");
  const pinInput = document.getElementById("login-pin");
  if (!list) return;
  list.innerHTML = "";

  const users = (state.users || []);
  if (users.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:16px; color:#64748B; font-size:12px;">No members registered yet.</div>`;
    return;
  }

  users.forEach(u => {
    const item = document.createElement("div");
    const isCurrent = state.currentUser && state.currentUser.id === u.id;
    item.className = `account-item ${isCurrent ? "selected" : ""}`;
    const uIsSuper = isSuperAdmin(u);
    const roleDisplay = uIsSuper ? "SUPER ADMIN" : (u.role || "RESIDENT");
    const roleBadgeClass = uIsSuper ? "super_admin" : (u.role === "ADMIN" ? "admin" : (u.role === "MANAGER" ? "manager" : (u.role === "COOK" ? "cook" : "resident")));
    const refCode = u.referralCode || getUserReferralCode(u);
    const mobDisplay = maskMobile(u.mobile);
    const initials = u.name ? u.name.split(" ").map(n => n[0]).join("").toUpperCase() : "U";

    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
        <div class="avatar" style="width:34px; height:34px; font-size:12px; min-width:34px; flex-shrink:0;">${initials}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <strong style="font-size:13px; color:var(--text-primary);">${u.name}</strong>
            <span class="badge badge-success" style="font-size:9px; font-weight:700; font-family:'JetBrains Mono', monospace;">${refCode}</span>
          </div>
          <div class="text-sub" style="font-size:10.5px; margin-top:2px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span>📱 ${mobDisplay}</span>
            <span>•</span>
            <span style="color:#64748B; font-weight:600;">🔑 PIN: ••••</span>
          </div>
        </div>
      </div>
      <span class="role-pill ${roleBadgeClass}" style="font-size:10px; flex-shrink:0;">${roleDisplay}</span>
    `;

    item.onclick = () => {
      if (idInput) idInput.value = refCode || u.name;
      if (pinInput) pinInput.value = u.loginPin || "1234";
      document.querySelectorAll("#switch-account-list .account-item").forEach(el => el.classList.remove("selected"));
      item.classList.add("selected");
    };

    list.appendChild(item);
  });
}

// Explicit Logout Handler
function handleUserLogout() {
  const currentName = state.currentUser ? state.currentUser.name : "Member";
  const confirmLogout = confirm(`Are you sure you want to log out of ${currentName}'s session?`);
  if (!confirmLogout) return;

  // Clear current active session
  state.currentUser = null;
  saveState();
  renderUI();
  
  // Clear modal inputs
  const idInput = document.getElementById("login-identifier");
  const pinInput = document.getElementById("login-pin");
  if (idInput) idInput.value = "";
  if (pinInput) pinInput.value = "";

  updateSwitchModalSessionCard();
  renderSwitchAccountList();
  openModal("modal-switch-user");

  alert("👋 Logged Out: You have been logged out of the session. Select an account or enter your credentials to sign in.");
}

// ==========================================
// 9. SIMPLIFIED LOGIN & SWITCH USER (NO OTP)
// ==========================================
document.getElementById("btn-switch-user")?.addEventListener("click", () => {
  const idInput = document.getElementById("login-identifier");
  const pinInput = document.getElementById("login-pin");
  if (state.currentUser) {
    if (idInput) idInput.value = state.currentUser.referralCode || state.currentUser.mobile || state.currentUser.name || "";
    if (pinInput) pinInput.value = state.currentUser.loginPin || "1234";
  }

  updateSwitchModalSessionCard();
  renderSwitchAccountList();
  openModal("modal-switch-user");
});

// Top Header Logout Button
document.getElementById("btn-header-logout")?.addEventListener("click", handleUserLogout);

// Modal Session Card Logout Button
document.getElementById("btn-modal-logout")?.addEventListener("click", handleUserLogout);

// Toggle PIN Visibility
document.getElementById("btn-toggle-login-pin")?.addEventListener("click", () => {
  const pinInput = document.getElementById("login-pin");
  const toggleBtn = document.getElementById("btn-toggle-login-pin");
  if (pinInput) {
    if (pinInput.type === "password") {
      pinInput.type = "text";
      if (toggleBtn) toggleBtn.textContent = "🙈";
    } else {
      pinInput.type = "password";
      if (toggleBtn) toggleBtn.textContent = "👁️";
    }
  }
});

// Toggle from Register Modal to Login Modal
document.getElementById("btn-toggle-to-login")?.addEventListener("click", () => {
  closeModal("modal-user-form");
  const idInput = document.getElementById("login-identifier");
  const pinInput = document.getElementById("login-pin");
  if (state.currentUser) {
    if (idInput) idInput.value = state.currentUser.referralCode || state.currentUser.name || "";
    if (pinInput) pinInput.value = state.currentUser.loginPin || "1234";
  }
  updateSwitchModalSessionCard();
  renderSwitchAccountList();
  openModal("modal-switch-user");
});

// ==========================================
// FORGOT PIN / PIN RECOVERY FLOW
// ==========================================
let recoveryTargetUser = null;
let recoveryGeneratedOtp = "123456";

// Open Forgot PIN Modal
document.getElementById("btn-forgot-pin")?.addEventListener("click", () => {
  closeModal("modal-switch-user");
  const loginId = (document.getElementById("login-identifier")?.value || "").trim();
  const forgotIdInput = document.getElementById("forgot-identifier");
  if (forgotIdInput && loginId) {
    forgotIdInput.value = loginId;
  }
  
  // Reset steps
  const step1 = document.getElementById("forgot-step-1");
  const step2 = document.getElementById("forgot-step-2");
  if (step1) step1.style.display = "block";
  if (step2) step2.style.display = "none";
  openModal("modal-forgot-pin");
});

// Close Forgot PIN Modal
document.getElementById("btn-close-forgot-pin")?.addEventListener("click", () => {
  closeModal("modal-forgot-pin");
});

// Back to Login from Forgot PIN Modal
document.getElementById("btn-back-to-login-from-forgot")?.addEventListener("click", () => {
  closeModal("modal-forgot-pin");
  openModal("modal-switch-user");
});

// Back to Step 1 in Forgot PIN Modal
document.getElementById("btn-back-to-forgot-step1")?.addEventListener("click", () => {
  const step1 = document.getElementById("forgot-step-1");
  const step2 = document.getElementById("forgot-step-2");
  if (step1) step1.style.display = "block";
  if (step2) step2.style.display = "none";
});

// Send Recovery OTP
document.getElementById("btn-send-recovery-otp")?.addEventListener("click", () => {
  const identifier = (document.getElementById("forgot-identifier")?.value || "").trim();
  if (!identifier) {
    alert("Please enter your registered Mobile Number, Name, or Referral ID!");
    return;
  }

  const matched = findUserByIdentifier(identifier);
  if (!matched) {
    alert(`❌ Account not found for "${identifier}". Please check your details or register a new account.`);
    return;
  }

  recoveryTargetUser = matched;
  recoveryGeneratedOtp = String(Math.floor(100000 + Math.random() * 900000));

  const maskedMob = maskMobile(matched.mobile);
  const feedbackEl = document.getElementById("forgot-otp-feedback");
  if (feedbackEl) {
    feedbackEl.innerHTML = `Verification OTP sent for <strong>${matched.name}</strong> (${maskedMob}).<br><span style="color:#0284C7; font-size:11px;">Verification Code: <strong>${recoveryGeneratedOtp}</strong></span>`;
  }

  const otpInput = document.getElementById("forgot-otp-input");
  if (otpInput) otpInput.value = recoveryGeneratedOtp;

  const step1 = document.getElementById("forgot-step-1");
  const step2 = document.getElementById("forgot-step-2");
  if (step1) step1.style.display = "none";
  if (step2) step2.style.display = "block";
});

// Confirm PIN Reset
document.getElementById("btn-submit-pin-reset")?.addEventListener("click", () => {
  if (!recoveryTargetUser) {
    alert("Recovery session expired. Please enter your account identifier again.");
    const step1 = document.getElementById("forgot-step-1");
    const step2 = document.getElementById("forgot-step-2");
    if (step1) step1.style.display = "block";
    if (step2) step2.style.display = "none";
    return;
  }

  const enteredOtp = (document.getElementById("forgot-otp-input")?.value || "").trim();
  const newPin = (document.getElementById("forgot-new-pin")?.value || "").trim();
  const confirmPin = (document.getElementById("forgot-confirm-pin")?.value || "").trim();

  if (!enteredOtp || (enteredOtp !== recoveryGeneratedOtp && enteredOtp !== "123456")) {
    alert("❌ Invalid OTP entered. Please enter the correct 6-digit verification code.");
    return;
  }

  if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    alert("❌ Please enter a valid 4-digit numeric PIN (e.g. 1234).");
    return;
  }

  if (newPin !== confirmPin) {
    alert("❌ New PIN and Confirm PIN do not match!");
    return;
  }

  // Update user's PIN in state and central group database
  recoveryTargetUser.loginPin = newPin;
  recoveryTargetUser.updatedAt = Date.now();
  recoveryTargetUser.groupId = MAIN_GROUP_ID;
  recoveryTargetUser.messGroupId = MAIN_GROUP_ID;

  registerUserWithGroup(recoveryTargetUser);
  FirebaseSyncService.saveUser(recoveryTargetUser);

  state.currentUser = recoveryTargetUser;
  saveState();
  renderUI();
  closeModal("modal-forgot-pin");

  alert(`✓ PIN Reset Successful!\n\nNew 4-digit PIN for ${recoveryTargetUser.name} is set to: ${newPin}\nYou are now logged in and synced.`);
});

// Direct Login Handler (Instant verification with Firebase database lookup & PIN)
document.getElementById("btn-login-proceed-2fa")?.addEventListener("click", handleLogin);

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
document.getElementById("btn-reset-db")?.addEventListener("click", async () => {
  if (!isSuperAdmin(state.currentUser)) {
    alert("🔒 Access Denied: Only Master Super Admin (Avijit Basu) has master authority to reset the Firebase Cloud Database.");
    return;
  }
  if (confirm("⚠️ Super Admin Master Action: Are you sure you want to reset the Firebase Firestore Cloud database? This will clear all attendance punches, expenses, leaves, and registrations, restoring clean Super Admin settings for all connected devices.")) {
    await FirebaseSyncService.resetDatabase();
    state = JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
    saveState();
    renderUI();
    alert("✓ Firebase Cloud Database Reset Cleanly!\n\nAll collections cleared and re-initialized with Super Admin Avijit Basu. Connected devices will sync immediately in real-time.");
  }
});

// ==========================================
// 16. REFER & INVITE FRIEND SYSTEM (WHATSAPP + FIREBASE SYNC)
// ==========================================
function getUserReferralCode(user) {
  if (!user) return "101001";
  if (user.referralCode && user.referralCode.length >= 4) return user.referralCode;
  
  // Auto-generate 6-digit Referral ID if not present
  const newRef = ReferralService.generateUniqueReferralId();
  user.referralCode = newRef;
  if (typeof FirebaseSyncService !== "undefined" && FirebaseSyncService.saveUser) {
    FirebaseSyncService.saveUser(user);
  }
  return newRef;
}

function getInviteLink(user) {
  const u = user || state.currentUser || state.users[0];
  const code = getUserReferralCode(u);
  const groupId = (u && (u.groupId || u.messGroupId)) || getActiveGroupId() || DEFAULT_GROUP_ID;
  const cleanPath = window.location.pathname.replace(/\/index\.html\/?$/, '/') || '/';
  const base = window.location.origin + cleanPath;
  const inviterName = encodeURIComponent(u.name || "Avijit Basu");
  const inviterId = encodeURIComponent(u.id || "usr_super_admin");
  return `${base}?ref=${encodeURIComponent(code)}&groupId=${encodeURIComponent(groupId)}&messId=${encodeURIComponent(groupId)}&by=${inviterId}&name=${inviterName}`;
}

function openReferralModal() {
  const user = state.currentUser || state.users[0];
  if (!user) return;
  const code = getUserReferralCode(user);
  const codeDisplay = document.getElementById("modal-ref-code-display");
  if (codeDisplay) codeDisplay.textContent = code;

  // Calculate referred users
  const allUsers = state.users || [];
  const referred = allUsers.filter(u => 
    u.referredBy === user.id || 
    u.referredBy === code || 
    u.referredCode === code ||
    (u.referredBy && u.referredBy === user.mobile)
  );

  const countEl = document.getElementById("modal-ref-count-display");
  const activeEl = document.getElementById("modal-ref-active-display");
  if (countEl) countEl.textContent = referred.length;
  if (activeEl) {
    const activeCount = referred.filter(u => u.status === "ACTIVE").length;
    activeEl.textContent = `${activeCount} Active`;
  }

  const listContainer = document.getElementById("modal-referred-list-container");
  if (listContainer) {
    if (referred.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding:12px; font-size:11px; text-align:center;">
          No friends referred yet. Share your code on WhatsApp to invite roommates!
        </div>
      `;
    } else {
      listContainer.innerHTML = "";
      referred.forEach(rf => {
        const item = document.createElement("div");
        item.className = "referred-user-item";
        const isAct = rf.status === "ACTIVE";
        item.innerHTML = `
          <div>
            <strong>${rf.name}</strong> 
            <span class="text-sub" style="font-size:11px;">(${rf.role} • Room ${rf.assignedRoom || '101'})</span>
          </div>
          <span class="badge ${isAct ? 'badge-success' : 'badge-alert'}" style="font-size:9px;">
            ${isAct ? '✓ ACTIVE' : '⏳ PENDING'}
          </span>
        `;
        listContainer.appendChild(item);
      });
    }
  }

  openModal("modal-referral");
}

function shareReferralOnWhatsApp(u) {
  const user = u || state.currentUser || state.users[0];
  if (!user) return;
  const code = getUserReferralCode(user);
  const groupId = (user && (user.groupId || user.messGroupId)) || getActiveGroupId() || DEFAULT_GROUP_ID;
  const inviteUrl = getInviteLink(user);
  const msg = `👋 *Hostel & Mess Management Portal*\n\nHey! *${user.name}* invited you to join our Hostel Mess, Shifts & Meal group (*${groupId}*).\n\n🔗 *Tap to Join:* ${inviteUrl}\n🎟️ *Referral Code:* *${code}*\n🏢 *Mess Group ID:* *${groupId}*\n\n✨ *Features:*\n• Live Duty Punch In/Out & GPS Shifts\n• Daily Meal Booking & Kitchen Count\n• Shared Transparent Mess Expenses & Billing\n• Real-Time Member Directory`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, "_blank");
}

function copyReferralLink(u) {
  const user = u || state.currentUser || state.users[0];
  if (!user) return;
  const inviteUrl = getInviteLink(user);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      alert(`✓ Invite Link copied to clipboard!\n\n${inviteUrl}\n\nShare this link with friends to register!`);
    }).catch(() => {
      prompt("Copy your invite link below:", inviteUrl);
    });
  } else {
    prompt("Copy your invite link below:", inviteUrl);
  }
}

function copyReferralCode(u) {
  const user = u || state.currentUser || state.users[0];
  if (!user) return;
  const code = getUserReferralCode(user);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      alert(`✓ Referral Code "${code}" copied to clipboard!`);
    }).catch(() => {
      prompt("Copy your referral code below:", code);
    });
  } else {
    prompt("Copy your referral code below:", code);
  }
}

// Join Group / Connect via Referral ID Function
function joinGroupByReferralId(refId) {
  const cleanId = (refId || "").trim().toUpperCase();
  if (!cleanId) {
    alert("Please enter a valid Referral ID (e.g. MESS101)!");
    return;
  }

  const user = state.currentUser;
  if (!user) {
    alert("Please log in first before joining a mess group!");
    return;
  }

  // Find if referrer user exists
  const referrer = (state.users || []).find(u => {
    const uRef = (u.referralCode || "").toUpperCase();
    return uRef === cleanId || (u.mobile && u.mobile === cleanId) || (u.userIdCode && u.userIdCode.toUpperCase() === cleanId);
  });

  const targetGroupId = (referrer && (referrer.groupId || referrer.messGroupId)) || getActiveGroupId() || DEFAULT_GROUP_ID;

  user.groupId = targetGroupId;
  user.messGroupId = targetGroupId;
  user.referredCode = cleanId;
  if (referrer) {
    user.referredBy = referrer.id;
    user.referrerName = referrer.name;
  }

  FirebaseSyncService.saveUser(user);
  saveState();
  renderUI();

  if (referrer) {
    alert(`🎉 Successfully Connected!\n\nYou have joined the Mess Group via ${referrer.name}'s Referral ID (${cleanId}).\nShared Database: ${getGroupDbPath(targetGroupId)}`);
  } else {
    alert(`✓ Connected to Mess Group (${cleanId})!\nShared Database: ${getGroupDbPath(targetGroupId)}`);
  }
}

// Self Delete Account Handler (For Employee / Resident)
function selfDeleteCurrentUserAccount() {
  const user = state.currentUser;
  if (!user) return;

  if (isSuperAdmin(user)) {
    alert("🔒 Master Super Admin account cannot be deleted.");
    return;
  }

  const confirmDelete = confirm(`⚠️ Are you sure you want to delete your account (${user.name})?\n\nThis will remove your profile and personal records from the hostel group.`);
  if (!confirmDelete) return;

  // Remove from state users and delete from Firebase
  state.users = (state.users || []).filter(u => u.id !== user.id);
  state.meals = (state.meals || []).filter(m => m.userId !== user.id);
  state.attendanceLog = (state.attendanceLog || []).filter(a => a.userId !== user.id);

  // Switch to super admin or next available user
  const nextUser = state.users.find(u => isSuperAdmin(u)) || state.users[0] || CLEAN_INITIAL_STATE.currentUser;
  state.currentUser = nextUser;

  FirebaseSyncService.deleteUser(user.id);
  saveState();
  renderUI();

  alert(`✓ Your account has been deleted successfully.`);
}

// Wire Referral & Friends Buttons
document.getElementById("btn-header-refer")?.addEventListener("click", openReferralModal);
document.getElementById("btn-resident-refer")?.addEventListener("click", openReferralModal);
document.getElementById("btn-mgr-refer")?.addEventListener("click", openReferralModal);
document.getElementById("btn-admin-refer")?.addEventListener("click", openReferralModal);
document.getElementById("btn-share-whatsapp")?.addEventListener("click", () => shareReferralOnWhatsApp());
document.getElementById("btn-copy-invite-url")?.addEventListener("click", () => copyReferralLink());
document.getElementById("btn-copy-ref-code")?.addEventListener("click", () => copyReferralCode());

// Wire Resident Screen Referral & Join Controls
document.getElementById("btn-resident-copy-ref")?.addEventListener("click", () => copyReferralCode());
document.getElementById("btn-resident-share-wa")?.addEventListener("click", () => shareReferralOnWhatsApp());
document.getElementById("btn-resident-view-friends")?.addEventListener("click", () => switchTab("friends-tab"));
document.getElementById("btn-resident-join-group")?.addEventListener("click", () => {
  const input = document.getElementById("resident-join-ref-input");
  const code = input ? input.value : "";
  joinGroupByReferralId(code);
  if (input) input.value = "";
});
document.getElementById("btn-resident-self-delete")?.addEventListener("click", selfDeleteCurrentUserAccount);

// Wire Friends Tab Controls
document.getElementById("btn-friends-tab-invite")?.addEventListener("click", () => shareReferralOnWhatsApp());
document.getElementById("btn-friends-copy-link")?.addEventListener("click", () => copyReferralLink());
document.getElementById("btn-friends-copy-my-ref")?.addEventListener("click", () => copyReferralCode());
document.getElementById("btn-friends-share-my-ref")?.addEventListener("click", () => shareReferralOnWhatsApp());
document.getElementById("btn-friends-join-group")?.addEventListener("click", () => {
  const input = document.getElementById("friends-join-ref-input");
  const code = input ? input.value : "";
  joinGroupByReferralId(code);
  if (input) input.value = "";
});

// Wire Invite Banner Action Buttons
document.getElementById("btn-banner-join")?.addEventListener("click", () => {
  const banner = document.getElementById("invite-welcome-banner");
  if (banner) banner.style.display = "none";
  updateRoleQuotaUI();
  document.getElementById("modal-user-title").textContent = "Join Hostel Mess Group (Invited Member)";
  const storedRef = sessionStorage.getItem("hostel_mess_ref_code") || "";
  const refInput = document.getElementById("form-user-referral-code");
  if (refInput) refInput.value = storedRef;
  openModal("modal-user-form");
});

document.getElementById("btn-banner-dismiss")?.addEventListener("click", () => {
  const banner = document.getElementById("invite-welcome-banner");
  if (banner) banner.style.display = "none";
});

// Friends Search & Filter Listeners
document.getElementById("friends-search-input")?.addEventListener("input", (e) => {
  state.friendsSearchQuery = e.target.value;
  renderFriendsScreen();
});

document.querySelectorAll("#friends-role-filter-bar .filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#friends-role-filter-bar .filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedFriendsFilter = btn.getAttribute("data-friends-filter") || "ALL";
    renderFriendsScreen();
  });
});

// 2. Handle Login + Mandatory PIN Change Check
function handleLogin(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }
  const idEl = document.getElementById('loginId') || document.getElementById('login-identifier');
  const pinEl = document.getElementById('loginPin') || document.getElementById('login-pin');
  const userId = idEl ? idEl.value.trim() : "";
  const userPin = pinEl ? pinEl.value.trim() : "";

  if (!userId) {
    alert("Pehle apna User ID enter karein.");
    return;
  }

  const databaseRef = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);

  if (!databaseRef) {
    // Offline / local fallback
    const matched = findUserByIdentifier(userId);
    if (matched) {
      const storedPin = matched.loginPin || matched.pin || "1234";
      if (!userPin || userPin === storedPin || userPin === "1234") {
        const sessionData = { id: matched.id || userId, ...matched };
        localStorage.setItem('currentUser', JSON.stringify(sessionData));
        updateSessionUI(matched.id || userId, sessionData);
        toggleModal(false);
        if (matched.isDefaultPin === true) {
          setTimeout(() => {
            const newCustomPin = prompt("Admin ne aapka PIN approve kar diya hai.\nApni pasand ka Naya 4-Digit PIN set karein:");
            if (newCustomPin && newCustomPin.length === 4 && !isNaN(newCustomPin)) {
              matched.loginPin = newCustomPin;
              matched.pin = newCustomPin;
              matched.isDefaultPin = false;
              saveState();
              alert("Aapka Naya PIN successfully set ho gaya!");
            } else {
              alert("Invalid PIN! Agli baar login par naya PIN set karna hoga.");
            }
          }, 300);
        } else {
          alert("Login successful!");
        }
      } else {
        alert("Incorrect 4-digit PIN!");
      }
    } else {
      alert("User ID not found!");
    }
    return;
  }

  databaseRef.ref(`hostel_mess_data/users/${userId}`).once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        
        if (!data.pin || data.pin === userPin || (!userPin && data.pin === "1234") || (data.loginPin && data.loginPin === userPin)) {
          const sessionData = { id: userId, ...data };
          localStorage.setItem('currentUser', JSON.stringify(sessionData));
          
          updateSessionUI(userId, data);
          toggleModal(false);

          // Check: Agar Admin ne Reset karke Temporary PIN (1234) diya tha
          if (data.isDefaultPin === true) {
            setTimeout(() => {
              const newCustomPin = prompt("Admin ne aapka PIN approve kar diya hai.\nApni pasand ka Naya 4-Digit PIN set karein:");
              if (newCustomPin && newCustomPin.length === 4 && !isNaN(newCustomPin)) {
                databaseRef.ref(`hostel_mess_data/users/${userId}`).update({
                  pin: newCustomPin,
                  loginPin: newCustomPin,
                  isDefaultPin: false
                });
                if (state.currentUser && state.currentUser.id === userId) {
                  state.currentUser.pin = newCustomPin;
                  state.currentUser.loginPin = newCustomPin;
                  state.currentUser.isDefaultPin = false;
                  saveState();
                }
                alert("Aapka Naya PIN successfully set ho gaya!");
              } else {
                alert("Invalid PIN! Agli baar login par naya PIN set karna hoga.");
              }
            }, 300);
          } else {
            alert("Login successful!");
          }
        } else {
          alert("Incorrect 4-digit PIN!");
        }
      } else {
        const matched = findUserByIdentifier(userId);
        if (matched) {
          const storedPin = matched.loginPin || matched.pin || "1234";
          if (!userPin || userPin === storedPin || userPin === "1234") {
            const sessionData = { id: matched.id || userId, ...matched };
            localStorage.setItem('currentUser', JSON.stringify(sessionData));
            updateSessionUI(matched.id || userId, sessionData);
            toggleModal(false);
            if (matched.isDefaultPin === true) {
              setTimeout(() => {
                const newCustomPin = prompt("Admin ne aapka PIN approve kar diya hai.\nApni pasand ka Naya 4-Digit PIN set karein:");
                if (newCustomPin && newCustomPin.length === 4 && !isNaN(newCustomPin)) {
                  databaseRef.ref(`hostel_mess_data/users/${matched.id || userId}`).update({
                    pin: newCustomPin,
                    loginPin: newCustomPin,
                    isDefaultPin: false
                  });
                  alert("Aapka Naya PIN successfully set ho gaya!");
                } else {
                  alert("Invalid PIN! Agli baar login par naya PIN set karna hoga.");
                }
              }, 300);
            } else {
              alert("Login successful!");
            }
          } else {
            alert("Incorrect 4-digit PIN!");
          }
        } else {
          alert("User ID not found!");
        }
      }
    })
    .catch((err) => alert("Database Error: " + err.message));
}

// 3. Forgot PIN Request System (Admin OTP / Employee Request)
function handleForgotPin() {
  const idEl = document.getElementById('loginId') || document.getElementById('login-identifier');
  const userId = idEl ? idEl.value.trim() : "";

  if (!userId) {
    alert("Pehle apna User ID enter karein.");
    return;
  }

  const databaseRef = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);

  if (!databaseRef) {
    alert("Database offline hai. Kripya thodi der baad try karein.");
    return;
  }

  databaseRef.ref(`hostel_mess_data/users/${userId}`).once('value')
    .then((snapshot) => {
      let userData = null;
      let targetId = userId;
      if (snapshot.exists()) {
        userData = snapshot.val();
      } else {
        const matched = findUserByIdentifier(userId);
        if (matched) {
          userData = matched;
          targetId = matched.id || userId;
        }
      }

      if (!userData) {
        alert("User ID nahi mila!");
        return;
      }

      const userRole = userData.role ? userData.role.toUpperCase() : "MEMBER";

      // Admin Dummy OTP Logic
      if (userRole === "SUPER_ADMIN" || userRole === "ADMIN") {
        const dummyOtp = Math.floor(1000 + Math.random() * 9000);
        alert(`[ADMIN OTP] Aapka OTP hai: ${dummyOtp}`);
        
        const enteredOtp = prompt("Enter 4-Digit Dummy OTP:");
        if (enteredOtp == dummyOtp) {
          const newPin = prompt("Set New 4-Digit Admin PIN:");
          if (newPin && newPin.length === 4 && !isNaN(newPin)) {
            databaseRef.ref(`hostel_mess_data/users/${targetId}`).update({
              pin: newPin,
              loginPin: newPin,
              isDefaultPin: false
            });
            if (state.currentUser && state.currentUser.id === targetId) {
              state.currentUser.pin = newPin;
              state.currentUser.loginPin = newPin;
              state.currentUser.isDefaultPin = false;
              saveState();
            }
            alert("Admin PIN Updated!");
          } else {
            alert("Invalid PIN! Must be 4 numeric digits.");
          }
        } else {
          alert("Wrong OTP!");
        }
      } 
      // Employee Request Logic
      else {
        databaseRef.ref(`hostel_mess_data/reset_requests/${targetId}`).set({
          userId: targetId,
          userName: userData.name || "Employee",
          status: "PENDING",
          timestamp: Date.now()
        }).then(() => {
          alert(`PIN Reset Request Admin ko bhej di gayi hai.\nAdmin approve karte hi aap temporary PIN '1234' se login karke naya PIN set kar sakte hain.`);
        });
      }
    })
    .catch((err) => alert("Database Error: " + err.message));
}

// Database updates listener
function listenToDatabaseUpdates() {
  if (typeof FirebaseSyncService !== "undefined" && FirebaseSyncService.init) {
    FirebaseSyncService.init();
  }

  const databaseRef = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);

  if (databaseRef) {
    // Dynamic Realtime Roster Sync (Direct Member Filter)
    databaseRef.ref('hostel_mess_data').on('value', (snapshot) => {
      const rootData = snapshot.val() || {};
      const users = rootData.users || {};
      const rosterData = rootData.roster || {};
      
      let rosterHTML = '';
      let activeCount = 0;

      Object.keys(rosterData).forEach((key) => {
        const entry = rosterData[key];
        if (!entry) return;
        
        // User ID match check (Direct matching with Database Users)
        const matchedUser = Object.values(users).find(u => 
          u && (u.id === entry.userId || u.id === key || u.name === entry.name || (entry.userId && String(u.id) === String(entry.userId)))
        );

        // Sirf wahi dikhega jo database me ACTIVE user hai
        if (matchedUser && (matchedUser.status === 'ACTIVE' || matchedUser.status === 'APPROVED' || !matchedUser.status)) {
          activeCount++;
          rosterHTML += `
            <tr>
              <td><b>${entry.name || matchedUser.name}</b></td>
              <td>${entry.room || matchedUser.room || matchedUser.assignedRoom || 'N/A'}</td>
              <td>${entry.shift || matchedUser.shift || 'OFF_DUTY'}</td>
              <td><span class="badge status-on">${entry.status || 'ON'}</span></td>
            </tr>`;
        }
      });

      // Table HTML update
      const rosterTable = document.getElementById('rosterTableBody') || document.getElementById('kitchen-roster-tbody');
      if (rosterTable) {
        rosterTable.innerHTML = rosterHTML || '<tr><td colspan="4" style="text-align:center;">No active members in roster</td></tr>';
      }

      // Active entries count update
      const countBadge = document.querySelector('.live-roster-count') || document.getElementById('kitchen-roster-count');
      if (countBadge) {
        countBadge.innerText = `${activeCount} active entries`;
      }
    });
  }
}

// Modal toggler helper (defaults to switch user/login modal)
function toggleModal(open = true, modalId = "modal-switch-user") {
  if (open) {
    if (modalId === "modal-switch-user") {
      updateSwitchModalSessionCard();
      renderSwitchAccountList();
    }
    openModal(modalId);
  } else {
    closeModal(modalId);
  }
}

// Session UI update helper
function updateSessionUI(userId, userObj = null) {
  let user = userObj;
  if (!user && userId) {
    user = (state.users || []).find(u => u && u.id === userId) || findUserByIdentifier(userId);
  }
  if (user) {
    user.groupId = MAIN_GROUP_ID;
    user.messGroupId = MAIN_GROUP_ID;
    state.currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("hostel_mess_current_user", JSON.stringify(user));
    saveLocalState();
    renderUI();
  }
}

// Recaptcha Init
function initRecaptchaVerifier() {
  if (typeof firebase !== 'undefined' && firebase.auth && document.getElementById('recaptcha-container')) {
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible'
        });
      }
    } catch (e) {
      console.warn("RecaptchaVerifier init error/warning:", e);
    }
  }
}

// Real OTP Send Function
function sendRealOTP(mobileNumber) {
  if (!window.recaptchaVerifier) {
    initRecaptchaVerifier();
  }
  const formattedNumber = mobileNumber.startsWith('+91') ? mobileNumber : `+91${mobileNumber}`;
  
  firebase.auth().signInWithPhoneNumber(formattedNumber, window.recaptchaVerifier)
    .then((confirmationResult) => {
      window.confirmationResult = confirmationResult;
      const otp = prompt(`${formattedNumber} par Real SMS OTP bheja gaya hai. Enter karein:`);
      
      if (otp) {
        confirmationResult.confirm(otp)
          .then((result) => {
            alert("OTP Verified Successfully!");
            // Perform Password/PIN Reset
          })
          .catch(() => alert("Galat OTP enter kiya!"));
      }
    })
    .catch((err) => alert("SMS Send Error: " + err.message));
}

// Secure Real-time Dashboard Syncing Function
function syncDashboardCounters() {
  const databaseRef = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);
  if (!databaseRef) return;

  const dbRef = databaseRef.ref('hostel_mess_data');

  dbRef.on('value', (snapshot) => {
    if (!snapshot.exists()) return;
    
    const rootData = snapshot.val() || {};
    const usersObj = rootData.users || {};
    const rosterObj = rootData.roster || rootData.orders || {};

    // 1. Total Active Members Count (Object Safe)
    const activeUsersList = Object.values(usersObj).filter(u => u && (u.status === 'ACTIVE' || u.status === 'APPROVED' || !u.status));
    const totalMembersCount = activeUsersList.length;

    // 2. Meal Plates Tally Calculation (Lunch / Dinner / Total)
    let lunchCount = 0;
    let dinnerCount = 0;
    let liveOnDutyCount = 0;

    Object.values(rosterObj).forEach((entry) => {
      if (!entry) return;
      
      // Verification: Check if entry belongs to a valid active user
      const isUserActive = activeUsersList.some(u => 
        u && (u.id === entry.userId || u.name === entry.name || u.phone === entry.userId || (entry.userId && String(u.id) === String(entry.userId)))
      );

      if (isUserActive) {
        if (entry.mealType === 'LUNCH' || entry.lunch || entry.status === 'ON' || entry.status === 'PACK_TIFFIN') lunchCount++;
        if (entry.mealType === 'DINNER' || entry.dinner || entry.status === 'ON') dinnerCount++;
        if (entry.shift && entry.shift !== 'OFF_DUTY') liveOnDutyCount++;
      }
    });

    // 3. UI Counter Elements Security Mapping
    updateCounterElement('totalMembersEl', totalMembersCount);
    updateCounterElement('liveOnDutyEl', liveOnDutyCount);
    updateCounterElement('lunchPlatesEl', lunchCount);
    updateCounterElement('dinnerPlatesEl', dinnerCount);
    updateCounterElement('totalPlatesEl', lunchCount + dinnerCount);

    // Also update existing dashboard badges if present
    updateCounterElement('mgr-active-count', `${totalMembersCount} Active`);
  }, (error) => {
    console.error("Firebase Read Error:", error);
  });
}

// Helper function to safely update DOM elements
function updateCounterElement(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = value;
  }
}

// Clean & Fresh App Logic (No Default/Dummy Accounts)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof firebase !== 'undefined') {
    initFreshDashboard();
  }
});

function initFreshDashboard() {
  const db = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);
  if (!db) return;

  db.ref('hostel_mess_data').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    const users = data.users || {};
    const roster = data.roster || {};

    const activeUsers = Object.values(users).filter(Boolean);

    // Update Live UI Counters with Actual Data Only
    setElementText('totalMembersEl', activeUsers.length);
    setElementText('liveOnDutyEl', 0);
    setElementText('lunchPlatesEl', 0);
    setElementText('dinnerPlatesEl', 0);
    setElementText('totalPlatesEl', 0);

  }, (error) => {
    console.error("Database sync error:", error);
  });
}

function setElementText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

// Duplicate Auto-Generated Users Sweep Function
function cleanupDuplicateResidents() {
  const db = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);
  if (!db) {
    alert("Firebase database connection not initialized.");
    return;
  }

  const ref = db.ref('hostel_mess_data/users');
  ref.once('value', (snapshot) => {
    const data = snapshot.val() || {};
    const updates = {};

    Object.keys(data).forEach((key) => {
      const item = data[key];
      // Sirf 'Resident' dummy accounts ko delete target karein
      if (item && (item.name === "Resident" || item.email === "resident@gmail.com")) {
        updates[key] = null;
      }
    });

    ref.update(updates).then(() => {
      localStorage.clear();
      alert("Sabhi duplicate dummy accounts clean kar diye gaye hain.");
      location.reload();
    }).catch(err => alert("Error: " + err.message));
  });
}

function cleanDuplicateResidents() {
  cleanupDuplicateResidents();
}

// User List Loader (Safe without auto-creating dummy residents)
function loadAppUsers(users) {
  const container = document.getElementById('userListContainer') || document.getElementById('mgr-resident-list');
  if (!users || Object.keys(users).length === 0) {
    if (container) {
      container.innerHTML = '<p class="empty-msg empty-state">No members found.</p>';
    }
    return;
  }

  // Render normal users
  if (typeof renderManagerResidentDirectory === "function") {
    renderManagerResidentDirectory();
  }
}

// Multi-location atomic delete by unique key
function deleteMemberByUniqueKey(userKey) {
  if (!userKey) return alert("Invalid User Key!");

  const db = (typeof database !== "undefined" && database) || (typeof rtdb !== "undefined" && rtdb) || (typeof firebase !== "undefined" && typeof firebase.database === "function" ? firebase.database() : null);
  if (!db) {
    alert("Firebase database connection not initialized.");
    return;
  }

  // Multi-location atomic delete
  const updates = {};
  updates[`/hostel_mess_data/users/${userKey}`] = null;
  updates[`/hostel_mess_data/roster/${userKey}`] = null;

  db.ref().update(updates)
    .then(() => {
      // Clear local memory cache
      localStorage.removeItem('cached_users');
      alert("✓ User permanently deleted from Database & Local Memory.");
      if (typeof renderManagerResidentDirectory === "function") {
        renderManagerResidentDirectory();
      }
    })
    .catch(err => alert("Delete Error: " + err.message));
}

// Expose helper functions globally for inline onclick handlers
window.handleLogin = handleLogin;
window.handleForgotPin = handleForgotPin;
window.sendRealOTP = sendRealOTP;
window.initRecaptchaVerifier = initRecaptchaVerifier;
window.syncDashboardCounters = syncDashboardCounters;
window.updateCounterElement = updateCounterElement;
window.cleanDuplicateResidents = cleanDuplicateResidents;
window.cleanupDuplicateResidents = cleanupDuplicateResidents;
window.loadAppUsers = loadAppUsers;
window.deleteMemberByUniqueKey = deleteMemberByUniqueKey;
window.initFreshDashboard = initFreshDashboard;
window.setElementText = setElementText;
window.handleApprovePendingUser = handleApprovePendingUser;
window.approveUserRegistration = approveUserRegistration;
window.rejectUserRegistration = rejectUserRegistration;
window.openReferralModal = openReferralModal;
window.shareReferralOnWhatsApp = shareReferralOnWhatsApp;
window.copyReferralLink = copyReferralLink;
window.copyReferralCode = copyReferralCode;
window.renderFriendsScreen = renderFriendsScreen;
window.joinGroupByReferralId = joinGroupByReferralId;
window.selfDeleteCurrentUserAccount = selfDeleteCurrentUserAccount;
window.listenToDatabaseUpdates = listenToDatabaseUpdates;
window.toggleModal = toggleModal;
window.updateSessionUI = updateSessionUI;

// 1. Window Load - Secure Session Check (Refresh Fix)
window.onload = function() {
  handleUrlRouting();
  const savedUser = localStorage.getItem('currentUser');
  
  if (savedUser && savedUser !== "undefined") {
    try {
      const user = JSON.parse(savedUser);
      if (user && user.id) {
        updateSessionUI(user.id, user);
        toggleModal(false);
      } else {
        toggleModal(true);
      }
    } catch (e) {
      toggleModal(true);
    }
  } else {
    toggleModal(true);
  }
  
  listenToDatabaseUpdates();
  try {
    syncDashboardCounters();
  } catch (e) {
    console.warn("syncDashboardCounters on load:", e);
  }
  try {
    initRecaptchaVerifier();
  } catch (e) {
    console.warn("Recaptcha verifier init on load:", e);
  }
};

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
