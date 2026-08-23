package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.*
import com.example.ui.components.*
import com.example.ui.theme.*
import com.example.ui.viewmodel.ResidentViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResidentHomeScreen(
    viewModel: ResidentViewModel,
    onNavigateToInvoice: () -> Unit,
    onNavigateToKitchen: () -> Unit,
    onNavigateToAdmin: () -> Unit,
    onNavigateToManager: () -> Unit,
    onSwitchUser: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val user = state.user

    var showOtDialogForMeal by remember { mutableStateOf<MealRecord?>(null) }
    var showLeaveDialog by remember { mutableStateOf(false) }

    val initials = remember(user?.name) {
        val parts = user?.name?.split(" ")?.filter { it.isNotBlank() } ?: listOf()
        if (parts.size >= 2) "${parts[0].take(1)}${parts[1].take(1)}".uppercase()
        else user?.name?.take(2)?.uppercase() ?: "RK"
    }

    val isOffOrNight = user?.currentShift == ShiftType.OFF_DUTY || user?.currentShift == ShiftType.NIGHT
    val mealLogicLabel = if (isOffOrNight) "Auto-ON (${user?.currentShift?.name ?: "Night"})" else "Auto-OFF (Duty)"

    Scaffold(
        containerColor = CleanBackground,
        topBar = {
            Surface(
                color = CleanSurface,
                shape = RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp),
                shadowElevation = 3.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 20.dp)
                ) {
                    // Profile Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = CleanBlueBg,
                                shape = CircleShape,
                                modifier = Modifier.size(48.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = initials,
                                        color = CleanPrimaryBlue,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 18.sp
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = user?.name ?: "Rahul Kumar",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    color = CleanTextPrimary
                                )
                                Text(
                                    text = "EMPLOYEE • ROOM ${user?.assignedRoom ?: "204"}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = CleanTextSecondary,
                                    letterSpacing = 0.5.sp
                                )
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            user?.let { RoleBadge(role = it.role) }
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = CleanSurfaceVariant,
                                shape = CircleShape,
                                modifier = Modifier.size(40.dp)
                            ) {
                                IconButton(
                                    onClick = onSwitchUser,
                                    modifier = Modifier.testTag("switch_user_top_button")
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.SwapHoriz,
                                        contentDescription = "Switch User",
                                        tint = CleanPrimaryBlue
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Minimal Blue Hero Status Card in Header
                    Surface(
                        color = CleanPrimaryBlue,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "CURRENT STATUS",
                                    color = Color.White.copy(alpha = 0.8f),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = user?.currentShift?.name ?: "OFF-DUTY",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "MEAL LOGIC",
                                    color = Color.White.copy(alpha = 0.8f),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Surface(
                                    color = Color.White.copy(alpha = 0.2f),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = mealLogicLabel,
                                        color = Color.White,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(2.dp))
                StatusBanner(
                    message = state.message,
                    isError = false,
                    onDismiss = { viewModel.clearMessage() }
                )
            }

            // Quick Role Portal Navigation Bar if user has elevated roles
            if (user?.role == UserRole.ADMIN || user?.role == UserRole.MANAGER) {
                item {
                    Surface(
                        color = CleanSurface,
                        shape = RoundedCornerShape(20.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (user.role == UserRole.ADMIN) {
                                Button(
                                    onClick = onNavigateToAdmin,
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("nav_admin_panel_button"),
                                    colors = ButtonDefaults.buttonColors(containerColor = CleanAlertBg, contentColor = CleanAlertDarkText),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.AdminPanelSettings, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Admin Panel", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Button(
                                onClick = onNavigateToKitchen,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("nav_kitchen_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = CleanBlueBg, contentColor = CleanOnPrimaryContainer),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.SoupKitchen, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Kitchen Live", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            if (user.role == UserRole.MANAGER) {
                                Button(
                                    onClick = onNavigateToManager,
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("nav_manager_button"),
                                    colors = ButtonDefaults.buttonColors(containerColor = CleanLilacBg, contentColor = CleanLilacText),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Assignment, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Roster Ops", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            // SECTION 1: SHIFT STATUS & OPERATIONAL RULES CARD
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Shift Roster & Meal Logic",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = CleanTextPrimary
                            )
                            user?.currentShift?.let { ShiftBadge(shift = it) }
                        }

                        Text(
                            text = "Shift change activates automated food logic and kitchen count:",
                            fontSize = 12.sp,
                            color = CleanTextSecondary,
                            modifier = Modifier.padding(vertical = 8.dp)
                        )

                        // 4 Shift Chips
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            ShiftSelectChip(
                                label = "Off-Duty",
                                isSelected = user?.currentShift == ShiftType.OFF_DUTY,
                                modifier = Modifier.weight(1f),
                                onClick = { viewModel.updateShift(ShiftType.OFF_DUTY) }
                            )
                            ShiftSelectChip(
                                label = "Morning",
                                isSelected = user?.currentShift == ShiftType.MORNING,
                                modifier = Modifier.weight(1f),
                                onClick = { viewModel.updateShift(ShiftType.MORNING) }
                            )
                            ShiftSelectChip(
                                label = "Evening",
                                isSelected = user?.currentShift == ShiftType.EVENING,
                                modifier = Modifier.weight(1f),
                                onClick = { viewModel.updateShift(ShiftType.EVENING) }
                            )
                            ShiftSelectChip(
                                label = "Night",
                                isSelected = user?.currentShift == ShiftType.NIGHT,
                                modifier = Modifier.weight(1f),
                                onClick = { viewModel.updateShift(ShiftType.NIGHT) }
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Dynamic Operational Rule Explanation Box
                        Surface(
                            color = if (isOffOrNight) CleanSuccessBg.copy(alpha = 0.5f) else CleanAlertBg.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = if (isOffOrNight) Icons.Default.CheckCircle else Icons.Default.Info,
                                    contentDescription = null,
                                    tint = if (isOffOrNight) CleanSuccessText else CleanAlertText,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = if (isOffOrNight) {
                                        "Rule: Off-Duty / Night Shift has Auto-ON meals. Use 'Skip Meal' if away."
                                    } else {
                                        "Rule: On-Duty (Morning/Evening) has Auto-OFF meals. Use 'Request Meal' if needed."
                                    },
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (isOffOrNight) CleanSuccessText else CleanAlertText
                                )
                            }
                        }
                    }
                }
            }

            // SECTION 2: TODAY'S MEALS CARD (MATCHES CLEAN UTILITY SPEC)
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(28.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Today's Meals",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = CleanTextPrimary
                            )
                            Surface(
                                color = CleanAlertBg,
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    text = "Cut-off: 4:30 PM",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = CleanAlertText,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // 3 Meal Rows
                        state.todayMeals.forEach { meal ->
                            MealRowItem(
                                meal = meal,
                                onRequest = { viewModel.requestMeal(meal.id) },
                                onSkip = { viewModel.skipMeal(meal.id) },
                                onOpenOt = { showOtDialogForMeal = meal }
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }

            // SECTION 3: QUICK ACTION GRID (LATE PLATE & MARK LEAVE)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Late Plate Action Button
                    Surface(
                        color = CleanLilacBg,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(88.dp)
                            .clickable {
                                val targetMeal = state.todayMeals.firstOrNull { it.mealType == MealType.DINNER }
                                    ?: state.todayMeals.firstOrNull()
                                if (targetMeal != null) {
                                    showOtDialogForMeal = targetMeal
                                }
                            }
                            .testTag("quick_action_late_plate")
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.HourglassBottom,
                                contentDescription = "Late Plate",
                                tint = CleanLilacText,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "LATE PLATE",
                                color = CleanLilacText,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }

                    // Mark Leave Action Button
                    Surface(
                        color = CleanAlertBg,
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(88.dp)
                            .clickable { showLeaveDialog = true }
                            .testTag("open_leave_dialog_button")
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.DirectionsBus,
                                contentDescription = "Mark Leave",
                                tint = CleanAlertDarkText,
                                modifier = Modifier.size(24.dp)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "MARK LEAVE",
                                color = CleanAlertDarkText,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            }

            // Recent Leaves Info if present
            if (state.leaves.isNotEmpty()) {
                item {
                    Surface(
                        color = CleanSurface,
                        shape = RoundedCornerShape(20.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text("Active / Recent Leaves:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CleanTextPrimary)
                            state.leaves.take(2).forEach { leave ->
                                Surface(
                                    color = CleanSurfaceVariant,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${leave.startDate} to ${leave.endDate} (${leave.totalDays}d) - ${leave.reason}",
                                            fontSize = 11.sp,
                                            color = CleanTextPrimary
                                        )
                                        Surface(
                                            color = CleanAlertBg,
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = leave.status.name,
                                                color = CleanAlertDarkText,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // SECTION 4: CURRENT MONTHLY BILL (CLEAN DARK HERO CARD)
            item {
                Surface(
                    color = CleanDarkCard,
                    shape = RoundedCornerShape(28.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Column {
                                Text(
                                    text = "CURRENT MONTHLY BILL",
                                    color = Color.White.copy(alpha = 0.6f),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.Bottom) {
                                    val formatted = String.format(Locale.US, "%,.2f", state.estimatedLiveBill)
                                    val parts = formatted.split(".")
                                    Text(
                                        text = "₹${parts[0]}.",
                                        color = Color.White,
                                        fontWeight = FontWeight.Light,
                                        fontSize = 28.sp
                                    )
                                    Text(
                                        text = if (parts.size > 1) parts[1] else "00",
                                        color = Color.White.copy(alpha = 0.6f),
                                        fontWeight = FontWeight.Normal,
                                        fontSize = 18.sp,
                                        modifier = Modifier.padding(bottom = 2.dp)
                                    )
                                }
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "${state.monthlyPlatesConsumed} Plates",
                                    color = Color.White.copy(alpha = 0.7f),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .background(CleanGreenLive, CircleShape)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Live Update",
                                        color = CleanGreenLive,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Button(
                            onClick = onNavigateToInvoice,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .testTag("view_itemized_invoice_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue, contentColor = Color.White),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("View Itemized Statement", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // Overtime Dialog (Short OT -> Late Plate | Long OT -> Pack Tiffin)
    if (showOtDialogForMeal != null) {
        val meal = showOtDialogForMeal!!
        var otHours by remember { mutableIntStateOf(2) }

        AlertDialog(
            onDismissRequest = { showOtDialogForMeal = null },
            shape = RoundedCornerShape(24.dp),
            containerColor = CleanSurface,
            title = {
                Text("${meal.mealType.name} Overtime (OT) Request", fontWeight = FontWeight.Bold, color = CleanTextPrimary)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Select Overtime Hours:", fontSize = 13.sp, color = CleanTextSecondary)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(1, 2, 3, 4, 6, 8).forEach { h ->
                            Surface(
                                color = if (otHours == h) CleanPrimaryBlue else CleanSurfaceVariant,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { otHours = h }
                                    .padding(vertical = 2.dp)
                                    .testTag("ot_hour_$h")
                            ) {
                                Text(
                                    text = "${h}h",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = if (otHours == h) Color.White else CleanTextPrimary,
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }

                    if (otHours in 1..3) {
                        Surface(color = CleanLilacBg, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "🍲 Short OT ($otHours hrs): Kitchen will pack Late Plate.",
                                color = CleanLilacText,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    } else {
                        Surface(color = CleanBlueBg, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                            Text(
                                text = "🍱 Long OT ($otHours hrs): Kitchen will pack Tiffin for site.",
                                color = CleanOnPrimaryContainer,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val action = if (otHours in 1..3) "LATE_PLATE" else "PACK_TIFFIN"
                        viewModel.setOvertime(meal.id, otHours, action)
                        showOtDialogForMeal = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.testTag("confirm_ot_button")
                ) {
                    Text("Confirm OT Meal", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showOtDialogForMeal = null }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }

    // Gaon / Leave Marking Dialog
    if (showLeaveDialog) {
        var startDay by remember { mutableStateOf("2026-08-24") }
        var endDay by remember { mutableStateOf("2026-08-28") }
        var reason by remember { mutableStateOf("Family / Gaon Visit") }

        AlertDialog(
            onDismissRequest = { showLeaveDialog = false },
            shape = RoundedCornerShape(24.dp),
            containerColor = CleanSurface,
            title = {
                Text("Mark On Leave (छुट्टी / गाँव)", fontWeight = FontWeight.Bold, color = CleanTextPrimary)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "All meals during leave dates are auto-cancelled to guarantee zero waste.",
                        fontSize = 12.sp,
                        color = CleanTextSecondary
                    )
                    OutlinedTextField(
                        value = startDay,
                        onValueChange = { startDay = it },
                        label = { Text("Start Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth().testTag("leave_start_input"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    OutlinedTextField(
                        value = endDay,
                        onValueChange = { endDay = it },
                        label = { Text("End Date (YYYY-MM-DD)") },
                        modifier = Modifier.fillMaxWidth().testTag("leave_end_input"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Reason (कारण)") },
                        modifier = Modifier.fillMaxWidth().testTag("leave_reason_input"),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.markOnLeave(startDay, endDay, reason)
                        showLeaveDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanAlertDarkText, contentColor = Color.White),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.testTag("submit_leave_button")
                ) {
                    Text("Mark On Leave & Lock Meals", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveDialog = false }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }
}

@Composable
fun ShiftSelectChip(
    label: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        color = if (isSelected) CleanPrimaryBlue else CleanSurfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .clickable { onClick() }
            .testTag("shift_chip_$label")
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.padding(vertical = 10.dp)
        ) {
            Text(
                text = label,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                fontSize = 11.sp,
                color = if (isSelected) Color.White else CleanTextPrimary
            )
        }
    }
}

@Composable
fun MealRowItem(
    meal: MealRecord,
    onRequest: () -> Unit,
    onSkip: () -> Unit,
    onOpenOt: () -> Unit
) {
    val (mealIcon, mealTitle, mealSubtitle) = when (meal.mealType) {
        MealType.BREAKFAST -> Triple("🍳", "Breakfast", "Consumed at 08:15 AM")
        MealType.LUNCH -> Triple("🍱", "Lunch (Active)", "Auto-ON: Standard Plate")
        MealType.DINNER -> Triple("🍲", "Dinner", "Unlocks at 04:30 PM")
    }

    val isMealOn = meal.status == MealStatus.ON || meal.status == MealStatus.MEAL_REQUESTED
    val isLunchActive = meal.mealType == MealType.LUNCH

    val containerBg = if (isLunchActive) CleanSurface else CleanSurfaceVariant
    val borderStroke = if (isLunchActive) androidx.compose.foundation.BorderStroke(2.dp, CleanBlueBg) else null

    Surface(
        color = containerBg,
        shape = RoundedCornerShape(18.dp),
        border = borderStroke,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = mealIcon, fontSize = 20.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = mealTitle,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (isLunchActive) CleanPrimaryBlue else CleanTextPrimary
                        )
                        Text(
                            text = mealSubtitle,
                            fontSize = 11.sp,
                            color = CleanTextSecondary
                        )
                    }
                }

                MealStatusChip(status = meal.status)
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (meal.status == MealStatus.ON_LEAVE) {
                    Text(
                        text = "🌴 On Leave (Auto-Locked)",
                        fontSize = 11.sp,
                        color = CleanAlertDarkText,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(4.dp)
                    )
                } else {
                    if (isMealOn) {
                        Button(
                            onClick = onSkip,
                            modifier = Modifier
                                .weight(1f)
                                .height(38.dp)
                                .testTag("skip_${meal.mealType.name}"),
                            colors = ButtonDefaults.buttonColors(containerColor = CleanBlueBg, contentColor = CleanOnPrimaryContainer),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("SKIP MEAL", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = onRequest,
                            modifier = Modifier
                                .weight(1f)
                                .height(38.dp)
                                .testTag("request_${meal.mealType.name}"),
                            colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue, contentColor = Color.White),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("REQUEST MEAL", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    // Overtime Button
                    Surface(
                        color = CleanLilacBg,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(38.dp)
                            .clickable { onOpenOt() }
                            .testTag("ot_${meal.mealType.name}")
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                Icons.Default.AccessTime,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = CleanLilacText
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (meal.overtimeType != OvertimeType.NONE) "OT: ${meal.otHours}h" else "+ OT / LATE",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = CleanLilacText
                            )
                        }
                    }
                }
            }
        }
    }
}

