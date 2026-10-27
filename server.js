const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Street Kings V2" }));

// Owner access is deliberately disabled until OWNER_PASSWORD is configured in Render.
const ownerSessions = new Map();
const loginAttempts = new Map();
function ownerToken(req) {
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const expiry = ownerSessions.get(token);
  if (!expiry || expiry < Date.now()) { ownerSessions.delete(token); return null; }
  return token;
}
app.get("/api/owner/status", (req, res) => {
  res.json({ configured: Boolean(process.env.OWNER_PASSWORD), authenticated: Boolean(ownerToken(req)) });
});
app.post("/api/owner/login", (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
  if (attempt.until > Date.now()) return res.status(429).json({ error: "Too many attempts. Wait 10 minutes and try again." });
  if (!process.env.OWNER_PASSWORD) return res.status(503).json({ error: "Owner access is not configured yet. Add OWNER_PASSWORD in Render Environment settings." });
  const supplied = String(req.body && req.body.password || "");
  const expected = String(process.env.OWNER_PASSWORD);
  const a = Buffer.from(supplied), b = Buffer.from(expected);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) {
    attempt.count++;
    if (attempt.count >= 6) { attempt.count = 0; attempt.until = Date.now() + 10 * 60 * 1000; }
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: "That owner password was not correct." });
  }
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  ownerSessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
  res.json({ ok: true, token, expiresInHours: 12 });
});
app.post("/api/owner/logout", (req, res) => {
  const token = ownerToken(req);
  if (token) ownerSessions.delete(token);
  res.json({ ok: true });
});

const waiting = [];
const activeRaces = new Map();
const names = new Map();
function cleanName(value) { return String(value || "Street Racer").replace(/[<>]/g, "").trim().slice(0, 18) || "Street Racer"; }
function removeFromQueue(id) { const i = waiting.indexOf(id); if (i !== -1) waiting.splice(i, 1); }
function queuePlayer(socket) {
  removeFromQueue(socket.id);
  const opponentIndex = waiting.findIndex(id => { const s = io.sockets.sockets.get(id); return s && s.connected && id !== socket.id; });
  if (opponentIndex === -1) { waiting.push(socket.id); socket.emit("queue:waiting"); return; }
  const opponentId = waiting.splice(opponentIndex, 1)[0];
  const opponent = io.sockets.sockets.get(opponentId);
  if (!opponent) { waiting.push(socket.id); socket.emit("queue:waiting"); return; }
  const raceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const race = { id: raceId, players: [socket.id, opponentId], stats: {}, startedAt: Date.now(), finished: false };
  activeRaces.set(raceId, race); socket.join(raceId); opponent.join(raceId);
  io.to(raceId).emit("race:matched", { raceId, racers: [{ id: socket.id, name: names.get(socket.id) || "Street Racer" }, { id: opponent.id, name: names.get(opponent.id) || "Street Racer" }] });
  setTimeout(() => {
    const current = activeRaces.get(raceId); if (!current || current.finished) return; current.finished = true;
    const ids = current.players;
    const score = id => { const st = current.stats[id] || { power: 1, reaction: 700 }; return (Math.max(1, Math.min(10, Number(st.power) || 1)) * 0.8) + ((1500 - Math.max(0, Math.min(1500, Number(st.reaction) || 700))) / 1500) * 0.2 + Math.random() * 0.15; };
    const a = score(ids[0]), b = score(ids[1]); const winnerId = a >= b ? ids[0] : ids[1];
    const timeFor = id => (10.8 - score(id) * 0.55 + Math.random() * 0.1).toFixed(3);
    io.to(raceId).emit("race:result", { raceId, winnerId, times: { [ids[0]]: timeFor(ids[0]), [ids[1]]: timeFor(ids[1]) }, winnerName: names.get(winnerId) || "Street Racer" });
    setTimeout(() => activeRaces.delete(raceId), 30000);
  }, 8500);
}
io.on("connection", socket => {
  socket.emit("server:hello", { online: io.engine.clientsCount });
  socket.on("player:name", name => { names.set(socket.id, cleanName(name)); });
  socket.on("race:queue", () => queuePlayer(socket));
  socket.on("race:stats", payload => {
    const race = activeRaces.get(String(payload && payload.raceId)); if (!race || race.finished || !race.players.includes(socket.id)) return;
    const power = Number(payload.power), reaction = Number(payload.reaction);
    race.stats[socket.id] = { power: Number.isFinite(power) ? Math.max(1, Math.min(10, power)) : 1, reaction: Number.isFinite(reaction) ? Math.max(0, Math.min(1500, reaction)) : 700 };
  });
  socket.on("race:cancel", () => removeFromQueue(socket.id));
  socket.on("disconnect", () => {
    removeFromQueue(socket.id); names.delete(socket.id);
    for (const [raceId, race] of activeRaces) if (!race.finished && race.players.includes(socket.id)) { io.to(raceId).emit("race:opponent-left"); activeRaces.delete(raceId); }
  });
});
server.listen(PORT, () => console.log(`Street Kings V2 running on port ${PORT}`));
