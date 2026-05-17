export type SyncStatus = "idle" | "pending" | "syncing" | "success" | "error"
export type Priority = "low" | "medium" | "high" | "urgent"
export type SensitivityLevel = "low" | "medium" | "high"
export type LifeBlockType = "reading" | "finance" | "training" | "memory" | "tasks"
export type HabitFrequency = "daily" | "weekly" | "custom"

export interface UserProfile {
  id: string
  userId: string
  displayName: string
  timezone: string
  preferredLanguage: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface MemoryEntry {
  id: string
  userId: string
  title: string
  content: string
  category: string
  sensitivityLevel: SensitivityLevel
  confidenceScore: number
  confirmedByUser: boolean
  source: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface Task {
  id: string
  userId: string
  source: string
  externalId: string
  title: string
  description: string
  projectName: string
  priority: Priority
  status: string
  dueDate: string
  completed: boolean
  syncStatus: SyncStatus
  lastSyncedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface Goal {
  id: string
  userId: string
  title: string
  description: string
  lifeBlock: LifeBlockType
  status: string
  targetDate: string
  progress: number
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface Habit {
  id: string
  userId: string
  goalId: string
  title: string
  frequency: HabitFrequency
  targetDay: string
  currentPeriod: string
  completed: boolean
  streak: number
  lastCompletedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface ReadingItem {
  id: string
  userId: string
  source: string
  externalId: string
  title: string
  author: string
  status: string
  progress: number
  url: string
  notes: string
  syncStatus: SyncStatus
  lastSyncedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface FinanceEntry {
  id: string
  userId: string
  source: string
  externalId: string
  date: string
  category: string
  label: string
  amount: number
  currency: string
  entryType: string
  isRecurring: boolean
  syncStatus: SyncStatus
  lastSyncedAt: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface GymSession {
  id: string
  userId: string
  sessionDate: string
  focus: string
  durationMinutes: number
  intensity: number
  exercises: string[]
  recoveryScore: number
  notes: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface BoxingSession {
  id: string
  userId: string
  sessionDate: string
  focus: string
  durationMinutes: number
  rounds: number
  intensity: number
  techniqueFocus: string[]
  conditioningScore: number
  notes: string
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface WeeklyReview {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  wins: string[]
  blockers: string[]
  nextWeekFocus: string[]
  aiSummary: string
  completed: boolean
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export interface AICommand {
  id: string
  label: string
  prompt: string
  scope: string
  createdAt: string
}
