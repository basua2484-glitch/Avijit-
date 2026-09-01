const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(__dirname + '/webapp'));

// In-Memory Database for Duty & Punch Logs
let logsDatabase = [
  {
    id: 1725100000000,
    employeeId: "EMP6063",
    employeeName: "Avijit Basu",
    date: "2026-08-31",
    punchInTime: "08:00:00 AM",
    punchOutTime: "05:30:00 PM",
    punchInTimestamp: new Date(Date.now() - 9.5 * 3600 * 1000).toISOString(),
    punchOutTimestamp: new Date().toISOString(),
    assignedDepartment: "Main ICU Ward 1",
    departmentAssignedTime: "08:15:00 AM",
    otTargetDepartment: "Emergency OT 2",
    otDeptAssignedTime: "04:00:00 PM",
    regularHours: 8.0,
    otHours: 1.5,
    totalHours: 9.5,
    status: 'SHIFT_COMPLETED'
  }
];

// Helper to format 12hr time
function formatTime12(dateObj) {
  const d = new Date(dateObj);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

// 1. GET /api/status/:empId - Fetch real-time duty status
app.get('/api/status/:empId', (req, res) => {
  const empId = req.params.empId;
  const activeLog = logsDatabase.find(log => log.employeeId === empId && !log.punchOutTime);
  const completedLogs = logsDatabase.filter(log => log.employeeId === empId && log.punchOutTime);
  const latestCompleted = completedLogs.length ? completedLogs[completedLogs.length - 1] : null;

  res.json({
    success: true,
    employeeId: empId,
    isPunchedIn: !!activeLog,
    shiftCompleted: !activeLog && !!latestCompleted,
    activeLog: activeLog || null,
    punchInTime: activeLog ? activeLog.punchInTime : (latestCompleted ? latestCompleted.punchInTime : null),
    punchOutTime: latestCompleted ? latestCompleted.punchOutTime : null,
    assignedDepartment: activeLog ? activeLog.assignedDepartment : (latestCompleted ? latestCompleted.assignedDepartment : null),
    departmentAssignedTime: activeLog ? activeLog.departmentAssignedTime : (latestCompleted ? latestCompleted.departmentAssignedTime : null),
    otTargetDepartment: activeLog ? activeLog.otTargetDepartment : (latestCompleted ? latestCompleted.otTargetDepartment : null),
    otDeptAssignedTime: activeLog ? activeLog.otDeptAssignedTime : (latestCompleted ? latestCompleted.otDeptAssignedTime : null),
    regularHours: latestCompleted ? latestCompleted.regularHours : (activeLog ? 0 : 0),
    otHours: latestCompleted ? latestCompleted.otHours : (activeLog ? 0 : 0),
    status: activeLog ? 'PUNCHED_IN' : (latestCompleted ? 'SHIFT_COMPLETED' : 'NOT_PUNCHED_IN')
  });
});

// 2. POST /api/punch-in - Record punch-in timestamp
app.post('/api/punch-in', (req, res) => {
  const { employeeId, employeeName, department, timestamp } = req.body;
  const empId = employeeId || "EMP6063";
  const now = timestamp ? new Date(timestamp) : new Date();

  // Check if already punched in
  let activeRecord = logsDatabase.find(log => log.employeeId === empId && !log.punchOutTime);
  if (activeRecord) {
    return res.status(400).json({ success: false, message: "Already punched in", log: activeRecord });
  }

  const todayStr = now.toISOString().split('T')[0];
  const timeFormatted = formatTime12(now);

  const newRecord = {
    id: Date.now(),
    employeeId: empId,
    employeeName: employeeName || "Avijit Basu",
    date: todayStr,
    punchInTime: timeFormatted,
    punchOutTime: null,
    punchInTimestamp: now.toISOString(),
    punchOutTimestamp: null,
    assignedDepartment: department || "Admin Desk",
    departmentAssignedTime: timeFormatted,
    otTargetDepartment: "--",
    otDeptAssignedTime: "--",
    regularHours: 0,
    otHours: 0,
    totalHours: 0,
    status: 'PUNCHED_IN'
  };

  logsDatabase.unshift(newRecord);
  res.status(200).json({ success: true, message: "Punch In Registered Successfully", log: newRecord });
});

// 3. POST /api/punch-out - Record punch-out timestamp and calculate total hours + OT
app.post('/api/punch-out', (req, res) => {
  const { employeeId, timestamp } = req.body;
  const empId = employeeId || "EMP6063";
  const now = timestamp ? new Date(timestamp) : new Date();

  const activeRecord = logsDatabase.find(log => log.employeeId === empId && !log.punchOutTime);

  if (!activeRecord) {
    return res.status(400).json({ success: false, message: "No active Punch In found to punch out from" });
  }

  const punchInDate = new Date(activeRecord.punchInTimestamp || Date.now());
  const elapsedMs = Math.max(0, now.getTime() - punchInDate.getTime());
  const totalHrs = parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2));
  
  // Standard Shift: 8.0 Hours. Anything beyond 8.0 is Overtime (OT)
  const regularHrs = Math.min(8.0, totalHrs);
  const otHrs = totalHrs > 8.0 ? parseFloat((totalHrs - 8.0).toFixed(2)) : 0.0;

  activeRecord.punchOutTime = formatTime12(now);
  activeRecord.punchOutTimestamp = now.toISOString();
  activeRecord.totalHours = totalHrs;
  activeRecord.regularHours = regularHrs;
  activeRecord.otHours = otHrs;
  activeRecord.status = 'SHIFT_COMPLETED';

  res.status(200).json({
    success: true,
    message: "Punch Out Registered Successfully",
    log: activeRecord,
    metrics: {
      totalHours: totalHrs,
      regularHours: regularHrs,
      otHours: otHrs
    }
  });
});

