/* The dashboard presents the existing activity and safety models without changing them. */
(() => {
  const icons = {
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    wave:'<path d="M2 8c4 0 3-5 7-5 5 0 3 7 9 7h4M2 15c4-6 6 6 11 0s7 0 9 0M2 21c4-6 6 6 11 0s7 0 9 0"/>',
    wind:'<path d="M2 8h13a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 16h6a3 3 0 1 1-3 3"/>',
    pressure:'<path d="M4 20a10 10 0 1 1 16 0M12 5v2M5 10l2 1m12-1-2 1m-5 5 5-7"/><circle cx="12" cy="16" r="1.5"/>',
    water:'<path d="M12 2C9 7 4 12 4 16a8 8 0 0 0 16 0c0-4-5-9-8-14Z"/>',
    map:'<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5Zm6-3v17m8-14v17"/>',
    clock:'<circle cx="12" cy="12" r="10"/><path d="M12 5v7l5 3"/>',
    fish:'<path d="M2 12c5-8 11-8 16-2l4-4v12l-4-4c-5 6-11 6-16-2Z"/><circle cx="7" cy="11" r=".7"/>',
    lure:'<path d="M3 16C4 5 16 1 21 3c0 8-10 15-18 13Zm0 0-1 5 5-5M11 10l2 1m2 3v4a3 3 0 0 0 6 0v-2"/>',
    shield:'<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z"/><path d="m7 12 3 3 7-7"/>',
    arrow:'<path d="m9 5 7 7-7 7"/>',
    chart:'<path d="M5 21V12m7 9V3m7 18V8"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sun}</svg>`;
  const html = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (x,d=0) => x == null || !Number.isFinite(+x) ? '—' : (+x).toFixed(d);
  let map=null, revision=0;
  function fail(message='התחזית אינה זמינה כרגע. אפשר לרענן ולנסות שוב.') {
    revision++; if(map){map.remove();map=null;}
    document.getElementById('fishingDashboard').innerHTML=`<div class="dash-empty">${icon('wave')}<h2>מחכים לעדכון מהים</h2><p>${html(message)}</p><button type="button" id="dashRetry">רענון התחזית</button></div>`;
    document.getElementById('dashRetry').onclick=()=>document.getElementById('refresh').click();
  }
  async function render(ctx) {
    const {b,r,E,key,onFish,onLure,onBeach,onTab,loadLeaflet,beaches,lureImage}=ctx;
    const host=document.getElementById('fishingDashboard'),stamp=++revision;
    if(map){map.remove();map=null;}
    const sessions=r.sessions.filter(s=>!s.na),remaining=sessions.filter(s=>s.x.T1>Date.now()||key!==E.il(Date.now()).key);
    const chosen=[...(remaining.length?remaining:sessions)].sort((a,b)=>b.score-a.score)[0];
    if(!chosen){fail('אין מספיק נתוני תחזית לתאריך ולחוף שנבחרו. בחרו יום אחר או רעננו את התחזית.');return;}
    const allPast=key===E.il(Date.now()).key&&!remaining.length;
    const x=chosen.x,score=chosen.score,color=score>=70?'#247569':score>=45?'#b77b10':'#a84c35';
    const fish=E.fishFor(b,+key.slice(5,7),x.sst).now.filter(f=>!f.sp.bait&&(f.sp.layer==='all'||f.sp.layer===chosen.tip.layer)).slice(0,3);
    const lures=E.luresFor(E.fishFor(b,+key.slice(5,7),x.sst).now,chosen.tip.layer).slice(0,3);
    const units=(value,unit)=>`<bdi dir="ltr">${value}</bdi> <small>${unit}</small>`;
    const metric=(type,title,value,sub)=>`<div class="dash-metric is-${type}">${icon(type)}<span>${title}</span><strong>${value}</strong><small class="metric-sub">${sub}</small><svg class="metric-water" viewBox="0 0 250 56" preserveAspectRatio="none" aria-hidden="true"><path d="M0 28Q40 5 86 28t84-4 80 3v29H0Z" fill="currentColor" opacity=".16"/><path d="M0 40Q50 10 100 34t90-4 60 0v26H0Z" fill="currentColor" opacity=".18"/></svg></div>`;
    const rows=r.rows.map(row=>({row,h:E.il(row.T).hf,v:r.safeOf(row)}));
    const W=900,H=190,pad=12,Y=v=>H-18-v*(H-38)/100,X=h=>pad+h/24*(W-pad*2);
    const points=rows.map(({h,v})=>`${X(h).toFixed(1)},${Y(v).toFixed(1)}`),line=points.join(' '),base=H-18;
    const chart=rows.length?`<svg viewBox="0 0 ${W} ${H}" class="dash-chart" role="img" aria-labelledby="dashChartTitle dashChartDesc"><title id="dashChartTitle">בטיחות ונוחות לפי שעה</title><desc id="dashChartDesc">מדד של 0 עד 100 לפי רוח, גלים, ראות ותנאים נוספים. האזור המוזהב מציין את חלון הפעילות המומלץ. בטיחות ופעילות דגים הם מדדים נפרדים.</desc><defs><linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#70b8ae" stop-opacity=".4"/><stop offset="1" stop-color="#70b8ae" stop-opacity=".03"/></linearGradient></defs>${[0,25,50,75,100].map(v=>`<line x1="12" x2="888" y1="${Y(v)}" y2="${Y(v)}" stroke="#dfe6df"/>`).join('')}${Array.from({length:13},(_,i)=>`<line x1="${X(i*2)}" x2="${X(i*2)}" y1="18" y2="${base}" stroke="#e5ebe5"/>`).join('')}<rect x="${X(chosen.start)}" y="18" width="${X(chosen.end)-X(chosen.start)}" height="${base-18}" fill="#e8b454" opacity=".25"/><path d="M${points[0]} L${line} L${X(rows.at(-1).h)},${base} L${X(rows[0].h)},${base}Z" fill="url(#dashArea)"/><polyline points="${line}" fill="none" stroke="#176a67" stroke-width="3.5" stroke-linejoin="round"/><line x1="${X(chosen.start)}" x2="${X(chosen.start)}" y1="18" y2="${base}" stroke="#bf8219" stroke-dasharray="5 5"/><line x1="${X(chosen.end)}" x2="${X(chosen.end)}" y1="18" y2="${base}" stroke="#bf8219" stroke-dasharray="5 5"/></svg><div class="chart-hours" dir="ltr">${[0,4,8,12,16,20,24].map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('')}</div>`:'';
    host.innerHTML=`<div class="dash-alerts">${document.querySelector("#beachHead .warnings")?.outerHTML || ""}</div>${b.legal?`<p class="dash-legal">${html(b.legal)}</p>`:''}<section class="dash-recommendation" aria-labelledby="recommendationTitle"><div class="dash-main"><div class="dash-score" style="--score:${score};--score-color:${color}" role="img" aria-label="מדד פעילות ${score} מתוך 100"><div><strong>${score}</strong><span>מדד פעילות</span><small>מתוך 100</small></div></div><div class="dash-window"><h1 id="recommendationTitle">${icon('sun')}${allPast?'החלון המוביל היום':'החלון המומלץ'}</h1><p class="dash-time" dir="ltr">${E.hm(chosen.start)}–${E.hm(chosen.end)}</p><p class="dash-tip">${html(chosen.tip.text)}</p><span class="dash-safety ${chosen.safe&&chosen.safe.min<50?'is-caution':''}">${icon('shield')}בטיחות ${chosen.safe?chosen.safe.avg+'/100':'לא זמינה'}</span><span class="dash-period">${allPast ? "הסתיים · " : ""}${html(chosen.name)} · ${new Date(key+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'long'})}</span></div></div>${chosen.safe&&chosen.safe.min<50?`<p class="dash-warning">${chosen.safe.min<30?'תנאים מסוכנים':'תנאים קשים'} בחלק מהחלון. בדקו את אזהרות הבטיחות לפני היציאה.</p>`:''}<div class="dash-metrics">${metric('wave','גלים',units(num(b.water==='lake'?null:x.wave),'ס״מ'),b.water==='lake'?'ראו תחזית רשמית לכנרת':'בחלון המומלץ')}${metric('wind','רוח',units(num(x.wind),'קמ״ש'),'מהירות ממוצעת')}${metric('pressure','לחץ',units(num(x.p0),'hPa'),x.dpS<-.3?'↘ במגמת ירידה':x.dpS>.3?'↗ במגמת עלייה':'→ יציב')}${metric('water','טמפרטורת מים',units(num(x.sst,1),'°C'),'בחלון המומלץ')}</div></section>
    <section class="dash-panel dash-hourly" aria-labelledby="dashHourlyTitle"><div class="dash-panel-head"><h2 id="dashHourlyTitle">${icon('clock')}תחזית לפי שעה</h2><span>בטיחות ונוחות · 0–100</span></div>${chart}<div class="chart-key"><span><i></i>החלון המומלץ לפעילות</span><span>מדד הבטיחות נפרד ממדד הפעילות</span></div><label class="chart-scrubber"><span>בחרו שעה</span><input id="dashHour" type="range" min="0" max="${Math.max(0,rows.length-1)}" value="${Math.max(0,rows.findIndex(q=>q.h>=chosen.start))}" aria-label="בחירת שעה לפירוט התנאים"><output id="dashHourValue" for="dashHour"></output></label></section>
    <div class="dash-bottom"><section class="dash-panel dash-map-card" aria-labelledby="dashMapTitle"><div class="dash-panel-head"><h2 id="dashMapTitle">${icon('map')}חופים בסביבה</h2><button type="button" data-dash-tab="rank" aria-label="לכל החופים">${icon('arrow')}</button></div><div id="overviewMap" class="overview-map" role="region" aria-label="מפת החוף הנבחר וחופים סמוכים"><p>טוען מפת חופים…</p></div><div id="overviewBeaches" class="overview-beaches"></div><p class="dash-map-note">מיקומי החופים בפועל · מפה דורשת חיבור לרשת</p></section><div class="dash-tackle"><section class="dash-panel" aria-labelledby="dashLuresTitle"><div class="dash-panel-head"><h2 id="dashLuresTitle">${icon('lure')}מה כדאי לקחת</h2><button type="button" data-dash-tab="lures" aria-label="לכל הדמויים">${icon('arrow')}</button></div><div class="dash-lures">${lures.map(c=>`<button class="dash-lure-row" type="button" data-dash-lure="${c}">${lureImage(c)}<span><b>${html(window.LURE_TYPES[c])}</b><small>${html((window.LURE_INFO[c]||{}).w||'')}</small></span></button>`).join('')||'<p class="dash-muted">לא נמצאה המלצת דמוי לתנאים האלה.</p>'}</div></section><section class="dash-panel dash-fish-card" aria-labelledby="dashFishTitle"><div class="dash-panel-head"><h2 id="dashFishTitle">${icon('fish')}דגים לשכבה הזו</h2><button type="button" data-dash-tab="fish" aria-label="לכל הדגים">${icon('arrow')}</button></div><div class="dash-fish">${fish.map(({sp})=>`<button type="button" data-dash-fish="${sp.id}"><img src="assets/fish/${sp.id}.webp?v=${window.FISH_PHOTOS_V||1}" alt="" width="200" height="100" loading="lazy"><span>${html(sp.name)}</span></button>`).join('')||'<p class="dash-muted">אין כרגע דגי מטרה בעונה בשכבה הזו.</p>'}</div></section></div></div><p class="dash-disclaimer">המדדים הם הערכה לפי התחזית. יש לבדוק את תנאי הים, האזהרות והגבלות הדיג בשטח.</p>`;
    host.querySelectorAll('[data-dash-tab]').forEach(bt=>bt.onclick=()=>onTab(bt.dataset.dashTab));
    host.querySelectorAll('[data-dash-fish]').forEach(bt=>bt.onclick=()=>onFish(bt.dataset.dashFish));
    host.querySelectorAll('[data-dash-lure]').forEach(bt=>bt.onclick=()=>onLure(bt.dataset.dashLure));
    const slider=host.querySelector('#dashHour'),output=host.querySelector('#dashHourValue');
    const showHour=()=>{const q=rows[+slider.value];if(!q)return;const sf=q.v;output.textContent=`${E.hm(q.h)} · בטיחות ${sf}/100 · רוח ${num(q.row.wind)} קמ״ש · גל ${num(q.row.wave)} ס״מ`;slider.setAttribute('aria-valuetext',output.textContent);const svg=host.querySelector('.dash-chart');let cursor=host.querySelector('#dashCursor');if(svg&&!cursor){svg.insertAdjacentHTML('beforeend','<g id="dashCursor" aria-hidden="true"></g>');cursor=host.querySelector('#dashCursor');}if(cursor)cursor.innerHTML=`<line x1="${X(q.h)}" x2="${X(q.h)}" y1="18" y2="${base}" stroke="#b47a0d" stroke-dasharray="3 4"/><circle cx="${X(q.h)}" cy="${Y(sf)}" r="5" fill="#b47a0d" stroke="#fff" stroke-width="2"/>`;};
    slider.oninput=showHour;showHour();
    const near=beaches.filter(q=>q.water===b.water).sort((a,c)=>Math.hypot(a.lat-b.lat,(a.lon-b.lon)*.85)-Math.hypot(c.lat-b.lat,(c.lon-b.lon)*.85)).slice(0,3);
    host.querySelector('#overviewBeaches').innerHTML=near.map((q,i)=>`<button type="button" data-near="${i}" class="${q.name===b.name?'is-selected':''}"><span>${i+1}</span>${html(q.name)}</button>`).join('');
    host.querySelectorAll('[data-near]').forEach(bt=>bt.onclick=()=>onBeach(near[+bt.dataset.near].name));
    try{
      const L=await loadLeaflet();if(stamp!==revision||!document.getElementById('overviewMap'))return;
      const el=document.getElementById('overviewMap');el.innerHTML='';map=L.map(el,{scrollWheelZoom:false,zoomControl:false});
      const tiles=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Esri, Maxar, Earthstar Geographics'}).addTo(map);
      let failed=false;tiles.on('tileerror',()=>{if(failed||stamp!==revision)return;failed=true;const note=host.querySelector('.dash-map-note');if(note)note.textContent='תמונות המפה לא זמינות כרגע. רשימת החופים וקישורי הניווט זמינים למטה.';});
      near.forEach((q,i)=>L.marker([q.lat,q.lon],{icon:L.divIcon({className:'dash-pin'+(q.name===b.name?' is-selected':''),html:`<span>${i+1}</span>`,iconSize:[32,40],iconAnchor:[16,40]}),title:q.name}).bindPopup(`<b>${html(q.name)}</b><br><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${q.lat},${q.lon}">ניווט לחוף</a>`).addTo(map));
      map.fitBounds(near.map(q=>[q.lat,q.lon]),{padding:[35,35],maxZoom:15});
      // A tab may have been hidden while the map was loading.
      requestAnimationFrame(()=>{if(stamp===revision&&map)map.invalidateSize();});
    }catch(e){if(stamp===revision){const el=document.getElementById('overviewMap');if(el)el.innerHTML=`<a class="map-fallback" href="https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}" target="_blank" rel="noopener">${icon('map')}פתיחת החוף במפה</a>`;}}
  }
  window.FISHING_DASHBOARD={render,fail,icon,invalidate(){if(map)map.invalidateSize();}};
})();
