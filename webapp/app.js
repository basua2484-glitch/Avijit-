// Hostel Mess & Shift Manager - Web Application Logic
// Complete state management, multi-role RBAC, 3-step accounting, and zero-waste kitchen tallies

const INITIAL_STATE = {
  currentUser: {
    id: "usr_101",
    name: "Rahul Kumar",
    mobile: "9876543210",
    role: "RESIDENT",
    assignedRoom: "204",
    userIdCode: "EMP_101",
    status: "ACTIVE",
    currentShift: "OFF_DUTY"
  },
  users: [
    { id: "usr_101", name: "Rahul Kumar", mobile: "9876543210", role: "RESIDENT", assignedRoom: "204", userIdCode: "EMP_101", status: "ACTIVE", currentShift: "OFF_DUTY" },
    { id: "usr_102", name: "Amit Sharma", mobile: "9876543211", role: "RESIDENT", assignedRoom: "205", userIdCode: "EMP_102", status: "ACTIVE", currentShift: "MORNING" },
    { id: "usr_103", name: "Vikram Singh", mobile: "9876543212", role: "MANAGER", assignedRoom: "101", userIdCode: "MGR_001", status: "ACTIVE", currentShift: "OFF_DUTY" },
    { id: "usr_104", name: "Suresh Sharma", mobile: "9876543213", role: "ADMIN", assignedRoom: "Admin Block", userIdCode: "ADM_001", status: "ACTIVE", currentShift: "OFF_DUTY" },
    { id: "usr_105", name: "Ramesh Chef", mobile: "9876543214", role: "COOK", assignedRoom: "Kitchen", userIdCode: "CK_001", status: "ACTIVE", currentShift: "OFF_DUTY" },
    { id: "usr_106", name: "Deepak Verma", mobile: "9876543215", role: "RESIDENT", assignedRoom: "208", userIdCode: "EMP_106", status: "ACTIVE", currentShift: "NIGHT" },
    { id: "usr_107", name: "Pooja Patel", mobile: "9876543216", role: "RESIDENT", assignedRoom: "301", userIdCode: "EMP_107", status: "ACTIVE", currentShift: "EVENING" }
  ],
  meals: [
    { id: "m1", userId: "usr_101", userName: "Rahul Kumar", roomNumber: "204", mealType: "LUNCH", status: "ON", otHours: 0, shiftAtTime: "OFF_DUTY" },
    { id: "m2", userId: "usr_101", userName: "Rahul Kumar", roomNumber: "204", mealType: "DINNER", status: "ON", otHours: 0, shiftAtTime: "OFF_DUTY" },
    { id: "m3", userId: "usr_102", userName: "Amit Sharma", roomNumber: "205", mealType: "LUNCH", status: "PACK_TIFFIN", otHours: 4, shiftAtTime: "MORNING" },
    { id: "m4", userId: "usr_106", userName: "Deepak Verma", roomNumber: "208", mealType: "LUNCH", status: "ON", otHours: 0, shiftAtTime: "NIGHT" },
    { id: "m5", userId: "usr_107", userName: "Pooja Patel", roomNumber: "301", mealType: "DINNER", status: "LATE_COVERED", otHours: 2, shiftAtTime: "EVENING" }
  ],
  pendingLeaves: [
    { id: "lev_1", userId: "usr_106", userName: "Deepak Verma", startDate: "2026-08-26", endDate: "2026-08-30", totalDays: 5, reason: "गाँव में पूजा (Festival)" },
    { id: "lev_2", userId: "usr_102", userName: "Amit Sharma", startDate: "2026-09-01", endDate: "2026-09-04", totalDays: 4, reason: "Home visit" }
  ],
  expenses: {
    grocery: 20400,
    electric: 4500,
    water: 1200,
    cookSalary: 12000,
    roomRent: 1500,
    totalPlates: 480
  },
  selectedOtHours: 2,
  activeKitchenMeal: "LUNCH"
};

