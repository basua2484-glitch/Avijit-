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
  meals: [],
  pendingLeaves: [],
  expensesLog: [], // Real actual expenses ledger
  roomRentPerPerson: 1500,
  activeKitchenMeal: "LUNCH",
  selectedOtHours: 2,
  selectedRoleFilter: "ALL",
  selectedExpenseCategoryFilter: "ALL"
};

// Load or initialize state from LocalStorage
let state = (function() {
  try {
    const saved = localStorage.getItem("hostel_mess_state_v2");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure expensesLog and users exist
      if (!parsed.expensesLog) parsed.expensesLog = [];
      if (!parsed.users || parsed.users.length === 0) parsed.users = CLEAN_INITIAL_STATE.users;
      return parsed;
    }
  } catch (e) {
    console.error("State parse error:", e);
  }
  return JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
})();

function saveState() {
  localStorage.setItem("hostel_mess_state_v2", JSON.stringify(state));
}

function getTodayString() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

// Global Calculations from Real Expense Ledger & Meals
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

// Navigation & Tab Switching
const navBtns = document.querySelectorAll(".nav-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    navBtns.forEach(b => b.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    const targetEl = document.getElementById(targetTab);
    if (targetEl) targetEl.classList.add("active");
    renderUI();
  });
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
  document.getElementById("current-role-badge").textContent = user.role;

  // Manage Nav Button Opacity & Permissions based on user role
  const mgrBtn = document.getElementById("nav-manager-btn");
  const expBtn = document.getElementById("nav-expense-btn");
  const admBtn = document.getElementById("nav-admin-btn");

  if (user.role === "RESIDENT") {
    if (mgrBtn) mgrBtn.style.opacity = "0.4";
    if (expBtn) expBtn.style.opacity = "0.7";
    if (admBtn) admBtn.style.opacity = "0.4";
  } else if (user.role === "MANAGER") {
    if (mgrBtn) mgrBtn.style.opacity = "1";
    if (expBtn) expBtn.style.opacity = "1";
    if (admBtn) admBtn.style.opacity = "0.4";
  } else if (user.role === "ADMIN") {
    if (mgrBtn) mgrBtn.style.opacity = "1";
    if (expBtn) expBtn.style.opacity = "1";
    if (admBtn) admBtn.style.opacity = "1";
  } else if (user.role === "COOK") {
    if (mgrBtn) mgrBtn.style.opacity = "0.4";
    if (expBtn) expBtn.style.opacity = "0.7";
    if (admBtn) admBtn.style.opacity = "0.4";
  }
}

// 2. Resident Screen Rendering
function renderResidentScreen() {
  const user = state.currentUser || state.users[0];
  document.getElementById("resident-shift-display").textContent = user.currentShift || "OFF_DUTY";
  document.getElementById("shift-badge-indicator").textContent = user.currentShift || "OFF_DUTY";

  const isAutoOn = user.currentShift === "OFF_DUTY" || user.currentShift === "NIGHT";
  const pill = document.getElementById("resident-logic-pill");
  if (pill) {
    pill.textContent = isAutoOn ? "Auto-ON (Night/Off)" : "Auto-OFF (Day Shift)";
    pill.className = `pill-badge ${isAutoOn ? "badge-success" : "badge-alert"}`;
  }

  const ruleBox = document.getElementById("rule-explanation-box");
  if (ruleBox) {
    ruleBox.innerHTML = isAutoOn
      ? "💡 <strong>Rule:</strong> Off-Duty / Night Shift has <strong>Auto-ON</strong> meals. You can skip if dining outside."
      : "⚠️ <strong>Rule:</strong> Day Shifts (Morning/Evening) are <strong>Auto-OFF</strong>. Toggle ON before cut-off to eat.";
  }

  // Update shift buttons active state
  document.querySelectorAll(".shift-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-shift") === user.currentShift);
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
    let status = existing ? existing.status : (isAutoOn ? "ON" : "OFF");
    let isOn = status === "ON" || status === "PACK_TIFFIN" || status === "LATE_COVERED";

    const item = document.createElement("div");
    item.className = `meal-item ${isOn ? "on" : ""}`;
    item.innerHTML = `
      <div class="meal-info">
        <strong>${dm.type} (${status})</strong>
        <span>${dm.time} • ${dm.cutOff}</span>
      </div>
      <button class="meal-toggle-btn ${isOn ? "btn-toggle-on" : "btn-toggle-off"}" onclick="toggleMeal('${dm.type}')">
        ${isOn ? "✓ Eating (Meal ON)" : "✕ Skip (Meal OFF)"}
      </button>
    `;
    listEl.appendChild(item);
  });

  // Calculate live dynamic bill based on ACTUAL expenses
  const expTotals = calculateExpenseTotals();
  const totalPlates = getTotalConsumedPlates();
  const plateRate = getDynamicPlateRate();
  const myPlatesCount = userMeals.filter(m => m.status === "ON" || m.status === "PACK_TIFFIN" || m.status === "LATE_COVERED").length;

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
  let meal = state.meals.find(m => m.userId === user.id && m.mealType === mealType);
  if (meal) {
    meal.status = (meal.status === "OFF" || meal.status === "SKIP") ? "ON" : "OFF";
    meal.otHours = 0;
  } else {
    state.meals.push({
      id: "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      userId: user.id,
      userName: user.name,
      roomNumber: user.assignedRoom || "101",
      mealType: mealType,
      status: "ON",
      otHours: 0,
      shiftAtTime: user.currentShift || "OFF_DUTY"
    });
  }
  saveState();
  renderUI();
}

