/* OP Carddass Tracker — Trubbish Bin
   tracker.js — app logic (requires sets-data.js loaded first) */

const CLIENT_ID='406228714733-s5jaq0bp4nl7uujdc35j51l8nj0cgagt.apps.googleusercontent.com';
const SCOPES='https://www.googleapis.com/auth/drive.file';
const FOLDER_ID='1Mf5sWIjDszg5UMgikmExaVWeeufCFVWB';
const FILE_NAME='op-carddass-tracker.json';
const IMG_BASE='assets/cards/';
const FALLBACK_IMG='assets/cards/CarddassHB.jpeg';

let tokenClient,accessToken,driveFileId,data={},saveTimer;
let activeTab='all',searchTerm='',sortByMissing=false,excludedSets={};

// ── Google Auth ──

function initAuth(){
  tokenClient=google.accounts.oauth2.initTokenClient({
    client_id:CLIENT_ID,
    scope:SCOPES,
    callback:handleToken,
  });
  document.getElementById('signInBtn').onclick=()=>tokenClient.requestAccessToken();
}

function handleToken(resp){
  if(resp.error)return showAuthError(resp.error);
  accessToken=resp.access_token;
  document.getElementById('authScreen').style.display='none';
  document.getElementById('app').style.display='block';
  loadFromDrive();
}

function showAuthError(msg){
  const el=document.getElementById('authError');
  el.textContent='Sign-in failed: '+msg;
  el.style.display='block';
}

// ── Drive Sync ──

async function driveRequest(url,opts={}){
  opts.headers={...opts.headers,'Authorization':'Bearer '+accessToken};
  const r=await fetch(url,opts);
  if(!r.ok)throw new Error('Drive '+r.status);
  return r;
}

