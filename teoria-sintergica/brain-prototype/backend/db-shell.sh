#!/bin/bash
# ── Prospecting DB shell ───────────────────────────────────────────────────────
# Conecta a la SQLite de prospecting y ofrece queries rápidas o modo interactivo.
#
# Uso:
#   ./db-shell.sh              → menú interactivo
#   ./db-shell.sh contacts     → todos los contactos
#   ./db-shell.sh stages       → resumen por stage
#   ./db-shell.sh tiers        → resumen por tier
#   ./db-shell.sh emails       → todos los emails enviados
#   ./db-shell.sh opens        → aperturas registradas
#   ./db-shell.sh contact <id> → detalle de un contacto
#   ./db-shell.sh ai           → contactos con análisis IA
#   ./db-shell.sh search <txt> → buscar en company/notes/focus
#   ./db-shell.sh shell        → sqlite3 interactivo directo

DB="$(dirname "$0")/database/prospecting.db"

if [[ ! -f "$DB" ]]; then
  echo "❌  Base de datos no encontrada: $DB"
  echo "   Arrancá el backend al menos una vez para que se cree."
  exit 1
fi

# Colores
BOLD='\033[1m'; CYAN='\033[0;36m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'

q() { sqlite3 -column -header "$DB" "$1"; }   # columnar + header
qcsv() { sqlite3 -csv -header "$DB" "$1"; }   # CSV

header() { echo -e "\n${BOLD}${CYAN}── $1 ──${RESET}"; }

