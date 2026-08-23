package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class UserRole {
    ADMIN,
    MANAGER,
    EMPLOYEE
}

enum class UserStatus {
    ACTIVE,
    REPLACED,
    BLOCKED
}

enum class ShiftType {
    OFF_DUTY,
    MORNING,
    EVENING,
    NIGHT
}

@Entity(tableName = "users")
data class User(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userIdCode: String, // e.g. "EMP_101", "MGR_01", "ADM_01"
    val name: String,
    val mobile: String,
    val role: UserRole,
    val status: UserStatus = UserStatus.ACTIVE,
    val assignedRoom: String = "101",
    val currentShift: ShiftType = ShiftType.OFF_DUTY,
    val defaultBreakfast: Boolean = true,
    val defaultLunch: Boolean = true,
    val defaultDinner: Boolean = true,
    val createdBy: String = "SYSTEM",
    val createdAt: Long = System.currentTimeMillis(),
    val notes: String = ""
)
