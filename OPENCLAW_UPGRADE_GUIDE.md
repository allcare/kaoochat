# OpenClaw Upgrade Guide: v2026.2.3 → v2026.2.6

## Current Status
- **Current Version**: v2026.2.3 (running on oclaw.kaoohi.com)
- **Target Version**: v2026.2.6 (released February 7, 2026)
- **Gateway URL**: wss://oclaw.kaoohi.com

## What's New in v2026.2.6

### Key Features
- **Model Support**: Anthropic Opus 4.6 and OpenAI Codex gpt-5.3-codex with fallback
- **New Provider**: xAI (Grok) integration
- **Token Usage Dashboard**: New web UI feature for cost visibility
- **Voyage AI**: Native memory support for embeddings
- **Session Management**: History payloads now capped to prevent context overflow

### Bug Fixes
- Telegram auto-injection fixes
- Security hardening for Gateway canvas host
- Cron scheduling and reminder delivery fixes
- Skill/plugin code safety scanner
- Improved billing error handling

## Pre-Upgrade Checklist

### 1. Backup Critical Data
```bash
# SSH into oclaw.kaoohi.com
ssh arnau1@oclaw.kaoohi.com

# Identify OpenClaw data directory (typically ~/.openclaw)
ls -la ~/.openclaw/

# Create backup
sudo mkdir -p /backup/openclaw-$(date +%Y%m%d)
sudo cp -r ~/.openclaw/* /backup/openclaw-$(date +%Y%m%d)/

# Backup configuration
sudo cp /home/node/.openclaw/openclaw.json /backup/openclaw-$(date +%Y%m%d)/
```

### 2. Document Current Configuration
```bash
# Check current version
openclaw --version

# Check running processes
pm2 list
# OR
docker ps | grep openclaw
# OR
systemctl status openclaw

# Check gateway status
curl -s https://oclaw.kaoohi.com/health || curl -s http://localhost:18789/health
```

## Upgrade Methods

### Method 1: NPM/PNPM Upgrade (Recommended for Node.js installations)
```bash
# Stop OpenClaw service
pm2 stop openclaw
# OR if using systemd
sudo systemctl stop openclaw

# Update via npm
npm install -g openclaw@2026.2.6
# OR via pnpm
pnpm add -g openclaw@2026.2.6

# Verify installation
openclaw --version  # Should show 2026.2.6

# Restart service
pm2 start openclaw
# OR
sudo systemctl start openclaw
```

### Method 2: Docker Update (If using Docker)
```bash
# Pull latest image
docker pull openclaw/openclaw:v2026.2.6

# Stop current container
docker stop openclaw

# Backup volumes
docker run --rm -v openclaw_data:/data -v $(pwd)/backup:/backup \
  alpine tar czf /backup/openclaw-data-$(date +%Y%m%d).tar.gz -C /data .

# Start new container with same volumes (preserves data)
docker run -d \
  --name openclaw \
  --restart unless-stopped \
  -p 18789:18789 \
  -v openclaw_data:/home/node/.openclaw \
  -e OPENCLAW_GATEWAY_TOKEN=I5dDki9JWDv5k4FaFhEzqRIzAYvJpOXfnQUydBFdI \
  openclaw/openclaw:v2026.2.6
```

### Method 3: Source Installation Update
```bash
# Clone or update repository
cd /opt/openclaw || git clone https://github.com/openclaw/openclaw.git /opt/openclaw
cd /opt/openclaw
git fetch --tags
git checkout v2026.2.6

# Install dependencies
pnpm install

# Build
pnpm build

# Restart service
pm2 restart openclaw
```

## Post-Upgrade Verification

### 1. Check Version
```bash
openclaw --version
# Should output: 2026.2.6
```

### 2. Verify Gateway Connection
```bash
# Test WebSocket connection
node /Users/arnau1/sources/kaoochat/test-openclaw-connection.js "Hello"
```

### 3. Check Session Data Preservation
```bash
# List sessions
openclaw sessions list

# Verify agent data
ls -la ~/.openclaw/agents/main/sessions/
```

### 4. Test Web UI
Open in browser: https://oclaw.kaoohi.com

Check the new token usage dashboard feature.

### 5. Test Chat Integration
```bash
# From kaoochat directory
cd /Users/arnau1/sources/kaoochat
npm run dev
```

Open http://localhost:3000 and verify chat history is preserved.

## Data Preservation Notes

OpenClaw stores data in these key locations:
- **Configuration**: `~/.openclaw/openclaw.json`
- **Sessions**: `~/.openclaw/agents/main/sessions/sessions.json`
- **History**: `~/.openclaw/agents/main/sessions/*.jsonl`
- **Skills**: `~/.openclaw/skills/`
- **Logs**: `~/.openclaw/logs/`

**These directories MUST be preserved during upgrade.**

## Rollback Procedure

If upgrade fails:
```bash
# Stop new version
pm2 stop openclaw  # OR docker stop openclaw

# Restore backup
sudo cp -r /backup/openclaw-YYYYMMDD/* ~/.openclaw/

# Reinstall old version
npm install -g openclaw@2026.2.3
# OR
docker run -d --name openclaw \
  -v openclaw_data:/home/node/.openclaw \
  openclaw/openclaw:v2026.2.3

# Restart
pm2 start openclaw
```

## Migration Notes

### Breaking Changes
No breaking changes reported between v2026.2.3 and v2026.2.6.

### Configuration Updates
The session history capping feature may require reviewing:
```json
{
  "agents": {
    "main": {
      "maxHistoryTokens": 100000  // New default cap
    }
  }
}
```

## Troubleshooting

### Issue: Gateway not responding after upgrade
```bash
# Check logs
tail -f ~/.openclaw/logs/gateway.log

# Check process
pm2 logs openclaw
# OR
docker logs openclaw
```

### Issue: Session data appears missing
```bash
# Verify backup
ls -la /backup/openclaw-YYYYMMDD/agents/main/sessions/

# Restore if needed
cp -r /backup/openclaw-YYYYMMDD/agents/main/sessions/* ~/.openclaw/agents/main/sessions/
```

### Issue: WebSocket connection fails
```bash
# Check port availability
sudo lsof -i :18789

# Verify SSL certificates if using HTTPS
sudo certbot certificates
```

## Next Steps

1. SSH into oclaw.kaoohi.com with proper authentication
2. Run pre-upgrade backup commands
3. Choose appropriate upgrade method based on installation type
4. Execute upgrade
5. Run post-upgrade verification
6. Test KaooChat integration

## Need Help?

If you need me to:
1. Set up SSH access to perform the upgrade automatically
2. Create specific deployment scripts for your environment
3. Troubleshoot any issues during upgrade

Just let me know the deployment method used (Docker/PM2/systemd) and I can provide more specific guidance.