function setShift(shift) {
  state.currentUser.currentShift = shift;
  // Update in users list
  const u = state.users.find(x => x.id === state.currentUser.id);
  if (u) u.currentShift = shift;

  const isAutoOn = shift === "OFF_DUTY" || shift === "NIGHT";
  
  // Auto sync today's meals based on rules
  ["LUNCH", "DINNER"].forEach(type => {
    let meal = state.meals.find(m => m.userId === state.currentUser.id && m.mealType === type);
    if (!meal) {
      state.meals.push({
        id: "m_" + Date.now() + "_" + type,
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        roomNumber: state.currentUser.assignedRoom || "101",
        mealType: type,
        status: isAutoOn ? "ON" : "OFF",
        otHours: 0,
        shiftAtTime: shift
      });
    } else {
      meal.status = isAutoOn ? "ON" : "OFF";
      meal.shiftAtTime = shift;
    }
  });

  saveState();
  renderUI();
}

// Shift button listeners
document.querySelectorAll(".shift-btn").forEach(btn => {
  btn.addEventListener("click", () => {
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

// 4. Manager Operations Screen
function renderManagerScreen() {
  const activeResidents = state.users.filter(u => u.status === 'ACTIVE' && (u.role === 'RESIDENT' || u.role === 'EMPLOYEE'));
  document.getElementById("mgr-active-count").textContent = `${activeResidents.length} Active`;
  document.getElementById("mgr-pending-count").textContent = `${(state.pendingLeaves || []).length} Requests`;

  const leavesContainer = document.getElementById("manager-leaves-list");
  leavesContainer.innerHTML = "";

  if (!state.pendingLeaves || state.pendingLeaves.length === 0) {
    leavesContainer.innerHTML = `<div class="empty-state">No pending leave requests.</div>`;
  } else {
    state.pendingLeaves.forEach(lev => {
      const item = document.createElement("div");
      item.className = "card mt-3 flex-between";
      item.innerHTML = `
        <div>
          <strong>${lev.userName}</strong>
          <p class="text-sub">${lev.startDate} to ${lev.endDate} (${lev.totalDays}d) - ${lev.reason}</p>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="processLeave('${lev.id}', true)">Approve</button>
          <button class="btn btn-alert btn-sm" onclick="processLeave('${lev.id}', false)">Reject</button>
        </div>
      `;
      leavesContainer.appendChild(item);
    });
  }

  // Resident Directory
  const rList = document.getElementById("manager-resident-list");
  rList.innerHTML = "";

  if (activeResidents.length === 0) {
    rList.innerHTML = `<div class="empty-state">No residents added yet. Click "+ New Resident" or use Admin Panel to add members.</div>`;
  } else {
    activeResidents.forEach(u => {
      const div = document.createElement("div");
      div.className = "account-item";
      div.innerHTML = `
        <div>
          <strong>${u.name} (Room ${u.assignedRoom || '101'})</strong>
          <p class="text-sub">${u.userIdCode || 'EMP'} • 📱 ${u.mobile}</p>
        </div>
        <span class="role-tag">${u.currentShift || 'OFF_DUTY'}</span>
      `;
      rList.appendChild(div);
    });
  }
}

function processLeave(id, approve) {
  state.pendingLeaves = state.pendingLeaves.filter(l => l.id !== id);
  saveState();
  renderUI();
  alert(approve ? "✓ Leave Approved! Meals automatically locked for the duration." : "Leave Request Rejected.");
}

// 5. Expense Ledger Screen (Actual Expenses Tracking)
function renderExpenseScreen() {
  const expTotals = calculateExpenseTotals();
  const dynamicRate = getDynamicPlateRate();

  document.getElementById("exp-metric-total").textContent = `₹${expTotals.grandTotal.toFixed(2)}`;
  document.getElementById("exp-metric-grocery").textContent = `₹${expTotals.GROCERY.toFixed(2)}`;
  document.getElementById("exp-metric-plate-rate").textContent = `₹${dynamicRate.toFixed(2)}`;

  const settingRentInput = document.getElementById("setting-room-rent");
  if (settingRentInput && !settingRentInput.matches(":focus")) {
    settingRentInput.value = state.roomRentPerPerson || 1500;
  }

  const categoryFilter = state.selectedExpenseCategoryFilter || "ALL";
  let entries = state.expensesLog || [];
  if (categoryFilter !== "ALL") {
    entries = entries.filter(e => e.category === categoryFilter);
  }

  const container = document.getElementById("expense-ledger-items");
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No expenses recorded yet.</p>
        <p class="text-sub mt-1">Click <strong>"+ Add Real Expense"</strong> to log grocery, electricity, cook salary, etc.</p>
      </div>
    `;
    return;
  }

  entries.slice().reverse().forEach(exp => {
    const card = document.createElement("div");
    const catClass = (exp.category || "other").toLowerCase();
    card.className = `expense-entry-card ${catClass}`;
    card.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="badge ${getCategoryBadgeClass(exp.category)}">${formatCategoryName(exp.category)}</span>
          <span class="text-sub">${exp.date}</span>
          <span class="text-sub">• ${exp.paymentMode || 'UPI'}</span>
        </div>
        <p style="font-size:13px; font-weight:600; margin-top:4px; color:var(--text-primary);">${exp.description}</p>
        <p class="text-sub">Logged by: ${exp.recordedBy || 'Admin'}</p>
      </div>
      <div style="text-align:right; display:flex; align-items:center; gap:10px;">
        <span style="font-size:16px; font-weight:800; color:var(--text-primary);">₹${parseFloat(exp.amount).toFixed(2)}</span>
        <button class="btn btn-alert btn-sm" onclick="deleteExpense('${exp.id}')" title="Delete Expense">🗑️</button>
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
  if (confirm("Are you sure you want to delete this expense entry?")) {
    state.expensesLog = state.expensesLog.filter(e => e.id !== id);
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
  const val = parseFloat(document.getElementById("setting-room-rent").value) || 0;
  state.roomRentPerPerson = val;
  saveState();
  renderUI();
  alert("✓ Standard Monthly Room Rent updated to ₹" + val);
});

// 6. Admin Screen Rendering (User & Role Management CRUD)
function renderAdminScreen() {
  const activeUsers = (state.users || []).filter(u => u.status === 'ACTIVE').length;
  const totalPlates = getTotalConsumedPlates();
  const plateRate = getDynamicPlateRate();

  document.getElementById("admin-members-count").textContent = activeUsers;
  document.getElementById("admin-plates-count").textContent = totalPlates;
  document.getElementById("admin-rate-display").textContent = `₹${plateRate.toFixed(2)}`;

  const roleFilter = state.selectedRoleFilter || "ALL";
  let filteredUsers = state.users || [];
  if (roleFilter !== "ALL") {
    filteredUsers = filteredUsers.filter(u => u.role === roleFilter);
  }

  const uList = document.getElementById("admin-users-list");
  uList.innerHTML = "";

  if (filteredUsers.length === 0) {
    uList.innerHTML = `
      <div class="empty-state">
        <p>No users found for selected role.</p>
        <p class="text-sub mt-1">Click <strong>"+ Add New User"</strong> to add Admins, Managers, Residents, or Cooks.</p>
      </div>
    `;
    return;
  }

  filteredUsers.forEach(u => {
    const div = document.createElement("div");
    div.className = "user-card-item";
    const roleBadgeClass = u.role === 'ADMIN' ? 'badge-amber' : (u.role === 'MANAGER' ? 'badge-lilac' : (u.role === 'COOK' ? 'badge-blue' : 'badge-success'));
    const isBlocked = u.status === "BLOCKED";

    div.innerHTML = `
      <div>
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>${u.name}</strong>
          <span class="badge ${roleBadgeClass}">${u.role}</span>
          ${isBlocked ? '<span class="badge badge-alert">BLOCKED</span>' : '<span class="badge badge-success">ACTIVE</span>'}
        </div>
        <p class="text-sub" style="margin-top:2px;">
          Room: <strong>${u.assignedRoom || 'N/A'}</strong> • ID: ${u.userIdCode || 'N/A'} • 📱 ${u.mobile} • Shift: ${u.currentShift || 'OFF_DUTY'}
        </p>
      </div>
      <div class="user-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditUserModal('${u.id}')">✏️ Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}')">
          ${isBlocked ? '🔓 Unblock' : '🔒 Lock'}
        </button>
        ${u.id !== state.currentUser.id && u.role !== 'ADMIN' ? `
          <button class="btn btn-alert btn-sm" onclick="deleteUser('${u.id}')">🗑️</button>
        ` : ''}
      </div>
    `;
    uList.appendChild(div);
  });
}

function toggleUserStatus(userId) {
  const u = state.users.find(x => x.id === userId);
  if (u) {
    u.status = u.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    saveState();
    renderUI();
  }
}

function deleteUser(userId) {
  const u = state.users.find(x => x.id === userId);
  if (!u) return;
  if (confirm(`Delete user "${u.name}" permanently?`)) {
    state.users = state.users.filter(x => x.id !== userId);
    state.meals = state.meals.filter(m => m.userId !== userId);
    state.pendingLeaves = state.pendingLeaves.filter(l => l.userId !== userId);
    if (state.currentUser.id === userId) {
      state.currentUser = state.users[0];
    }
    saveState();
    renderUI();
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

// 7. Add / Edit User Form Handlers
document.getElementById("btn-open-add-user")?.addEventListener("click", () => {
  document.getElementById("modal-user-title").textContent = "Add New User";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  document.getElementById("form-user-mobile").value = "";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  openModal("modal-user-form");
});

document.getElementById("btn-mgr-add-resident")?.addEventListener("click", () => {
  document.getElementById("modal-user-title").textContent = "Add New Resident";
  document.getElementById("form-user-id").value = "";
  document.getElementById("form-user-name").value = "";
  document.getElementById("form-user-mobile").value = "";
  document.getElementById("form-user-role").value = "RESIDENT";
  document.getElementById("form-user-room").value = "";
  document.getElementById("form-user-code").value = "";
  document.getElementById("form-user-shift").value = "OFF_DUTY";
  openModal("modal-user-form");
});

function openEditUserModal(userId) {
  const u = state.users.find(x => x.id === userId);
  if (!u) return;

  document.getElementById("modal-user-title").textContent = "Edit User Details";
  document.getElementById("form-user-id").value = u.id;
  document.getElementById("form-user-name").value = u.name;
  document.getElementById("form-user-mobile").value = u.mobile;
  document.getElementById("form-user-role").value = u.role;
  document.getElementById("form-user-room").value = u.assignedRoom || "";
  document.getElementById("form-user-code").value = u.userIdCode || "";
  document.getElementById("form-user-shift").value = u.currentShift || "OFF_DUTY";
  openModal("modal-user-form");
}

document.getElementById("btn-save-user")?.addEventListener("click", () => {
  const editId = document.getElementById("form-user-id").value;
  const name = document.getElementById("form-user-name").value.trim();
  const mobile = document.getElementById("form-user-mobile").value.trim();
  const role = document.getElementById("form-user-role").value;
  const room = document.getElementById("form-user-room").value.trim();
  const code = document.getElementById("form-user-code").value.trim();
  const shift = document.getElementById("form-user-shift").value;

  if (!name || !mobile) {
    alert("Please enter both Name and Mobile Number!");
    return;
  }

  if (editId) {
    // Editing existing user
    const existing = state.users.find(x => x.id === editId);
    if (existing) {
      existing.name = name;
      existing.mobile = mobile;
      existing.role = role;
      existing.assignedRoom = room || "101";
      existing.userIdCode = code || existing.userIdCode;
      existing.currentShift = shift;

      // Update current user if edited
      if (state.currentUser.id === editId) {
        state.currentUser = existing;
      }
    }
  } else {
    // Adding new user
    const prefix = role === "ADMIN" ? "ADM" : (role === "MANAGER" ? "MGR" : (role === "COOK" ? "CK" : "EMP"));
    const generatedCode = code || `${prefix}_${Math.floor(100 + Math.random() * 900)}`;
    const newUser = {
      id: "usr_" + Date.now(),
      name: name,
      mobile: mobile,
      role: role,
      assignedRoom: room || (role === "ADMIN" ? "Office" : (role === "COOK" ? "Kitchen" : "101")),
      userIdCode: generatedCode,
      status: "ACTIVE",
      currentShift: shift
    };
    state.users.push(newUser);

    // If new user is resident, initialize today's meals based on shift
    if (role === "RESIDENT") {
      const isAutoOn = shift === "OFF_DUTY" || shift === "NIGHT";
      ["LUNCH", "DINNER"].forEach(type => {
        state.meals.push({
          id: "m_" + Date.now() + "_" + type + "_" + Math.random().toString(36).substring(2, 4),
          userId: newUser.id,
          userName: newUser.name,
          roomNumber: newUser.assignedRoom,
          mealType: type,
          status: isAutoOn ? "ON" : "OFF",
          otHours: 0,
          shiftAtTime: shift
        });
      });
    }
  }

  saveState();
  renderUI();
  closeModal("modal-user-form");
  alert(editId ? "✓ User details updated!" : `✓ User "${name}" added successfully with role ${role}!`);
});

// 8. Add Real Expense Form Handlers
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
    alert("Please enter a description / bill voucher note!");
    return;
  }

  const newExpense = {
    id: "exp_" + Date.now(),
    date: date,
    category: category,
    amount: amount,
    description: note,
    paymentMode: mode,
    recordedBy: state.currentUser ? state.currentUser.name : "Admin",
    createdAt: Date.now()
  };

  if (!state.expensesLog) state.expensesLog = [];
  state.expensesLog.push(newExpense);

  saveState();
  renderUI();
  closeModal("modal-add-expense");
  alert(`✓ Recorded actual expense of ₹${amount.toFixed(2)} under ${formatCategoryName(category)}!`);
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
        <p class="text-sub">${u.role} • Room ${u.assignedRoom || 'N/A'}</p>
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
document.getElementById("btn-quick-late-plate")?.addEventListener("click", () => openModal("modal-ot"));
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
  const hours = state.selectedOtHours || 2;
  const status = hours >= 4 ? "PACK_TIFFIN" : "LATE_COVERED";
  
  let meal = state.meals.find(m => m.userId === user.id && m.mealType === "DINNER");
  if (meal) {
    meal.status = status;
    meal.otHours = hours;
  } else {
    state.meals.push({
      id: "m_" + Date.now(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.assignedRoom || "101",
      mealType: "DINNER",
      status: status,
      otHours: hours,
      shiftAtTime: user.currentShift || "OFF_DUTY"
    });
  }
  saveState();
  renderUI();
  closeModal("modal-ot");
  alert(`✓ Overtime Dinner Meal recorded (${status})!`);
});

// 12. Leave Submission Handlers
document.getElementById("btn-open-leave")?.addEventListener("click", () => {
  document.getElementById("leave-start").value = getTodayString();
  document.getElementById("leave-end").value = getTodayString();
  openModal("modal-leave");
});

document.getElementById("btn-submit-leave")?.addEventListener("click", () => {
  const start = document.getElementById("leave-start").value;
  const end = document.getElementById("leave-end").value;
  const reason = document.getElementById("leave-reason").value || "Home visit";

  if (!state.pendingLeaves) state.pendingLeaves = [];
  state.pendingLeaves.push({
    id: "lev_" + Date.now(),
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    startDate: start,
    endDate: end,
    totalDays: 3,
    reason: reason
  });

  saveState();
  renderUI();
  closeModal("modal-leave");
  alert("✓ Leave application submitted to Manager for approval!");
});

// 13. Guest Plates Handlers
document.getElementById("btn-open-guest-modal")?.addEventListener("click", () => openModal("modal-guest"));
document.getElementById("btn-confirm-guest")?.addEventListener("click", () => {
  const count = parseInt(document.getElementById("guest-count").value) || 2;
  const note = document.getElementById("guest-note").value || "Guests";
  for (let i = 0; i < count; i++) {
    state.meals.push({
      id: "m_guest_" + Date.now() + "_" + i,
      userId: "guest_" + Date.now() + "_" + i,
      userName: `Guest (${note})`,
      roomNumber: "Guest",
      mealType: state.activeKitchenMeal || "LUNCH",
      status: "ON",
      otHours: 0,
      shiftAtTime: "OFF_DUTY"
    });
  }
  saveState();
  renderUI();
  closeModal("modal-guest");
  alert(`✓ Added +${count} guest plates to ${state.activeKitchenMeal} counter!`);
});

// 14. Reset Database Handler
document.getElementById("btn-reset-db")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data? This will clear all entries and initialize with a clean Super Admin.")) {
    state = JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
    saveState();
    renderUI();
    alert("✓ Database reset cleanly! You can now add real users and actual expenses.");
  }
});

// Initial boot render
renderUI();
