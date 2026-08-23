package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.model.*
import com.example.data.repository.HostelRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class AdminUiState(
    val usersList: List<User> = emptyList(),
    val leavesList: List<LeaveRecord> = emptyList(),
    val pendingLeaves: List<LeaveRecord> = emptyList(),
    val currentMonthExpense: MonthlyExpense? = null,
    val monthlyInvoices: List<ResidentInvoice> = emptyList(),
    val totalActiveResidents: Int = 0,
    val totalConsumedPlatesThisMonth: Int = 150,
    val calculatedPlateRate: Double = 48.50,
    val totalMonthBillingAmount: Double = 17148.0,
    val selectedMonthYear: String = HostelRepository.getCurrentMonthString(),
    val isGeneratingBills: Boolean = false,
    val actionMessage: String? = null
)

class AdminViewModel(private val repository: HostelRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(AdminUiState())
    val uiState: StateFlow<AdminUiState> = _uiState.asStateFlow()

    init {
        observeAdminData()
    }

    private fun observeAdminData() {
        val currentMonth = _uiState.value.selectedMonthYear

        viewModelScope.launch {
            repository.allUsers.collect { users ->
                val activeCount = users.count { it.status == UserStatus.ACTIVE && it.role == UserRole.EMPLOYEE }
                _uiState.update {
                    it.copy(
                        usersList = users,
                        totalActiveResidents = activeCount
                    )
                }
            }
        }

        viewModelScope.launch {
            repository.allLeaves.collect { leaves ->
                _uiState.update {
                    it.copy(
                        leavesList = leaves,
                        pendingLeaves = leaves.filter { l -> l.status == LeaveStatus.PENDING }
                    )
                }
            }
        }

        viewModelScope.launch {
            repository.getExpenseForMonth(currentMonth).collect { expense ->
                _uiState.update {
                    it.copy(
                        currentMonthExpense = expense,
                        calculatedPlateRate = expense?.calculatedPlateRate ?: 48.50,
                        totalConsumedPlatesThisMonth = expense?.totalPlatesConsumed ?: 150
                    )
                }
            }
        }

        viewModelScope.launch {
            repository.getInvoicesForMonth(currentMonth).collect { invoices ->
                val sum = invoices.sumOf { it.totalPayable }
                _uiState.update {
                    it.copy(
                        monthlyInvoices = invoices,
                        totalMonthBillingAmount = if (sum > 0) sum else 17148.0
                    )
                }
            }
        }
    }

    /**
     * User Management & Replacement Panel Actions:
     * 1. Replace Manager: Revokes old manager and creates new
     */
    fun replaceManager(newName: String, newMobile: String, room: String = "Office") {
        viewModelScope.launch {
            try {
                val created = repository.replaceManager(newName, newMobile, room)
                _uiState.update {
                    it.copy(actionMessage = "पुराना Manager हटाया गया और नया Manager (${created.name}) सक्रिय हुआ (Manager replaced successfully)")
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(actionMessage = "त्रुटि: ${e.localizedMessage}") }
            }
        }
    }

    /**
     * 2. Instant Access Revoke (Lock / Unlock User)
     */
    fun toggleUserLock(user: User) {
        val newStatus = if (user.status == UserStatus.BLOCKED) UserStatus.ACTIVE else UserStatus.BLOCKED
        viewModelScope.launch {
            repository.updateUserStatus(user.id, newStatus)
            val msg = if (newStatus == UserStatus.BLOCKED) {
                "${user.name} का एक्सेस तत्काल ब्लॉक (Revoke) कर दिया गया है"
            } else {
                "${user.name} का एक्सेस पुनः सक्रिय (Active) कर दिया गया है"
            }
            _uiState.update { it.copy(actionMessage = msg) }
        }
    }

    /**
     * 3. Transfer / Update Employee Room & Shift
     */
    fun transferEmployee(userId: Long, newRoom: String) {
        viewModelScope.launch {
            repository.updateUserRoom(userId, newRoom)
            _uiState.update { it.copy(actionMessage = "कमरा नंबर सफलतापूर्वक बदला गया -> Room $newRoom") }
        }
    }

    /**
     * 4. Enter Grocery & Utility Bills and 1-Click Generate Invoices
     */
    fun generateMonthlyBills(
        groceryCost: Double,
        electricityBill: Double,
        waterBill: Double,
        cookSalary: Double,
        roomRent: Double = 1500.0
    ) {
        val month = _uiState.value.selectedMonthYear
        viewModelScope.launch {
            _uiState.update { it.copy(isGeneratingBills = true) }
            try {
                val (plateRate, invoices) = repository.saveMonthlyExpenseAndGenerateInvoices(
                    monthYear = month,
                    groceryCost = groceryCost,
                    electricityBill = electricityBill,
                    waterBill = waterBill,
                    cookSalary = cookSalary,
                    roomRent = roomRent
                )
                _uiState.update {
                    it.copy(
                        isGeneratingBills = false,
                        calculatedPlateRate = plateRate,
                        monthlyInvoices = invoices,
                        actionMessage = "✅ 1-Click Auto Bill उत्पन्न हुआ! Per Plate Rate: ₹$plateRate, Total Invoices: ${invoices.size}"
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isGeneratingBills = false, actionMessage = "त्रुटि: ${e.localizedMessage}") }
            }
        }
    }

    /**
     * Leave Approval / Rejection
     */
    fun processLeave(leaveId: Long, approve: Boolean) {
        viewModelScope.launch {
            repository.approveLeave(leaveId, approve)
            val msg = if (approve) "Leave स्वीकृत की गई (Leave Approved)" else "Leave अस्वीकृत की गई (Leave Rejected)"
            _uiState.update { it.copy(actionMessage = msg) }
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(actionMessage = null) }
    }
}

class AdminViewModelFactory(private val repository: HostelRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AdminViewModel(repository) as T
    }
}