// 4. POST /api/assign-dept - Update active department or OT department
app.post('/api/assign-dept', (req, res) => {
  const { employeeId, department, isOtDuty, timestamp } = req.body;
  const empId = employeeId || "EMP6063";
  const now = timestamp ? new Date(timestamp) : new Date();
  const timeFormatted = formatTime12(now);

  if (!department || !department.trim()) {
    return res.status(400).json({ success: false, message: "Department name is required" });
  }

  const deptVal = department.trim();

  // Find active log, or latest today's log, or create one
  let targetLog = logsDatabase.find(log => log.employeeId === empId && !log.punchOutTime);
  if (!targetLog) {
    targetLog = logsDatabase.find(log => log.employeeId === empId);
  }

  if (targetLog) {
    if (isOtDuty) {
      targetLog.otTargetDepartment = deptVal;
      targetLog.otDeptAssignedTime = timeFormatted;
    } else {
      targetLog.assignedDepartment = deptVal;
      targetLog.departmentAssignedTime = timeFormatted;
    }
    return res.status(200).json({
      success: true,
      message: `Duty assigned to ${deptVal} (${isOtDuty ? 'OT Duty' : 'Regular Duty'})`,
      log: targetLog
    });
  }

  // If no record exists yet, create dummy pending entry
  const newEntry = {
    id: Date.now(),
    employeeId: empId,
    employeeName: "Avijit Basu",
    date: now.toISOString().split('T')[0],
    punchInTime: "--",
    punchOutTime: "--",
    punchInTimestamp: null,
    punchOutTimestamp: null,
    assignedDepartment: isOtDuty ? "Admin" : deptVal,
    departmentAssignedTime: isOtDuty ? "--" : timeFormatted,
    otTargetDepartment: isOtDuty ? deptVal : "--",
    otDeptAssignedTime: isOtDuty ? timeFormatted : "--",
    regularHours: 0,
    otHours: 0,
    totalHours: 0,
    status: 'ASSIGNED'
  };
  logsDatabase.unshift(newEntry);

  res.status(200).json({
    success: true,
    message: `Duty assigned to ${deptVal} (${isOtDuty ? 'OT Duty' : 'Regular Duty'})`,
    log: newEntry
  });
});

// 5. GET /api/logs - Return all today's logs
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: logsDatabase });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
}

module.exports = app;
