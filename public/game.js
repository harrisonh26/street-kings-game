(() => {
  const $ = id => document.getElementById(id);
  const CARS = [
    { id:"kairo", name:"Kairo S", price:0, hp:120, grip:54, accel:5.8, desc:"A lightweight street starter.", color:"#d5ff45", tier:1 },
    { id:"vortex", name:"Vortex GT", price:6500, hp:205, grip:68, accel:4.4, desc:"Turbo power with sharp handling.", color:"#ff5264", tier:2 },
    { id:"phantom", name:"Phantom R", price:22000, hp:320, grip:79, accel:3.3, desc:"A night-runner built to dominate.", color:"#70d9ff", tier:3 }
  ];
  const DEFAULT = { cash:1000, owned:["kairo"], car:"kairo", upgrades:{engine:1,tyres:1,nitro:0}, rep:0, wins:0, losses:0, history:[] };
  let state = load();
  let socket = null, currentRace = null, queueTimeout = null, startTimeouts = [], launchStart = 0, launched = false, toastTimer;
  const money = n => "$" + Math.floor(n).toLocaleString("en-US");
  const car = () => CARS.find(c => c.id === state.car) || CARS[0];
  const hp = () => car().hp + (state.upgrades.engine - 1) * 22 + state.upgrades.nitro * 12;
  const grip = () => car().grip + (state.upgrades.tyres - 1) * 9;
  const powerScore = () => Math.min(10, hp()/45 + grip()/35 + state.upgrades.nitro*.2);
  function load() {
    try { const raw = JSON.parse(localStorage.getItem("streetKingsSave") || "null"); if (raw && typeof raw === "object") return { ...structuredClone(DEFAULT), ...raw, upgrades:{...DEFAULT.upgrades,...raw.upgrades}, history:Array.isArray(raw.history)?raw.history:[] }; } catch {}
    return structuredClone(DEFAULT);
  }
  function save() {
    try { localStorage.setItem("streetKingsSave", JSON.stringify(state)); $("saveStatus").textContent = "Progress saved on this device"; }
    catch { $("saveStatus").textContent = "Could not save — storage unavailable"; }
  }
  function notify(msg) {
    const el = $("toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function showModal(title, text) { $("modalTitle").textContent=title; $("modalText").textContent=text; $("modal").classList.remove("hidden"); }
  function addHistory(title, subtitle, reward) {
    state.history.unshift({title, subtitle, reward, date:new Date().toLocaleDateString()});
    state.history = state.history.slice(0,6);
  }
  function render() {
    $("cash").textContent=money(state.cash); $("rep").textContent=state.rep>=12?"Street Legend":state.rep>=6?"Pro Racer":state.rep>=2?"Rising Star":"Rookie";
    $("heroPower").textContent=hp(); $("heroCarName").textContent=car().name.toUpperCase();
    $("currentCarName").textContent=car().name; $("currentCarDesc").textContent=car().desc;
    $("powerStat").textContent=hp()+" HP"; $("gripStat").textContent=grip(); $("accelStat").textContent=Math.max(2.3,car().accel-(state.upgrades.engine-1)*.22-state.upgrades.nitro*.12).toFixed(1)+"s";
    $("carTier").textContent="TIER "+car().tier;
    $("upgradeBtn").textContent=`UPGRADE ENGINE — ${money(upgradeCost("engine"))}`;
    $("engineLevel").textContent="Lv. "+state.upgrades.engine; $("tyreLevel").textContent="Lv. "+state.upgrades.tyres; $("nitroLevel").textContent="Lv. "+state.upgrades.nitro;
    $("carMarket").innerHTML=CARS.map(c=>{
      const owned=state.owned.includes(c.id), active=state.car===c.id;
      return `<div class="market-car ${owned?"owned":""}"><div class="market-art" style="--car-color:${c.color}"><div class="roof"></div><div class="shape"></div></div><h4>${c.name}</h4><p>${c.hp} HP · ${c.desc}</p><div class="price">${owned?"OWNED":money(c.price)}</div><button class="btn ${active?"ghost":"primary"}" data-car="${c.id}" ${active?"disabled":""}>${active?"SELECTED":owned?"SELECT":"BUY RIDE"}</button></div>`;
    }).join("");
    document.querySelectorAll("[data-car]").forEach(btn=>btn.addEventListener("click",()=>chooseCar(btn.dataset.car)));
    document.querySelectorAll("[data-upgrade]").forEach(btn=>btn.onclick=()=>upgrade(btn.dataset.upgrade));
    $("history").innerHTML=state.history.length?state.history.map(h=>`<div class="history-item"><div class="history-icon">↗</div><div><b>${escapeHtml(h.title)}</b><small>${escapeHtml(h.subtitle)} · ${h.date}</small></div><strong>${h.reward>=0?"+":""}${money(h.reward)}</strong></div>`).join(""):'<div class="empty-history">Your race history will show up here.</div>';
    document.querySelectorAll(".car-illustration,.mini-body,.mini-roof").forEach(el=>el.style.background=car().color);
    save();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function upgradeCost(type) { const level=state.upgrades[type]; return type==="engine"?Math.floor(750*Math.pow(1.75,level-1)):type==="tyres"?Math.floor(600*Math.pow(1.7,level-1)):Math.floor(1800*Math.pow(2,level)); }
  function upgrade(type) {
    if (type==="engine" && state.upgrades.engine>=10) return notify("Engine is already maxed.");
    if (type==="tyres" && state.upgrades.tyres>=8) return notify("Tyres are already maxed.");
    if (type==="nitro" && state.upgrades.nitro>=5) return notify("Nitrous is already maxed.");
    const cost=upgradeCost(type); if(state.cash<cost) return notify(`You need ${money(cost)} for that upgrade.`);
    state.cash-=cost; state.upgrades[type]++; render(); notify(`${type[0].toUpperCase()+type.slice(1)} upgraded!`);
  }
  function chooseCar(id) {
    const c=CARS.find(x=>x.id===id); if(!c)return;
    if(state.owned.includes(id)){state.car=id;render();notify(`${c.name} selected.`);return;}
    if(state.cash<c.price)return notify(`You need ${money(c.price)} to buy this car.`);
    state.cash-=c.price;state.owned.push(id);state.car=id;render();notify(`${c.name} added to your garage!`);
  }
  function initSocket() {
    if(typeof io!=="function"){ $("online").textContent="Offline mode"; return; }
    socket=io();
    socket.on("connect",()=>{$("online").textContent="Online";socket.emit("player:name",promptName());});
    socket.on("disconnect",()=>{$("online").textContent="Offline";});
    socket.on("server:hello",d=>{$("online").textContent=`${d.online} online`;});
    socket.on("queue:waiting",()=>{setStatus("Searching for another racer…");$("cancelQueue").classList.remove("hidden");});
    socket.on("race:matched",data=>{
      currentRace=data; $("cancelQueue").classList.add("hidden"); clearTimeout(queueTimeout);
      const rival=data.racers.find(r=>r.id!==socket.id);
      setStatus(`Matched with ${rival?rival.name:"a rival"} — race starts now!`);
      $("reactionWrap").classList.remove("hidden"); $("startLight").textContent="READY";$("startLight").classList.remove("go");$("launchBtn").disabled=true;launched=false;
      socket.emit("race:stats",{raceId:data.raceId,power:powerScore(),reaction:700});
      startTimeouts.forEach(clearTimeout); startTimeouts=[];
      startTimeouts.push(setTimeout(()=>{$("startLight").textContent="3";},700));
      startTimeouts.push(setTimeout(()=>{$("startLight").textContent="2";},1400));
      startTimeouts.push(setTimeout(()=>{$("startLight").textContent="1";},2100));
      startTimeouts.push(setTimeout(()=>{$("startLight").textContent="GO!";$("startLight").classList.add("go");$("launchBtn").disabled=false;launchStart=Date.now();},2800));
      startTimeouts.push(setTimeout(()=>finishLaunch(true),5800));
    });
    socket.on("race:result",data=>{
      if(!currentRace || data.raceId!==currentRace.raceId)return;
      const won=data.winnerId===socket.id;const reward=won?1500+car().tier*500:250;
      state.cash+=reward;state.rep+=won?2:1;if(won)state.wins++;else state.losses++;
      const myTime=data.times[socket.id]||"—", rivalTime=data.times[currentRace.racers.find(r=>r.id!==socket.id)?.id]||"—";
      $("yourLaneTime").textContent=myTime+"s";$("rivalLaneTime").textContent=rivalTime+"s";
      animateCars();addHistory(won?"Multiplayer victory":"Multiplayer race",`Quarter-mile · ${myTime}s vs ${rivalTime}s`,reward);render();
      showModal(won?"YOU OWNED THE NIGHT":"RACE LOST",`${won?"You beat":"You raced"} ${data.winnerName==="You"?"your rival":data.winnerName}. Your time: ${myTime}s. ${won?"Winner's purse":"Participation payout"}: ${money(reward)}.`);
      currentRace=null;$("reactionWrap").classList.add("hidden");
    });
    socket.on("race:opponent-left",()=>{setStatus("Your opponent disconnected. Try another race.");currentRace=null;});
  }
  function promptName(){let n=localStorage.getItem("streetKingsName");if(!n){n=prompt("Choose a racer name (optional):","Street Racer")||"Street Racer";n=n.trim().slice(0,18)||"Street Racer";localStorage.setItem("streetKingsName",n);}return n;}
  function setStatus(text){$("raceStatus").lastElementChild.textContent=text;}
  function animateCars(){document.querySelector(".player-lane-car").style.left="78%";document.querySelector(".rival-lane-car").style.left="68%";}
  function resetLanes(){document.querySelector(".player-lane-car").style.left="4px";document.querySelector(".rival-lane-car").style.left="4px";$("yourLaneTime").textContent="—";$("rivalLaneTime").textContent="—";}
  function onlineRace(){
    if(!socket){notify("Online server unavailable. Try a solo sprint.");return;}
    if(!socket.connected){notify("Connecting to multiplayer server…");return;}
    if(currentRace)return notify("You're already in a race.");
    resetLanes();$("reactionWrap").classList.add("hidden");socket.emit("race:queue");setStatus("Joining the street-racing queue…");
    queueTimeout=setTimeout(()=>{if(!currentRace){setStatus("Still waiting. Leave this tab open for another racer.");}},12000);
  }
  function cancelQueue(){if(socket)socket.emit("race:cancel");clearTimeout(queueTimeout);$("cancelQueue").classList.add("hidden");setStatus("Queue cancelled.");}
  function finishLaunch(auto=false){
    if(launched)return;launched=true;
    const reaction=launchStart?Math.min(1500,Date.now()-launchStart):1500;
    if(socket&&currentRace)socket.emit("race:stats",{raceId:currentRace.raceId,power:powerScore(),reaction});
    $("launchBtn").disabled=true;
    if(!auto)notify(`Launch reaction: ${reaction} ms`);
  }
  function soloRun(){
    resetLanes();$("reactionWrap").classList.remove("hidden");$("startLight").textContent="READY";$("startLight").classList.remove("go");$("launchBtn").disabled=true;launched=false;currentRace={solo:true};
    setStatus("Solo sprint: wait for GO, then launch.");
    startTimeouts.forEach(clearTimeout);startTimeouts=[];
    const delay=2200+Math.random()*2600;
    startTimeouts.push(setTimeout(()=>{$("startLight").textContent="GO!";$("startLight").classList.add("go");$("launchBtn").disabled=false;launchStart=Date.now();},delay));
    startTimeouts.push(setTimeout(()=>{if(!launched)finishSolo(true);},delay+2300));
  }
  function finishSolo(auto=false){
    if(launched)return;launched=true;const reaction=launchStart?Date.now()-launchStart:2300;const score=powerScore()+(reaction<450?.8:reaction<700?.4:0)+(Math.random()*.8);
    const won=score>2.8;const reward=won?Math.round(400+hp()*3+Math.max(0,700-reaction)):100;
    state.cash+=reward;state.rep+=won?1:0;if(won)state.wins++;else state.losses++;
    const myTime=(11.9-(score*.45)+Math.random()*.2).toFixed(3), rivalTime=(10.5+Math.random()*.8).toFixed(3);
    $("yourLaneTime").textContent=myTime+"s";$("rivalLaneTime").textContent=rivalTime+"s";animateCars();
    addHistory(won?"Solo sprint win":"Solo sprint",`${myTime}s vs ${rivalTime}s`,reward);render();$("reactionWrap").classList.add("hidden");
    showModal(won?"NICE RUN!":"KEEP TUNING",`${won?"You won the solo sprint!":"The rival edged you out."} Reaction: ${reaction} ms. You earned ${money(reward)}.`);currentRace=null;
  }
  $("quickRace").onclick=onlineRace;$("onlineRace").onclick=onlineRace;$("cancelQueue").onclick=cancelQueue;
  $("soloRace").onclick=soloRun;$("soloRun").onclick=soloRun;$("launchBtn").onclick=()=>{if(currentRace&&currentRace.solo)finishSolo(false);else finishLaunch(false);};
  $("upgradeBtn").onclick=()=>upgrade("engine");
  $("resetGame").onclick=()=>{if(confirm("Reset your local Street Kings progress? This cannot be undone.")){state=structuredClone(DEFAULT);save();render();notify("Save reset.");}};
  $("modalClose").onclick=$("modalOk").onclick=()=>{$("modal").classList.add("hidden");};
  initSocket();render();
})();