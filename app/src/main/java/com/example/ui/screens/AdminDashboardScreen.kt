package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.User
import com.example.data.model.UserRole
import com.example.data.model.UserStatus
import com.example.ui.components.AppTopBar
import com.example.ui.components.RoleBadge
import com.example.ui.components.StatusBanner
import com.example.ui.theme.*
import com.example.ui.viewmodel.AdminViewModel
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
    viewModel: AdminViewModel,
    onBackClick: () -> Unit,
    onNavigateToKitchen: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    var showReplaceManagerDialog by remember { mutableStateOf(false) }
    var selectedUserForTransfer by remember { mutableStateOf<User?>(null) }

    // Bill Input Form states
    var groceryInput by remember { mutableStateOf("7275.00") }
    var electricityInput by remember { mutableStateOf("1400.00") }
    var waterInput by remember { mutableStateOf("600.00") }
    var cookSalaryInput by remember { mutableStateOf("1000.00") }
    var roomRentInput by remember { mutableStateOf("1500.00") }

    Scaffold(
        containerColor = CleanBackground,
        topBar = {
            AppTopBar(
                title = "Admin Master Control Panel",
                subtitle = "Month: ${state.selectedMonthYear} • Super Access",
                onBackClick = onBackClick,
                actions = {
                    IconButton(onClick = onNavigateToKitchen) {
                        Icon(Icons.Default.SoupKitchen, contentDescription = "Kitchen Live", tint = CleanPrimaryBlue)
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(2.dp))
                StatusBanner(
                    message = state.actionMessage,
                    isError = false,
                    onDismiss = { viewModel.clearMessage() }
                )
            }

            // Top Master Metrics
            item {
                Surface(
                    color = CleanDarkCard,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "👑 Super Control Overview",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Total Residents", color = CleanSurfaceVariant, fontSize = 11.sp)
                                Text("${state.totalActiveResidents} Active", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                            Column {
                                Text("Consumed Plates", color = CleanSurfaceVariant, fontSize = 11.sp)
                                Text("${state.totalConsumedPlatesThisMonth}", color = CleanPrimaryBlueLight, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Per Plate Rate", color = CleanSurfaceVariant, fontSize = 11.sp)
                                Text("₹${state.calculatedPlateRate}", color = CleanSuccessText, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                        }
                    }
                }
            }

            // SECTION 1: USER MANAGEMENT & REPLACEMENT PANEL (MANDATORY REQUIREMENT)
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.ManageAccounts, contentDescription = null, tint = CleanPrimaryBlue)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "User Management & Replacement",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = CleanTextPrimary
                                )
                            }
                            Button(
                                onClick = { showReplaceManagerDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.testTag("open_replace_manager_button")
                            ) {
                                Text("Replace Manager", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Text(
                            text = "Admin Access Control: 1-Tap Lock (Revoke), Replace Manager, Transfer Room:",
                            fontSize = 11.sp,
                            color = CleanTextSecondary,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )

                        state.usersList.forEach { user ->
                            Surface(
                                color = CleanSurfaceVariant,
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(user.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CleanTextPrimary)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            RoleBadge(role = user.role)
                                        }
                                        Text(
                                            text = "ID: ${user.userIdCode} • Room: ${user.assignedRoom} • ${user.mobile}",
                                            fontSize = 11.sp,
                                            color = CleanTextSecondary
                                        )
                                        if (user.status != UserStatus.ACTIVE) {
                                            Text(
                                                text = "Status: ${user.status.name}",
                                                color = CleanAlertDarkText,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }

                                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        // Transfer Room button
                                        IconButton(
                                            onClick = { selectedUserForTransfer = user },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(Icons.Default.MeetingRoom, contentDescription = "Transfer Room", tint = CleanPrimaryBlue, modifier = Modifier.size(18.dp))
                                        }

                                        // Lock / Unlock button
                                        IconButton(
                                            onClick = { viewModel.toggleUserLock(user) },
                                            modifier = Modifier.size(32.dp).testTag("lock_user_${user.userIdCode}")
                                        ) {
                                            Icon(
                                                imageVector = if (user.status == UserStatus.BLOCKED) Icons.Default.LockOpen else Icons.Default.Lock,
                                                contentDescription = "Lock User",
                                                tint = if (user.status == UserStatus.BLOCKED) CleanSuccessText else CleanAlertDarkText,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // SECTION 2: GROCERY & UTILITY BILL INPUTS & 1-CLICK BILL GENERATOR
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Calculate, contentDescription = null, tint = CleanPrimaryBlue)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Grocery & Utility Bills (मासिक खर्च)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = CleanTextPrimary
                            )
                        }

                        Text(
                            text = "महीने के कुल खर्चे दर्ज करें और 1-Click में सभी का बिल ऑटो-कैलकुलेट करें:",
                            fontSize = 11.sp,
                            color = CleanTextSecondary
                        )

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = groceryInput,
                                onValueChange = { groceryInput = it },
                                label = { Text("Grocery & Fuel (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.weight(1f).testTag("input_grocery_bill"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )
                            OutlinedTextField(
                                value = electricityInput,
                                onValueChange = { electricityInput = it },
                                label = { Text("Electricity Bill (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.weight(1f).testTag("input_electric_bill"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = waterInput,
                                onValueChange = { waterInput = it },
                                label = { Text("Water Bill (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.weight(1f).testTag("input_water_bill"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )
                            OutlinedTextField(
                                value = cookSalaryInput,
                                onValueChange = { cookSalaryInput = it },
                                label = { Text("Cook Salary (₹)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                modifier = Modifier.weight(1f).testTag("input_cook_salary"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )
                        }

                        OutlinedTextField(
                            value = roomRentInput,
                            onValueChange = { roomRentInput = it },
                            label = { Text("Room Rent / Maint. Per Person (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth().testTag("input_room_rent"),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp)
                        )

                        // 1-Click Auto Bill Generator Button
                        Button(
                            onClick = {
                                val g = groceryInput.toDoubleOrNull() ?: 7275.0
                                val e = electricityInput.toDoubleOrNull() ?: 1400.0
                                val w = waterInput.toDoubleOrNull() ?: 600.0
                                val c = cookSalaryInput.toDoubleOrNull() ?: 1000.0
                                val r = roomRentInput.toDoubleOrNull() ?: 1500.0
                                viewModel.generateMonthlyBills(g, e, w, c, r)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("generate_monthly_bills_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            if (state.isGeneratingBills) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Icon(Icons.Default.AutoMode, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("1-Click Generate & Publish Invoices", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // SECTION 3: LEAVE APPROVAL SYSTEM
            if (state.pendingLeaves.isNotEmpty()) {
                item {
                    Surface(
                        color = CleanSurface,
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(20.dp)) {
                            Text(
                                text = "Pending Leave Requests (स्वीकृति अनुरोध)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = CleanTextPrimary
                            )
                            state.pendingLeaves.forEach { leave ->
                                Surface(
                                    color = CleanSurfaceVariant,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(leave.userName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CleanTextPrimary)
                                            Text("${leave.startDate} to ${leave.endDate} (${leave.totalDays}d) - ${leave.reason}", fontSize = 11.sp, color = CleanTextSecondary)
                                        }
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Button(
                                                onClick = { viewModel.processLeave(leave.id, true) },
                                                colors = ButtonDefaults.buttonColors(containerColor = CleanSuccessBg),
                                                shape = RoundedCornerShape(8.dp),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                            ) {
                                                Text("Approve", fontSize = 11.sp, color = CleanSuccessText, fontWeight = FontWeight.Bold)
                                            }
                                            OutlinedButton(
                                                onClick = { viewModel.processLeave(leave.id, false) },
                                                shape = RoundedCornerShape(8.dp),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                            ) {
                                                Text("Reject", fontSize = 11.sp, color = CleanAlertDarkText, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }

    // Replace Manager Dialog
    if (showReplaceManagerDialog) {
        var mgrName by remember { mutableStateOf("Sanjay Verma") }
        var mgrMobile by remember { mutableStateOf("9876543299") }
        var mgrRoom by remember { mutableStateOf("Office-2") }

        AlertDialog(
            onDismissRequest = { showReplaceManagerDialog = false },
            containerColor = CleanSurface,
            shape = RoundedCornerShape(24.dp),
            title = { Text("Replace Hostel Manager (मैनेजर बदलें)", fontWeight = FontWeight.Bold, color = CleanTextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "⚡ Instant Action: पुराने Manager का एक्सेस तुरंत Revoke (Block) हो जाएगा और नए Manager का खाता सक्रिय हो जाएगा।",
                        fontSize = 12.sp,
                        color = CleanAlertDarkText
                    )
                    OutlinedTextField(
                        value = mgrName,
                        onValueChange = { mgrName = it },
                        label = { Text("New Manager Name") },
                        modifier = Modifier.fillMaxWidth().testTag("input_new_manager_name"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    OutlinedTextField(
                        value = mgrMobile,
                        onValueChange = { mgrMobile = it },
                        label = { Text("New Mobile No.") },
                        modifier = Modifier.fillMaxWidth().testTag("input_new_manager_mobile"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    OutlinedTextField(
                        value = mgrRoom,
                        onValueChange = { mgrRoom = it },
                        label = { Text("Assigned Office / Room") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.replaceManager(mgrName, mgrMobile, mgrRoom)
                        showReplaceManagerDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.testTag("confirm_replace_manager_button")
                ) {
                    Text("Replace & Revoke Old Access", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showReplaceManagerDialog = false }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }

    // Transfer Employee Dialog
    if (selectedUserForTransfer != null) {
        val u = selectedUserForTransfer!!
        var newRoom by remember { mutableStateOf(u.assignedRoom) }

        AlertDialog(
            onDismissRequest = { selectedUserForTransfer = null },
            containerColor = CleanSurface,
            shape = RoundedCornerShape(24.dp),
            title = { Text("Transfer / Change Room for ${u.name}", fontWeight = FontWeight.Bold, color = CleanTextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("नया कमरा नंबर दर्ज करें:", color = CleanTextSecondary)
                    OutlinedTextField(
                        value = newRoom,
                        onValueChange = { newRoom = it },
                        label = { Text("New Room Number") },
                        modifier = Modifier.fillMaxWidth().testTag("input_transfer_room"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.transferEmployee(u.id, newRoom)
                        selectedUserForTransfer = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Update Room", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedUserForTransfer = null }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }
}
