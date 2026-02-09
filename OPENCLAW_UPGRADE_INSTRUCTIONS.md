# OpenClaw Upgrade Instructions
## Upgrade from v2026.2.3 to v2026.2.6 on oclaw.kaoohi.com

## Current Situation

**Issue**: SSH access to the server (217.154.231.116) on port 22 is blocked or unavailable.

**Current Status**:
- Server: 217.154.231.116 (oclaw.kaoohi.com)
- Current OpenClaw: v2026.2.3
- Target OpenClaw: v2026.2.6 (released Feb 7, 2026)
- Deployment: Docker-based with docker-compose
- SSH Credentials: root / rCFvu8Hb

## What's New in v2026.2.6

### Key Features
- **Model Support**: Anthropic Opus 4.6 and OpenAI Codex gpt-5.3-codex
- **xAI (Grok)**: New AI provider integration
- **Token Usage Dashboard**: Cost tracking in Web UI
- **Voyage AI**: Native memory/embedding support
- **Session Management**: History capping to prevent context overflow

### Bug Fixes
- Security hardening for Gateway
- Cron scheduling fixes
- Skill/plugin safety scanner
- Better billing error handling

## Solution Options

### Option 1: Enable SSH Access (Recommended)

If you have console/panel access to the server:

```bash
# On the server console
systemctl status sshd
systemctl start sshd
systemctl enable sshd

# Check if firewall is blocking
ufw status
ufw allow 22/tcp

# Or if using iptables
iptables -L -n | grep 22
```

Then run from your local machine:
```bash
sshpass -p 'rCFvu8Hb' ssh root@217.154.231.116 'bash -s' < /Users/arnau1/sources/kaoochat/upgrade-openclaw-docker.sh
```

### Option 2: Try Alternative SSH Port

Some servers run SSH on non-standard ports:

```bash
# Try common alternative ports
for port in 2222 2200 22022; do
    echo "Trying port $port..."
    sshpass -p 'rCFvu8Hb' ssh -p $port root@217.154.231.116 "echo Connected on port $port" && break
done
```

### Option 3: Server Panel/Console Access

If you have web-based console access (like DigitalOcean, Vultr, Hetzner console):

1. **Access server console** through your hosting provider's panel

2. **Login as root** with password: `rCFvu8Hb`

3. **Download and run the upgrade script**:
```bash
# Navigate to OpenClaw directory
cd /opt/openclaw

# Download upgrade script
curl -o upgrade-openclaw-docker.sh https://raw.githubusercontent.com/YOUR_REPO/upgrade-openclaw-docker.sh
# OR create it manually (see script below)

# Make it executable
chmod +x upgrade-openclaw-docker.sh

# Run the upgrade
./upgrade-openclaw-docker.sh
```

### Option 4: Manual Docker Upgrade Steps

If you can access the server console, run these commands manually:

```bash
# 1. Navigate to OpenClaw directory
cd /opt/openclaw

# 2. Create backup
mkdir -p /backup/openclaw-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backup/openclaw-$(date +%Y%m%d-%H%M%S)"

# Backup volumes
for volume in openclaw-sessions openclaw-data openclaw-browser openclaw-cache openclaw-logs; do
    echo "Backing up $volume..."
    docker run --rm \
        -v "${volume}:/source:ro" \
        -v "${BACKUP_DIR}:/backup" \
        alpine tar czf "/backup/${volume}.tar.gz" -C /source .
done

# Backup config
cp openclaw-config.json "${BACKUP_DIR}/" 2>/dev/null || true

# 3. Stop container
docker-compose down

# 4. Update Dockerfile
sed -i.bak 's/openclaw@[0-9]\+\.[0-9]\+\.[0-9]\+/openclaw@2026.2.6/g' Dockerfile

# 5. Build new image
docker-compose build --no-cache openclaw

# 6. Start new container
docker-compose up -d

# 7. Wait and check
sleep 30
docker-compose ps
docker-compose logs --tail=50 openclaw

# 8. Verify version
docker-compose exec -T -u node openclaw cat /app/package.json | grep version
```

### Option 5: Use Docker Context (Remote Docker)

If Docker API is exposed on the server:

