# ! LabOps Development (Node.js)
`Node.js v18+`

> **🆕 New to coding?** Read `QUICK_START.md` for a super simple step-by-step guide!  
> **📝 Need quick setup?** Read `SETUP.txt` for a 5-minute setup guide!

## Quick Setup

1. **Install Node.js** from https://nodejs.org/
2. **Get bot token** from https://discord.com/developers/applications
3. **Run these commands:**
```bash
npm install
```
4. **Create `.env` file** with your token:
```
TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
OWNER_ID=your_discord_user_id_here
```
5. **Edit `config.json`** with your Discord IDs
6. **Start bot:**
```bash
node deploy-commands.js
node index.js
```

## Features

* 🌐 Global Ban/Unban Commands Across Multiple Servers
* 🧾 Role Request System with Approval Workflow
* ⚙️ Assign/Unassign Single or Multiple Roles
* 🧼 Mass Role Operations (Role All Members)
* 🛠️ Channel Lockdown, Mute, and Cleanup Utilities
* 📊 User & Server Info Display
* 🔄 Role Sync Between Servers
* 🛡️ Bot Protection & Alt Account Detection
* 📩 DM Forwarding System
* 💾 Role Backup & Restore System
* 🔐 Verification System with Button Support
* ⏱️ Custom Bot Status Display (Configurable via config.json)
* 🛡️ All Features Configurable via `config.json`

---

## Commands Overview

### 🌐 Global Moderation

| Command               | Description                                 |
| --------------------- | ------------------------------------------- |
| `/globalban`          | Ban a user from all linked servers (with confirmation & cooldown) |
| `/globalunban`        | Remove global ban from a user across all servers |
| `/checkban`           | Check if a user is globally banned |
| `/globallinkserver`   | Link a server to the global ban system (requires link permission) |
| `/ungloballink`       | Unlink a server from global system (requires link permission) |
| `/setlinkpermission`  | Manage who can use link/unlink commands (Owner only) |
| `/listlinkedguilds`   | List all linked servers and which ones you can access |
| `/setglobalrole`      | Set roles that can use global ban commands in this server (Owner only) |
| `/removeglobalrole`   | Remove a role from global mod permissions (Owner only) |
| `/listglobalroles`    | List all global mod roles in every server |
| `/clearallglobalroles` | Remove all global mod roles (Bot owner only) |
| `/lockall`            | Lock all text channels across all servers (Owner only) |
| `/unlockall`          | Unlock all text channels across all servers (Owner only) |

### 🧾 Role Management

| Command               | Description                               |
| --------------------- | ----------------------------------------- |
| `/assignrole`         | Assign a single role to a user            |
| `/unassignrole`       | Remove a role from a user                |
| `/assignmultiple`     | Assign up to 5 roles to a user at once   |
| `/unassignmultiple`   | Remove up to 5 roles from a user at once  |
| `/requestrole`        | Request a role with approval workflow     |
| `/setuprequestrole`   | Configure role request system (Owner only) |
| `/roleall`            | Assign a role to everyone in the server   |
| `/setupautorole`      | Configure auto role for new members       |
| `/forceverify`        | Manually verify a user and assign verified role |

### 🧹 Moderation Tools

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `/mute`         | Timeout (mute) a member for specified minutes (1-43200) |
| `/unmute`       | Remove timeout from a member       |
| `/lock`         | Lock the current channel           |
| `/unlock`       | Unlock the current channel         |
| `/slowmode`     | Set slowmode delay (0-21600 seconds) for channel |
| `/clear`        | Delete messages from a channel (1-100) |
| `/blacklist`    | Blacklist a user (remove all roles, assign blacklist role) |
| `/unblacklist`  | Remove blacklist role and restore member role |

### 📊 Information Commands

| Command       | Description                        |
| ------------- | ---------------------------------- |
| `/userinfo`   | Display detailed information about a user |
| `/serverinfo` | Display server and bot statistics |

### 🛠️ Utility Commands

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `/setdmforward`    | Set channel where bot DMs are forwarded |
| `/api restore`     | Restore roles for a previously kicked/banned user |

---

## Automatic Features (Events)

### 🎯 Auto Role System
- Automatically assigns configured roles to new members when they join
- Configurable per server via `/setupautorole`
- Supports role hierarchy checks

### 🛡️ Bot Protection
- Automatically kicks unauthorized bots added to the server
- Logs bot additions with executor information
- Allows whitelisted users to add bots

### ⚠️ Alt Account Detection
- Detects new accounts joining the server (configurable age threshold)
- Sends alerts to log channel with approve/deny buttons
- Automatically assigns denied role if account is too new

### 💾 Role Backup & Restore
- Automatically backs up user roles when they are kicked or banned
- Backups expire after 24 hours
- Restore roles using `/api restore` command

### 🔄 Role Sync System
- Syncs roles between two configured servers
- Bidirectional role synchronization
- Configurable role mappings in `config.json`

### 📩 DM Forwarding
- Forwards all DMs received by the bot to configured channels
- Supports attachments and embeds
- Per-server configuration

### 👋 Welcome Messages
- Sends welcome embeds when members join
- Configurable welcome channel and message
- Customizable branding

### 📊 Status Display
- Live status embed with rotating colors
- Shows server count, member count, ping, and uptime
- Fully configurable via `config.json` (channels, colors, buttons, update interval)
- Auto-updates at configurable intervals
- Includes verify button for member verification

### 🔐 Verification System
- Button-based verification system on status display
- Removes unverified role and assigns verified role when button is clicked
- Configurable via `config.json` (autoRoleId and VerifyRoleID)

---

## Setup Requirements

* `Node.js v18+`
* Required files:
  * `.env` (contains `CLIENT_ID`, `BOT_TOKEN`, `OWNER_ID`, etc.)
  * `config.json` (all configuration settings)
  * JSON storage files:
    * `Ban_File.json` - Global ban list
    * `Link_Permissions.json` - Link command permissions
    * `GlobalRoles.json` - Global moderator roles per server
    * `Guild_Linked.json` - Linked servers for global bans
    * `role_backups.json` - Role backups for kicked/banned users
    * `Pending_Bans.json` - Pending global ban approvals
    * `Pending_Alt_Checks.json` - Pending alt account checks
    * `data/autoRoles.json` - Auto role configurations
    * `data/roleRequests.json` - Role request system config
    * `dmForwardConfig.json` - DM forwarding configuration
    * `autoroleConfig.json` - Legacy auto role config

---

## Configuration

All features are configurable via `config.json`. Key settings include:

- **Moderation Roles**: Roles that can use moderation commands
- **Log Channels**: Channels for logging various actions
- **Global System**: Global ban and role management settings
- **Role Sync**: Bidirectional role synchronization between servers
- **Alt Checker**: Account age threshold and approver roles
- **DM Forwarding**: Per-server DM forwarding channels
- **Welcome System**: Welcome channel and branding

---

## Permission Requirements

The bot requires the following permissions:
- `Manage Roles` - For role assignment/removal
- `Ban Members` - For ban commands
- `Kick Members` - For kick commands
- `Manage Channels` - For lock/unlock/slowmode
- `Manage Messages` - For clear command
- `Send Messages` - For all messaging features
- `Embed Links` - For embed features
- `Read Message History` - For message operations

---

## License

Copyright (c) realcrow2  
All rights reserved.

---

## Developer

* **Discord:** realcrow2 (`1228084539138506845`)  
* **GitHub:** [https://github.com/realcrow2](https://github.com/realcrow2)

---

*Contributions and suggestions are welcome. DM on Discord to get in touch.*
