package com.example.data.local

import androidx.room.*
import com.example.data.model.LeaveRecord
import com.example.data.model.LeaveStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface LeaveDao {
    @Query("SELECT * FROM leave_records ORDER BY id DESC")
    fun getAllLeaves(): Flow<List<LeaveRecord>>

    @Query("SELECT * FROM leave_records WHERE userId = :userId ORDER BY id DESC")
    fun getUserLeaves(userId: Long): Flow<List<LeaveRecord>>

    @Query("SELECT * FROM leave_records WHERE status = 'PENDING' ORDER BY id ASC")
    fun getPendingLeaves(): Flow<List<LeaveRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLeave(leave: LeaveRecord): Long

    @Query("UPDATE leave_records SET status = :status WHERE id = :id")
    suspend fun updateLeaveStatus(id: Long, status: LeaveStatus)

    @Query("SELECT * FROM leave_records WHERE userId = :userId AND status = 'APPROVED' AND (startDate <= :date AND endDate >= :date) LIMIT 1")
    suspend fun getActiveLeaveForUser(userId: Long, date: String): LeaveRecord?
}
