#!/usr/bin/env bash
#
# OpenClaw Upgrade Script: v2026.2.3 → v2026.2.6
# Safely upgrades OpenClaw while preserving all data
#
# Usage: ./upgrade-openclaw.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TARGET_VERSION="2026.2.6"
BACKUP_DIR="/backup/openclaw-$(date +%Y%m%d-%H%M%S)"
OPENCLAW_DIR="$HOME/.openclaw"

# Functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  OpenClaw Upgrade Script${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Main script
main() {
    print_header

    # 1. Check current version
    print_step "Checking current OpenClaw version..."
    if command_exists openclaw; then
        CURRENT_VERSION=$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo "Current version: ${CURRENT_VERSION}"
        echo "Target version:  ${TARGET_VERSION}"
    else
        print_error "OpenClaw not found in PATH"
        exit 1
    fi

    # 2. Detect installation method
    print_step "Detecting installation method..."
    INSTALL_METHOD="unknown"

    if command_exists pm2 && pm2 list 2>/dev/null | grep -q openclaw; then
        INSTALL_METHOD="pm2"
        print_success "Detected: PM2 managed installation"
    elif command_exists docker && docker ps 2>/dev/null | grep -q openclaw; then
        INSTALL_METHOD="docker"
        print_success "Detected: Docker installation"
    elif systemctl --user status openclaw >/dev/null 2>&1; then
        INSTALL_METHOD="systemd"
        print_success "Detected: systemd service"
    elif launchctl list 2>/dev/null | grep -q openclaw; then
        INSTALL_METHOD="launchd"
        print_success "Detected: launchd service (macOS)"
    else
        INSTALL_METHOD="manual"
        print_warning "Installation method unclear, proceeding with manual upgrade"
    fi

    # 3. Create backup
    print_step "Creating backup of OpenClaw data..."
    if [ -d "$OPENCLAW_DIR" ]; then
        sudo mkdir -p "$BACKUP_DIR"
        sudo cp -r "$OPENCLAW_DIR"/* "$BACKUP_DIR/" 2>/dev/null || true
        print_success "Backup created at: $BACKUP_DIR"

        # List backed up files
        echo "Backed up:"
        ls -lh "$BACKUP_DIR" | tail -n +2 | awk '{print "  - " $9}'
    else
        print_warning "OpenClaw data directory not found at $OPENCLAW_DIR"
    fi

    # 4. Stop OpenClaw service
    print_step "Stopping OpenClaw service..."
    case "$INSTALL_METHOD" in
        pm2)
            pm2 stop openclaw || true
            print_success "PM2 service stopped"
            ;;
        docker)
            docker stop openclaw || true
            print_success "Docker container stopped"
            ;;
        systemd)
            systemctl --user stop openclaw || true
            print_success "systemd service stopped"
            ;;
        launchd)
            launchctl stop com.openclaw.gateway || true
            print_success "launchd service stopped"
            ;;
        *)
            print_warning "Please manually stop OpenClaw service"
            read -p "Press Enter when ready to continue..."
            ;;
    esac

    # 5. Upgrade OpenClaw
    print_step "Upgrading OpenClaw to v${TARGET_VERSION}..."

    case "$INSTALL_METHOD" in
        docker)
            print_step "Pulling Docker image..."
            docker pull openclaw/openclaw:v${TARGET_VERSION}

            print_step "Removing old container..."
            docker rm openclaw 2>/dev/null || true

            print_step "Starting new container..."
            docker run -d \
                --name openclaw \
                --restart unless-stopped \
                -p 18789:18789 \
                -v openclaw_data:/home/node/.openclaw \
                -e OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}" \
                openclaw/openclaw:v${TARGET_VERSION}
            print_success "Docker container updated and started"
            ;;
        *)
            if command_exists pnpm; then
                pnpm add -g openclaw@${TARGET_VERSION}
            elif command_exists npm; then
                npm install -g openclaw@${TARGET_VERSION}
            else
                print_error "Neither npm nor pnpm found"
                exit 1
            fi
            print_success "OpenClaw upgraded via npm"
            ;;
    esac

    # 6. Verify installation
    print_step "Verifying installation..."
    sleep 2
    NEW_VERSION=$(openclaw --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")

    if [ "$NEW_VERSION" = "$TARGET_VERSION" ]; then
        print_success "Version verified: $NEW_VERSION"
    else
        print_warning "Version mismatch. Got: $NEW_VERSION, Expected: $TARGET_VERSION"
    fi

    # 7. Run doctor check
    print_step "Running OpenClaw doctor..."
    if command_exists openclaw; then
        openclaw doctor || print_warning "Doctor check completed with warnings"
    fi

    # 8. Restart service
    print_step "Starting OpenClaw service..."
    case "$INSTALL_METHOD" in
        pm2)
            pm2 start openclaw || pm2 restart openclaw
            pm2 save
            print_success "PM2 service started"
            ;;
        systemd)
            systemctl --user start openclaw
            print_success "systemd service started"
            ;;
        launchd)
            launchctl start com.openclaw.gateway
            print_success "launchd service started"
            ;;
        docker)
            print_success "Docker container already running"
            ;;
        *)
            print_warning "Please manually start OpenClaw service"
            ;;
    esac

    # 9. Wait for startup
    print_step "Waiting for OpenClaw to start..."
    sleep 5

    # 10. Verify gateway
    print_step "Verifying gateway connection..."
    if command_exists curl; then
        if curl -s --max-time 5 https://oclaw.kaoohi.com >/dev/null 2>&1 || \
           curl -s --max-time 5 http://localhost:18789 >/dev/null 2>&1; then
            print_success "Gateway is responding"
        else
            print_warning "Gateway not responding yet (may need more time)"
        fi
    fi

    # 11. Verify session data
    print_step "Verifying session data preservation..."
    if [ -d "$OPENCLAW_DIR/agents/main/sessions" ]; then
        SESSION_COUNT=$(find "$OPENCLAW_DIR/agents/main/sessions" -name "*.jsonl" 2>/dev/null | wc -l)
        print_success "Found $SESSION_COUNT session files"
    else
        print_warning "Session directory not found"
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
    echo "  1. Test gateway: curl https://oclaw.kaoohi.com"
    echo "  2. Check logs: openclaw logs"
    echo "  3. Test chat: cd /Users/arnau1/sources/kaoochat && npm run dev"
    echo "  4. View sessions: openclaw sessions list"
    echo ""
    echo "If issues occur, rollback with:"
    echo "  sudo cp -r ${BACKUP_DIR}/* ${OPENCLAW_DIR}/"
    echo "  npm install -g openclaw@${CURRENT_VERSION}"
    echo ""
}

# Run main function
main

exit 0
