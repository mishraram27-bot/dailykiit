;(function(){
function formatCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function getCurrentMonthDate(){
  return LifeOSStorage.parseDateKey(LifeOSStorage.todayKey())
}

function isSameMonth(date, baseDate){
  return date.getFullYear() === baseDate.getFullYear() && date.getMonth() === baseDate.getMonth()
}

function getMonthLabel(date){
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(date)
}

function escapeCsvValue(value){
  let stringValue = String(value ?? "")

  if(/^[=+\-@]/.test(stringValue)){
    stringValue = `'${stringValue}`
  }

  const normalized = stringValue.replaceAll('"', '""')
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized
}

function getMonthlyReportData(){
  const today = getCurrentMonthDate()
  const expenses = LifeOSStorage.getExpenses().filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return date && isSameMonth(date, today)
  })
  const borrow = LifeOSStorage.getBorrow().filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return date && isSameMonth(date, today)
  })
  const grocery = LifeOSStorage.getGrocery().filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return date && isSameMonth(date, today)
  })

  const categoryTotals = expenses.reduce((accumulator, entry) => {
    accumulator[entry.category] = (accumulator[entry.category] || 0) + entry.amount
    return accumulator
  }, {})
  const totalExpense = expenses.reduce((sum, entry) => sum + entry.amount, 0)
  const totalBorrow = borrow.reduce((sum, entry) => sum + entry.amount, 0)
  const budget = LifeOSStorage.getBudgetSettings().monthlyBudget
  const topCategory = Object.keys(categoryTotals).sort((left, right) => categoryTotals[right] - categoryTotals[left])[0] || "No data"

  return {
    monthLabel: getMonthLabel(today),
    budget,
    totalExpense,
    totalBorrow,
    groceryCount: grocery.length,
    transactionCount: expenses.length,
    topCategory,
    categoryTotals,
    expenses,
    borrow,
    grocery
  }
}

function buildMonthlyReportCsv(){
  const report = getMonthlyReportData()
  const rows = [
    ["section", "label", "value"],
    ["summary", "Month", report.monthLabel],
    ["summary", "Total Expense", report.totalExpense],
    ["summary", "Budget", report.budget ?? ""],
    ["summary", "Borrow Pending Added", report.totalBorrow],
    ["summary", "Grocery Items Added", report.groceryCount],
    ["summary", "Top Category", report.topCategory]
  ]

  Object.entries(report.categoryTotals).forEach(([category, amount]) => {
    rows.push(["category", category, amount])
  })

  rows.push(["detail", "Type", "Name/Person", "Amount", "Date", "Category"])

  report.expenses.forEach((entry) => {
    rows.push(["expense", entry.name, entry.name, entry.amount, entry.date, entry.category])
  })

  report.borrow.forEach((entry) => {
    rows.push(["borrow", entry.person, entry.person, entry.amount, entry.date, ""])
  })

  report.grocery.forEach((entry) => {
    rows.push(["grocery", entry.name, entry.name, "", entry.date || "", ""])
  })

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n")
}

function downloadMonthlyReport(){
  const csv = buildMonthlyReportCsv()
  const report = getMonthlyReportData()
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"})
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = `life-os-report-${report.monthLabel.replace(/\s+/g, "-").toLowerCase()}.csv`
  link.click()

  URL.revokeObjectURL(url)
  window.LifeOSFeedback?.success("Monthly report downloaded.")
}

window.LifeOSReports = {
  getMonthlyReportData,
  buildMonthlyReportCsv,
  downloadMonthlyReport,
  formatCurrency
}
})()
