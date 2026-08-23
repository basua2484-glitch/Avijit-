package com.example.data.local

import androidx.room.*
import com.example.data.model.ShiftType
import com.example.data.model.User
import com.example.data.model.UserRole
import com.example.data.model.UserStatus
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Query("SELECT * FROM users ORDER BY id ASC")
    fun getAllUsers(): Flow<List<User>>

    @Query("SELECT * FROM users WHERE status != 'BLOCKED' ORDER BY id ASC")
    fun getActiveUsers(): Flow<List<User>>

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    fun getUserById(id: Long): Flow<User?>

    @Query("SELECT * FROM users WHERE id = :id LIMIT 1")
    suspend fun getUserByIdOnce(id: Long): User?

    @Query("SELECT * FROM users WHERE mobile = :mobile LIMIT 1")
    suspend fun getUserByMobile(mobile: String): User?

    @Query("SELECT * FROM users WHERE role = :role AND status = 'ACTIVE'")
    fun getUsersByRole(role: UserRole): Flow<List<User>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: User): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUsers(users: List<User>)

    @Update
    suspend fun updateUser(user: User)

    @Query("UPDATE users SET status = :status WHERE id = :userId")
    suspend fun updateUserStatus(userId: Long, status: UserStatus)

    @Query("UPDATE users SET currentShift = :shift WHERE id = :userId")
    suspend fun updateUserShift(userId: Long, shift: ShiftType)

    @Query("UPDATE users SET assignedRoom = :room WHERE id = :userId")
    suspend fun updateUserRoom(userId: Long, room: String)

    @Query("UPDATE users SET status = 'REPLACED' WHERE role = :role AND status = 'ACTIVE'")
    suspend fun revokeExistingRole(role: UserRole)

    @Query("DELETE FROM users WHERE id = :userId")
    suspend fun deleteUser(userId: Long)

    @Query("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE' AND role = 'EMPLOYEE'")
    fun getActiveEmployeeCount(): Flow<Int>
}
