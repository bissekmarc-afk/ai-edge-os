import type {
  UserProfile,
  Task,
  Goal,
  Habit,
  MemoryEntry,
  FinanceEntry,
  GymSession,
  BoxingSession,
  ReadingItem,
  WeeklyReview,
  AICommand,
  SyncStatus,
} from "@/types"

export const mockUserId = "usr_mock_01"

// ─── User ────────────────────────────────────────────────────────────────────

export const mockUserProfile: UserProfile = {
  id: "profile_01",
  userId: mockUserId,
  displayName: "Alex",
  timezone: "Europe/Paris",
  preferredLanguage: "fr",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-05-10T08:00:00.000Z",
  metadata: {},
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export const mockGoals: Goal[] = [
  {
    id: "goal_01",
    userId: mockUserId,
    title: "Lire 24 livres en 2026",
    description: "Objectif de lecture annuel, 2 livres par mois.",
    lifeBlock: "reading",
    status: "active",
    targetDate: "2026-12-31",
    progress: 42,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-15T09:00:00.000Z",
    metadata: {},
  },
  {
    id: "goal_02",
    userId: mockUserId,
    title: "Épargne 20 % du revenu",
    description: "Maintenir un taux d'épargne de 20 % chaque mois.",
    lifeBlock: "finance",
    status: "active",
    targetDate: "2026-12-31",
    progress: 68,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "goal_03",
    userId: mockUserId,
    title: "3 séances de gym par semaine",
    description: "Renforcement musculaire et cardio.",
    lifeBlock: "training",
    status: "active",
    targetDate: "2026-12-31",
    progress: 75,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-16T07:30:00.000Z",
    metadata: {},
  },
  {
    id: "goal_04",
    userId: mockUserId,
    title: "Boxe 2× semaine + sparring mensuel",
    description: "Améliorer technique et conditionnement.",
    lifeBlock: "training",
    status: "active",
    targetDate: "2026-12-31",
    progress: 60,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-05-14T18:00:00.000Z",
    metadata: {},
  },
]

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const mockTasks: Task[] = [
  {
    id: "task_01",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_001",
    title: "Finaliser rapport mensuel Q2",
    description: "Compléter les sections budget et KPI.",
    projectName: "Travail",
    priority: "urgent",
    status: "pending",
    dueDate: "2026-05-17",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-10T09:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_02",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_002",
    title: "Réviser proposition client Acme",
    description: "",
    projectName: "Travail",
    priority: "high",
    status: "pending",
    dueDate: "2026-05-17",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-12T10:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_03",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_003",
    title: "Commander livres Amazon",
    description: "Deep Work + Cal Newport.",
    projectName: "Lecture",
    priority: "medium",
    status: "pending",
    dueDate: "2026-05-17",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-13T08:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_04",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_004",
    title: "Préparer session boxe jeudi",
    description: "Séquences de combinations + défense.",
    projectName: "Sport",
    priority: "medium",
    status: "pending",
    dueDate: "2026-05-17",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-14T08:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_05",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_005",
    title: "Appel hebdo avec mentor",
    description: "",
    projectName: "Personnel",
    priority: "high",
    status: "pending",
    dueDate: "2026-05-17",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-15T09:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_06",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_006",
    title: "Mettre à jour budget mai",
    description: "Catégoriser dépenses semaine.",
    projectName: "Finance",
    priority: "medium",
    status: "pending",
    dueDate: "2026-05-18",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-16T10:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
  {
    id: "task_07",
    userId: mockUserId,
    source: "todoist",
    externalId: "ext_t_007",
    title: "Lire chapitres 8-10 de Atomic Habits",
    description: "",
    projectName: "Lecture",
    priority: "low",
    status: "pending",
    dueDate: "2026-05-20",
    completed: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-16T12:00:00.000Z",
    updatedAt: "2026-05-17T07:00:00.000Z",
    metadata: {},
  },
]

// ─── Habits ──────────────────────────────────────────────────────────────────

export const mockHabits: Habit[] = [
  {
    id: "habit_01",
    userId: mockUserId,
    goalId: "goal_03",
    title: "Séance de gym",
    frequency: "daily",
    targetDay: "",
    currentPeriod: "2026-05-17",
    completed: false,
    streak: 14,
    lastCompletedAt: "2026-05-15T18:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-15T18:00:00.000Z",
    metadata: {},
  },
  {
    id: "habit_02",
    userId: mockUserId,
    goalId: "goal_04",
    title: "Entraînement boxe",
    frequency: "weekly",
    targetDay: "tuesday,thursday",
    currentPeriod: "2026-W20",
    completed: false,
    streak: 8,
    lastCompletedAt: "2026-05-15T19:30:00.000Z",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-05-15T19:30:00.000Z",
    metadata: {},
  },
  {
    id: "habit_03",
    userId: mockUserId,
    goalId: "goal_01",
    title: "30 min de lecture",
    frequency: "daily",
    targetDay: "",
    currentPeriod: "2026-05-17",
    completed: true,
    streak: 21,
    lastCompletedAt: "2026-05-17T06:30:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-05-17T06:30:00.000Z",
    metadata: {},
  },
  {
    id: "habit_04",
    userId: mockUserId,
    goalId: "goal_02",
    title: "Revue budgétaire quotidienne",
    frequency: "daily",
    targetDay: "",
    currentPeriod: "2026-05-17",
    completed: true,
    streak: 30,
    lastCompletedAt: "2026-05-17T07:15:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-05-17T07:15:00.000Z",
    metadata: {},
  },
  {
    id: "habit_05",
    userId: mockUserId,
    goalId: "goal_01",
    title: "Prise de notes / mémoire Claude",
    frequency: "daily",
    targetDay: "",
    currentPeriod: "2026-05-17",
    completed: false,
    streak: 5,
    lastCompletedAt: "2026-05-16T21:00:00.000Z",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-05-16T21:00:00.000Z",
    metadata: {},
  },
  {
    id: "habit_06",
    userId: mockUserId,
    goalId: "goal_03",
    title: "Marche 10 000 pas",
    frequency: "daily",
    targetDay: "",
    currentPeriod: "2026-05-17",
    completed: true,
    streak: 7,
    lastCompletedAt: "2026-05-17T08:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-05-17T08:00:00.000Z",
    metadata: {},
  },
]

// ─── Memory ──────────────────────────────────────────────────────────────────

export const mockMemoryEntries: MemoryEntry[] = [
  {
    id: "mem_01",
    userId: mockUserId,
    title: "Préférence : Deep Work le matin",
    content: "Travail concentré de 8h à 12h, sans notifications. Mails après 14h.",
    category: "productivité",
    sensitivityLevel: "low",
    confidenceScore: 0.95,
    confirmedByUser: true,
    source: "manuel",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "mem_02",
    userId: mockUserId,
    title: "Allergie : lactose en grande quantité",
    content: "Inconfort digestif. Fromages forts à éviter, yaourt OK.",
    category: "santé",
    sensitivityLevel: "medium",
    confidenceScore: 0.9,
    confirmedByUser: true,
    source: "manuel",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-01-20T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "mem_03",
    userId: mockUserId,
    title: "Objectif: lancer side-project d'ici septembre",
    content: "Projet SaaS dans la productivité. Stack : Next.js, Supabase.",
    category: "projets",
    sensitivityLevel: "low",
    confidenceScore: 0.8,
    confirmedByUser: true,
    source: "conversation",
    createdAt: "2026-03-15T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "mem_04",
    userId: mockUserId,
    title: "Mentor : Rémi Dupont",
    content: "CEO d'une startup B2B. Contact LinkedIn. Appel mensuel. Intros réseau.",
    category: "réseau",
    sensitivityLevel: "high",
    confidenceScore: 1.0,
    confirmedByUser: true,
    source: "manuel",
    createdAt: "2026-01-05T00:00:00.000Z",
    updatedAt: "2026-01-05T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "mem_05",
    userId: mockUserId,
    title: "Style d'apprentissage : visuel + pratique",
    content: "Meilleure rétention avec schémas et exercices concrets. Éviter longs textes théoriques.",
    category: "apprentissage",
    sensitivityLevel: "low",
    confidenceScore: 0.85,
    confirmedByUser: false,
    source: "inférence",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    metadata: {},
  },
]

// ─── Finance ─────────────────────────────────────────────────────────────────

export const mockFinanceEntries: FinanceEntry[] = [
  {
    id: "fin_01",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_001",
    date: "2026-05-01",
    category: "revenu",
    label: "Salaire net",
    amount: 3800,
    currency: "EUR",
    entryType: "income",
    isRecurring: true,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_02",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_002",
    date: "2026-05-02",
    category: "logement",
    label: "Loyer",
    amount: -1100,
    currency: "EUR",
    entryType: "expense",
    isRecurring: true,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_03",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_003",
    date: "2026-05-05",
    category: "alimentation",
    label: "Courses Monoprix",
    amount: -87.4,
    currency: "EUR",
    entryType: "expense",
    isRecurring: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_04",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_004",
    date: "2026-05-07",
    category: "sport",
    label: "Abonnement salle",
    amount: -39,
    currency: "EUR",
    entryType: "expense",
    isRecurring: true,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_05",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_005",
    date: "2026-05-10",
    category: "transport",
    label: "Navigo mensuel",
    amount: -86.4,
    currency: "EUR",
    entryType: "expense",
    isRecurring: true,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_06",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_006",
    date: "2026-05-12",
    category: "loisirs",
    label: "Restaurant Chez Pierre",
    amount: -54,
    currency: "EUR",
    entryType: "expense",
    isRecurring: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-12T00:00:00.000Z",
    updatedAt: "2026-05-12T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_07",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_007",
    date: "2026-05-15",
    category: "épargne",
    label: "Virement épargne",
    amount: -760,
    currency: "EUR",
    entryType: "expense",
    isRecurring: true,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-15T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "fin_08",
    userId: mockUserId,
    source: "google_sheets",
    externalId: "gs_row_008",
    date: "2026-05-16",
    category: "alimentation",
    label: "Marché du dimanche",
    amount: -32,
    currency: "EUR",
    entryType: "expense",
    isRecurring: false,
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T06:00:00.000Z",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    metadata: {},
  },
]

// ─── Gym ─────────────────────────────────────────────────────────────────────

export const mockGymSessions: GymSession[] = [
  {
    id: "gym_01",
    userId: mockUserId,
    sessionDate: "2026-05-15",
    focus: "Push — Poitrine / Épaules / Triceps",
    durationMinutes: 60,
    intensity: 8,
    exercises: ["Développé couché", "Élévations latérales", "Dips"],
    recoveryScore: 85,
    notes: "PR sur développé couché : 90 kg × 5.",
    createdAt: "2026-05-15T19:00:00.000Z",
    updatedAt: "2026-05-15T19:00:00.000Z",
    metadata: {},
  },
  {
    id: "gym_02",
    userId: mockUserId,
    sessionDate: "2026-05-13",
    focus: "Pull — Dos / Biceps",
    durationMinutes: 55,
    intensity: 7,
    exercises: ["Tractions lestées", "Rowing barre", "Curl marteau"],
    recoveryScore: 78,
    notes: "",
    createdAt: "2026-05-13T18:30:00.000Z",
    updatedAt: "2026-05-13T18:30:00.000Z",
    metadata: {},
  },
  {
    id: "gym_03",
    userId: mockUserId,
    sessionDate: "2026-05-12",
    focus: "Jambes — Squat / Fessiers",
    durationMinutes: 70,
    intensity: 9,
    exercises: ["Squat", "Leg press", "Hip thrust"],
    recoveryScore: 72,
    notes: "Fatigue post-session élevée.",
    createdAt: "2026-05-12T18:00:00.000Z",
    updatedAt: "2026-05-12T18:00:00.000Z",
    metadata: {},
  },
  {
    id: "gym_04",
    userId: mockUserId,
    sessionDate: "2026-05-10",
    focus: "Push — Variation",
    durationMinutes: 50,
    intensity: 7,
    exercises: ["Développé incliné", "Press Arnold", "Triceps corde"],
    recoveryScore: 88,
    notes: "",
    createdAt: "2026-05-10T17:30:00.000Z",
    updatedAt: "2026-05-10T17:30:00.000Z",
    metadata: {},
  },
  {
    id: "gym_05",
    userId: mockUserId,
    sessionDate: "2026-05-08",
    focus: "Full body — Mobilité",
    durationMinutes: 45,
    intensity: 5,
    exercises: ["Foam rolling", "Hip flexor stretch", "Face pull"],
    recoveryScore: 95,
    notes: "Séance de récupération active.",
    createdAt: "2026-05-08T09:00:00.000Z",
    updatedAt: "2026-05-08T09:00:00.000Z",
    metadata: {},
  },
]

// ─── Boxing ──────────────────────────────────────────────────────────────────

export const mockBoxingSessions: BoxingSession[] = [
  {
    id: "box_01",
    userId: mockUserId,
    sessionDate: "2026-05-15",
    focus: "Technique combinaisons",
    durationMinutes: 75,
    rounds: 8,
    intensity: 8,
    techniqueFocus: ["Jab-cross-hook", "Défense slip"],
    conditioningScore: 82,
    notes: "Bonne fluidité sur les combinaisons 1-2.",
    createdAt: "2026-05-15T20:00:00.000Z",
    updatedAt: "2026-05-15T20:00:00.000Z",
    metadata: {},
  },
  {
    id: "box_02",
    userId: mockUserId,
    sessionDate: "2026-05-13",
    focus: "Conditionnement",
    durationMinutes: 60,
    rounds: 6,
    intensity: 9,
    techniqueFocus: ["Cardio boxe", "Shadow boxing"],
    conditioningScore: 88,
    notes: "6 rounds non-stop. Record personnel.",
    createdAt: "2026-05-13T20:30:00.000Z",
    updatedAt: "2026-05-13T20:30:00.000Z",
    metadata: {},
  },
  {
    id: "box_03",
    userId: mockUserId,
    sessionDate: "2026-05-08",
    focus: "Sparring doux",
    durationMinutes: 90,
    rounds: 5,
    intensity: 7,
    techniqueFocus: ["Contrôle distance", "Uppercut"],
    conditioningScore: 75,
    notes: "Premier sparring du mois. Gestion de la distance à améliorer.",
    createdAt: "2026-05-08T20:00:00.000Z",
    updatedAt: "2026-05-08T20:00:00.000Z",
    metadata: {},
  },
  {
    id: "box_04",
    userId: mockUserId,
    sessionDate: "2026-05-06",
    focus: "Technique défensive",
    durationMinutes: 60,
    rounds: 6,
    intensity: 6,
    techniqueFocus: ["Bob & weave", "Parry"],
    conditioningScore: 80,
    notes: "",
    createdAt: "2026-05-06T19:30:00.000Z",
    updatedAt: "2026-05-06T19:30:00.000Z",
    metadata: {},
  },
]

// ─── Reading ─────────────────────────────────────────────────────────────────

export const mockReadingItems: ReadingItem[] = [
  {
    id: "read_01",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_001",
    title: "Atomic Habits",
    author: "James Clear",
    status: "reading",
    progress: 65,
    url: "",
    notes: "Concept des systèmes vs objectifs. Loi 1% très actionnable.",
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-17T06:30:00.000Z",
    metadata: {},
  },
  {
    id: "read_02",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_002",
    title: "Deep Work",
    author: "Cal Newport",
    status: "to_read",
    progress: 0,
    url: "",
    notes: "",
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "read_03",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_003",
    title: "Zero to One",
    author: "Peter Thiel",
    status: "completed",
    progress: 100,
    url: "",
    notes: "Secrètes des startups : trouver ce que les autres ne voient pas.",
    syncStatus: "success",
    lastSyncedAt: "2026-05-10T07:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-05-10T22:00:00.000Z",
    metadata: {},
  },
  {
    id: "read_04",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_004",
    title: "The Mom Test",
    author: "Rob Fitzpatrick",
    status: "completed",
    progress: 100,
    url: "",
    notes: "Comment valider une idée sans se faire mentir.",
    syncStatus: "success",
    lastSyncedAt: "2026-04-20T07:00:00.000Z",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    metadata: {},
  },
  {
    id: "read_05",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_005",
    title: "Thinking in Systems",
    author: "Donella Meadows",
    status: "reading",
    progress: 30,
    url: "",
    notes: "Boucles de feedback et leviers de changement.",
    syncStatus: "success",
    lastSyncedAt: "2026-05-17T07:00:00.000Z",
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-05-16T22:00:00.000Z",
    metadata: {},
  },
  {
    id: "read_06",
    userId: mockUserId,
    source: "notion",
    externalId: "ntn_book_006",
    title: "Ikigai",
    author: "Héctor García",
    status: "to_read",
    progress: 0,
    url: "",
    notes: "",
    syncStatus: "success",
    lastSyncedAt: "2026-05-05T07:00:00.000Z",
    createdAt: "2026-05-05T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z",
    metadata: {},
  },
]

// ─── Weekly Reviews ──────────────────────────────────────────────────────────

export const mockWeeklyReviews: WeeklyReview[] = [
  {
    id: "review_01",
    userId: mockUserId,
    weekStart: "2026-05-11",
    weekEnd: "2026-05-17",
    wins: [
      "PR sur développé couché : 90 kg",
      "6 rounds non-stop en boxe",
      "Lecture quotidienne maintenue 7/7",
    ],
    blockers: [
      "Rapport Q2 en retard d'un jour",
      "Moins de temps pour side-project",
    ],
    nextWeekFocus: [
      "Finaliser rapport Q2",
      "Session sparring boxe",
      "Avancer chapitre 10 Atomic Habits",
    ],
    aiSummary: "Semaine sportive excellente. Productivité légèrement en retrait sur le travail professionnel. Bonne continuité sur les habitudes.",
    completed: false,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-16T21:00:00.000Z",
    metadata: {},
  },
  {
    id: "review_02",
    userId: mockUserId,
    weekStart: "2026-05-04",
    weekEnd: "2026-05-10",
    wins: [
      "Sparring premier du mois",
      "Terminé Zero to One",
      "Budget mai en avance",
    ],
    blockers: ["Fatigue post-jambes : récupération longue"],
    nextWeekFocus: ["Maintenir streak lecture", "Push PR développé couché"],
    aiSummary: "Semaine équilibrée. Objectif lecture atteint. Finance bien maîtrisée.",
    completed: true,
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-10T21:00:00.000Z",
    metadata: {},
  },
]

// ─── AI Commands ─────────────────────────────────────────────────────────────

export const mockAICommands: AICommand[] = [
  {
    id: "cmd_01",
    label: "Brief du jour",
    prompt: "Donne-moi un résumé de mes priorités pour aujourd'hui.",
    scope: "dashboard",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cmd_02",
    label: "Revue semaine",
    prompt: "Aide-moi à faire ma revue de la semaine.",
    scope: "dashboard",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cmd_03",
    label: "Optimiser budget",
    prompt: "Analyse mes dépenses ce mois et suggère des optimisations.",
    scope: "finance",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cmd_04",
    label: "Plan d'entraînement",
    prompt: "Génère mon plan de la semaine pour gym et boxe.",
    scope: "training",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cmd_05",
    label: "Résumé lecture",
    prompt: "Résume les points clés de mes lectures en cours.",
    scope: "reading",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getTodayTasks(): Task[] {
  return mockTasks.filter((t) => t.dueDate === "2026-05-17" && !t.completed)
}

export function getTopTasks(limit = 5): Task[] {
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  }
  return [...mockTasks]
    .filter((t) => !t.completed)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, limit)
}

interface BudgetSummary {
  income: number
  expenses: number
  balance: number
  currency: string
  entriesCount: number
}

export function getMonthlyBudgetSummary(): BudgetSummary {
  const income = mockFinanceEntries
    .filter((e) => e.entryType === "income")
    .reduce((sum, e) => sum + e.amount, 0)
  const expenses = mockFinanceEntries
    .filter((e) => e.entryType === "expense")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0)
  return {
    income,
    expenses,
    balance: income - expenses,
    currency: "EUR",
    entriesCount: mockFinanceEntries.length,
  }
}

interface TrainingSummary {
  gymSessions: number
  boxingSessions: number
  totalMinutes: number
  lastSession: string
}

export function getTrainingSummary(): TrainingSummary {
  const totalGymMin = mockGymSessions.reduce((s, g) => s + g.durationMinutes, 0)
  const totalBoxMin = mockBoxingSessions.reduce((s, b) => s + b.durationMinutes, 0)
  const lastGym = mockGymSessions[0]?.sessionDate ?? ""
  const lastBox = mockBoxingSessions[0]?.sessionDate ?? ""
  const lastSession = lastGym > lastBox ? lastGym : lastBox
  return {
    gymSessions: mockGymSessions.length,
    boxingSessions: mockBoxingSessions.length,
    totalMinutes: totalGymMin + totalBoxMin,
    lastSession,
  }
}

interface ReadingSummary {
  total: number
  reading: number
  completed: number
  avgProgress: number
}

export function getReadingSummary(): ReadingSummary {
  const reading = mockReadingItems.filter((r) => r.status === "reading")
  const completed = mockReadingItems.filter((r) => r.status === "completed")
  const avgProgress =
    reading.length > 0
      ? Math.round(reading.reduce((s, r) => s + r.progress, 0) / reading.length)
      : 0
  return {
    total: mockReadingItems.length,
    reading: reading.length,
    completed: completed.length,
    avgProgress,
  }
}

interface MemorySummary {
  total: number
  confirmed: number
  categories: string[]
}

export function getMemorySummary(): MemorySummary {
  const confirmed = mockMemoryEntries.filter((m) => m.confirmedByUser)
  const categories = [...new Set(mockMemoryEntries.map((m) => m.category))]
  return {
    total: mockMemoryEntries.length,
    confirmed: confirmed.length,
    categories,
  }
}

interface HabitSummary {
  total: number
  completedToday: number
  bestStreak: number
}

export function getHabitSummary(): HabitSummary {
  const completedToday = mockHabits.filter((h) => h.completed).length
  const bestStreak = Math.max(...mockHabits.map((h) => h.streak))
  return {
    total: mockHabits.length,
    completedToday,
    bestStreak,
  }
}

interface SyncActivity {
  source: string
  status: SyncStatus
  lastSyncedAt: string
  label: string
}

export function getSyncActivity(): SyncActivity[] {
  return [
    {
      source: "todoist",
      status: "success",
      lastSyncedAt: "2026-05-17T07:00:00.000Z",
      label: "Todoist",
    },
    {
      source: "google_sheets",
      status: "success",
      lastSyncedAt: "2026-05-17T06:00:00.000Z",
      label: "Google Sheets",
    },
    {
      source: "notion",
      status: "success",
      lastSyncedAt: "2026-05-17T07:00:00.000Z",
      label: "Notion (lectures)",
    },
    {
      source: "supabase",
      status: "idle",
      lastSyncedAt: "2026-05-16T23:00:00.000Z",
      label: "Supabase mémoire",
    },
    {
      source: "claude",
      status: "idle",
      lastSyncedAt: "2026-05-16T22:00:00.000Z",
      label: "Claude API",
    },
  ]
}
