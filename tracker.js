/* OP Carddass Tracker — Trubbish Bin
   tracker.js — app logic (requires sets-data.js + drive-auth.js loaded first) */

const IMG_BASE='assets/cards/';
const FALLBACK_IMG='assets/cards/CarddassHB.jpeg';

let data={},saveTimer;
let activeTab='all',searchTerm='',rarityFilter='';

// ── Google Drive sync (shared module) ──

const sync=createDriveSync({
  clientId:'406228714733-s5jaq0bp4nl7uujdc35j51l8nj0cgagt.apps.googleusercontent.com',
  folderId:'1Mf5sWIjDszg5UMgikmExaVWeeufCFVWB',
  fileName:'op-carddass-tracker.json',
  rememberKey:'slk_drive_signed_in',
  onSessionExpired:showSessionExpired,
});

// ── Auth ──

function initAuth(){
  document.getElementById('signInBtn').onclick=async()=>{
    try{
      await sync.signIn();
      onSignedIn();
    }catch(e){
      showAuthError(e.message);
    }
  };
  sync.init().then(silentOk=>{
    if(silentOk)onSignedIn();
  });
}

function onSignedIn(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('app').style.display='block';
  loadFromDrive();
}

function showAuthError(msg){
  const el=document.getElementById('authError');
  el.textContent='Sign-in failed: '+msg;
  el.style.display='block';
}

function showSessionExpired(retry){
  setSyncState('error');
  const label=document.getElementById('syncLabel');
  label.textContent='Session expired — click to reconnect';
  label.style.cursor='pointer';
  label.onclick=()=>{
    label.style.cursor='';
    label.onclick=null;
    retry();
  };
}

// ── Drive Sync ──

async function loadFromDrive(){
  setSyncState('syncing');
  try{
    const loaded=await sync.load();
    if(loaded){
      data=loaded;
    }else{
      const cached=localStorage.getItem('op-carddass-data');
      if(cached)data=JSON.parse(cached);
    }
    setSyncState('saved');
  }catch(e){
    console.error('Load error:',e);
    const cached=localStorage.getItem('op-carddass-data');
    if(cached)data=JSON.parse(cached);
    setSyncState('error');
  }
  render();
}

async function saveToDrive(){
  setSyncState('syncing');
  localStorage.setItem('op-carddass-data',JSON.stringify(data));
  try{
    await sync.save(data);
    setSyncState('saved');
  }catch(e){
    console.error('Save error:',e);
    setSyncState('error');
  }
}

function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(saveToDrive,1500);
}

function setSyncState(state){
  const dot=document.querySelector('.sync-dot');
  const label=document.getElementById('syncLabel');
  const pill=document.getElementById('statPill');
  if(!dot || !label) return;
  dot.className='sync-dot '+state;
  if(state!=='error'){
    label.textContent=state==='syncing'?'Saving…':'Synced';
    label.style.cursor='';
    label.onclick=null;
  }else if(!label.onclick){
    label.textContent='Sync error';
  }
  // Update stat pill color: green when synced, red on error
  if(pill){
    pill.classList.remove('synced','out-of-sync');
    if(state==='saved') pill.classList.add('synced');
    else if(state==='error') pill.classList.add('out-of-sync');
  }
}

// ── Render ──

