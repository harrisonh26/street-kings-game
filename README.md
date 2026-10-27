# Street Kings — browser street-racing game

A playable web game prototype with:
- Cash, three cars, garage selection and upgrades
- Solo reaction-time sprints and race rewards
- Live multiplayer matchmaking using Socket.IO
- Local save data in the browser
- Responsive desktop/mobile layout

## Run it on your computer

You need Node.js 18 or newer. Download it from https://nodejs.org/.

1. Unzip the `street-kings.zip` file.
2. Open the `street-kings` folder.
3. In that folder, open a terminal / Command Prompt.
4. Run:

   ```bash
   npm install
   npm start
   ```

5. Open http://localhost:3000 in your browser.

Keep the terminal running while you play. Multiplayer works between browsers/devices connected to the same running server.

## Deploy it online with Render

1. Create a GitHub account if you don't have one, then create a new repository named `street-kings`.
2. Upload the contents of this folder to the repository (make sure `package.json` and `server.js` are at the repository root).
3. Sign in to https://render.com/ and create a **New Web Service** connected to that repository.
4. Use these settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free, if available for your account
5. Click **Deploy**. Open the `onrender.com` URL Render provides.

Other hosts that support long-lived Node.js web services and WebSockets can also run this project.

## Important notes

- Game progress is saved in `localStorage` on the player's device. Clearing browser data or switching devices resets that local save.
- Multiplayer matchmaking requires the deployed server to be running. To test with two players, open the game URL in two browsers or on two devices.
- This is a starter prototype, not a cheat-resistant commercial game. Cash and upgrades are stored client-side and can be edited by a player in their own browser. Multiplayer results are calculated by the server, but the server does not yet have accounts, a persistent database, anti-cheat validation, moderation, or a global leaderboard.
- Don't put passwords, API keys, or private credentials in the public repository.
