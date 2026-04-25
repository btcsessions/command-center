# Command Center - Project Notes

## Architecture
- **Client**: Vite-based vanilla JS app (ES modules) in `client/`
- **Server**: Express + SQLite in `server/`
- **Deployment**: Docker on Umbrel, accessed via Tailscale at `http://100.118.162.66:3050`
- **Code pipeline**: Push to GitHub → Gitea mirrors automatically → Deploy from Gitea on Umbrel
- **Gitea**: Self-hosted on Umbrel at port 8085, repo `btcsessions/command-center`

## Troubleshooting

### App not accessible after Umbrel OS update
Umbrel OS updates often stop or remove Docker containers. Fix:

```bash
# 1. Check if container is running
sudo docker ps | grep next-action

# 2. Check if it exists but stopped
sudo docker ps -a | grep next-action

# 3. If gone, redeploy
cd ~/command-center && sudo docker compose up -d

# 4. If the directory was wiped, re-clone from Gitea first
cd ~ && git clone http://localhost:8085/btcsessions/command-center.git
cd command-center && sudo docker compose up -d
```

### Tailscale IP check
```bash
sudo docker exec tailscale_web_1 tailscale ip -4
```

### Gitea Funnel (if needed)
```bash
sudo docker exec tailscale_web_1 tailscale funnel 8085
```
Exposes Gitea at `https://umbrel1.tail553d8.ts.net/`

### Data sync issues / tasks missing
- Use the Force Sync button (top-right) to clear local IndexedDB and reload from server
- Categories and Habits are stored in localStorage (client-only, not synced between devices)

### Server DB reset (nuclear option)
If project fields or tasks are corrupted on the server:
```bash
# On Umbrel, stop the container, delete the DB, restart
cd ~/command-center
sudo docker compose down
sudo rm -f server/data/nextaction.db
sudo docker compose up -d
```
Then Force Sync on each device to repopulate from scratch.
