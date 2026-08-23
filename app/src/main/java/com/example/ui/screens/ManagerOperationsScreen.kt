package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MealStatus
import com.example.data.model.ShiftType
import com.example.data.model.User
import com.example.data.model.UserRole
import com.example.ui.components.AppTopBar
import com.example.ui.components.RoleBadge
import com.example.ui.components.ShiftBadge
import com.example.ui.components.StatusBanner
import com.example.ui.theme.*
import com.example.ui.viewmodel.AdminViewModel

@Composable
fun ManagerOperationsScreen(
    viewModel: AdminViewModel,
    onBackClick: () -> Unit,
    onNavigateToKitchen: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    Scaffold(
        containerColor = CleanBackground,
        topBar = {
            AppTopBar(
                title = "Hostel Manager Operations",
                subtitle = "Daily Mess & Shift Roster Control",
                onBackClick = onBackClick,
                actions = {
                    IconButton(onClick = onNavigateToKitchen) {
                        Icon(Icons.Default.SoupKitchen, contentDescription = "Kitchen", tint = CleanPrimaryBlue)
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

            // Operations Header Card
            item {
                Surface(
                    color = CleanDarkCard,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "📋 Manager Daily Desk",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            RoleBadge(role = UserRole.MANAGER)
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Total Hostel Members", color = CleanSurfaceVariant, fontSize = 11.sp)
                                Text("${state.totalActiveResidents} Active", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                            Column {
                                Text("Pending Leave Approvals", color = CleanSurfaceVariant, fontSize = 11.sp)
                                Text("${state.pendingLeaves.size} Requests", color = CleanLilacText, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            }
                        }
                    }
                }
            }

            // Kitchen Quick Access Card
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
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Kitchen Live Counter", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = CleanTextPrimary)
                            Text("रसोईया खुराक टारगेट और टिफिन मॉनिटरिंग", fontSize = 11.sp, color = CleanTextSecondary)
                        }
                        Button(
                            onClick = onNavigateToKitchen,
                            colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.testTag("manager_view_kitchen_button")
                        ) {
                            Text("Open Live Counter", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Pending Leave Approvals
            if (state.pendingLeaves.isNotEmpty()) {
                item {
                    Text(
                        text = "Leave & Gaon Approvals (${state.pendingLeaves.size}):",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = CleanTextPrimary
                    )
                }
                items(state.pendingLeaves) { leave ->
                    Surface(
                        color = CleanSurface,
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(leave.userName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = CleanTextPrimary)
                                Text("${leave.startDate} to ${leave.endDate} (${leave.totalDays} Days) - ${leave.reason}", fontSize = 11.sp, color = CleanTextSecondary)
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

            // Resident Roster List
            item {
                Text(
                    text = "Active Hostel Residents Roster:",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = CleanTextPrimary
                )
            }

            items(state.usersList.filter { it.role == UserRole.EMPLOYEE }) { resident ->
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "${resident.name} (Room ${resident.assignedRoom})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = CleanTextPrimary
                            )
                            Text(
                                text = "ID: ${resident.userIdCode} • ${resident.mobile}",
                                fontSize = 11.sp,
                                color = CleanTextSecondary
                            )
                        }
                        ShiftBadge(shift = resident.currentShift)
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}