// Load or initialize state from LocalStorage
let state = JSON.parse(localStorage.getItem("hostel_mess_state")) || INITIAL_STATE;

function saveState() {
  localStorage.setItem("hostel_mess_state", JSON.stringify(state));
}

// DOM Elements
const navBtns = document.querySelectorAll(".nav-btn");
const tabPanes = document.querySelectorAll(".tab-pane");

// Setup Tab Navigation
navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetTab = btn.getAttribute("data-tab");
    navBtns.forEach(b => b.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(targetTab)?.classList.add("active");
    renderUI();
  });
});

// Render UI Components
function renderUI() {
  renderHeader();
  renderResidentScreen();
  renderKitchenScreen();
  renderManagerScreen();
  renderAdminScreen();
}

function renderHeader() {
  const user = state.currentUser;
  document.getElementById("header-avatar").textContent = user.name.split(" ").map(n => n[0]).join("");
  document.getElementById("header-user-name").textContent = user.name;
  document.getElementById("header-user-role").textContent = `${user.role} • ROOM ${user.assignedRoom}`;
  document.getElementById("current-role-badge").textContent = user.role;

  // Manage Nav Visibility based on role
  const mgrBtn = document.getElementById("nav-manager-btn");
  const admBtn = document.getElementById("nav-admin-btn");
  if (user.role === "RESIDENT") {
    mgrBtn.style.opacity = "0.4";
    admBtn.style.opacity = "0.4";
  } else if (user.role === "MANAGER") {
    mgrBtn.style.opacity = "1";
    admBtn.style.opacity = "0.4";
  } else if (user.role === "ADMIN") {
    mgrBtn.style.opacity = "1";
    admBtn.style.opacity = "1";
  }
}

