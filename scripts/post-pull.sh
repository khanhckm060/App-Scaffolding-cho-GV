#!/bin/bash

# ============================================
# Post-Pull Auto-Fix Script
# ============================================
# Tự động sửa các lỗi AI Studio thường gây ra
# sau khi git pull về Local.
#
# Usage:
#   bash scripts/post-pull.sh
#
# Hoặc add vào git hook:
#   cp scripts/post-pull.sh .git/hooks/post-merge
#   chmod +x .git/hooks/post-merge
# ============================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Running post-pull auto-fix...${NC}"
echo ""

# ============================================
# FIX 1: .ts imports → .js trong /api/
# ============================================
echo -e "${YELLOW}[1/3] Checking /api imports...${NC}"

if grep -rl "from '\./.*\.ts'" api/ 2>/dev/null; then
    echo -e "${RED}  ⚠️  Found .ts imports in /api/ (AI Studio bug)${NC}"
    echo -e "${YELLOW}  → Fixing to .js extensions...${NC}"
    
    # Fix tất cả imports .ts → .js trong api/
    find api -name "*.ts" -exec sed -i.bak \
        -e "s|from '\./_lib/firebaseAdmin\.ts'|from './_lib/firebaseAdmin.js'|g" \
        -e "s|from '\./_lib/resend\.ts'|from './_lib/resend.js'|g" \
        -e "s|from '\./_lib/emailTemplates\.ts'|from './_lib/emailTemplates.js'|g" \
        -e "s|from '\./firebaseAdmin\.ts'|from './firebaseAdmin.js'|g" \
        -e "s|from '\./resend\.ts'|from './resend.js'|g" \
        -e "s|from '\./emailTemplates\.ts'|from './emailTemplates.js'|g" \
        {} \;
    
    # Fix imports không có extension
    find api -name "*.ts" -exec sed -i.bak \
        -e "s|from '\./_lib/firebaseAdmin'|from './_lib/firebaseAdmin.js'|g" \
        -e "s|from '\./_lib/resend'|from './_lib/resend.js'|g" \
        -e "s|from '\./_lib/emailTemplates'|from './_lib/emailTemplates.js'|g" \
        {} \;
    
    # Remove .bak files
    find api -name "*.bak" -delete
    
    echo -e "${GREEN}  ✅ Fixed imports in /api/${NC}"
else
    echo -e "${GREEN}  ✅ /api/ imports OK${NC}"
fi

# ============================================
# FIX 2: server.ts imports
# ============================================
echo -e "${YELLOW}[2/3] Checking server.ts...${NC}"

if [ -f "server.ts" ]; then
    if grep -q "from \"\./api/.*\.ts\"" server.ts; then
        echo -e "${RED}  ⚠️  Found .ts imports in server.ts${NC}"
        sed -i.bak \
            -e 's|from "\./api/notify-assignment\.ts"|from "./api/notify-assignment"|g' \
            -e 's|from "\./api/cron-reminder\.ts"|from "./api/cron-reminder"|g' \
            server.ts
        rm -f server.ts.bak
        echo -e "${GREEN}  ✅ Fixed server.ts${NC}"
    else
        echo -e "${GREEN}  ✅ server.ts OK${NC}"
    fi
fi

# ============================================
# FIX 3: Verify and report
# ============================================
echo -e "${YELLOW}[3/3] Verification...${NC}"

# Check không còn .ts imports nào
BAD_IMPORTS=$(grep -rn "from '\./.*\.ts'" api/ 2>/dev/null || true)
if [ -z "$BAD_IMPORTS" ]; then
    echo -e "${GREEN}  ✅ No bad imports found${NC}"
else
    echo -e "${RED}  ❌ Còn imports SAI:${NC}"
    echo "$BAD_IMPORTS"
    exit 1
fi

# Check imports đều có .js
ALL_IMPORTS=$(grep -rn "from '\./_lib" api/ 2>/dev/null || true)
echo ""
echo -e "${BLUE}📊 Current /api imports:${NC}"
echo "$ALL_IMPORTS"

# ============================================
# Auto commit if changes
# ============================================
if [ -n "$(git status --porcelain)" ]; then
    echo ""
    echo -e "${YELLOW}📝 Changes detected. Auto-committing...${NC}"
    git add api/ server.ts 2>/dev/null || true
    git commit -m "fix: auto-fix .ts → .js imports (AI Studio compat)" || true
    echo -e "${GREEN}✅ Auto-fix committed. Run 'git push' to update GitHub.${NC}"
else
    echo ""
    echo -e "${GREEN}✅ No changes needed. Code already correct.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Post-pull check complete!${NC}"
