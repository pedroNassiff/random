#!/bin/bash

# Script de diagnóstico completo de analytics

echo "🔍 DIAGNÓST ICO DE ANALYTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Verificar backend
echo "1️⃣  Verificando backend..."
STATUS=$(curl -s http://localhost:8000/analytics/health | jq -r '.status' 2>/dev/null)
if [ "$STATUS" == "healthy" ]; then
    echo "   ✅ Backend funcionando"
else
    echo "   ❌ Backend NO responde"
    exit 1
fi
echo ""

# 2. Verificar endpoints
echo "2️⃣  Verificando endpoints..."
curl -s "http://localhost:8000/analytics/summary?days=7" > /dev/null && echo "   ✅ /analytics/summary" || echo "   ❌ /analytics/summary"
curl -s "http://localhost:8000/analytics/top-pages?days=7&limit=5" > /dev/null && echo "   ✅ /analytics/top-pages" || echo "   ❌ /analytics/top-pages"
curl -s "http://localhost:8000/analytics/top-events?days=7&limit=5" > /dev/null && echo "   ✅ /analytics/top-events" || echo "   ❌ /analytics/top-events"
curl -s "http://localhost:8000/analytics/top-engagement-zones?days=7&limit=5" > /dev/null && echo "   ✅ /analytics/top-engagement-zones" || echo "   ❌ /analytics/top-engagement-zones"
echo ""

# 3. Verificar base de datos
echo "3️⃣  Verificando datos en base de datos..."
echo ""
echo "   📊 Sesiones:"
docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM sessions;" 2>/dev/null | xargs
echo ""
echo "   📄 Pageviews:"
docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM pageviews;" 2>/dev/null | xargs
echo ""
echo "   🎯 Eventos:"
docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM events;" 2>/dev/null | xargs
echo ""
echo "   ⏱️  Engagement Zones:"
docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM engagement_zones;" 2>/dev/null | xargs
echo ""

# 4. Test de creación de sesión
echo "4️⃣  Probando creación de nueva sesión..."
RESPONSE=$(curl -s -X POST http://localhost:8000/analytics/session/start \
  -H "Content-Type: application/json" \
  -d '{
    "user_agent": "Test/1.0",
    "referrer": "http://test.com",
    "utm_source": "test_script",
    "utm_medium": "script",
    "utm_campaign": "diagnostico"
  }')

SUCCESS=$(echo $RESPONSE | jq -r '.success' 2>/dev/null)
SESSION_ID=$(echo $RESPONSE | jq -r '.data.session_id' 2>/dev/null)

if [ "$SUCCESS" == "true" ]; then
    echo "   ✅ Sesión creada: $SESSION_ID"
else
    echo "   ❌ Error creando sesión"
    echo "   Response: $RESPONSE"
fi
echo ""

# 5. Test de pageview
if [ "$SUCCESS" == "true" ]; then
    echo "5️⃣  Probando registro de pageview..."
    PV_RESPONSE=$(curl -s -X POST http://localhost:8000/analytics/pageview \
      -H "Content-Type: application/json" \
      -d "{
        \"session_id\": \"$SESSION_ID\",
        \"page_path\": \"/test-diagnostic\",
        \"page_title\": \"Test Diagnóstico Analytics\"
      }")
    
    PV_SUCCESS=$(echo $PV_RESPONSE | jq -r '.success' 2>/dev/null)
    if [ "$PV_SUCCESS" == "true" ]; then
        echo "   ✅ Pageview registrado"
    else
        echo "   ❌ Error registrando pageview"
    fi
    echo ""
fi

# 6. Verificar datos después del test
echo "6️⃣  Verificando nuevos datos..."
NEW_SESSIONS=$(docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM sessions;" 2>/dev/null | x args)
NEW_PAGEVIEWS=$(docker exec -i brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM pageviews;" 2>/dev/null | xargs)

echo "   📊 Total de sesiones: $NEW_SESSIONS"
echo "   📄 Total de pageviews: $NEW_PAGEVIEWS"
echo ""

# 7. Verificar últimos registros
echo "7️⃣  Últimos 5 pageviews registrados:"
docker exec -i brain-postgres psql -U analytics_user -d random_analytics -c "
  SELECT 
    page_path,
    page_title,
    to_char(viewed_at, 'HH24:MI:SS') as hora
  FROM pageviews 
  ORDER BY viewed_at DESC 
  LIMIT 5;
" 2>/dev/null

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Diagnóstico completado"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo ""
echo "   1. Abre http://localhost:5173 en tu navegador"
echo "   2. Navega por diferentes páginas (Home, Work, Project Detail)"
echo "   3. Abre la consola del navegador (F12) y busca errores"
echo "   4. Ejecuta de nuevo este script para ver si aumentan los números"
echo "   5. Visita http://localhost:5173/analytics para ver el dashboard"
echo ""
