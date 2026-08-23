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
import com.example.ui.components.RoleBadge
import com.example.ui.components.StatusBanner
import com.example.ui.theme.*
import com.example.ui.viewmodel.AuthUiState
import com.example.ui.viewmodel.AuthViewModel

@Composable
fun AuthScreen(
    viewModel: AuthViewModel,
    onNavigateToHome: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()

    var isRegisterMode by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var mobile by remember { mutableStateOf("") }
    var roomNumber by remember { mutableStateOf("204") }
    var selectedRole by remember { mutableStateOf(UserRole.EMPLOYEE) }
    var enteredOtp by remember { mutableStateOf("") }

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
                        .padding(horizontal = 20.dp, vertical = 20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            color = CleanBlueBg,
                            shape = CircleShape,
                            modifier = Modifier.size(48.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Restaurant,
                                    contentDescription = null,
                                    tint = CleanPrimaryBlue,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(
                                text = "Hostel Mess & Shift Portal",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = CleanTextPrimary
                            )
                            Text(
                                text = "Multi-Role RBAC & Zero Wastage System",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = CleanTextSecondary
                            )
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(2.dp))
                StatusBanner(
                    message = state.errorMessage ?: state.otpMessage,
                    isError = state.errorMessage != null,
                    onDismiss = { viewModel.clearError() }
                )
            }

            // Quick Profile Switcher Card (for effortless multi-role testing & login)
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
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.SupervisorAccount,
                                    contentDescription = null,
                                    tint = CleanPrimaryBlue
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Select / Switch Account",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = CleanTextPrimary
                                )
                            }
                            TextButton(
                                onClick = { isRegisterMode = !isRegisterMode },
                                modifier = Modifier.testTag("toggle_register_button")
                            ) {
                                Text(
                                    text = if (isRegisterMode) "Cancel" else "+ New User",
                                    color = CleanPrimaryBlue,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Text(
                            text = "Admin, Hostel Manager, ya Employee kisi bhi account me 1-click login karein:",
                            fontSize = 12.sp,
                            color = CleanTextSecondary,
                            modifier = Modifier.padding(vertical = 6.dp)
                        )

                        state.allUsers.forEach { user ->
                            val isSelected = state.currentUser?.id == user.id
                            Surface(
                                color = if (isSelected) CleanBlueBg.copy(alpha = 0.5f) else CleanSurfaceVariant,
                                shape = RoundedCornerShape(14.dp),
                                border = if (isSelected) androidx.compose.foundation.BorderStroke(1.5.dp, CleanPrimaryBlue) else null,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clickable {
                                        viewModel.switchUser(user)
                                        onNavigateToHome()
                                    }
                                    .testTag("user_item_${user.userIdCode}")
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = user.name,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                                color = CleanTextPrimary
                                            )
                                            if (user.status == UserStatus.BLOCKED) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "🚫 BLOCKED",
                                                    color = CleanAlertDarkText,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                        Text(
                                            text = "ID: ${user.userIdCode} • Room: ${user.assignedRoom} • ${user.mobile}",
                                            fontSize = 11.sp,
                                            color = CleanTextSecondary
                                        )
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        RoleBadge(role = user.role)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Icon(
                                            imageVector = Icons.Default.ArrowForwardIos,
                                            contentDescription = null,
                                            modifier = Modifier.size(14.dp),
                                            tint = CleanTextSecondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // New Registration Form Card
            if (isRegisterMode) {
                item {
                    Surface(
                        color = CleanSurface,
                        shape = RoundedCornerShape(24.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "New Registration (नया पंजीकरण)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = CleanTextPrimary
                            )
                            Text(
                                text = "नाम, मोबाइल नंबर, OTP और अपनी Role (भूमिका) का चयन करें:",
                                fontSize = 12.sp,
                                color = CleanTextSecondary
                            )

                            // Name
                            OutlinedTextField(
                                value = name,
                                onValueChange = { name = it },
                                label = { Text("Full Name (पूरा नाम)") },
                                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = CleanPrimaryBlue) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("input_name"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )

                            // Mobile
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                OutlinedTextField(
                                    value = mobile,
                                    onValueChange = { if (it.length <= 10) mobile = it },
                                    label = { Text("Mobile No.") },
                                    leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = CleanPrimaryBlue) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                    modifier = Modifier
                                        .weight(1f)
                                        .testTag("input_mobile"),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Button(
                                    onClick = { viewModel.requestOtp(mobile) },
                                    enabled = mobile.length >= 10,
                                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.testTag("send_otp_button")
                                ) {
                                    Text("Send OTP", fontWeight = FontWeight.Bold)
                                }
                            }

                            // OTP Input & Auto-fill helper
                            if (state.isOtpSent) {
                                Surface(
                                    color = CleanBlueBg,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "📩 OTP: ${state.simulatedOtp}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = CleanOnPrimaryContainer
                                        )
                                        TextButton(
                                            onClick = { enteredOtp = state.simulatedOtp },
                                            modifier = Modifier.testTag("autofill_otp_button")
                                        ) {
                                            Text("Auto-Fill OTP", color = CleanPrimaryBlue, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = enteredOtp,
                                    onValueChange = { if (it.length <= 6) enteredOtp = it },
                                    label = { Text("Enter 6-Digit OTP") },
                                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = CleanPrimaryBlue) },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("input_otp"),
                                    singleLine = true,
                                    shape = RoundedCornerShape(12.dp)
                                )
                            }

                            // Role Selection (3 Options)
                            Text(
                                text = "Select System Role (अपनी भूमिका चुनें):",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp,
                                color = CleanTextPrimary
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                RoleSelectionChip(
                                    title = "Admin",
                                    subtitle = "Super Access",
                                    isSelected = selectedRole == UserRole.ADMIN,
                                    modifier = Modifier.weight(1f),
                                    onClick = { selectedRole = UserRole.ADMIN }
                                )
                                RoleSelectionChip(
                                    title = "Manager",
                                    subtitle = "Operations/Mess",
                                    isSelected = selectedRole == UserRole.MANAGER,
                                    modifier = Modifier.weight(1f),
                                    onClick = { selectedRole = UserRole.MANAGER }
                                )
                                RoleSelectionChip(
                                    title = "Employee",
                                    subtitle = "Resident/Shift",
                                    isSelected = selectedRole == UserRole.EMPLOYEE,
                                    modifier = Modifier.weight(1f),
                                    onClick = { selectedRole = UserRole.EMPLOYEE }
                                )
                            }

                            // Assigned Room Number
                            OutlinedTextField(
                                value = roomNumber,
                                onValueChange = { roomNumber = it },
                                label = { Text("Assigned Room / Office No.") },
                                leadingIcon = { Icon(Icons.Default.MeetingRoom, contentDescription = null, tint = CleanPrimaryBlue) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("input_room"),
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp)
                            )

                            // Submit Registration Button
                            Button(
                                onClick = {
                                    viewModel.register(
                                        name = name,
                                        mobile = mobile,
                                        role = selectedRole,
                                        assignedRoom = roomNumber,
                                        enteredOtp = enteredOtp,
                                        onSuccess = { onNavigateToHome() }
                                    )
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .testTag("submit_registration_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                if (state.isLoading) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                                } else {
                                    Text("Complete Registration & Enter App", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun RoleSelectionChip(
    title: String,
    subtitle: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        color = if (isSelected) CleanPrimaryBlue else CleanSurfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .clickable { onClick() }
            .testTag("role_chip_$title")
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = if (isSelected) Color.White else CleanTextPrimary
            )
            Text(
                text = subtitle,
                fontSize = 9.sp,
                color = if (isSelected) CleanBlueBg else CleanTextSecondary
            )
        }
    }
}

