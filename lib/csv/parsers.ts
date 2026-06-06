// ── lib/csv/parsers.ts ────────────────────────────────────────────────────────
//
// Parse les deux formats CSV Société Générale :
//   • Carte   : carte_XXXX_*.csv  — UTF-8,   sep=';'
//   • Compte  : XXXXXXXXX_*.csv   — latin-1, sep=';'

export type CsvType = "carte" | "compte"

export interface ParsedTransaction {
  date:          string        // YYYY-MM-DD
  label:         string
  /** Signé : négatif = débit/dépense, positif = crédit/entrée */
  amount:        number
  categoryBank:  string | null // Catégorie SG (Carte uniquement)
  subCategory:   string | null // Sous-catégorie SG (Carte uniquement)
  typeOperation: string | null // Type d'opération (Compte uniquement)
  excluded:      boolean
  excludeReason: string | null
}

export interface ParseResult {
  type:         CsvType
  transactions: ParsedTransaction[]
  rowsParsed:   number
  rowsSkipped:  number
  rowsExcluded: number
  errors:       string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse un montant FR : "-165,00" → -165  |  "500,00" → 500  |  "-" → null */
function parseFrenchAmount(raw: string | undefined): number | null {
  const s = raw?.trim()
  if (!s || s === "-" || s === "") return null
  const cleaned = s.replace(/,/g, ".").replace(/\s/g, "").replace(/\+/g, "")
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Parse une date FR : "30/05/2026" → "2026-05-30" */
function parseFrenchDate(raw: string | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** Normalise un nom de colonne pour comparaison robuste */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}

/** Trouve l'index de la première colonne dont le header normalisé inclut `needle` */
function findCol(headers: string[], needle: string): number {
  return headers.findIndex(h => h.includes(needle))
}

// ─── Parser Carte (UTF-8) ──────────────────────────────────────────────────────
//
// Colonnes : Date de comptabilisation | Libelle simplifie | Debit | Credit |
//            Categorie | Sous categorie
// Première ligne peut être "sep=;" — à ignorer.

function parseCarte(text: string): ParseResult {
  const rawLines = text.split(/\r?\n/)

  // Ignorer la ligne "sep=;" si présente
  const startIdx    = rawLines[0]?.trim().toLowerCase().startsWith("sep") ? 1 : 0
  const headerLine  = rawLines[startIdx]
  if (!headerLine) {
    return { type: "carte", transactions: [], rowsParsed: 0, rowsSkipped: 0, rowsExcluded: 0, errors: ["Fichier vide"] }
  }

  const headers    = headerLine.split(";").map(normalizeHeader)
  const colDate    = findCol(headers, "date")
  const colLabel   = findCol(headers, "libel")
  const colDebit   = findCol(headers, "debit")
  const colCredit  = findCol(headers, "credit")
  const colCat     = findCol(headers, "categorie") !== -1
    ? headers.findIndex(h => h === "categorie")
    : findCol(headers, "cat")
  const colSubCat  = findCol(headers, "sous")

  const errors: string[] = []
  if (colDate === -1 || colLabel === -1) {
    errors.push(`Colonnes Date/Libellé introuvables. Headers : ${headers.join(" | ")}`)
    return { type: "carte", transactions: [], rowsParsed: 0, rowsSkipped: 0, rowsExcluded: 0, errors }
  }

  const transactions: ParsedTransaction[] = []
  let rowsSkipped  = 0

  for (let i = startIdx + 1; i < rawLines.length; i++) {
    const raw = rawLines[i].trim()
    if (!raw) { rowsSkipped++; continue }

    const cols  = raw.split(";")
    const date  = parseFrenchDate(cols[colDate])
    const label = cols[colLabel]?.trim() ?? ""

    if (!date)  { errors.push(`Ligne ${i + 1} : date invalide "${cols[colDate]}"`); rowsSkipped++; continue }
    if (!label) { rowsSkipped++; continue }

    const debit  = parseFrenchAmount(cols[colDebit])
    const credit = parseFrenchAmount(cols[colCredit])

    if (debit === null && credit === null) { rowsSkipped++; continue }

    // Priorité débit. Les deux cas produisent un montant signé.
    const amount = debit !== null ? debit : credit!   // débit est déjà négatif dans le CSV

    transactions.push({
      date,
      label,
      amount,
      categoryBank:  colCat    !== -1 ? (cols[colCat]?.trim()    || null) : null,
      subCategory:   colSubCat !== -1 ? (cols[colSubCat]?.trim() || null) : null,
      typeOperation: "Carte bancaire",
      excluded:      false,
      excludeReason: null,
    })
  }

  return {
    type: "carte",
    transactions,
    rowsParsed:   transactions.length,
    rowsSkipped,
    rowsExcluded: 0,
    errors,
  }
}

// ─── Parser Compte courant (latin-1) ──────────────────────────────────────────
//
// Règles d'exclusion :
//   1. label contient "DEBIT DIFFERE" (insensible à la casse)
//   2. typeOperation === "Carte bancaire" (déjà dans le relevé carte)
// Types conservés : Virement, Prélèvement, Virement reçu, Retrait, Frais bancaires, Prêt

const COMPTE_EXCLUDED_LABELS   = ["debit differe"]
const COMPTE_EXCLUDED_TYPE_OPS = ["carte bancaire"]

function parseCompte(text: string): ParseResult {
  const rawLines = text.split(/\r?\n/)

  const startIdx   = rawLines[0]?.trim().toLowerCase().startsWith("sep") ? 1 : 0
  const headerLine = rawLines[startIdx]
  if (!headerLine) {
    return { type: "compte", transactions: [], rowsParsed: 0, rowsSkipped: 0, rowsExcluded: 0, errors: ["Fichier vide"] }
  }

  const headers   = headerLine.split(";").map(normalizeHeader)
  const colDate   = findCol(headers, "date")
  const colLabel  = findCol(headers, "libel")
  const colDebit  = findCol(headers, "debit")
  const colCredit = findCol(headers, "credit")
  // Type d'opération : chercher "type" ou "operation"
  const colType   = (() => {
    const t = findCol(headers, "type")
    if (t !== -1) return t
    return findCol(headers, "operation")
  })()

  const errors: string[] = []
  if (colDate === -1 || colLabel === -1) {
    errors.push(`Colonnes Date/Libellé introuvables. Headers : ${headers.join(" | ")}`)
    return { type: "compte", transactions: [], rowsParsed: 0, rowsSkipped: 0, rowsExcluded: 0, errors }
  }

  const transactions: ParsedTransaction[] = []
  let rowsSkipped  = 0
  let rowsExcluded = 0

  for (let i = startIdx + 1; i < rawLines.length; i++) {
    const raw = rawLines[i].trim()
    if (!raw) { rowsSkipped++; continue }

    const cols      = raw.split(";")
    const date      = parseFrenchDate(cols[colDate])
    const label     = cols[colLabel]?.trim() ?? ""
    const typeOp    = colType !== -1 ? (cols[colType]?.trim() || null) : null
    const labelLow  = label.toLowerCase()
    const typeOpLow = (typeOp ?? "").toLowerCase()

    if (!date)  { errors.push(`Ligne ${i + 1} : date invalide "${cols[colDate]}"`); rowsSkipped++; continue }
    if (!label) { rowsSkipped++; continue }

    // Règle 1 : exclure DEBIT DIFFERE dans le libellé
    if (COMPTE_EXCLUDED_LABELS.some(excl => labelLow.includes(excl))) {
      rowsExcluded++
      transactions.push({
        date, label, amount: 0, categoryBank: null, subCategory: null, typeOperation: typeOp,
        excluded: true, excludeReason: "DEBIT DIFFERE",
      })
      continue
    }

    // Règle 2 : exclure Carte bancaire (déjà dans le relevé carte)
    if (COMPTE_EXCLUDED_TYPE_OPS.some(excl => typeOpLow.includes(excl))) {
      rowsExcluded++
      transactions.push({
        date, label, amount: 0, categoryBank: null, subCategory: null, typeOperation: typeOp,
        excluded: true, excludeReason: "Carte bancaire (déjà dans relevé carte)",
      })
      continue
    }

    const debit  = parseFrenchAmount(cols[colDebit])
    const credit = parseFrenchAmount(cols[colCredit])

    if (debit === null && credit === null) { rowsSkipped++; continue }

    const amount = debit !== null ? debit : credit!

    transactions.push({
      date, label, amount,
      categoryBank:  null,
      subCategory:   null,
      typeOperation: typeOp,
      excluded:      false,
      excludeReason: null,
    })
  }

  return {
    type: "compte",
    transactions,
    rowsParsed:   transactions.filter(t => !t.excluded).length,
    rowsSkipped,
    rowsExcluded,
    errors,
  }
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────

/**
 * Détecte le type (Carte / Compte) depuis le filename + headers,
 * décode avec le bon charset et retourne un ParseResult.
 */
export function parseCSV(buffer: ArrayBuffer, filename: string): ParseResult {
  const filenameLow = filename.toLowerCase()

  // ── Détection prioritaire par nom de fichier ──────────────────────────────
  //
  // Carte     : carte_XXXX_*.csv  → commence toujours par "carte_"
  // Compte    : XXXXXXXXX_*.csv   → commence par le numéro de compte (chiffres)
  //
  // On n'utilise PAS "includes('sous')" qui est trop permissif (SG peut inclure
  // ce mot dans les headers du compte courant selon la version d'export).

  if (filenameLow.startsWith("carte_")) {
    console.log("[parseCSV] type=carte (filename prefix)")
    return parseCarte(new TextDecoder("utf-8").decode(buffer))
  }

  if (/^\d/.test(filenameLow)) {
    console.log("[parseCSV] type=compte (filename starts with digit → account number)")
    return parseCompte(new TextDecoder("iso-8859-1").decode(buffer))
  }

  // ── Fallback : détection par headers ─────────────────────────────────────
  // Uniquement si le nom de fichier ne permet pas de trancher.
  // Critère strict : "sous categorie" ou ("categorie" ET "comptabilisation").

  const utf8Text   = new TextDecoder("utf-8", { fatal: false }).decode(buffer)
  const firstLines = utf8Text.split(/\r?\n/).slice(0, 3).join("\n").toLowerCase()

  if (
    firstLines.includes("sous categorie") ||
    (firstLines.includes("categorie") && firstLines.includes("comptabilisation"))
  ) {
    console.log("[parseCSV] type=carte (header detection fallback)")
    return parseCarte(utf8Text)
  }

  console.log("[parseCSV] type=compte (header detection fallback)")
  return parseCompte(new TextDecoder("iso-8859-1").decode(buffer))
}
