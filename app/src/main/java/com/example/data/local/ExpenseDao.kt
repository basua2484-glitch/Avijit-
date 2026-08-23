package com.example.data.local

import androidx.room.*
import com.example.data.model.MonthlyExpense
import com.example.data.model.ResidentInvoice
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM monthly_expenses WHERE monthYear = :monthYear LIMIT 1")
    fun getExpenseForMonth(monthYear: String): Flow<MonthlyExpense?>

    @Query("SELECT * FROM monthly_expenses WHERE monthYear = :monthYear LIMIT 1")
    suspend fun getExpenseForMonthOnce(monthYear: String): MonthlyExpense?

    @Query("SELECT * FROM monthly_expenses ORDER BY monthYear DESC")
    fun getAllExpenses(): Flow<List<MonthlyExpense>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdateExpense(expense: MonthlyExpense): Long
}

@Dao
interface InvoiceDao {
    @Query("SELECT * FROM resident_invoices WHERE monthYear = :monthYear ORDER BY roomNumber ASC")
    fun getInvoicesForMonth(monthYear: String): Flow<List<ResidentInvoice>>

    @Query("SELECT * FROM resident_invoices WHERE userId = :userId ORDER BY monthYear DESC")
    fun getUserInvoices(userId: Long): Flow<List<ResidentInvoice>>

    @Query("SELECT * FROM resident_invoices WHERE userId = :userId AND monthYear = :monthYear LIMIT 1")
    fun getUserInvoiceForMonth(userId: Long, monthYear: String): Flow<ResidentInvoice?>

    @Query("SELECT * FROM resident_invoices WHERE userId = :userId AND monthYear = :monthYear LIMIT 1")
    suspend fun getUserInvoiceForMonthOnce(userId: Long, monthYear: String): ResidentInvoice?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoices(invoices: List<ResidentInvoice>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertInvoice(invoice: ResidentInvoice): Long

    @Query("UPDATE resident_invoices SET isPaid = :isPaid, paymentMode = :paymentMode, paymentDate = :paymentDate WHERE id = :invoiceId")
    suspend fun updatePaymentStatus(invoiceId: Long, isPaid: Boolean, paymentMode: String, paymentDate: Long?)

    @Query("DELETE FROM resident_invoices WHERE monthYear = :monthYear")
    suspend fun deleteInvoicesForMonth(monthYear: String)
}