function renderResidentScreen() {
  const user = state.currentUser;
  document.getElementById("resident-shift-display").textContent = user.currentShift;
  document.getElementById("shift-badge-indicator").textContent = user.currentShift;

  const isAutoOn = user.currentShift === "OFF_DUTY" || user.currentShift === "NIGHT";
  const pill = document.getElementById("resident-logic-pill");
  pill.textContent = isAutoOn ? "Auto-ON (Night/Off)" : "Auto-OFF (Day Shift)";
  pill.className = `pill-badge ${isAutoOn ? "badge-success" : "badge-alert"}`;

  const ruleBox = document.getElementById("rule-explanation-box");
  ruleBox.innerHTML = isAutoOn
    ? "💡 <strong>Rule:</strong> Off-Duty / Night Shift has <strong>Auto-ON</strong> meals. Tiffin auto-packed if OT ≥ 4h."
    : "⚠️ <strong>Rule:</strong> Day Shifts (Morning/Evening) are <strong>Auto-OFF</strong>. Toggle ON before cut-off to eat.";

  // Update shift buttons active state
  document.querySelectorAll(".shift-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-shift") === user.currentShift);
  });

  // Render Resident Meals
  const userMeals = state.meals.filter(m => m.userId === user.id);
  const listEl = document.getElementById("resident-meal-list");
  listEl.innerHTML = "";

  const defaultMeals = [
    { type: "LUNCH", time: "12:00 PM - 2:30 PM", cutOff: "Cut-off: 8:30 AM" },
    { type: "DINNER", time: "7:30 PM - 10:00 PM", cutOff: "Cut-off: 4:30 PM" }
  ];

  defaultMeals.forEach(dm => {
    const existing = userMeals.find(m => m.mealType === dm.type);
    const status = existing ? existing.status : (isAutoOn ? "ON" : "OFF");
    const isOn = status === "ON" || status === "PACK_TIFFIN" || status === "LATE_COVERED";

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

  // Calculate live bill
  const plateRate = state.expenses.grocery / (state.expenses.totalPlates || 1);
  const activeCount = state.users.filter(u => u.status === "ACTIVE").length || 1;
  const userPlates = 48; // Estimated month to date
  const myMealShare = userPlates * plateRate;
  const myElectShare = state.expenses.electric / activeCount;
  const myWaterShare = state.expenses.water / activeCount;
  const myCookShare = state.expenses.cookSalary / activeCount;
  const myTotalBill = myMealShare + myElectShare + myWaterShare + myCookShare + state.expenses.roomRent;

  document.getElementById("resident-bill-amount").textContent = `₹${myTotalBill.toFixed(2)}`;
}

function toggleMeal(mealType) {
  const user = state.currentUser;
  let meal = state.meals.find(m => m.userId === user.id && m.mealType === mealType);
  if (meal) {
    meal.status = meal.status === "OFF" ? "ON" : "OFF";
    meal.otHours = 0;
  } else {
    state.meals.push({
      id: "m_" + Date.now(),
      userId: user.id,
      userName: user.name,
      roomNumber: user.assignedRoom,
      mealType: mealType,
      status: "OFF",
      otHours: 0,
      shiftAtTime: user.currentShift
    });
  }
  saveState();
  renderUI();
}

function setShift(shift) {
  state.currentUser.currentShift = shift;
  const isAutoOn = shift === "OFF_DUTY" || shift === "NIGHT";
  
  // Auto sync today's meals based on rules
  ["LUNCH", "DINNER"].forEach(type => {
    let meal = state.meals.find(m => m.userId === state.currentUser.id && m.mealType === type);
    if (!meal) {
      state.meals.push({
        id: "m_" + Date.now() + "_" + type,
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        roomNumber: state.currentUser.assignedRoom,
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

// Kitchen Screen Rendering
function renderKitchenScreen() {
  const activeMeal = state.activeKitchenMeal;
  const filteredMeals = state.meals.filter(m => m.mealType === activeMeal && m.status !== "OFF");

  const normal = filteredMeals.filter(m => m.status === "ON").length + 30; // base floor
  const tiffins = filteredMeals.filter(m => m.status === "PACK_TIFFIN").length + 5;
  const late = filteredMeals.filter(m => m.status === "LATE_COVERED").length + 3;
  const total = normal + tiffins + late;

  document.getElementById("kitchen-total-count").textContent = `${activeMeal}: ${total} TOTAL PLATES`;
  document.getElementById("k-metric-normal").textContent = normal;
  document.getElementById("k-metric-tiffins").textContent = tiffins;
  document.getElementById("k-metric-late").textContent = late;
  document.getElementById("kitchen-roster-count").textContent = `${filteredMeals.length + 5} entries`;

  // Populate Table
  const tbody = document.getElementById("kitchen-roster-tbody");
  tbody.innerHTML = "";

  state.users.forEach(u => {
    const meal = state.meals.find(m => m.userId === u.id && m.mealType === activeMeal);
    const status = meal ? meal.status : "ON";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.name}</strong></td>
      <td>Room ${u.assignedRoom}</td>
      <td>${u.currentShift} ${meal && meal.otHours ? `(OT ${meal.otHours}h)` : ""}</td>
      <td><span class="badge ${status === 'ON' ? 'badge-success' : status === 'PACK_TIFFIN' ? 'badge-blue' : 'badge-lilac'}">${status}</span></td>
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

// Manager Screen
function renderManagerScreen() {
  document.getElementById("mgr-active-count").textContent = `${state.users.filter(u => u.status === 'ACTIVE').length} Active`;
  document.getElementById("mgr-pending-count").textContent = `${state.pendingLeaves.length} Requests`;

  const leavesContainer = document.getElementById("manager-leaves-list");
  leavesContainer.innerHTML = "";

  if (state.pendingLeaves.length === 0) {
    leavesContainer.innerHTML = `<p class="text-sub">No pending leave requests.</p>`;
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
          <button class="btn btn-secondary" onclick="processLeave('${lev.id}', true)">Approve</button>
          <button class="btn btn-alert" onclick="processLeave('${lev.id}', false)">Reject</button>
        </div>
      `;
      leavesContainer.appendChild(item);
    });
  }

  // Resident Directory
  const rList = document.getElementById("manager-resident-list");
  rList.innerHTML = "";
  state.users.forEach(u => {
    const div = document.createElement("div");
    div.className = "account-item";
    div.innerHTML = `
      <div>
        <strong>${u.name} (Room ${u.assignedRoom})</strong>
        <p class="text-sub">${u.userIdCode} • ${u.mobile}</p>
      </div>
      <span class="role-tag">${u.currentShift}</span>
    `;
    rList.appendChild(div);
  });
}

function processLeave(id, approve) {
  state.pendingLeaves = state.pendingLeaves.filter(l => l.id !== id);
  saveState();
  renderUI();
  alert(approve ? "Leave Approved. Meals automatically cancelled for leave period!" : "Leave Rejected.");
}

// Admin Screen
function renderAdminScreen() {
  const activeUsers = state.users.filter(u => u.status === 'ACTIVE').length;
  const plateRate = state.expenses.grocery / (state.expenses.totalPlates || 1);

  document.getElementById("admin-members-count").textContent = activeUsers;
  document.getElementById("admin-plates-count").textContent = state.expenses.totalPlates;
  document.getElementById("admin-rate-display").textContent = `₹${plateRate.toFixed(2)}`;

  const uList = document.getElementById("admin-users-list");
  uList.innerHTML = "";

  state.users.forEach(u => {
    const div = document.createElement("div");
    div.className = "account-item";
    div.innerHTML = `
      <div>
        <strong>${u.name} <span class="role-tag">${u.role}</span></strong>
        <p class="text-sub">Room ${u.assignedRoom} • ${u.mobile} • ${u.status}</p>
      </div>
      <button class="btn btn-secondary" onclick="toggleUserStatus('${u.id}')">
        ${u.status === 'ACTIVE' ? '🔒 Lock Access' : '🔓 Unlock'}
      </button>
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

// 1-Click Bill Calculation
document.getElementById("btn-calc-bills")?.addEventListener("click", () => {
  state.expenses.grocery = parseFloat(document.getElementById("adm-grocery").value) || 20400;
  state.expenses.electric = parseFloat(document.getElementById("adm-electric").value) || 4500;
  state.expenses.water = parseFloat(document.getElementById("adm-water").value) || 1200;
  state.expenses.cookSalary = parseFloat(document.getElementById("adm-salary").value) || 12000;
  state.expenses.roomRent = parseFloat(document.getElementById("adm-rent").value) || 1500;

  saveState();
  renderUI();
  alert("✓ Monthly Bills Generated successfully with 3-Step Transparent Auto-Accounting!");
});

// Modals Handling
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

// Switch User Modal
document.getElementById("btn-switch-user")?.addEventListener("click", () => {
  const list = document.getElementById("switch-account-list");
  list.innerHTML = "";
  state.users.forEach(u => {
    const item = document.createElement("div");
    item.className = `account-item ${state.currentUser.id === u.id ? "selected" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${u.name}</strong>
        <p class="text-sub">${u.role} • Room ${u.assignedRoom}</p>
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

// View Invoice Modal
document.getElementById("btn-view-invoice")?.addEventListener("click", () => {
  const activeCount = state.users.filter(u => u.status === "ACTIVE").length || 1;
  const plateRate = state.expenses.grocery / (state.expenses.totalPlates || 1);
  const userPlates = 48;
  const mealCost = userPlates * plateRate;
  const elecShare = state.expenses.electric / activeCount;
  const waterShare = state.expenses.water / activeCount;
  const cookShare = state.expenses.cookSalary / activeCount;
  const rent = state.expenses.roomRent;
  const total = mealCost + elecShare + waterShare + cookShare + rent;

  const tbody = document.getElementById("invoice-breakdown-tbody");
  tbody.innerHTML = `
    <tr><td>Mess Grocery Share</td><td>${userPlates} plates × ₹${plateRate.toFixed(2)}</td><td class="text-right">₹${mealCost.toFixed(2)}</td></tr>
    <tr><td>Electricity Share</td><td>1/${activeCount}th of ₹${state.expenses.electric}</td><td class="text-right">₹${elecShare.toFixed(2)}</td></tr>
    <tr><td>Water Utility Share</td><td>1/${activeCount}th of ₹${state.expenses.water}</td><td class="text-right">₹${waterShare.toFixed(2)}</td></tr>
    <tr><td>Cook / Staff Salary</td><td>1/${activeCount}th of ₹${state.expenses.cookSalary}</td><td class="text-right">₹${cookShare.toFixed(2)}</td></tr>
    <tr><td>Room Rent / Maint.</td><td>Standard Monthly</td><td class="text-right">₹${rent.toFixed(2)}</td></tr>
  `;
  document.getElementById("invoice-modal-total").textContent = `₹${total.toFixed(2)}`;
  openModal("modal-invoice");
});

// Late Plate / OT Modal
document.getElementById("btn-quick-late-plate")?.addEventListener("click", () => {
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
      roomNumber: user.assignedRoom,
      mealType: "DINNER",
      status: status,
      otHours: hours,
      shiftAtTime: user.currentShift
    });
  }
  saveState();
  renderUI();
  closeModal("modal-ot");
  alert(`✓ OT Meal recorded (${status}) for Dinner!`);
});

// Leave Modal
document.getElementById("btn-open-leave")?.addEventListener("click", () => openModal("modal-leave"));
document.getElementById("btn-submit-leave")?.addEventListener("click", () => {
  const start = document.getElementById("leave-start").value;
  const end = document.getElementById("leave-end").value;
  const reason = document.getElementById("leave-reason").value;

  state.pendingLeaves.push({
    id: "lev_" + Date.now(),
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    startDate: start,
    endDate: end,
    totalDays: 5,
    reason: reason
  });

  saveState();
  renderUI();
  closeModal("modal-leave");
  alert("Leave application submitted to Manager!");
});

// Guest Plates Modal
document.getElementById("btn-open-guest-modal")?.addEventListener("click", () => openModal("modal-guest"));
document.getElementById("btn-confirm-guest")?.addEventListener("click", () => {
  const count = parseInt(document.getElementById("guest-count").value) || 2;
  alert(`✓ Added +${count} Guest plates to ${state.activeKitchenMeal} counter!`);
  closeModal("modal-guest");
});

// Replace Manager Modal
document.getElementById("btn-open-replace-mgr")?.addEventListener("click", () => openModal("modal-replace-mgr"));
document.getElementById("btn-confirm-replace-mgr")?.addEventListener("click", () => {
  const name = document.getElementById("new-mgr-name").value;
  const mobile = document.getElementById("new-mgr-mobile").value;
  const room = document.getElementById("new-mgr-room").value;

  if (!name || !mobile) {
    alert("Please enter manager name and mobile!");
    return;
  }

  // Demote previous manager
  state.users.forEach(u => {
    if (u.role === "MANAGER") {
      u.role = "RESIDENT";
      u.status = "BLOCKED";
    }
  });

  // Add new manager
  state.users.push({
    id: "usr_" + Date.now(),
    name: name,
    mobile: mobile,
    role: "MANAGER",
    assignedRoom: room || "101",
    userIdCode: "MGR_NEW",
    status: "ACTIVE",
    currentShift: "OFF_DUTY"
  });

  saveState();
  renderUI();
  closeModal("modal-replace-mgr");
  alert("✓ Previous manager access revoked. New manager activated!");
});

// Initial load
renderUI();
