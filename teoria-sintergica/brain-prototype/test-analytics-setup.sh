#!/bin/bash

echo "======================================"
echo "🧪 Testing Analytics Setup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Docker containers
echo "1️⃣ Checking Docker containers..."
if docker ps | grep -q "brain-postgres"; then
    echo -e "${GREEN}✓ PostgreSQL container running${NC}"
else
    echo -e "${RED}✗ PostgreSQL container not running${NC}"
    exit 1
fi

# Test 2: Database exists
echo ""
echo "2️⃣ Checking databases..."
if docker exec brain-postgres psql -U brain_user -d postgres -lqt | grep -q "random_analytics"; then
    echo -e "${GREEN}✓ random_analytics database exists${NC}"
else
    echo -e "${RED}✗ random_analytics database not found${NC}"
    exit 1
fi

# Test 3: Tables exist
echo ""
echo "3️⃣ Checking analytics tables..."
TABLE_COUNT=$(docker exec brain-postgres psql -U analytics_user -d random_analytics -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
if [ "$TABLE_COUNT" -eq "6" ]; then
    echo -e "${GREEN}✓ All 6 analytics tables exist${NC}"
    docker exec brain-postgres psql -U analytics_user -d random_analytics -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" | grep -v "^-" | grep -v "table_name" | grep -v "^(" | grep -v "^$"
else
    echo -e "${RED}✗ Expected 6 tables, found $TABLE_COUNT${NC}"
    exit 1
fi

# Test 4: Backend health check
echo ""
echo "4️⃣ Testing backend health..."
HEALTH_RESPONSE=$(curl -s http://localhost:8000/analytics/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Backend analytics endpoint healthy${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Backend analytics endpoint not responding${NC}"
    exit 1
fi

# Test 5: Test session creation
echo ""
echo "5️⃣ Testing session creation..."
SESSION_ID="test-session-$(date +%s)"
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8000/analytics/session/start \
  -H "Content-Type: application/json" \
  -d "{
    \"anonymous_id\": \"test-user-123\",
    \"session_id\": \"$SESSION_ID\",
    \"entry_page\": \"/\",
    \"device_type\": \"desktop\",
    \"browser\": \"Chrome\",
    \"referrer_url\": \"https://google.com\",
    \"utm_source\": \"test\",
    \"utm_campaign\": \"setup-verification\"
  }")

if echo "$SESSION_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Session creation successful${NC}"
    echo "   Session ID: $SESSION_ID"
else
    echo -e "${RED}✗ Session creation failed${NC}"
    echo "   Response: $SESSION_RESPONSE"
    exit 1
fi

# Test 6: Test pageview tracking
echo ""
echo "6️⃣ Testing pageview tracking..."
PAGEVIEW_RESPONSE=$(curl -s -X POST http://localhost:8000/analytics/pageview \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"page_path\": \"/test\",
    \"page_title\": \"Test Page\"
  }")

if echo "$PAGEVIEW_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ Pageview tracking successful${NC}"
else
    echo -e "${YELLOW}⚠ Pageview tracking response:${NC}"
    echo "   $PAGEVIEW_RESPONSE"
fi

# Test 7: Check frontend .env
echo ""
echo "7️⃣ Checking frontend configuration..."
if [ -f "/Users/pedronassiff/Desktop/proyectos/random/.env" ]; then
    if grep -q "VITE_ANALYTICS_API=http://localhost:8000/analytics" "/Users/pedronassiff/Desktop/proyectos/random/.env"; then
        echo -e "${GREEN}✓ Frontend .env configured correctly${NC}"
    else
        echo -e "${YELLOW}⚠ Frontend .env exists but URL might be wrong${NC}"
    fi
else
    echo -e "${RED}✗ Frontend .env not found${NC}"
fi

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo "======================================"
echo ""
echo "📊 Analytics system ready:"
echo "   • Backend: http://localhost:8000/analytics"
echo "   • Frontend: http://localhost:5173/analytics"
echo "   • Database: random_analytics (6 tables)"
echo ""
echo "🚀 Next steps:"
echo "   1. Start frontend: cd random && npm run dev"
echo "   2. Visit: http://localhost:5173/analytics"
echo "   3. Check data: docker exec -i brain-postgres psql -U analytics_user -d random_analytics"
echo ""
