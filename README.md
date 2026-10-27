# Street Kings V2

A browser street-racing game with 30 cars, car search/class filters, vehicle stats, six upgrade types, paint customisation, solo sprints, Socket.IO multiplayer, local saves, and a protected owner mode.

## Deploy on Render

1. Upload the **contents** of this folder to the top level of your GitHub repository (so `server.js`, `package.json`, and `public/` are visible together).
2. In Render, create or update a **Web Service** connected to that repository.
3. Use:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Root directory:** leave blank when the files are at repository top level
   - **Instance:** Free is okay for testing
4. In Render, open the service's **Environment** settings and add:
   - **Key:** `OWNER_PASSWORD`
   - **Value:** a strong, private password you choose (at least 16 characters is recommended)
5. Save the environment variable. Render will redeploy the service. When the deployment says **Live**, open the service URL.

## Owner Mode

Click **OWNER LOGIN** in the game and enter the same password you saved as `OWNER_PASSWORD` in Render. Owner Mode provides unlimited in-game cash while active and unlocks the complete car collection. The Owner Control Room also includes buttons to unlock all cars/max all upgrades on the local save, add $10,000,000, or restore the starter save.

Owner authentication is checked by the server. Do not share the owner password. The game prototype saves normal player progress in the browser's local storage, so normal progress is device/browser-specific.

## Notes

- Free Render web services can sleep after inactivity; the first visit after a quiet period may take a little longer.
- Multiplayer requires at least two people online at the same time and waiting in the queue.
- Car names and specifications are fictionalised game data for gameplay balance; the game is a fan-made prototype, not an official product.
