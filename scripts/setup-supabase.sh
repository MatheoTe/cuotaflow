#!/usr/bin/env bash
# Crea el proyecto de Supabase de la demo, aplica el esquema, carga las
# variables en Vercel, siembra datos y despliega. Requiere `supabase login` hecho.
#   scripts/setup-supabase.sh            → crea el proyecto y hace todo
#   PROJECT_REF=xxxx scripts/setup-supabase.sh  → usa un proyecto existente
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="demo-creditos"
REGION="${REGION:-sa-east-1}"

if [ -z "${PROJECT_REF:-}" ]; then
  ORG_ID="${ORG_ID:-$(supabase orgs list -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log((o.find(x=>/personal|matheo/i.test(x.name))||o[0]).id)})')}"
  DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)}"
  echo "→ creando proyecto $NAME en la org $ORG_ID ($REGION)"
  supabase projects create "$NAME" --org-id "$ORG_ID" --db-password "$DB_PASSWORD" --region "$REGION" -o json > /tmp/sb-project.json
  PROJECT_REF=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/sb-project.json","utf8")).id)')
  echo "   ref: $PROJECT_REF"
  echo "DB_PASSWORD=$DB_PASSWORD" >> .env.supabase.local
  echo "PROJECT_REF=$PROJECT_REF" >> .env.supabase.local
  echo "→ esperando que la base esté lista"
  for i in $(seq 1 40); do
    STATUS=$(supabase projects list -o json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(x=>x.id===process.argv[1]);console.log(p?p.status:"?")})' "$PROJECT_REF")
    [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
    sleep 10
  done
else
  DB_PASSWORD="${DB_PASSWORD:?Con PROJECT_REF hay que pasar DB_PASSWORD}"
fi

echo "→ vinculando y aplicando el esquema"
supabase link --project-ref "$PROJECT_REF" -p "$DB_PASSWORD"
supabase db push -p "$DB_PASSWORD"

echo "→ leyendo claves"
KEYS=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json)
SERVICE_KEY=$(echo "$KEYS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s);console.log((k.find(x=>x.name==="service_role")||k.find(x=>/secret|service/i.test(x.name))).api_key)})')
SUPABASE_URL="https://$PROJECT_REF.supabase.co"

echo "→ cargando variables en Vercel (production)"
vercel env rm SUPABASE_URL production --yes >/dev/null 2>&1 || true
vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes >/dev/null 2>&1 || true
printf "%s" "$SUPABASE_URL" | vercel env add SUPABASE_URL production --yes
printf "%s" "$SERVICE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production --yes

echo "→ sembrando datos en Supabase"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" npx tsx scripts/seed.ts --reset

echo "→ desplegando"
vercel --prod --yes

echo "Listo. Tablero: https://demo-creditos.vercel.app/tablero"
