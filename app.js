// Simple IndexedDB wrapper and app logic
const DB_NAME = 'daily-journal-db';
const DB_VERSION = 1;
let dbPromise;
function openDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if(!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles',{keyPath:'id'});
      if(!db.objectStoreNames.contains('entries')) db.createObjectStore('entries',{keyPath:'id'});
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbPromise;
}

function promisifyRequest(req){
  return new Promise((res,rej)=>{
    req.onsuccess = ()=>res(req.result);
    req.onerror = ()=>rej(req.error);
  });
}

const storage = {
  async getProfile(id){
    const db = await openDB();
    const tx = db.transaction('profiles','readonly');
    const store = tx.objectStore('profiles');
    return promisifyRequest(store.get(id));
  },
  async saveProfile(profile){
    const db = await openDB();
    const tx = db.transaction('profiles','readwrite');
    const store = tx.objectStore('profiles');
    return promisifyRequest(store.put(profile));
  },
  async deleteProfile(id){
    const db = await openDB();
    const tx = db.transaction('profiles','readwrite');
    const store = tx.objectStore('profiles');
    return promisifyRequest(store.delete(id));
  },
  async listProfiles(){
    const db = await openDB();
    const tx = db.transaction('profiles','readonly');
    const store = tx.objectStore('profiles');
    return promisifyRequest(store.getAll());
  },
  async getEntry(id){
    const db = await openDB();
    const tx = db.transaction('entries','readonly');
    const store = tx.objectStore('entries');
    return promisifyRequest(store.get(id));
  },
  async saveEntry(entry){
    const db = await openDB();
    const tx = db.transaction('entries','readwrite');
    const store = tx.objectStore('entries');
    return promisifyRequest(store.put(entry));
  },
  async listEntries(){
    const db = await openDB();
    const tx = db.transaction('entries','readonly');
    const store = tx.objectStore('entries');
    return promisifyRequest(store.getAll());
  },
  async exportData(){
    const profiles = await this.listProfiles();
    const entries = await this.listEntries();
    return { profiles, entries, exportedAt:new Date().toISOString() };
  },
  async importData(obj){
    if(!obj) throw new Error('Invalid backup');
    const db = await openDB();
    const ptx = db.transaction('profiles','readwrite');
    const etx = db.transaction('entries','readwrite');
    const pStore = ptx.objectStore('profiles');
    const eStore = etx.objectStore('entries');
    for(const p of (obj.profiles||[])) pStore.put(p);
    for(const e of (obj.entries||[])) eStore.put(e);
    return Promise.all([
      promisifyRequest(ptx.complete || ptx),
      promisifyRequest(etx.complete || etx)
    ]);
  }
};

// App UI glue
function $(id){return document.getElementById(id)}

const todayId = ()=>{
  const d = new Date();
  return d.toISOString().slice(0,10);
}