function render(){
  let allCards=[];
  SETS.forEach(s=>{
    s.cards.forEach(c=>{
      allCards.push({...c,set:s.key,setTitle:s.title});
    });
  });

  let filtered=allCards;
  if(activeTab==='owned')filtered=filtered.filter(c=>data[c.id]);
  if(activeTab==='missing')filtered=filtered.filter(c=>!data[c.id]);
  if(searchTerm){
    const q=searchTerm.toLowerCase();
    filtered=filtered.filter(c=>c.id.toLowerCase().includes(q)||c.nm.toLowerCase().includes(q));
  }
  if(rarityFilter){
    filtered=filtered.filter(c=>c.r===rarityFilter);
  }

  let sortedSets=SETS.slice();

  // ── Render Sidebar Navigation — all 16 sets, single era ──
  const navContainer = document.getElementById('sidebarNav');
  if(navContainer) {
    let navHtml = '';
    navHtml += '<div class="nav-era-label">Era 1 — Carddass Hyper Battle</div>';

    sortedSets.forEach(s => {
      const owned=s.cards.filter(c=>!c.rp&&data[c.id]).length;
      const total=s.cards.filter(c=>!c.rp).length;
      const pct=total>0?Math.round((owned/total)*100):0;
      const isComplete = (owned === total && total > 0);

      navHtml += `
        <div class="nav-set ${isComplete ? 'is-complete' : ''}" data-key="${s.key}" onclick="scrollToSet('${s.key}')">
          <span class="nav-name">${s.title}</span>
          <div class="nav-meta-row">
            <span class="nav-count">${owned}/${total}</span>
            <div class="nav-pip"><div class="nav-pip-fill" style="width: ${pct}%"></div></div>
            <span class="nav-pct">${pct}%</span>
          </div>
        </div>
      `;
    });
    navContainer.innerHTML = navHtml;
  }

  const main=document.getElementById('main');
  main.innerHTML='';

  sortedSets.forEach(s=>{
    const setCards=filtered.filter(c=>c.set===s.key);
    if(setCards.length===0&&activeTab!=='all')return;

    const owned=s.cards.filter(c=>!c.rp&&data[c.id]).length;
    const total=s.cards.filter(c=>!c.rp).length;
    const pct=total>0?Math.round((owned/total)*100):0;
    const isComplete = (owned === total && total > 0);

    const group=document.createElement('div');
    group.className='set-group';
    group.id = 'set-' + s.key;

    const hdr=document.createElement('div');
    hdr.className='set-header';
    hdr.innerHTML=`
      <h2 class="set-title">${s.title}</h2>
      <div class="set-sub">${s.sub}</div>
    `;

    const grid=document.createElement('div');
    grid.className='card-grid';

    setCards.forEach(c=>{
      const isReprint=!!c.rp;
      const d=data[c.id]||{};
      const isOwned=!!data[c.id];
      const card=document.createElement('div');
      card.className='card'+(isOwned?' owned':'')+(isReprint?' reprint':'');
      const rarity=c.r==='h'?'holo':c.r==='g'?'gold':'regular';
      const rarityLabel=c.r==='h'?'Holo':c.r==='g'?'Gold':'Regular';

      let detailsMarkup = '';
      if (!isReprint) {
        if (isOwned) {
          detailsMarkup = `
            <div class="card-detail">
              <div class="qty-row">
                <span class="qty-label">Qty</span>
                <div class="qty-ctrl">
                  <button class="qty-btn" data-id="${c.id}" data-op="dec" aria-label="Decrease quantity">−</button>
                  <span class="qty-val">${d.qty||0}</span>
                  <button class="qty-btn" data-id="${c.id}" data-op="inc" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <div class="cond-pills">
                ${['NM','LP','MP','HP','D'].map(cnd=>`<span class="pill${(d.cond||[]).includes(cnd)?' on':''}" data-id="${c.id}" data-cond="${cnd}">${cnd}</span>`).join('')}
              </div>
              <div class="grade-row">
                <span class="grade-label">Grade</span>
                <div class="grade-pills">
                  ${['RAW','CGC','PSA','BGS'].map(gr=>`<span class="pill${(d.grader||'RAW')===gr?' on':''}" data-id="${c.id}" data-grader="${gr}">${gr}</span>`).join('')}
                </div>
                ${(d.grader&&d.grader!=='RAW')?`<div class="grade-num-row">
                  ${['6','7','8','8.5','9','9.5','10'].map(gn=>`<span class="pill${(d.grade||'')==gn?' on':''}" data-id="${c.id}" data-grade="${gn}">${gn}</span>`).join('')}
                </div>`:''}
              </div>
              <button class="remove-btn" data-id="${c.id}">Remove</button>
            </div>
          `;
        } else {
          detailsMarkup = `<div class="card-add-prompt">+ Add to Collection</div>`;
        }
      }

      card.innerHTML=`
        <div class="card-img-wrap">
          <img src="${IMG_BASE}${c.id.toLowerCase()}.png" alt="${c.nm}" onload="this.classList.remove('loading');this.parentNode.querySelector('.img-ph').style.display='none';" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';" class="loading">
          <div class="img-ph"><div class="img-ph-id">${c.id}</div></div>
          <div class="owned-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          ${isReprint?'<div class="reprint-badge">REPRINT</div>':''}
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-id">${c.id}</span>
            <span class="rarity-tag ${rarity}">${rarityLabel}</span>
          </div>
          <div class="card-name">${c.nm}</div>
          ${detailsMarkup}
        </div>
      `;

      if(!isReprint && !isOwned){
        card.onclick=()=>{
          if(!data[c.id]) data[c.id]={qty:0,cond:['NM'],grader:'RAW'};
          scheduleSave();
          render();
        };
      }

      grid.appendChild(card);
    });

    group.appendChild(hdr);
    group.appendChild(grid);
    main.appendChild(group);
  });

  /* Bind qty buttons */
  document.querySelectorAll('.qty-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const id=btn.dataset.id;
      const op=btn.dataset.op;
      if(!data[id])data[id]={qty:0,cond:['NM'],grader:'RAW'};
      if(op==='inc')data[id].qty=(data[id].qty||0)+1;
      else if(op==='dec')data[id].qty=Math.max(0,(data[id].qty||0)-1);
      scheduleSave();
      render();
    };
  });

  /* Bind pill tags */
  document.querySelectorAll('.pill').forEach(pill=>{
    pill.onclick=(e)=>{
      e.stopPropagation();
      const id=pill.dataset.id;
      const cnd=pill.dataset.cond;
      const grader=pill.dataset.grader;
      const grade=pill.dataset.grade;

      if(!data[id])data[id]={qty:0,cond:[],grader:'RAW'};

      if(cnd){
        if(!data[id].cond)data[id].cond=[];
        const idx=data[id].cond.indexOf(cnd);
        if(idx>-1)data[id].cond.splice(idx,1);
        else data[id].cond.push(cnd);
      }

      if(grader){
        data[id].grader=grader;
        if(grader==='RAW')delete data[id].grade;
      }

      if(grade){
        data[id].grade=grade;
      }

      scheduleSave();
      render();
    };
  });

  /* Bind trash removals */
  document.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const id=btn.dataset.id;
      delete data[id];
      scheduleSave();
      render();
    };
  });

  updateStats();
  updateActiveNavHighlight();
}

