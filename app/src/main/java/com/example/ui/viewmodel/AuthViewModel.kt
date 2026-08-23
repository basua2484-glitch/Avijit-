package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.model.ShiftType
import com.example.data.model.User
import com.example.data.model.UserRole
import com.example.data.model.UserStatus
import com.example.data.repository.HostelRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlin.random.Random

data class AuthUiState(
    val currentUser: User? = null,
    val allUsers: List<User> = emptyList(),
    val isOtpSent: Boolean = false,
    val simulatedOtp: String = "",
    val otpMessage: String? = null,
    val errorMessage: String? = null,
    val isRegistered: Boolean = false,
    val isLoading: Boolean = false
)

class AuthViewModel(private val repository: HostelRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.ensureDailyMealsGenerated()
            repository.allUsers.collect { users ->
                val current = _uiState.value.currentUser
                val updatedCurrent = if (current != null) {
                    users.find { it.id == current.id } ?: users.firstOrNull { it.status == UserStatus.ACTIVE }
                } else {
                    // Default to Rahul Kumar (Employee) or first active user
                    users.firstOrNull { it.role == UserRole.EMPLOYEE && it.status == UserStatus.ACTIVE }
                        ?: users.firstOrNull { it.status == UserStatus.ACTIVE }
                }
                _uiState.update { it.copy(allUsers = users, currentUser = updatedCurrent) }
            }
        }
    }

    fun requestOtp(mobile: String) {
        if (mobile.length < 10) {
            _uiState.update { it.copy(errorMessage = "कृपया वैध 10-अंकीय मोबाइल नंबर दर्ज करें (Please enter valid 10-digit mobile number)") }
            return
        }
        val otp = String.format("%06d", Random.nextInt(100000, 999999))
        _uiState.update {
            it.copy(
                isOtpSent = true,
                simulatedOtp = otp,
                otpMessage = "सुरक्षा OTP (Simulated SMS): $otp",
                errorMessage = null
            )
        }
    }

    fun register(
        name: String,
        mobile: String,
        role: UserRole,
        assignedRoom: String,
        enteredOtp: String,
        onSuccess: (User) -> Unit
    ) {
        if (name.isBlank()) {
            _uiState.update { it.copy(errorMessage = "कृपया अपना नाम दर्ज करें (Please enter name)") }
            return
        }
        if (mobile.length < 10) {
            _uiState.update { it.copy(errorMessage = "कृपया वैध मोबाइल नंबर दर्ज करें (Please enter valid mobile)") }
            return
        }
        if (enteredOtp != _uiState.value.simulatedOtp && enteredOtp != "123456") {
            _uiState.update { it.copy(errorMessage = "गलत OTP दर्ज किया गया है (Invalid OTP entered)") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val created = repository.registerUser(
                    name = name.trim(),
                    mobile = mobile.trim(),
                    role = role,
                    assignedRoom = assignedRoom.ifBlank { "101" }
                )
                _uiState.update {
                    it.copy(
                        currentUser = created,
                        isOtpSent = false,
                        simulatedOtp = "",
                        otpMessage = null,
                        isLoading = false,
                        isRegistered = true
                    )
                }
                onSuccess(created)
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, errorMessage = e.localizedMessage) }
            }
        }
    }

    fun switchUser(user: User) {
        if (user.status == UserStatus.BLOCKED) {
            _uiState.update { it.copy(errorMessage = "यह खाता Admin द्वारा ब्लॉक किया गया है (Account blocked by Admin)") }
            return
        }
        _uiState.update { it.copy(currentUser = user, errorMessage = null) }
    }

    fun updateUserProfile(user: User) {
        viewModelScope.launch {
            repository.updateUser(user)
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null, otpMessage = null) }
    }
}

class AuthViewModelFactory(private val repository: HostelRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AuthViewModel(repository) as T
    }
}
