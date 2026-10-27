const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Street Kings" }));

const waiting = [];
const activeRaces = new Map();
const names = new Map();

function cleanName(value) {
  return String(value || "Street Racer").replace(/[<>]/g, "").trim().slice(0, 18) || "Street Racer";
}

function removeFromQueue(id) {
  const i = waiting.indexOf(id);
  if (i !== -1) waiting.splice(i, 1);
}

function queuePlayer(socket) {
  removeFromQueue(socket.id);
  const opponentIndex = waiting.findIndex(id => {
    const s = io.sockets.sockets.get(id);
    return s && s.connected && id !== socket.id;
  });
  if (opponentIndex === -1) {
    waiting.push(socket.id);
    socket.emit("queue:waiting");
    return;
  }
  const opponentId = waiting.splice(opponentIndex, 1)[0];
  const opponent = io.sockets.sockets.get(opponentId);
  if (!opponent) {
    waiting.push(socket.id);
    socket.emit("queue:waiting");
    return;
  }
  const raceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const race = { id: raceId, players: [socket.id, opponentId], stats: {}, startedAt: Date.now(), finished: false };
  activeRaces.set(raceId, race);
  socket.join(raceId);
  opponent.join(raceId);
  io.to(raceId).emit("race:matched", {
    raceId,
    racers: [
      { id: socket.id, name: names.get(socket.id) || "Street Racer" },
      { id: opponent.id, name: names.get(opponent.id) || "Street Racer" }
    ]
  });
  setTimeout(() => {
    const current = activeRaces.get(raceId);
    if (!current || current.finished) return;
    current.finished = true;
    const ids = current.players;
    const score = id => {
      const st = current.stats[id] || { power: 1, reaction: 700 };
      return (Math.max(1, Math.min(10, Number(st.power) || 1)) * 0.8) +
        (Math.max(0, Math.min(1500, Number(st.reaction) || 700)) / 1500) * 0.2 +
        Math.random() * 0.15;
    };
    const a = score(ids[0]), b = score(ids[1]);
    const winnerId = a >= b ? ids[0] : ids[1];
    io.to(raceId).emit("race:result", {
      raceId,
      winnerId,
      times: {
        [ids[0]]: (10.8 - score(ids[0]) * 0.55 + Math.random() * 0.1).toFixed(3),
        [ids[1]]: (10.8 - score(ids[1]) * 0.55 + Math.random() * 0.1).toFixed(3)
      },
      winnerName: names.get(winnerId) || "Street Racer"
    });
    setTimeout(() => activeRaces.delete(raceId), 30000);
  }, 8500);
}

io.on("connection", socket => {
  socket.emit("server:hello", { online: io.engine.clientsCount });
  socket.on("player:name", name => { names.set(socket.id, cleanName(name)); });
  socket.on("race:queue", () => queuePlayer(socket));
  socket.on("race:stats", payload => {
    const race = activeRaces.get(String(payload && payload.raceId));
    if (!race || race.finished || !race.players.includes(socket.id)) return;
    const power = Number(payload.power);
    const reaction = Number(payload.reaction);
    race.stats[socket.id] = {
      power: Number.isFinite(power) ? Math.max(1, Math.min(10, power)) : 1,
      reaction: Number.isFinite(reaction) ? Math.max(0, Math.min(1500, reaction)) : 700
    };
  });
  socket.on("race:cancel", () => removeFromQueue(socket.id));
  socket.on("disconnect", () => {
    removeFromQueue(socket.id);
    names.delete(socket.id);
    for (const [raceId, race] of activeRaces) {
      if (!race.finished && race.players.includes(socket.id)) {
        io.to(raceId).emit("race:opponent-left");
        activeRaces.delete(raceId);
      }
    }
  });
});

server.listen(PORT, () => console.log(`Street Kings running on port ${PORT}`));