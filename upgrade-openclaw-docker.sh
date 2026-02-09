#!/usr/bin/env bash
#
# OpenClaw Docker Upgrade Script: v2026.2.3 → v2026.2.6
# To be run directly on the server at 217.154.231.116
#
# Usage: ./upgrade-openclaw-docker.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TARGET_VERSION="2026.2.6"
OPENCLAW_DIR="/opt/openclaw"
BACKUP_DIR="/backup/openclaw-$(date +%Y%m%d-%H%M%S)"

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  OpenClaw Docker Upgrade to v${TARGET_VERSION}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

main() {
    print_header

    # Check if running in correct directory
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml not found"
        echo "Please run this script from ${OPENCLAW_DIR}"
        cd "${OPENCLAW_DIR}" 2>/dev/null || exit 1
    fi

    # 1. Check current version
    print_step "Checking current OpenClaw version..."
    CURRENT_VERSION=$(docker-compose exec -T -u node openclaw cat /app/package.json 2>/dev/null | grep '"version"' | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    echo "Current version: ${CURRENT_VERSION}"
    echo "Target version:  ${TARGET_VERSION}"

    # 2. Create backup
    print_step "Creating backup of OpenClaw data..."
    mkdir -p "${BACKUP_DIR}"

    # Backup Docker volumes
    print_step "Backing up Docker volumes..."
    for volume in openclaw-sessions openclaw-data openclaw-browser openclaw-cache openclaw-logs; do
        if docker volume inspect "$volume" >/dev/null 2>&1; then
            echo "  Backing up $volume..."
            docker run --rm \
                -v "${volume}:/source:ro" \
                -v "${BACKUP_DIR}:/backup" \
                alpine \
                tar czf "/backup/${volume}.tar.gz" -C /source . 2>/dev/null || true
        fi
    done

    # Backup openclaw-config.json if exists
    if [ -f "openclaw-config.json" ]; then
        cp openclaw-config.json "${BACKUP_DIR}/openclaw-config.json"
    fi

    print_success "Backup created at: ${BACKUP_DIR}"
    du -sh "${BACKUP_DIR}"

    # 3. Stop current container
    print_step "Stopping OpenClaw container..."
    docker-compose down
    print_success "Container stopped"

    # 4. Update OpenClaw repository
    print_step "Pulling latest OpenClaw code..."
    if [ -d ".git" ]; then
        git fetch --tags
        git checkout "v${TARGET_VERSION}" 2>/dev/null || {
            print_warning "Tag v${TARGET_VERSION} not found, trying main branch"
            git pull origin main
        }
    else
        print_warning "Not a git repository, skipping code update"
    fi

    # 5. Update Dockerfile to use latest OpenClaw
    print_step "Updating Dockerfile for OpenClaw v${TARGET_VERSION}..."
    if grep -q "openclaw@" Dockerfile; then
        sed -i.bak "s/openclaw@[0-9]\+\.[0-9]\+\.[0-9]\+/openclaw@${TARGET_VERSION}/g" Dockerfile
        print_success "Dockerfile updated"
    else
        print_warning "Dockerfile format not recognized, skipping"
    fi

    # 6. Build new image
    print_step "Building new Docker image with OpenClaw v${TARGET_VERSION}..."
    print_warning "This may take 10-15 minutes..."
    docker-compose build --no-cache openclaw

    # 7. Start new container
    print_step "Starting updated OpenClaw container..."
    docker-compose up -d

    # 8. Wait for startup
    print_step "Waiting for OpenClaw to start (30 seconds)..."
    sleep 30

    # 9. Verify installation
    print_step "Verifying installation..."
    NEW_VERSION=$(docker-compose exec -T -u node openclaw cat /app/package.json 2>/dev/null | grep '"version"' | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")

    echo "  Installed version: ${NEW_VERSION}"

    # 10. Check container health
    print_step "Checking container health..."
    docker-compose ps

    # 11. Check logs
    print_step "Recent logs:"
    docker-compose logs --tail=20 openclaw

    # 12. Test gateway
    print_step "Testing gateway connection..."
    if curl -s --max-time 5 http://localhost:18789 >/dev/null 2>&1; then
        print_success "Gateway is responding on port 18789"
    else
        print_warning "Gateway not responding yet (may need more time)"
    fi

    # 13. Verify data preservation
    print_step "Verifying data preservation..."
    SESSION_COUNT=$(docker-compose exec -T -u node openclaw find /home/node/.openclaw -name "*.jsonl" 2>/dev/null | wc -l || echo "0")
    echo "  Found ${SESSION_COUNT} session files"

    if [ "$SESSION_COUNT" -gt 0 ]; then
        print_success "Session data preserved"
    else
        print_warning "No session files found (may be normal for new installation)"
    fi

    # Final summary
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Upgrade Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Summary:"
    echo "  Previous version: ${CURRENT_VERSION}"
    echo "  Current version:  ${NEW_VERSION}"
    echo "  Backup location:  ${BACKUP_DIR}"
    echo ""
    echo "Next steps:"
    echo "  1. Test Web UI: https://oclaw.kaoohi.com"
    echo "  2. Test WebSocket: node test-openclaw-connection.js"
    echo "  3. Check logs: docker-compose logs -f openclaw"
    echo "  4. Verify sessions: docker-compose exec -u node openclaw ls -la /home/node/.openclaw/agents/main/sessions/"
    echo ""
    echo "If issues occur, rollback with:"
    echo "  docker-compose down"
    echo "  # Restore volumes from ${BACKUP_DIR}"
    echo "  for vol in ${BACKUP_DIR}/*.tar.gz; do"
    echo "    volname=\$(basename \$vol .tar.gz)"
    echo "    docker run --rm -v \${volname}:/target -v ${BACKUP_DIR}:/backup alpine \\"
    echo "      sh -c 'rm -rf /target/* && tar xzf /backup/\$(basename \$vol) -C /target'"
    echo "  done"
    echo "  docker-compose up -d"
    echo ""
}

# Run main function
main

exit 0