// ── Stats ──

function updateStats(){
  let totalCards=0;
  let ownedCards=0;
  SETS.forEach(s=>{
    s.cards.forEach(c=>{
      if(c.rp)return;
      totalCards++;
      if(data[c.id])ownedCards++;
    });
  });
  const tCount = document.getElementById('totalCount');
  const oCount = document.getElementById('ownedCount');
  if(tCount) tCount.textContent=totalCards;
  if(oCount) oCount.textContent=ownedCards;
}

// ── Nav Sidebar Interactivity ──

function scrollToSet(key) {
  document.getElementById('set-' + key)?.scrollIntoView({behavior:'smooth', block:'start'});
  closeSidebar();
  highlightNav(key);
}

function highlightNav(key) {
  document.querySelectorAll('.nav-set').forEach(n =>
    n.classList.toggle('nav-active', n.dataset.key === key));
  document.querySelector('.nav-set.nav-active')?.scrollIntoView({block:'nearest'});
}

function updateActiveNavHighlight() {
  let activeKey = '';
  SETS.forEach(s => {
    const el = document.getElementById('set-' + s.key);
    if (el && el.getBoundingClientRect().top < 150) activeKey = s.key;
  });
  if (activeKey) highlightNav(activeKey);
}

window.addEventListener('scroll', updateActiveNavHighlight);

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if(sb.classList.contains('open')) {
    closeSidebar();
  } else {
    sb.classList.add('open');
    document.getElementById('overlay').classList.add('visible');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');
}

// ── UI Bindings ──

document.querySelectorAll('.tab').forEach(tab=>{
  tab.onclick=()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    activeTab=tab.dataset.tab;
    render();
  };
});

document.getElementById('searchInput').oninput=(e)=>{
  searchTerm=e.target.value;
  render();
};

document.querySelectorAll('.rf-btn').forEach(btn=>{
  btn.onclick=()=>{
    const r=btn.dataset.rarity;
    if(rarityFilter===r){
      rarityFilter='';
      btn.classList.remove('active');
    }else{
      rarityFilter=r;
      document.querySelectorAll('.rf-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    }
    render();
  };
});

document.getElementById('exportBtn').onclick=()=>{
  const rows=[['Card ID','Card Name','Set','Rarity','Qty','Condition','Grader','Grade','Notes'].join('\t')];
  SETS.forEach(s=>{
    s.cards.forEach(c=>{
      if(c.rp)return;
      const d=data[c.id];
      if(!d)return;
      const rarity=c.r==='h'?'Holo':c.r==='g'?'Gold':'Regular';
      const grader=d.grader||'RAW';
      const grade=d.grade||'';
      rows.push([c.id,c.nm,s.title,rarity,d.qty||0,(d.cond||[]).join(','),grader,grade,d.notes||''].join('\t'));
    });
  });
  const blob=new Blob([rows.join('\n')],{type:'text/tab-separated-values'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='carddass-collection-'+new Date().toISOString().slice(0,10)+'.tsv';
  a.click();
  showToast('Exported to TSV');
};

document.getElementById('importBtn').onclick=()=>{
  document.getElementById('importFile').click();
};

document.getElementById('importFile').onchange=(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const text=ev.target.result;
    const lines=text.split('\n').slice(1);
    lines.forEach(line=>{
      const parts=line.split('\t');
      if(parts.length<4)return;
      const id=parts[0].trim();
      const qty=parseInt(parts[4])||1;
      const cond=parts[5]?parts[5].split(',').map(c=>c.trim()).filter(c=>c):['NM'];
      const grader=parts[6]?parts[6].trim():'RAW';
      const grade=parts[7]?parts[7].trim():'';
      const notes=parts[8]||'';
      data[id]={qty,cond,grader,grade,notes};
    });
    scheduleSave();
    render();
    showToast('Import complete');
  };
  reader.readAsText(file);
};

document.getElementById('signOutBtn').onclick=()=>{
  sync.signOut();
  location.reload();
};

function showToast(msg){
  const toast=document.getElementById('toast');
  if(!toast) return;
  toast.textContent=msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

document.getElementById('logoHeader').onclick=()=>{
  window.location.href='https://metaprinter.github.io/trubbish-bin/';
};

// ── Init ──
initAuth();
render();
