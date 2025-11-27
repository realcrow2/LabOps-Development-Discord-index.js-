# 🚀 Quick Start Guide

## Step 1: Download Node.js
1. Go to: https://nodejs.org/
2. Download the **LTS version** (big green button)
3. Install it (just click Next, Next, Next)

## Step 2: Get Your Bot Token
1. Go to: https://discord.com/developers/applications
2. Click **"New Application"** → Name it → Create
3. Go to **"Bot"** tab → Click **"Add Bot"** → Yes
4. Click **"Reset Token"** → Copy the token (save it somewhere safe!)
5. Scroll down → Enable these:
   - ✅ MESSAGE CONTENT INTENT
   - ✅ SERVER MEMBERS INTENT
6. Go to **"OAuth2"** → **"URL Generator"**
   - Select: `bot` and `applications.commands`
   - Copy the URL at the bottom
   - Open it in a browser → Invite bot to your server

## Step 3: Setup the Bot
1. **Extract** the bot files to a folder
2. **Open** the folder in File Explorer
3. **Right-click** in the folder → **"Open in Terminal"** (or **"Open PowerShell here"**)

## Step 4: Install Dependencies
In the terminal, type:
```
npm install
```
Press Enter. Wait for it to finish.

## Step 5: Create .env File
1. In the bot folder, create a new file named: `.env`
2. Open it in Notepad
3. Paste this (replace with YOUR info):
```
TOKEN=your_bot_token_here
CLIENT_ID=your_bot_client_id_here
OWNER_ID=your_discord_user_id_here
```

**How to get these:**
- **TOKEN**: The token you copied in Step 2
- **CLIENT_ID**: In Discord Developer Portal → "General Information" → Copy "Application ID"
- **OWNER_ID**: In Discord → Settings → Advanced → Enable "Developer Mode" → Right-click your name → "Copy ID"

## Step 6: Configure Bot
1. Open `config.json` in Notepad
2. Replace ALL `YOUR_*_ID` with your actual Discord IDs
3. Save the file

**How to get IDs:**
- Right-click on channels/roles/users → "Copy ID" (need Developer Mode enabled)

## Step 7: Start the Bot
In the terminal, type:
```
node index.js
```
Press Enter.

**You should see:**
```
╔═══════════════════════════════════════╗
║     LabOps Development                ║
║     ✅ Bot is online and ready!        ║
╚═══════════════════════════════════════╝
```

## ✅ Done!
Your bot is now running! Test it with `/help` in your Discord server.

---

## 🆘 Having Problems?

**"Cannot find module"**
→ Run `npm install` again

**"Invalid token"**
→ Check your `.env` file has the correct token

**"Commands not showing"**
→ Wait 5 minutes, or run: `node deploy-commands.js`

**Need help?**
→ Check the full README.md for more details