async function findFile(){
  const q=encodeURIComponent(`name='${FILE_NAME}' and '${FOLDER_ID}' in parents and trashed=false`);
  const r=await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`);
  const d=await r.json();
  return d.files&&d.files[0]?d.files[0].id:null;
}

async function loadFromDrive(){
  setSyncState('syncing');
  try{
    driveFileId=await findFile();
    if(driveFileId){
      const r=await driveRequest(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
      data=await r.json();
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
    if(!driveFileId){
      const meta={name:FILE_NAME,parents:[FOLDER_ID],mimeType:'application/json'};
      const form=new FormData();
      form.append('metadata',new Blob([JSON.stringify(meta)],{type:'application/json'}));
      form.append('file',new Blob([JSON.stringify(data)],{type:'application/json'}));
      const r=await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',body:form});
      const d=await r.json();
      driveFileId=d.id;
    }else{
      await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(data),
      });
    }
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
  dot.className='sync-dot '+state;
  label.textContent=state==='syncing'?'Saving…':state==='saved'?'Synced':'Sync error';
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

  let sortedSets=SETS.slice();
  if(sortByMissing){
    sortedSets.sort((a,b)=>{
      const aMiss=a.cards.filter(c=>!c.rp&&!data[c.id]).length;
      const bMiss=b.cards.filter(c=>!c.rp&&!data[c.id]).length;
      if(aMiss===0&&bMiss>0)return 1;
      if(bMiss===0&&aMiss>0)return -1;
      return bMiss-aMiss;
    });
  }

  const main=document.getElementById('main');
  main.innerHTML='';

  sortedSets.forEach(s=>{
    const setCards=filtered.filter(c=>c.set===s.key);
    if(setCards.length===0&&activeTab!=='all')return;

    const owned=s.cards.filter(c=>!c.rp&&data[c.id]).length;
    const total=s.cards.filter(c=>!c.rp).length;
    const pct=total>0?Math.round((owned/total)*100):0;
    const isExcluded=excludedSets[s.key];

    const group=document.createElement('div');
    group.className='set-group'+(isExcluded?' excluded':'');

    const hdr=document.createElement('div');
    hdr.className='set-header';
    hdr.innerHTML=`
<div>
<div class="set-title">${s.title}</div>
<div class="set-sub">${s.sub} • ${total} cards</div>
</div>
<div class="set-progress">
<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
<div class="progress-pct">${owned}/${total} (${pct}%)</div>
</div>
<button class="st-toggle ${isExcluded?'excluded':'included'}">${isExcluded?'EXCL':'INCL'}</button>
`;

    hdr.querySelector('.st-toggle').onclick=()=>{
      if(excludedSets[s.key])delete excludedSets[s.key];
      else excludedSets[s.key]=true;
      render();
    };

    const grid=document.createElement('div');
    grid.className='card-grid';

    setCards.forEach(c=>{
      const isReprint=!!c.rp;
      const d=data[c.id]||{};
      const isOwned=!!d.qty;
      const card=document.createElement('div');
      card.className='card'+(isOwned?' owned':'')+(isReprint?' reprint':'');
      const rarity=c.r==='h'?'holo':c.r==='g'?'gold':'regular';
      const rarityLabel=c.r==='h'?'Holo':c.r==='g'?'Gold':'Regular';

      const rot=d.rot||0;
      const rotStyle=rot?`transform:rotate(${rot}deg);`:'';

      card.innerHTML=`
<div class="card-img-wrap${rot?' rotated':''}">
<img src="${IMG_BASE}${c.id.toLowerCase()}.png" alt="${c.nm}" style="${rotStyle}" onload="this.classList.remove('loading');this.parentNode.querySelector('.img-ph').style.display='none';" onerror="this.onerror=null;this.src='${FALLBACK_IMG}';" class="loading">
<div class="img-ph"><div class="img-ph-id">${c.id}</div></div>
<div class="owned-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
<button class="rot-btn" data-id="${c.id}" title="Rotate 90°">↻</button>
${isReprint?'<div class="reprint-badge">REPRINT</div>':''}
</div>
<div class="card-body">
<div class="card-meta">
<span class="card-id">${c.id}</span>
<span class="rarity-tag ${rarity}">${rarityLabel}</span>
</div>
<div class="card-name">${c.nm}</div>
${isReprint?'':`<div class="card-detail">
<div class="qty-row">
<span class="qty-label">Qty</span>
<div class="qty-ctrl">
<button class="qty-btn" data-id="${c.id}" data-op="dec">−</button>
<span class="qty-val">${d.qty||1}</span>
<button class="qty-btn" data-id="${c.id}" data-op="inc">+</button>
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
</div>`}
</div>
`;

      if(!isReprint&&!isOwned){
        card.onclick=()=>{
          if(!data[c.id])data[c.id]={};
          data[c.id].qty=1;
          if(!data[c.id].cond||data[c.id].cond.length===0)data[c.id].cond=['NM'];
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

  // Bind qty buttons
  document.querySelectorAll('.qty-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const id=btn.dataset.id;
      const op=btn.dataset.op;
      if(!data[id])data[id]={qty:1,cond:['NM']};
      if(op==='inc')data[id].qty=(data[id].qty||1)+1;
      else if(op==='dec')data[id].qty=Math.max(1,(data[id].qty||1)-1);
      scheduleSave();
      render();
    };
  });

  // Bind pills (condition, grader, grade)
  document.querySelectorAll('.pill').forEach(pill=>{
    pill.onclick=(e)=>{
      e.stopPropagation();
      const id=pill.dataset.id;
      const cnd=pill.dataset.cond;
      const grader=pill.dataset.grader;
      const grade=pill.dataset.grade;

      if(!data[id])data[id]={qty:1,cond:[],grader:'RAW'};

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

  // Bind remove buttons
  document.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      const id=btn.dataset.id;
      const rot=data[id]&&data[id].rot;
      if(rot){
        data[id]={rot};
      }else{
        delete data[id];
      }
      scheduleSave();
      render();
    };
  });

  // Bind rotate buttons
  document.querySelectorAll('.rot-btn').forEach(btn=>{
    btn.onclick=(e)=>{
      e.stopPropagation();
      e.preventDefault();
      const id=btn.dataset.id;
      if(!data[id])data[id]={qty:0,cond:[]};
      data[id].rot=((data[id].rot||0)+90)%360;
      if(data[id].rot===0)delete data[id].rot;
      // Clean up entries that only have rot=0 and no qty
      if(!data[id].qty&&!data[id].rot){
        delete data[id];
      }
      scheduleSave();
      render();
    };
  });

  updateStats();
  updateGaps();
}

// ── Stats & Gaps ──

function updateStats(){
  let totalCards=0;
  let ownedCards=0;
  SETS.forEach(s=>{
    if(excludedSets[s.key])return;
    s.cards.forEach(c=>{
      if(c.rp)return;
      totalCards++;
      if(data[c.id])ownedCards++;
    });
  });
  document.getElementById('totalCount').textContent=totalCards;
  document.getElementById('ownedCount').textContent=ownedCards;
}

function updateGaps(){
  const panel=document.getElementById('gapsPanel');
  const gaps=[];
  SETS.forEach(s=>{
    if(excludedSets[s.key])return;
    const missing=s.cards.filter(c=>!c.rp&&!data[c.id]).length;
    if(missing>0)gaps.push({set:s.key,title:s.title,count:missing});
  });
  if(gaps.length===0){
    panel.innerHTML='<span class="gaps-panel-label">🎉 Collection Complete!</span>';
    return;
  }
  panel.innerHTML='<span class="gaps-panel-label">Missing:</span>'+gaps.map(g=>
    `<a href="#${g.set}" class="gap-chip"><span class="gap-label">${g.title}</span> <span class="gap-count">${g.count}</span></a>`
  ).join('');
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

document.getElementById('sortMissingBtn').onclick=()=>{
  sortByMissing=!sortByMissing;
  const btn=document.getElementById('sortMissingBtn');
  btn.classList.toggle('sort-active',sortByMissing);
  render();
};

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
      rows.push([c.id,c.nm,s.title,rarity,d.qty||1,(d.cond||[]).join(','),grader,grade,d.notes||''].join('\t'));
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

document.getElementById('resetBtn').onclick=()=>{
  if(!confirm('Reset all collection data? This cannot be undone.'))return;
  data={};
  excludedSets={};
  scheduleSave();
  render();
  showToast('Collection reset');
};

document.getElementById('signOutBtn').onclick=()=>{
  google.accounts.oauth2.revoke(accessToken);
  location.reload();
};

function showToast(msg){
  const toast=document.getElementById('toast');
  toast.textContent=msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

document.querySelector('.logo-wrap').onclick=()=>{
  window.location.href='https://metaprinter.github.io/trubbish-bin/';
};

// ── Init ──
initAuth();
render();
