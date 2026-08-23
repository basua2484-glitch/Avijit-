package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class LeaveStatus {
    PENDING,
    APPROVED,
    REJECTED
}

@Entity(tableName = "leave_records")
data class LeaveRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: Long,
    val userCode: String,
    val userName: String,
    val startDate: String, // YYYY-MM-DD
    val endDate: String,   // YYYY-MM-DD
    val totalDays: Int,
    val reason: String = "Gaon / Leave",
    val status: LeaveStatus = LeaveStatus.APPROVED,
    val createdAt: Long = System.currentTimeMillis()
)
