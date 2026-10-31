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
    const {b,r,E,key,onFish,onLure,onBeach,onTab,loadLeaflet,beaches,lureImage,whyHere}=ctx;
    const host=document.getElementById('fishingDashboard'),stamp=++revision;
    if(map){map.remove();map=null;}
    const sessions=r.sessions.filter(s=>!s.na),lake=b.water==='lake',isToday=key===E.il(Date.now()).key,nowH=E.il(Date.now()).hf;
    // v3.3: the day is one 24-hour activity curve (engine.hourCurve, docs/strike-point/21); the recommended window is its best 2–3 hours still ahead
    const moon=E.moonEvents(key,1,b.lat,b.lon),curve=E.hourCurve(r.rowsAll||r.rows,key,r.tidesAll||r.tides,moon,r.win,b.water,sessions);
    let rec=E.bestWindow(curve,isToday?Date.now():0),allPast=false;
    if(!rec&&isToday){rec=E.bestWindow(curve,0);allPast=true;}
    if(!rec||!sessions.length){fail('אין מספיק נתוני תחזית לתאריך ולחוף שנבחרו. בחרו יום אחר או רעננו את התחזית.');return;}
    const mid=(rec.start+rec.end)/2;
    const chosen=sessions.find(s=>mid>=s.start&&mid<=s.end)||sessions.slice().sort((a,c)=>Math.abs((a.start+a.end)/2-mid)-Math.abs((c.start+c.end)/2-mid))[0];
    const x=E.sessionInputs(r.rowsAll||r.rows,key,{start:rec.start,end:rec.end})||chosen.x,tip=E.tip(r.rowsAll||r.rows,key,{id:'window',start:rec.start,end:rec.end},lake);
    const score=rec.score,color=score>=70?'#247569':score>=45?'#b77b10':'#a84c35';
    const sfs=rec.hours.map(p=>r.safeOf(p.row)),safe={avg:Math.round(sfs.reduce((a,c)=>a+c,0)/sfs.length),min:Math.min(...sfs)};
    const inSession=sessions.find(s=>rec.start>=s.start-.01&&rec.end<=s.end+.01),dark=rec.hours.every(p=>p.light==='night')?'לילה':rec.hours.some(p=>p.light==='night')?'חלקו בחושך':'';
    const dateTxt=new Date(key+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'long'});
    const periodTxt=(allPast?'הסתיים · ':'')+(inSession?`בתוך סשן ה${inSession.name}`:`מחוץ לשלושת הסשנים${dark?' · '+dark:''}`)+' · '+dateTxt;
    const fish=E.fishFor(b,+key.slice(5,7),x.sst).now.filter(f=>!f.sp.bait&&(f.sp.layer==='all'||f.sp.layer===tip.layer)).slice(0,3);
    const lures=E.luresFor(E.fishFor(b,+key.slice(5,7),x.sst).now,tip.layer).slice(0,3);
    const units=(value,unit)=>`<bdi dir="ltr">${value}</bdi> <small>${unit}</small>`;
    const metric=(type,title,value,sub)=>`<div class="dash-metric is-${type}">${icon(type)}<span>${title}</span><strong>${value}</strong><small class="metric-sub">${sub}</small><svg class="metric-water" viewBox="0 0 250 56" preserveAspectRatio="none" aria-hidden="true"><path d="M0 28Q40 5 86 28t84-4 80 3v29H0Z" fill="currentColor" opacity=".16"/><path d="M0 40Q50 10 100 34t90-4 60 0v26H0Z" fill="currentColor" opacity=".18"/></svg></div>`;
    const rows=curve.map(p=>({p,h:p.h,v:r.safeOf(p.row)}));
    const W=900,H=226,pad=12,top=34,base=H-20,Y=v=>base-(Math.max(20,Math.min(90,v))-20)*(base-top)/70,X=h=>pad+h/24*(W-pad*2),colW=X(1)-X(0); // axis 20–90: the curve lives in 40–80
    const sfColor=v=>v>=75?'#9fd3b0':v>=50?'#f1dd96':v>=30?'#f4bf8a':'#ef9c93';
    const line=curve.map(p=>`${X(p.h+.5).toFixed(1)},${Y(p.score).toFixed(1)}`).join(' ');
    const chart=curve.length?`<svg viewBox="0 0 ${W} ${H}" class="dash-chart" role="img" aria-labelledby="dashChartTitle dashChartDesc"><title id="dashChartTitle">מדד הפעילות לפי שעה</title><desc id="dashChartDesc">עקומת מדד הפעילות לכל 24 השעות. מסגרות מקווקוות: שלושת הסשנים עם הציון שלהם. צבע הרקע: מדד הבטיחות של השעה. האזור המוזהב: החלון המומלץ.</desc>${rows.map(({p,v})=>`<rect x="${X(p.h).toFixed(1)}" y="${top}" width="${colW.toFixed(1)}" height="${base-top}" fill="${sfColor(v)}" opacity=".3"/>`).join('')}${[35,50,65,80].map(v=>`<line x1="${pad}" x2="${W-pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#d7dfd7"/><text x="${W-pad-2}" y="${Y(v)-3}" text-anchor="end" font-size="11" fill="#7a8a84">${v}</text>`).join('')}${sessions.map(s=>`<rect x="${X(s.start).toFixed(1)}" y="${top}" width="${(X(s.end)-X(s.start)).toFixed(1)}" height="${base-top}" fill="none" stroke="#176a67" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/><text x="${((X(s.start)+X(s.end))/2).toFixed(1)}" y="${top-10}" text-anchor="middle" font-size="16" font-weight="700" fill="#123f48">${html(s.name)} ${s.score}</text>`).join('')}<rect x="${X(rec.start).toFixed(1)}" y="${top}" width="${(X(rec.end)-X(rec.start)).toFixed(1)}" height="${base-top}" fill="#e8b454" opacity=".38"/><polyline points="${line}" fill="none" stroke="#176a67" stroke-width="3.5" stroke-linejoin="round"/>${isToday?`<line x1="${X(nowH).toFixed(1)}" x2="${X(nowH).toFixed(1)}" y1="${top}" y2="${base}" stroke="#a84c35" stroke-width="2"/><text x="${X(nowH).toFixed(1)}" y="${H-4}" text-anchor="middle" font-size="13" font-weight="700" fill="#a84c35">עכשיו</text>`:''}</svg><div class="chart-hours" dir="ltr">${[0,4,8,12,16,20,24].map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('')}</div>`:'';
    host.innerHTML=`<div class="dash-alerts">${document.querySelector("#beachHead .warnings")?.outerHTML || ""}</div>${b.legal?`<p class="dash-legal">${html(b.legal)}</p>`:''}<section class="dash-recommendation" aria-labelledby="recommendationTitle"><div class="dash-main"><div class="dash-score" style="--score:${score};--score-color:${color}" role="img" aria-label="מדד פעילות ${score} מתוך 100"><div><strong>${score}</strong><span>מדד פעילות</span><small>בחלון המומלץ</small></div></div><div class="dash-window"><h1 id="recommendationTitle">${icon('sun')}${allPast?'החלון המוביל היום':'החלון המומלץ'}</h1><p class="dash-sub">${allPast?'כל השעות של היום עברו; זה החלון שהוביל':isToday?'השעות הטובות ביותר שעוד לפניך, מתוך כל 24 השעות':'השעות הטובות ביותר ביום הזה, מתוך כל 24 השעות'}</p><p class="dash-time" dir="ltr">${E.hm(rec.start)}–${E.hm(rec.end)}</p><p class="dash-tip">${html(tip.text)}</p><span class="dash-safety ${safe.min<50?'is-caution':''}">${icon('shield')}בטיחות ${safe.avg}/100</span><span class="dash-period">${html(periodTxt)}</span></div></div>${whyHere?whyHere(chosen):""}${safe.min<50?`<p class="dash-warning">${safe.min<30?'תנאים מסוכנים':'תנאים קשים'} בחלק מהחלון. בדקו את אזהרות הבטיחות לפני היציאה.</p>`:''}<div class="dash-metrics">${metric('wave','גלים',units(num(lake?null:x.wave),'ס״מ'),lake?'ראו תחזית רשמית לכנרת':'בחלון המומלץ')}${metric('wind','רוח',units(num(x.wind),'קמ״ש'),'מהירות ממוצעת')}${metric('pressure','לחץ',units(num(x.p0),'hPa'),x.dpS<-.3?'↘ במגמת ירידה':x.dpS>.3?'↗ במגמת עלייה':'→ יציב')}${metric('water','טמפרטורת מים',units(num(x.sst,1),'°C'),'בחלון המומלץ')}</div></section>
    <section class="dash-panel dash-hourly" aria-labelledby="dashHourlyTitle"><div class="dash-panel-head"><h2 id="dashHourlyTitle">${icon('clock')}מדד הפעילות לפי שעה</h2><span>כל 24 השעות · 0–100</span></div>${chart}<div class="chart-key"><span><i></i>החלון המומלץ</span><span>קו: מדד הפעילות · מסגרות: שלושת הסשנים וציונם · רקע: בטיחות (ירוק טוב, צהוב סביר, כתום חלש, אדום מסוכן)</span></div><label class="chart-scrubber"><span>בחרו שעה</span><input id="dashHour" type="range" min="0" max="${Math.max(0,rows.length-1)}" value="${Math.max(0,rows.findIndex(q=>q.h>=rec.start))}" aria-label="בחירת שעה לפירוט המדד והתנאים"><output id="dashHourValue" for="dashHour"></output></label></section>
    <div class="dash-bottom"><section class="dash-panel dash-map-card" aria-labelledby="dashMapTitle"><div class="dash-panel-head"><h2 id="dashMapTitle">${icon('map')}חופים בסביבה</h2><button type="button" data-dash-tab="rank" aria-label="לכל החופים">${icon('arrow')}</button></div><div id="overviewMap" class="overview-map" role="region" aria-label="מפת החוף הנבחר וחופים סמוכים"><p>טוען מפת חופים…</p></div><div id="overviewBeaches" class="overview-beaches"></div><p class="dash-map-note">מיקומי החופים בפועל · מפה דורשת חיבור לרשת</p></section><div class="dash-tackle"><section class="dash-panel" aria-labelledby="dashLuresTitle"><div class="dash-panel-head"><h2 id="dashLuresTitle">${icon('lure')}מה כדאי לקחת</h2><button type="button" data-dash-tab="lures" aria-label="לכל הדמויים">${icon('arrow')}</button></div><div class="dash-lures">${lures.map(c=>`<button class="dash-lure-row" type="button" data-dash-lure="${c}">${lureImage(c)}<span><b>${html(window.LURE_TYPES[c])}</b><small>${html((window.LURE_INFO[c]||{}).w||'')}</small></span></button>`).join('')||'<p class="dash-muted">לא נמצאה המלצת דמוי לתנאים האלה.</p>'}</div></section><section class="dash-panel dash-fish-card" aria-labelledby="dashFishTitle"><div class="dash-panel-head"><h2 id="dashFishTitle">${icon('fish')}דגים לשכבה הזו</h2><button type="button" data-dash-tab="fish" aria-label="לכל הדגים">${icon('arrow')}</button></div><div class="dash-fish">${fish.map(({sp})=>`<button type="button" data-dash-fish="${sp.id}"><img src="assets/fish/${sp.id}.webp?v=${window.FISH_PHOTOS_V||1}" alt="" width="200" height="100" loading="lazy"><span>${html(sp.name)}</span></button>`).join('')||'<p class="dash-muted">אין כרגע דגי מטרה בעונה בשכבה הזו.</p>'}</div></section></div></div><p class="dash-disclaimer">המדדים הם הערכה לפי התחזית. יש לבדוק את תנאי הים, האזהרות והגבלות הדיג בשטח.</p>`;
    host.querySelectorAll('[data-dash-tab]').forEach(bt=>bt.onclick=()=>onTab(bt.dataset.dashTab));
    host.querySelectorAll('[data-dash-fish]').forEach(bt=>bt.onclick=()=>onFish(bt.dataset.dashFish));
    host.querySelectorAll('[data-dash-lure]').forEach(bt=>bt.onclick=()=>onLure(bt.dataset.dashLure));
    const slider=host.querySelector('#dashHour'),output=host.querySelector('#dashHourValue');
    const showHour=()=>{const q=rows[+slider.value];if(!q)return;const p=q.p,sf=q.v,lv=E.level(p.score),c=p.score>=70?'#247569':p.score>=45?'#b77b10':'#a84c35';
      output.innerHTML=`<b dir="ltr">${E.hm(p.h)}–${E.hm(p.h+1)}</b> · פעילות <b style="color:${c}">${p.score}</b> (${lv.t}) · בטיחות ${sf}/100 · רוח ${num(p.row.wind)} קמ״ש · גל ${num(p.row.wave)} ס״מ<br><small>${p.factors.slice(0,3).map(f=>(f.pts>0?'+':'')+(f.pts?f.pts.toFixed(1)+' ':'')+html(f.label)).join(' · ')||'—'}</small>`;
      slider.setAttribute('aria-valuetext',output.textContent);const svg=host.querySelector('.dash-chart');let cursor=host.querySelector('#dashCursor');if(svg&&!cursor){svg.insertAdjacentHTML('beforeend','<g id="dashCursor" aria-hidden="true"></g>');cursor=host.querySelector('#dashCursor');}if(cursor)cursor.innerHTML=`<line x1="${X(p.h+.5)}" x2="${X(p.h+.5)}" y1="${top}" y2="${base}" stroke="#b47a0d" stroke-dasharray="3 4"/><circle cx="${X(p.h+.5)}" cy="${Y(p.score)}" r="6" fill="#b47a0d" stroke="#fff" stroke-width="2"/>`;};
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
