/** Returns today's date as YYYY-MM-DD in UTC */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns yesterday's date as YYYY-MM-DD in UTC */
export function yesterdayDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Returns the date 7 days ago as YYYY-MM-DD in UTC */
export function sevenDaysAgoDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}
