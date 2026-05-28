import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse un montant au format français : -462,00 ou +4588,73
 * Retourne null si la cellule est vide ou non numérique.
 */
function parseFrenchAmount(raw: string | undefined): number | null {
  if (!raw?.trim()) return null
  const cleaned = raw
    .replace(/\+/g, "")   // supprimer le + des crédits
    .replace(/,/g, ".")   // virgule décimale → point
    .replace(/\s/g, "")   // espaces insécables éventuels
    .trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/**
 * Convertit DD/MM/YYYY → YYYY-MM-DD
 * Retourne null si le format ne correspond pas.
 */
function parseFrenchDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  console.log("[csv-bootstrap] ── POST started ──")

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll() {},
    },
  })

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // ── 2. Récupérer le fichier ───────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Impossible de lire le formulaire multipart" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Aucun fichier fourni (champ 'file' manquant)" }, { status: 400 })
  }

  console.log(`[csv-bootstrap] fichier reçu — taille: ${file.size} octets, type: ${file.type}`)

  // ── 3. Décodage latin-1 (Caisse d'Épargne) ───────────────────────────────
  const buffer  = await file.arrayBuffer()
  const decoder = new TextDecoder("latin1")
  const text    = decoder.decode(buffer)

  console.log(`[csv-bootstrap] décodé latin-1 — ${text.length} chars`)
  console.log(`[csv-bootstrap] aperçu: ${text.slice(0, 200).replace(/\n/g, "\\n")}`)

  // ── 4. Découpage lignes ───────────────────────────────────────────────────
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  console.log(`[csv-bootstrap] ${lines.length} lignes non-vides`)

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vide ou sans données", parsed: 0, entries: [] }, { status: 422 })
  }

  // ── 5. Détection des colonnes depuis le header ────────────────────────────
  const rawHeader = lines[0]
  const headers   = rawHeader.split(";").map(h => h.trim().toLowerCase()
    // normaliser les accents pour la détection
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
  )

  console.log(`[csv-bootstrap] headers détectés: ${JSON.stringify(headers)}`)

  const colDate   = headers.findIndex(h => h.startsWith("date"))
  const colLabel  = headers.findIndex(h => h.startsWith("libel") || h === "lib" || h === "libelle")
  const colDebit  = headers.findIndex(h => h === "debit")
  const colCredit = headers.findIndex(h => h === "credit")

  console.log(`[csv-bootstrap] colonnes — date:${colDate} label:${colLabel} debit:${colDebit} credit:${colCredit}`)

  if (colDate === -1 || colLabel === -1) {
    return NextResponse.json({
      error:            `Colonnes 'Date' ou 'Libellé' introuvables dans le CSV`,
      headers_detected: headers,
      raw_header_line:  rawHeader,
      parsed:           0,
      entries:          [],
    }, { status: 422 })
  }

  // ── 6. Parsing ligne par ligne ────────────────────────────────────────────
  const entries:        Record<string, unknown>[] = []
  const skippedDetail:  { line: number; reason: string; raw: string }[] = []
  const errorDetail:    { line: number; reason: string; raw: string }[] = []

  for (let i = 1; i < lines.length; i++) {
    const raw  = lines[i]
    const cols = raw.split(";")

    const rawDate   = cols[colDate]?.trim()
    const rawLabel  = cols[colLabel]?.trim()
    const rawDebit  = colDebit  !== -1 ? cols[colDebit]?.trim()  : undefined
    const rawCredit = colCredit !== -1 ? cols[colCredit]?.trim() : undefined

    // Date invalide → erreur
    const date = parseFrenchDate(rawDate)
    if (!date) {
      errorDetail.push({ line: i + 1, reason: `Date invalide: "${rawDate}"`, raw })
      console.warn(`[csv-bootstrap] ERREUR ligne ${i + 1}: date invalide "${rawDate}"`)
      continue
    }

    // Libellé vide → skip silencieux
    if (!rawLabel) {
      skippedDetail.push({ line: i + 1, reason: "Libellé vide", raw })
      continue
    }

    const debitAmount  = parseFrenchAmount(rawDebit)
    const creditAmount = parseFrenchAmount(rawCredit)

    // Aucun montant → skip
    if (debitAmount === null && creditAmount === null) {
      skippedDetail.push({ line: i + 1, reason: "Débit et Crédit tous les deux vides", raw })
      continue
    }

    // Priorité au débit ; si les deux sont présents, le débit gagne
    const isDebit   = debitAmount !== null && debitAmount !== 0
    const amount    = isDebit ? Math.abs(debitAmount!) : creditAmount!
    const entryType = isDebit ? "expense" : "income"
    const fluxNature = isDebit ? "Cash Out" : "Cash In"

    const [yyyy, mm] = date.split("-")
    const month = parseInt(mm, 10)
    const year  = parseInt(yyyy, 10)

    // external_id déterministe à partir des données sources
    const externalId = `caisse_epargne:${date}:${rawLabel.slice(0, 50)}:${isDebit ? rawDebit : rawCredit}`

    entries.push({
      external_id:   externalId,
      source:        "caisse_epargne_csv",
      date,
      label:         rawLabel,
      category:      "",            // à catégoriser après import
      amount,
      currency:      "EUR",
      entry_type:    entryType,
      entry_subtype: null,
      flux_nature:   fluxNature,
      is_non_cash:   false,
      is_subtotal:   false,
      is_recurring:  false,
      month,
      year,
      scenario:      "actual",
      validated:     false,
      sync_status:   "pending",
    })

    console.log(
      `[csv-bootstrap] OK    ligne ${i + 1} — ${date} | "${rawLabel.slice(0, 30)}" | ` +
      `${entryType} ${amount} EUR`,
    )
  }

  console.log(
    `[csv-bootstrap] ── Terminé ──\n` +
    `  parsées  : ${entries.length}\n` +
    `  skippées : ${skippedDetail.length}\n` +
    `  erreurs  : ${errorDetail.length}`,
  )

  return NextResponse.json({
    parsed:          entries.length,
    skipped:         skippedDetail.length,
    errors:          errorDetail.length,
    headers_detected: headers,
    entries,
    skipped_detail:  skippedDetail,
    error_detail:    errorDetail,
  })
}