async function init(){
  // wire buttons
  $('entry-date').textContent = new Date().toLocaleDateString();
  $('btn-save').addEventListener('click', saveEntry);
  $('btn-new-day').addEventListener('click', newDay);
  $('btn-add-profile').addEventListener('click', addProfile);
  $('btn-delete-profile').addEventListener('click', deleteProfile);
  $('btn-export').addEventListener('click', doExport);
  $('import-file').addEventListener('change', doImport);
  $('btn-add-custom').addEventListener('click', addCustomItem);
  $('btn-about').addEventListener('click', ()=>$('about-modal').hidden = false);
  $('close-about').addEventListener('click', ()=>$('about-modal').hidden=true);
  document.querySelectorAll('.estimate').forEach(b=>b.addEventListener('click', (e)=>estimateCal(e.target.dataset.meal)));
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click', switchRange));
  $('btn-install').addEventListener('click', promptInstall);

  // load profiles
  await refreshProfiles();
  await refreshEntries();
  // register SW
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

async function refreshProfiles(){
  const list = await storage.listProfiles();
  const sel = $('profile-select'); sel.innerHTML='';
  if(list.length===0){
    const id = 'default';
    const prof = {id, name:'Default'};
    await storage.saveProfile(prof);
    list.push(prof);
  }
  for(const p of list){
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; sel.appendChild(opt);
  }
  sel.addEventListener('change',()=>{ loadEntryForToday(); refreshEntries(); });
}

async function addProfile(){
  const name = $('profile-name').value.trim();
  if(!name){ alert('Enter profile name'); return; }
  const id = 'p_'+Date.now();
  await storage.saveProfile({id,name});
  $('profile-name').value='';
  await refreshProfiles();
}
async function deleteProfile(){
  const sel = $('profile-select');
  const id = sel.value; if(!confirm('Delete profile and its entries?')) return;
  await storage.deleteProfile(id);
  // delete entries for profile
  const entries = await storage.listEntries();
  for(const e of entries) if(e.profileId===id) await openDB().then(db=>{const tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(e.id)});
  await refreshProfiles(); await refreshEntries();
}

function collectFromUI(){
  const profileId = $('profile-select').value;
  const entry = {
    id: profileId + '::' + todayId(),
    profileId,
    date: todayId(),
    water: $('water').value,
    morning: {
      jeera: $('morning-jeera').checked,
      almonds: $('morning-almonds').checked,
      raisins: $('morning-raisins').checked,
      custom: Array.from(document.querySelectorAll('.custom-list li')).map(li=>li.textContent)
    },
    meals: {
      breakfast: {desc: $('breakfast-meal').value, cal: Number($('breakfast-cal').value)||0},
      chai: {desc: $('chai-meal').value, cal: Number($('chai-cal').value)||0},
      lunch: {desc: $('lunch-meal').value, cal: Number($('lunch-cal').value)||0},
      dinner: {desc: $('dinner-meal').value, cal: Number($('dinner-cal').value)||0}
    },
    workout: {
      weight: $('workout-weight').checked,
      swim: $('workout-swim').checked,
      sauna: $('workout-sauna').checked,
      walk: $('workout-walk').checked,
      duration: Number($('workout-duration').value)||0,
      notes: $('workout-notes').value
    },
    night: {
      walnuts: $('night-walnuts').checked,
      tea: $('night-tea').checked
    },
    energy: Number($('energy').value)||null,
    notes: $('notes').value,
    updatedAt: new Date().toISOString()
  };
  entry.summaryCalories = entry.meals.breakfast.cal + entry.meals.chai.cal + entry.meals.lunch.cal + entry.meals.dinner.cal;
  return entry;
}

async function saveEntry(){
  const entry = collectFromUI();
  await storage.saveEntry(entry);
  alert('Saved locally');
  await refreshEntries();
}

function newDay(){
  // clear inputs for a new day
  document.querySelectorAll('#entry-section input, #entry-section textarea').forEach(i=>{
    if(i.type==='checkbox') i.checked=false; else i.value='';
  });
  document.querySelectorAll('.custom-list').forEach(l=>l.innerHTML='');
  updateDailyCal();
}

async function refreshEntries(rangeDays=7){
  const entries = await storage.listEntries();
  const sel = $('profile-select');
  const profileId = sel.value;
  const filtered = entries.filter(e=>e.profileId===profileId);
  const listEl = $('entries-list'); listEl.innerHTML='';
  const now = new Date();
  for(const e of filtered.sort((a,b)=>b.date.localeCompare(a.date))){
    if(rangeDays>0){
      const diff = (now - new Date(e.date))/ (1000*60*60*24);
      if(diff>rangeDays) continue;
    }
    const li = document.createElement('li');
    li.tabIndex=0;
    li.innerHTML = `<strong>${e.date}</strong> - ${e.summaryCalories} kcal (EST)
      <div class="mini">Water: ${e.water}L | Energy: ${e.energy||'-'}</div>
      <button class="btn" data-id="${e.id}">Open</button>
    `;
    li.querySelector('button').addEventListener('click', ()=>openEntry(e.id));
    listEl.appendChild(li);
  }
}

async function openEntry(id){
  const e = await storage.getEntry(id);
  if(!e) return alert('Not found');
  // populate UI
  $('water').value = e.water || '1';
  $('morning-jeera').checked = e.morning?.jeera || false;
  $('morning-almonds').checked = e.morning?.almonds || false;
  $('morning-raisins').checked = e.morning?.raisins || false;
  const customList = $('custom-list'); customList.innerHTML='';
  (e.morning?.custom||[]).forEach(c=>{ const li=document.createElement('li'); li.textContent=c; customList.appendChild(li); });
  $('breakfast-meal').value = e.meals.breakfast.desc||''; $('breakfast-cal').value = e.meals.breakfast.cal||'';
  $('chai-meal').value = e.meals.chai.desc||''; $('chai-cal').value = e.meals.chai.cal||'';
  $('lunch-meal').value = e.meals.lunch.desc||''; $('lunch-cal').value = e.meals.lunch.cal||'';
  $('dinner-meal').value = e.meals.dinner.desc||''; $('dinner-cal').value = e.meals.dinner.cal||'';
  $('workout-weight').checked = e.workout?.weight||false; $('workout-swim').checked = e.workout?.swim||false; $('workout-sauna').checked = e.workout?.sauna||false; $('workout-walk').checked = e.workout?.walk||false;
  $('workout-duration').value = e.workout?.duration||''; $('workout-notes').value = e.workout?.notes||'';
  $('night-walnuts').checked = e.night?.walnuts||false; $('night-tea').checked = e.night?.tea||false;
  $('energy').value = e.energy||''; $('notes').value = e.notes||'';
  updateDailyCal();
}

function addCustomItem(){
  const v = $('morning-custom').value.trim(); if(!v) return;
  const ul = $('custom-list'); const li = document.createElement('li'); li.textContent = v; ul.appendChild(li); $('morning-custom').value='';
}

function estimateCaloriesForText(text){
  if(!text) return 0;
  const t = text.toLowerCase();
  // very simple rule-based estimates
  const mapping = [
    ['oat',200], ['porridge',200], ['banana',100], ['egg',78], ['eggs',78], ['toast',80], ['bread',80], ['rice',250], ['dal',150], ['curry',200], ['chicken',250], ['paneer',300], ['salad',80], ['milk',120], ['teA',50], ['tea',50], ['coffee',5], ['sugar',30], ['pizza',285]
  ];
  let total=0; for(const [k,v] of mapping){ if(t.includes(k)) total += v; }
  if(total===0) total = 180; // fallback
  return total;
}

function estimateCal(meal){
  if(meal==='breakfast'){
    const t = $('breakfast-meal').value; const est = estimateCaloriesForText(t); $('breakfast-cal').value = est; updateDailyCal();
  }
}

function updateDailyCal(){
  const b = Number($('breakfast-cal').value)||0; const c = Number($('chai-cal').value)||0; const l = Number($('lunch-cal').value)||0; const d = Number($('dinner-cal').value)||0;
  const total = b+c+l+d; $('daily-cal').textContent = total; 
}

async function doExport(){
  const data = await storage.exportData();
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download = `daily-journal-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove();
}

async function doImport(e){
  const file = e.target.files[0]; if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    await storage.importData(obj);
    alert('Imported');
    await refreshProfiles(); await refreshEntries();
  }catch(err){ alert('Invalid backup file'); }
}

function switchRange(e){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  e.target.classList.add('active');
  const val = Number(e.target.dataset.range);
  refreshEntries(val);
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e; $('btn-install').style.display='inline-block';
});
async function promptInstall(){
  if(deferredPrompt){ deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; deferredPrompt = null; }
}

// keep daily cal reactive
document.addEventListener('input', (e)=>{ if(['breakfast-cal','chai-cal','lunch-cal','dinner-cal'].includes(e.target.id)) updateDailyCal(); });

// initial load
init().catch(err=>console.error('Init error',err));