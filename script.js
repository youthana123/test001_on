/* ════════════════════════════════════════
   ⚙️ ตั้งค่า THINGER.IO
   ════════════════════════════════════════ */
const APP_CONFIG = {
  USERNAME: "Yout45",  // <-- ใส่ Username ของคุณที่นี่
  TOKEN:    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkZXYiOiJoZWxtZXRfMDEiLCJpYXQiOjE3Nzg0MTA0NTYsImp0aSI6IjZhMDA2M2Q4ZDYxYTdkYWFmODBhMmQ1YSIsInN2ciI6ImFwLXNvdXRoZWFzdC5hd3MudGhpbmdlci5pbyIsInVzciI6IllvdXQ0NSJ9.uyA0o7BSQuhDA5OX59Ya5n6HUO4e74UADg91rComJ8g"       // <-- ใส่ Access Token
};

let currentWorkerDevice = ""; 
let html5QrCode = null;

// เปลี่ยนหน้า
function go(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('show'));
  document.getElementById(id).classList.add('show');
  window.scrollTo(0,0);
}

/* ── Scanner Logic (แบบเปิดกล้องทันที) ── */
function startScanner() {
  go('pgScan');
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  
  const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

  html5QrCode.start({ facingMode: "environment" }, qrConfig, onScanSuccess, onScanFailure)
    .catch(err => {
      console.warn("ไม่พบกล้องหลัง กำลังสลับไปใช้กล้องหน้า/เว็บแคม...", err);
      html5QrCode.start({ facingMode: "user" }, qrConfig, onScanSuccess, onScanFailure)
        .catch(err2 => {
          toast('❌ ไม่สามารถเข้าถึงกล้องได้ กรุณาตรวจสอบการอนุญาตใช้งานกล้อง', 'err');
          setTimeout(() => go('pgHome'), 2500);
        });
    });
}

function onScanSuccess(decodedText, decodedResult) {
  let helmetId = decodedText;
  try {
    let url = new URL(decodedText);
    helmetId = url.searchParams.get("id") || decodedText;
  } catch(e) {}

  currentWorkerDevice = helmetId;
  document.getElementById('displayHelmetId').textContent = currentWorkerDevice;
  
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      go('pgWorker');
      toast('✅ สแกนรหัสหมวก: ' + currentWorkerDevice + ' สำเร็จ');
    });
  }
}

function onScanFailure(error) {
  // ไม่ต้องทำอะไร ปล่อยให้มันรันต่อไปจนกว่าจะสแกนติด
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      go('pgHome');
    }).catch(() => go('pgHome'));
  } else {
    go('pgHome');
  }
}

/* ── PIN Login ── */
const PIN='1234'; let pinBuf='';
function pp(d){
  if(pinBuf.length>=4) return; pinBuf+=d; renderPin();
  if(pinBuf.length===4) setTimeout(checkPin,150);
}
function pd(){ pinBuf=pinBuf.slice(0,-1); renderPin(); document.getElementById('pinErr').classList.remove('show'); }
function renderPin(){
  for(let i=0;i<4;i++){
    const c=document.getElementById('pc'+i);
    c.classList.toggle('on',i<pinBuf.length); c.classList.remove('bad');
  }
}
function checkPin(){
  if(pinBuf===PIN){
    go('pgBoss'); pinBuf=''; renderPin();
    document.getElementById('pinErr').classList.remove('show');
    bLog('🔓 หัวหน้าเข้าสู่ระบบ','info');
  } else {
    for(let i=0;i<4;i++) document.getElementById('pc'+i).classList.add('bad');
    document.getElementById('pinErr').classList.add('show');
    setTimeout(()=>{ pinBuf=''; renderPin(); },700);
  }
}
function bossLogout(){ stopAll(); go('pgHome'); }