# ── Quick commands ─────────────────────────────────────────────────────────────
case "${1:-menu}" in

  contacts)
    header "Todos los contactos"
    q "SELECT id, company, tier, stage, location, responded,
              CASE WHEN ai_analysis IS NOT NULL THEN '✓' ELSE '·' END AS ia,
              CASE WHEN scraped_content IS NOT NULL THEN '✓' ELSE '·' END AS scrape
       FROM contacts ORDER BY tier, id;"
    ;;

  stages)
    header "Contactos por stage"
    q "SELECT stage,
              COUNT(*) AS total,
              SUM(responded) AS respondieron,
              SUM(CASE WHEN ai_analysis IS NOT NULL THEN 1 ELSE 0 END) AS analizados
       FROM contacts
       GROUP BY stage
       ORDER BY CASE stage
         WHEN 'identificado'  THEN 1
         WHEN 'siguiendo'     THEN 2
         WHEN 'engagement'    THEN 3
         WHEN 'pitch'         THEN 4
         WHEN 'follow_up'     THEN 5
         WHEN 'respondio'     THEN 6
         WHEN 'call'          THEN 7
         WHEN 'cerrado'       THEN 8
         WHEN 'descartado'    THEN 9
         ELSE 10 END;"
    ;;

  tiers)
    header "Contactos por tier"
    q "SELECT tier,
              COUNT(*) AS total,
              SUM(responded) AS respondieron,
              SUM(CASE WHEN ai_analysis IS NOT NULL THEN 1 ELSE 0 END) AS con_ia
       FROM contacts
       GROUP BY tier ORDER BY tier;"
    ;;

  emails)
    header "Emails enviados"
    q "SELECT pl.tracking_id,
              c.company,
              pl.to_email,
              pl.subject,
              pl.sent_at,
              json_array_length(pl.opens) AS aperturas
       FROM pitch_logs pl
       LEFT JOIN contacts c ON c.id = pl.contact_id
       ORDER BY pl.sent_at DESC;"
    ;;

  opens)
    header "Aperturas registradas"
    q "SELECT pl.tracking_id,
              c.company,
              pl.to_email,
              json_array_length(pl.opens) AS total_opens,
              json_extract(pl.opens, '$[#-1].timestamp') AS ultimo_open,
              json_extract(pl.opens, '$[#-1].ip')        AS ultimo_ip
       FROM pitch_logs pl
       LEFT JOIN contacts c ON c.id = pl.contact_id
       WHERE json_array_length(pl.opens) > 0
       ORDER BY ultimo_open DESC;"
    ;;

  contact)
    id="${2:?Uso: $0 contact <id>}"
    header "Contacto #$id"
    q "SELECT * FROM contacts WHERE id=$id;"
    echo ""
    header "  AI analysis (raw JSON)"
    sqlite3 "$DB" "SELECT ai_analysis FROM contacts WHERE id=$id;" | python3 -m json.tool 2>/dev/null || echo "(sin análisis)"
    echo ""
    header "  Emails enviados"
    q "SELECT tracking_id, to_email, subject, sent_at,
              json_array_length(opens) AS aperturas
       FROM pitch_logs WHERE contact_id=$id ORDER BY sent_at DESC;"
    ;;

  ai)
    header "Contactos con análisis IA"
    q "SELECT id, company, tier, stage,
              json_extract(ai_analysis, '$.score')        AS score,
              json_extract(ai_analysis, '$.fit_category') AS fit
       FROM contacts
       WHERE ai_analysis IS NOT NULL
       ORDER BY CAST(json_extract(ai_analysis, '$.score') AS INTEGER) DESC;"
    ;;

  search)
    txt="${2:?Uso: $0 search <texto>}"
    header "Búsqueda: '$txt'"
    q "SELECT id, company, tier, stage, location
       FROM contacts
       WHERE company LIKE '%$txt%'
          OR notes    LIKE '%$txt%'
          OR focus    LIKE '%$txt%'
          OR location LIKE '%$txt%'
          OR decision_maker LIKE '%$txt%'
       ORDER BY tier, id;"
    ;;

  export)
    FILE="${2:-/tmp/prospecting_export_$(date +%Y%m%d).csv}"
    header "Exportando contactos → $FILE"
    qcsv "SELECT id, company, tier, stage, location, website, decision_maker,
                 responded, follow_up_count, last_action, next_action, notes,
                 json_extract(ai_analysis,'$.score') AS ai_score,
                 json_extract(ai_analysis,'$.fit_category') AS ai_fit,
                 created_at
          FROM contacts ORDER BY tier, id;" > "$FILE"
    echo -e "${GREEN}✓ Exportado: $FILE${RESET}"
    ;;

  shell)
    header "sqlite3 interactivo — escribe .quit para salir"
    echo -e "${YELLOW}Tablas disponibles: contacts, pitch_logs${RESET}"
    echo -e "${YELLOW}Usa  .schema contacts  o  .schema pitch_logs  para ver columnas${RESET}\n"
    sqlite3 -column -header "$DB"
    ;;

  stats)
    header "Stats generales"
    q "SELECT
         (SELECT COUNT(*) FROM contacts)                                         AS total_contactos,
         (SELECT COUNT(*) FROM contacts WHERE responded=1)                       AS respondieron,
         (SELECT COUNT(*) FROM contacts WHERE ai_analysis IS NOT NULL)           AS con_ia,
         (SELECT COUNT(*) FROM contacts WHERE scraped_content IS NOT NULL)       AS con_scrape,
         (SELECT COUNT(*) FROM pitch_logs)                                       AS emails_enviados,
         (SELECT SUM(json_array_length(opens)) FROM pitch_logs)                  AS total_aperturas;"
    ;;

  menu|*)
    echo -e "\n${BOLD}${CYAN}Prospecting DB — $(basename $DB)${RESET}"
    echo -e "${YELLOW}$(sqlite3 "$DB" "SELECT COUNT(*) || ' contactos · ' || (SELECT COUNT(*) FROM pitch_logs) || ' emails' FROM contacts;")${RESET}\n"
    echo -e "  ${GREEN}./db-shell.sh stats${RESET}           → resumen general"
    echo -e "  ${GREEN}./db-shell.sh contacts${RESET}        → tabla de contactos"
    echo -e "  ${GREEN}./db-shell.sh stages${RESET}          → agrupado por stage"
    echo -e "  ${GREEN}./db-shell.sh tiers${RESET}           → agrupado por tier"
    echo -e "  ${GREEN}./db-shell.sh ai${RESET}              → contactos con análisis IA (score)"
    echo -e "  ${GREEN}./db-shell.sh emails${RESET}          → emails enviados"
    echo -e "  ${GREEN}./db-shell.sh opens${RESET}           → aperturas registradas"
    echo -e "  ${GREEN}./db-shell.sh contact <id>${RESET}    → detalle + IA + emails de un contacto"
    echo -e "  ${GREEN}./db-shell.sh search <texto>${RESET}  → buscar en company/notes/focus"
    echo -e "  ${GREEN}./db-shell.sh export [archivo]${RESET}→ exportar CSV"
    echo -e "  ${GREEN}./db-shell.sh shell${RESET}           → sqlite3 interactivo directo\n"
    ;;
esac