```bash
# Create Docker context for remote server
docker context create openclaw-remote \
    --docker "host=ssh://root@217.154.231.116"

# Use the context
docker context use openclaw-remote

# Now run commands against remote Docker
docker-compose -f /path/to/docker-compose.yml ps
docker-compose -f /path/to/docker-compose.yml down
docker-compose -f /path/to/docker-compose.yml build --no-cache
docker-compose -f /path/to/docker-compose.yml up -d
```

## Post-Upgrade Verification

### 1. Check Version
```bash
docker-compose exec -T -u node openclaw cat /app/package.json | grep version
# Should show: "version": "2026.2.6"
```

### 2. Check Container Health
```bash
docker-compose ps
# Status should be "Up" and healthy
```

### 3. Test Gateway
```bash
curl https://oclaw.kaoohi.com
# Should return gateway info
```

### 4. Test WebSocket Connection
```bash
cd /Users/arnau1/sources/kaoochat
node test-openclaw-connection.js "Hello, upgraded OpenClaw!"
```

### 5. Test KaooChat Integration
```bash
cd /Users/arnau1/sources/kaoochat
npm run dev
```
Open http://localhost:3000 and verify:
- Chat history is preserved (82 messages)
- New conversations work
- Connection indicator functions properly

### 6. Check New Token Usage Dashboard
Open https://oclaw.kaoohi.com in browser and check for the new token usage dashboard feature.

### 7. Verify Session Data
```bash
docker-compose exec -u node openclaw ls -la /home/node/.openclaw/agents/main/sessions/
# Should show existing session files preserved
```

## Rollback Procedure

If the upgrade fails:

```bash
# Stop new version
cd /opt/openclaw
docker-compose down

# Restore volumes from backup
BACKUP_DIR="/backup/openclaw-YYYYMMDD-HHMMSS"  # Use your backup timestamp
for vol in ${BACKUP_DIR}/*.tar.gz; do
    volname=$(basename $vol .tar.gz)
    echo "Restoring $volname..."
    docker run --rm \
        -v "${volname}:/target" \
        -v "${BACKUP_DIR}:/backup" \
        alpine sh -c "rm -rf /target/* && tar xzf /backup/$(basename $vol) -C /target"
done

# Revert Dockerfile
mv Dockerfile.bak Dockerfile 2>/dev/null || true

# Rebuild with old version
docker-compose build --no-cache

# Start
docker-compose up -d
```

## Troubleshooting

### SSH Connection Refused
- Check if SSH service is running: `systemctl status sshd`
- Check firewall: `ufw status` or `iptables -L`
- Try alternative SSH ports: 2222, 2200, 22022
- Use server console/panel access instead

### Container Won't Start
```bash
# Check logs
docker-compose logs openclaw

# Check resources
docker stats

# Verify volumes
docker volume ls | grep openclaw
```

### Data Loss
If session data appears missing:
```bash
# List volumes
docker volume ls

# Inspect volume
docker run --rm -v openclaw-data:/data alpine ls -la /data

# Restore from backup
docker run --rm \
    -v openclaw-data:/target \
    -v /backup/openclaw-DATE:/backup \
    alpine tar xzf /backup/openclaw-data.tar.gz -C /target
```

### Version Mismatch
If version doesn't update:
```bash
# Force rebuild
docker-compose down
docker-compose build --no-cache --pull
docker-compose up -d

# Verify base image
docker-compose exec openclaw cat /app/package.json
```

## Files Created

1. **upgrade-openclaw-docker.sh** - Automated Docker upgrade script
2. **OPENCLAW_UPGRADE_GUIDE.md** - Comprehensive upgrade guide
3. **OPENCLAW_UPGRADE_INSTRUCTIONS.md** - This file

## Need Help?

If you encounter issues:

1. **Check logs**: `docker-compose logs -f openclaw`
2. **Check container**: `docker-compose ps`
3. **Check resources**: `docker stats`
4. **Verify backups**: `ls -lh /backup/openclaw-*`

## Contact & Support

- OpenClaw GitHub: https://github.com/openclaw/openclaw
- Release Notes: https://github.com/openclaw/openclaw/releases/tag/v2026.2.6

## Next Steps

Choose the option that works for your setup:
- **Option 1**: Enable SSH and use automated script (fastest)
- **Option 3**: Use server console/panel (most reliable if SSH unavailable)
- **Option 4**: Manual commands via console (most control)

All options preserve your data and allow rollback if needed.