/* ── Thinger API ── */
const BASE='https://backend.thinger.io';
async function tGet(user,device,token,resource){
  const r=await fetch(`${BASE}/v1/users/${user}/devices/${device}/resources/${resource}`,{headers:{'Authorization':'Bearer '+token}});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
async function tPost(user,device,token,resource,body){
  const r=await fetch(`${BASE}/v1/users/${user}/devices/${device}/resources/${resource}`,{
    method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.ok;
}

/* ── WORKER SIDE ── */
let wPoll=null;
async function workerSend(){
  if(!currentWorkerDevice) { toast('⚠️ ไม่พบรหัสหมวก กรุณาสแกน QR Code ใหม่', 'err'); return; }
  const name = v('wName'); const eid = v('wEID') || "ไม่มีรหัส";
  if(!name){ toast('⚠️ กรุณากรอกชื่อของคุณ','warn'); return; }

  const btn=document.getElementById('wSendBtn');
  btn.disabled=true; btn.textContent='กำลังส่งข้อมูล…';
  wSetStatus('','กำลังเชื่อมต่อหมวก…');
  
  try {
    await tPost(APP_CONFIG.USERNAME, currentWorkerDevice, APP_CONFIG.TOKEN, 'set_worker', { name, id: eid });
    wSetStatus('ok','บันทึกสำเร็จ: '+name+' ('+eid+')');
    toast('✅ บันทึกชื่อเข้าหมวกรหัส ' + currentWorkerDevice + ' เรียบร้อย');
    setDot('wDot','wDotLbl','live');
    if(wPoll) clearInterval(wPoll);
    wPoll=setInterval(() => wFetchStatus(APP_CONFIG.USERNAME, currentWorkerDevice, APP_CONFIG.TOKEN), 3000);
  } catch(e){
    wSetStatus('fail','เชื่อมต่อล้มเหลว: ' + e.message); setDot('wDot','wDotLbl','err'); toast('❌ เกิดข้อผิดพลาด: '+e.message,'err');
  }
  btn.disabled=false; btn.textContent='✅ บันทึกชื่อเข้าหมวก';
}

async function wFetchStatus(u,d,t){
  try{
    const data=await tGet(u,d,t,'status'); setDot('wDot','wDotLbl','live');
    const obs=data.obstacle===true;
    wSetStatus(obs?'fail':'ok', obs?'⚠️ ตรวจพบสิ่งกีดขวาง!':'🟢 ระบบหมวกทำงานปกติ');
  }catch(e){ setDot('wDot','wDotLbl','err'); }
}

function wSetStatus(state,txt){
  const dot=document.getElementById('wStatusDot');
  dot.className='w-status-dot'+(state==='ok'?' ok':state==='fail'?' fail':'');
  document.getElementById('wStatusTxt').textContent=txt;
}

/* ── BOSS SIDE ── */
let helmets=[]; let globalPoll=null;
function bossStartAll(){
  if(!APP_CONFIG.USERNAME || !APP_CONFIG.TOKEN){ toast('⚠️ กรุณาตั้งค่า Username/Token ในโค้ดก่อน','warn'); return; }
  if(helmets.length===0){ toast('⚠️ เพิ่มหมวกอย่างน้อย 1 ใบด้านล่างก่อน','warn'); return; }
  document.getElementById('bStatusPill').style.display='flex'; setDot('bDot','bDotLbl','loading');
  bLog('เริ่มติดตาม '+helmets.length+' หมวก','info'); stopAll();
  globalPoll = setInterval(pollAll, 2500); pollAll();
}

function bossStopAll(){ stopAll(); setDot('bDot','bDotLbl','off'); bLog('หยุดติดตาม','info'); }
function stopAll(){ if(globalPoll){ clearInterval(globalPoll); globalPoll=null; } }

async function pollAll(){
  let onlineCnt=0, sosCnt=0, obsCnt=0;
  for(const h of helmets){
    try{
      const data = await tGet(APP_CONFIG.USERNAME, h.device, APP_CONFIG.TOKEN, 'status');
      h.data = data; h.online = true; onlineCnt++;
      if(data.sos===true) sosCnt++; if(data.obstacle===true) obsCnt++;
      if(data.sos && !h.prev_sos){ bLog('🚨 SOS จาก '+(data.worker_name||h.label),'sos'); playAlert(); }
      if(data.obstacle && !h.prev_obs){ bLog('⚠️ สิ่งกีดขวาง: '+(data.worker_name||h.label),'obs'); }
      h.prev_sos = data.sos; h.prev_obs = data.obstacle;
    } catch(e){ h.online = false; h.data = null; }
    renderCard(h);
  }
  document.getElementById('sumTotal').textContent = helmets.length; document.getElementById('sumOnline').textContent = onlineCnt;
  document.getElementById('sumSOS').textContent = sosCnt; document.getElementById('sumObs').textContent = obsCnt;
  
  const banner = document.getElementById('sosBanner');
  if(sosCnt>0){
    banner.classList.add('show');
    const names = helmets.filter(h=>h.data?.sos).map(h=>h.data?.worker_name||h.label).join(', ');
    document.getElementById('bannerTxt').textContent = '🚨 SOS จาก: '+names;
  } else { banner.classList.remove('show'); }
  setDot('bDot','bDotLbl', onlineCnt>0?'live':(helmets.length>0?'err':'off'));
}

function addHelmet(){
  const label = v('aLabel'); const device = v('aDevice');
  if(!label||!device){ toast('⚠️ กรอกชื่อและ Device ID ให้ครบ','warn'); return; }
  if(helmets.find(h=>h.device===device)){ toast('⚠️ Device ID นี้มีอยู่แล้ว','warn'); return; }
  const h = { id:Date.now(), label, device, prev_sos:false, prev_obs:false, online:false, data:null };
  helmets.push(h); document.getElementById('aLabel').value = ''; document.getElementById('aDevice').value = '';
  renderAllCards(); bLog('➕ เพิ่มหมวกรหัส: '+device,'info'); toast('✅ เพิ่ม '+label+' แล้ว'); updateSummaryStatic();
}

function removeHelmet(id){ helmets = helmets.filter(h=>h.id!==id); renderAllCards(); updateSummaryStatic(); }
function updateSummaryStatic(){ document.getElementById('sumTotal').textContent = helmets.length; }

function renderAllCards(){
  const grid = document.getElementById('helmetsGrid'); const empty = document.getElementById('emptyState');
  if(helmets.length===0){ grid.innerHTML=''; grid.appendChild(empty); return; }
  if(grid.contains(empty)) grid.removeChild(empty);
  helmets.forEach(h=>{
    if(!document.getElementById('hcard-'+h.id)) { const el=document.createElement('div'); el.id='hcard-'+h.id; grid.appendChild(el); }
    renderCard(h);
  });
}

function renderCard(h){
  const el=document.getElementById('hcard-'+h.id); if(!el) return;
  const d=h.data; const online=h.online; const sos = d?.sos===true; const obs = d?.obstacle===true;
  const name = d?.worker_name || '—'; const eid = d?.worker_id || '—';
  const d1 = d?.distance1_cm; const d2 = d?.distance2_cm; const now = new Date().toLocaleTimeString('th-TH');

  el.className = 'h-card'+(sos?' sos-active':obs?' obs-active':!online?' offline':'');
  
  // เปลี่ยน Avatar รูปหน้าคน (👷) ให้เป็นรูปได้ที่นี่ ถ้าต้องการ
  el.innerHTML = `
    <div class="h-card-head">
      <div class="h-card-id"><div class="h-avatar">👷</div><div><div class="h-name">${name!=='—'?name:h.label}</div><div class="h-eid">${eid!=='—'?eid+' · ':''}<span style="color:var(--txt2)">${h.device}</span></div></div></div>
      <div class="h-card-badges">${sos?'<span class="badge sos">🚨 SOS</span>':''}${obs?'<span class="badge obs">⚠️ กีดขวาง</span>':''}<span class="badge ${online?'online':'offline'}">${online?'LIVE':'OFFLINE'}</span><button onclick="removeHelmet(${h.id})" style="background:none;border:none;color:var(--txt2);cursor:pointer;font-size:.75rem;padding:2px 4px;margin-left:2px;">✕</button></div>
    </div>
    <div class="h-card-body">
      <div class="m-row"><div class="m-box"><div class="m-lbl">สถานะ</div><div class="m-val ${sos?'r':obs?'o':'g'}">${sos?'SOS!':obs?'ระวัง':'ปกติ'}</div></div>
      <div class="m-box"><div class="m-lbl">Sensor 1</div><div class="m-val ${d1&&d1<50?'o':''}">${fmtDist(d1)}</div></div>
      <div class="m-box"><div class="m-lbl">Sensor 2</div><div class="m-val ${d2&&d2<50?'o':''}">${fmtDist(d2)}</div></div></div>
      <div class="dist-mini"><div class="dist-mini-row"><span class="dist-mini-label">ด้านหน้า</span><div class="dist-mini-bar"><div class="dist-mini-fill ${d1&&d1<50?'warn':''}" style="width:${distPct(d1)}%"></div></div><span class="dist-mini-val">${fmtDist(d1)}</span></div>
      <div class="dist-mini-row"><span class="dist-mini-label">ด้านข้าง</span><div class="dist-mini-bar"><div class="dist-mini-fill ${d2&&d2<50?'warn':''}" style="width:${distPct(d2)}%"></div></div><span class="dist-mini-val">${fmtDist(d2)}</span></div></div>
    </div>
    <div class="h-card-foot"><span class="foot-time">อัพเดท ${online?now:'—'}</span><button class="btn-ack-small" ${!sos?'disabled':''} onclick="ackSOS('${h.device}','${h.label}')">${sos?'✅ ตอบรับ SOS':'ไม่มีเหตุ'}</button></div>
  `;
}

async function ackSOS(device, label){
  try{ await tPost(APP_CONFIG.USERNAME, device, APP_CONFIG.TOKEN, 'ack_sos', {ack:true}); bLog('✅ ตอบรับ SOS: '+label,'ok'); toast('✅ ส่งการตอบรับไปยัง '+label);
    const h=helmets.find(h=>h.device===device); if(h){ h.prev_sos=false; if(h.data) h.data.sos=false; renderCard(h); }
  }catch(e){ toast('❌ ส่งไม่สำเร็จ: '+e.message,'err'); }
}

function v(id){ return document.getElementById(id).value.trim(); }
function fmtDist(cm){ return (!cm||cm>=999)?'—':(cm.toFixed(1)+' ซม.'); }
function distPct(cm){ return (!cm||cm>=999)?0:Math.min(100,Math.max(0,((200-cm)/200)*100)); }
function setDot(dotId,lblId,state){ const d=document.getElementById(dotId), l=document.getElementById(lblId); if(state==='live'){ d.className='sdot live'; l.textContent='ออนไลน์'; } else if(state==='err'){ d.className='sdot err'; l.textContent='เชื่อมต่อล้มเหลว'; } else { d.className='sdot'; l.textContent='ออฟไลน์'; } }
function bLog(msg,type='info'){ const list=document.getElementById('bLog'); const t=new Date().toLocaleTimeString('th-TH'); const el=document.createElement('div'); el.className='log-item'; el.innerHTML=`<span class="log-t">${t}</span><span class="log-m ${type}">${msg}</span>`; list.prepend(el); while(list.children.length>60) list.removeChild(list.lastChild); }
let _toastTimer; function toast(msg,type='ok'){ const el=document.getElementById('toast'); el.textContent=msg; const c=type==='err'?'var(--red)':type==='warn'?'var(--yellow)':type==='sos'?'var(--orange)':'var(--cyan)'; el.style.borderColor=c; el.style.color=c; el.classList.add('show'); clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>el.classList.remove('show'),3200); }
function playAlert(){ try{ const ctx=new(window.AudioContext||window.webkitAudioContext)(); [523,659,784,659,523].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination); o.frequency.value=f; const t=ctx.currentTime+i*.17; g.gain.setValueAtTime(.22,t); g.gain.exponentialRampToValueAtTime(.001,t+.15); o.start(t);o.stop(t+.15); }); }catch(e){} }
