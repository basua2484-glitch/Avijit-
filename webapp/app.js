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

function saveState() {
  localStorage.setItem("hostel_mess_state_v2", JSON.stringify(state));
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

  if (activePunch) {
    if (pulseDot) pulseDot.className = "live-pulse-dot";
    if (statusBadge) {
      statusBadge.textContent = "ON DUTY (ACTIVE)";
      statusBadge.className = "badge badge-success";
    }
    if (statusText) statusText.textContent = `Shift Active since ${activePunch.punchInTime}`;
    if (btnPunchIn) btnPunchIn.disabled = true;
    if (btnPunchOut) btnPunchOut.disabled = false;
    if (inTimeEl) inTimeEl.textContent = activePunch.punchInTime;
    if (outTimeEl) outTimeEl.textContent = "Active...";

    const calc = calculateDutyShift(activePunch.punchInTimestamp, Date.now());
    if (totalHoursEl) totalHoursEl.textContent = `${calc.totalHours.toFixed(2)}h`;
    if (otHoursEl) {
      otHoursEl.textContent = `${calc.otHours.toFixed(2)}h OT`;
      otHoursEl.style.color = calc.otHours > 0 ? "#F59E0B" : "#94A3B8";
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
      btnPunchIn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Punch In (Next Shift)`;
    }
    if (btnPunchOut) btnPunchOut.disabled = true;
    if (inTimeEl) inTimeEl.textContent = lastPunch.punchInTime;
    if (outTimeEl) outTimeEl.textContent = lastPunch.punchOutTime;
    if (totalHoursEl) totalHoursEl.textContent = `${lastPunch.totalWorkedHours.toFixed(2)}h`;
    if (otHoursEl) {
      otHoursEl.textContent = `${lastPunch.otHours.toFixed(2)}h OT`;
      otHoursEl.style.color = lastPunch.otHours > 0 ? "#F59E0B" : "#94A3B8";
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
      btnPunchIn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Punch In (Start Duty)`;
    }
    if (btnPunchOut) btnPunchOut.disabled = true;
    if (inTimeEl) inTimeEl.textContent = "--:--";
    if (outTimeEl) outTimeEl.textContent = "--:--";
    if (totalHoursEl) totalHoursEl.textContent = "0.0h";
    if (otHoursEl) {
      otHoursEl.textContent = "0.0h OT";
      otHoursEl.style.color = "#94A3B8";
    }
  }

  // 2. Render Shift & Meal Logic
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

// 6. Admin Screen Rendering (User & Role Management CRUD + Attendance & OT Report)
function renderAdminScreen() {
  const activeUsers = (state.users || []).filter(u => u.status === 'ACTIVE').length;
  const totalPlates = getTotalConsumedPlates();
  const plateRate = getDynamicPlateRate();

  document.getElementById("admin-members-count").textContent = activeUsers;
  document.getElementById("admin-plates-count").textContent = totalPlates;
  document.getElementById("admin-rate-display").textContent = `₹${plateRate.toFixed(2)}`;

  // 1. Render Attendance & OT Report Table
  renderAttendanceReport();

  // 2. Render User & Role Directory
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

function renderAttendanceReport() {
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

  if (punchedTodayEl) punchedTodayEl.textContent = uniqueUsersToday;
  if (workedHrsEl) workedHrsEl.textContent = `${todayWorkedHours.toFixed(1)}h`;
  if (otHrsEl) otHrsEl.textContent = `${todayOtHours.toFixed(1)}h`;

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

  // Render Table
  const tbody = document.getElementById("admin-attendance-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-sub" style="padding:28px;">
          No attendance punch records found for the selected filter.<br>
          Employees can Punch In/Out from their portal, or Admin can click <strong>"+ Record Punch"</strong>.
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

    tr.innerHTML = `
      <td>
        <strong>${att.date}</strong>
        <div class="text-sub">${att.shiftType || 'Normal Shift'}</div>
      </td>
      <td>
        <strong>${att.userName}</strong>
        <div class="text-sub">${att.userRole || 'RESIDENT'} • Room ${att.assignedRoom || '101'} • ${att.userIdCode || ''}</div>
      </td>
      <td><span class="font-mono">${att.punchInTime || '--:--'}</span></td>
      <td><span class="font-mono">${outDisplay}</span></td>
      <td><strong class="font-mono">${worked.toFixed(2)} hrs</strong></td>
      <td><span class="text-sub font-mono">${regular.toFixed(2)} hrs</span></td>
      <td>${otBadge}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-alert btn-sm" onclick="deleteAttendance('${att.id}')" title="Delete record">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteAttendance(id) {
  if (confirm("Are you sure you want to delete this attendance record?")) {
    state.attendanceLog = (state.attendanceLog || []).filter(a => a.id !== id);
    saveState();
    renderUI();
  }
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

// 14. Attendance & Overtime (OT) Module Event Listeners
// Employee Punch In
document.getElementById("btn-employee-punch-in")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  const active = getActivePunch(user.id);
  if (active) {
    alert("⚠️ You already have an active duty shift running! Please punch out before starting a new shift.");
    return;
  }

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
    totalWorkedHours: 0,
    regularHours: 0,
    otHours: 0,
    status: "ACTIVE",
    note: "Live Punch In"
  };

  if (!state.attendanceLog) state.attendanceLog = [];
  state.attendanceLog.push(newRecord);
  saveState();
  renderUI();
  alert(`✓ Punch In recorded at ${formatTimeShort(now)}!\nDuty shift started. Standard shift is 8.0 hours; extra time will be auto-calculated as Overtime (OT).`);
});

// Employee Punch Out
document.getElementById("btn-employee-punch-out")?.addEventListener("click", () => {
  const user = state.currentUser || state.users[0];
  const active = getActivePunch(user.id);
  if (!active) {
    alert("⚠️ No active punch-in found for today.");
    return;
  }

  const now = new Date();
  const calc = calculateDutyShift(active.punchInTimestamp, now.getTime());

  active.punchOutTime = formatTimeAMPM(now);
  active.punchOutTimestamp = now.getTime();
  active.totalWorkedHours = calc.totalHours;
  active.regularHours = calc.regularHours;
  active.otHours = calc.otHours;
  active.status = "COMPLETED";

  saveState();
  renderUI();

  const otMsg = calc.otHours > 0
    ? `\n⚡ Overtime: +${calc.otHours.toFixed(2)} OT Hours recorded!`
    : `\nStandard shift (8h) completed.`;

  alert(`✓ Punch Out recorded at ${formatTimeShort(now)}!\nTotal Worked: ${calc.totalHours.toFixed(2)} hrs (Standard: ${calc.regularHours.toFixed(2)}h)${otMsg}`);
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
  saveState();
  renderUI();
  closeModal("modal-manual-attendance");
  alert(`✓ Attendance recorded for ${user.name} on ${date}!\nTotal: ${totalWorked.toFixed(2)}h (${regular.toFixed(2)}h Standard + ${ot.toFixed(2)}h OT).`);
});

// 15. Reset Database Handler
document.getElementById("btn-reset-db")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all data? This will clear all entries and initialize with a clean Super Admin.")) {
    state = JSON.parse(JSON.stringify(CLEAN_INITIAL_STATE));
    saveState();
    renderUI();
    alert("✓ Database reset cleanly! You can now add real users, actual expenses, and attendance punches.");
  }
});

// Initial boot render
renderUI();
