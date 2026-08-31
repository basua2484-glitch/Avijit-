const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Temporary DB Array (Database Connection Replace karein MongoDB / MySQL se)
let logsDatabase = [];

// API: Get Current Status
app.get('/api/status/:empId', (req, res) => {
  const empId = req.params.empId;
  const activeLog = logsDatabase.find(log => log.employeeId === empId && !log.punchOutTime);
  const completedLog = logsDatabase.find(log => log.employeeId === empId && log.punchOutTime);

  res.json({
    isPunchedIn: !!activeLog,
    shiftCompleted: !!completedLog,
    punchInTime: activeLog ? activeLog.punchInTime : null
  });
});

// API: Punch In Route
app.post('/api/punch-in', (req, res) => {
  const { employeeId, timestamp } = req.body;

  const newRecord = {
    id: Date.now(),
    employeeId,
    punchInTime: timestamp || new Date(),
    punchOutTime: null,
    status: 'PUNCHED_IN'
  };

  logsDatabase.push(newRecord);
  res.status(200).json({ success: true, message: "Punch In Registered", log: newRecord });
});

// API: Punch Out Route
app.post('/api/punch-out', (req, res) => {
  const { employeeId, timestamp } = req.body;
  const activeRecord = logsDatabase.find(log => log.employeeId === employeeId && !log.punchOutTime);

  if (!activeRecord) {
    return res.status(400).json({ success: false, message: "No active Punch In found" });
  }

  activeRecord.punchOutTime = timestamp || new Date();
  activeRecord.status = 'SHIFT_COMPLETED';

  res.status(200).json({ success: true, message: "Punch Out Registered", log: activeRecord });
});

// API: Get All Logs
app.get('/api/logs', (req, res) => {
  res.json({ success: true, logs: logsDatabase });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
}

module.exports = app;
