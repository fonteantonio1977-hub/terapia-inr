(function(){
  if(!window.React||!window.ReactDOM||!window.Recharts){
    document.getElementById('root').innerHTML = '<div style="padding:16px;color:#b91c1c">Errore: librerie CDN non caricate.</div>';
    return;
  }
  const h = React.createElement;
  const {useState,useMemo,useEffect,useRef} = React;
  const {BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ReferenceArea,ReferenceLine,ResponsiveContainer,Cell,LabelList} = Recharts;

  const fmt = new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit'});
  const fmtFull = new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short'});
  const iso = (d)=> new Date(d).toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
  const todayISO=()=> new Date().toISOString().slice(0,10);
  const isFutureISO=(isoDate,ref=todayISO())=>{const a=new Date(isoDate);a.setHours(0,0,0,0);const b=new Date(ref);b.setHours(0,0,0,0);return a.getTime()>b.getTime();};
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const sanitize=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f;};
  const fractionLabel=f=>(f===1?'1':f===0.75?'3/4':f===0.5?'1/2':'1/4');
  const calcTotal=(f,b)=>+(f*b).toFixed(2);
  const toCSV=(rows,sep=';')=>rows.map(r=>r.map(x=>{const s=String(x??'');return(s.includes(sep)||s.includes('\"')||/\\s/.test(s))?'\"'+s.replace(/\"/g,'\"\"')+'\"':s;}).join(sep)).join('\n');

  const loadScript = (src) => new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('Errore caricamento '+src)); document.head.appendChild(s); });
  async function ensurePdfDeps(){
    if(!window.html2canvas){ await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'); }
    if(!window.jspdf){ await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'); }
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if(!window.html2canvas || !jsPDF) throw new Error('Dipendenze PDF non disponibili');
    return { html2canvas: window.html2canvas, jsPDF };
  }
  async function exportElementToPDF(el, filename='Calendario_dosi.pdf'){
    const { html2canvas, jsPDF } = await ensurePdfDeps();
    const toHide = el.querySelectorAll('[data-hide-on-export="true"]');
    const hidden = [];
    toHide.forEach((node)=>{ hidden.push([node, node.style.visibility]); node.style.visibility='hidden'; });
    await new Promise(r => requestAnimationFrame(r));
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, windowWidth: document.documentElement.scrollWidth });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p','mm','a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin*2;
    const ratio = usableWidth / canvas.width;
    let imgHeight = canvas.height * ratio;
    const addHeaderFooter = (pageNum, total) => {
      pdf.setFontSize(14); pdf.text('Terapia assunta', pageWidth/2, 10, {align:'center'});
      pdf.setFontSize(10); pdf.text('Data export: '+ new Date().toLocaleDateString('it-IT'), margin, pageHeight-5);
      pdf.text(`Pagina ${pageNum} di ${total}`, pageWidth-margin, pageHeight-5, {align:'right'});
    };
    if (imgHeight <= pageHeight - margin*6) {
      addHeaderFooter(1,1);
      pdf.addImage(imgData,'PNG', margin, 20, usableWidth, imgHeight);
    } else {
      let sY = 0;
      const sliceHeightPx = (pageHeight - margin*6) / ratio;
      let pageNum=0;
      const totalPages = Math.ceil(canvas.height / sliceHeightPx);
      while (sY < canvas.height) {
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.min(sliceHeightPx, canvas.height - sY);
        slice.getContext('2d').drawImage(canvas, 0, -sY);
        const sliceImg = slice.toDataURL('image/png');
        if (pageNum>0) pdf.addPage();
        pageNum++; addHeaderFooter(pageNum,totalPages);
        pdf.addImage(sliceImg,'PNG', margin, 20, usableWidth, slice.height * ratio);
        sY += sliceHeightPx;
      }
    }
    pdf.save(filename);
    hidden.forEach(([n,v])=>n.style.visibility=v);
  }

  function StatusChip({status}){
    const map = {
      presa: { cls:'background:#dcfce7;color:#166534;border:1px solid #86efac', label:'presa' },
      dimenticata: { cls:'background:#fee2e2;color:#991b1b;border:1px solid #fecaca', label:'dimenticata' },
      oggi: { cls:'background:#ffedd5;color:#9a3412;border:1px solid #fed7aa', label:'da prendere' },
      other: { cls:'background:#f3f4f6;color:#374151;border:1px solid #e5e7eb', label:'—' }
    };
    const m = map[status] || map.other;
    return React.createElement('span',{style:`font-size:10px;padding:2px 8px;border-radius:9999px;${m.cls}`}, m.label);
  }

  function App(){
    const defaultBase=5;
    const [tab,setTab]=React.useState('home');
    const dosiRef = React.useRef(null);
    const [pdfBusy,setPdfBusy]=React.useState(false);

    const [doses,setDoses]=React.useState(()=>{
      try{const raw=localStorage.getItem('inr_data_doses'); if(raw) return new Map(Object.entries(JSON.parse(raw)));}catch{}
      const m=new Map(); const t=todayISO();
      for(let i=-5;i<=35;i++){ const d=iso(addDays(new Date(),i)); const fr=[1,.75,.5,.25][Math.floor(Math.random()*4)]; const taken=!isFutureISO(d,t) && Math.random()>0.5; m.set(d,{fraction:fr,baseMg:defaultBase,totalMg:calcTotal(fr,defaultBase),taken}); }
      return m;
    });
    React.useEffect(()=>{ try{localStorage.setItem('inr_data_doses',JSON.stringify(Object.fromEntries(doses)));}catch{} },[doses]);

    const [inr,setINR]=React.useState(()=>{
      try{const r=localStorage.getItem('inr_values'); if(r) return JSON.parse(r);}catch{}
      return [{date:iso(addDays(new Date(),-14)),value:2.8},{date:iso(addDays(new Date(),-7)),value:3.1},{date:iso(addDays(new Date(),-3)),value:2.4}];
    });
    React.useEffect(()=>{ try{localStorage.setItem('inr_values',JSON.stringify(inr));}catch{} },[inr]);

    const [notes,setNotes]=React.useState(()=>{
      try{const r=localStorage.getItem('inr_notes'); return r? JSON.parse(r) : {};}catch{ return {}; }
    });
    React.useEffect(()=>{ try{localStorage.setItem('inr_notes',JSON.stringify(notes));}catch{} },[notes]);

    const [nextDraw,setNextDraw] = React.useState(iso(addDays(new Date(), 7)));

    const today = todayISO();
    const tomorrow = iso(addDays(new Date(),1));
    const todayDose = doses.get(today);
    const tomorrowDose = doses.get(tomorrow);
    const latestINR = inr.length ? inr.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-1)[0].value : undefined;

    function toggleTaken(d){
      if (isFutureISO(d,today)) return;
      setDoses(prev=>{ const m=new Map(prev); const dd=m.get(d); if(dd){ dd.taken=!dd.taken; m.set(d,{...dd}); } return m; });
    }

    function getStatusCode(date, dd){
      if (!dd) return 'other';
      const d0=startOfDay(date), t0=startOfDay(today);
      if (d0 < t0 && !dd.taken) return 'dimenticata';
      if (dd.taken) return 'presa';
      if (d0 >= t0 && !dd.taken) return 'oggi';
      return 'other';
    }

    const days = React.useMemo(()=>{
      const base=new Date(); const start=new Date(base.getFullYear(), base.getMonth(), 1); const end=new Date(base.getFullYear(), base.getMonth()+1, 0);
      const list=[]; for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) list.push(iso(d));
      return list;
    },[]);

    const [showOnlyWithDose,setShowOnlyWithDose]=React.useState(false);
    const [statusFilter,setStatusFilter]=React.useState('all');

    function applyRange({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith}){
      const s = new Date(start); s.setHours(0,0,0,0);
      const e = new Date(end); e.setHours(0,0,0,0);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || s>e) return;
      setDoses(prev=>{
        const m = new Map(prev);
        const offset = startWith === 'B' ? 1 : 0; let idx = 0;
        for (let d = new Date(s); d<=e; d.setDate(d.getDate()+1)){
          const key = iso(d); const future = isFutureISO(key, today);
          if (overwrite || !m.get(key)){
            const existing = m.get(key) || { taken: false };
            let fr = sanitize(fraction,1);
            if (alternate) { const useA = ((idx + offset) % 2) === 0; fr = useA ? sanitize(fractionA,1) : sanitize(fractionB,1); }
            const base = clamp(sanitize(baseMg,5),0,30);
            const taken = future ? false : !!existing.taken;
            m.set(key,{...existing,fraction:fr,baseMg:base,totalMg:calcTotal(fr,base), taken});
          }
          idx++;
        }
        return m;
      });
    }

    const monthStats = React.useMemo(()=>{
      let total=0,taken=0,missed=0,pendingToday=0,pendingFuture=0;
      const tISO=todayISO();
      for(const d of days){ const dd=doses.get(d); if(!dd) continue; total++; const st=getStatusCode(d,dd); if(st==='presa') taken++; else if(st==='dimenticata') missed++; else if(st==='oggi'){ if(d===tISO) pendingToday++; else pendingFuture++; } }
      const pct = total? Math.round((taken/total)*100) : 0;
      return {total,taken,missed,pendingToday,pendingFuture,pct};
    },[doses,days]);

    function exportMonthCSV(){
      const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
      const monthDays = days.filter(d => !showOnlyWithDose || doses.has(d));
      const map = { presa:'Presa', dimenticata:'Dimenticata', oggi:'Da prendere', other:'—' };
      for(const d of monthDays){
        const dd=doses.get(d); if(!dd) continue;
        const st = map[getStatusCode(d, dd)] || '—';
        rows.push([d, fractionLabel(dd.fraction), (dd.baseMg??0).toFixed(2), (dd.totalMg??0).toFixed(2), st]);
      }
      const csv=toCSV(rows); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
      const a=document.createElement('a'); a.href=url; a.download='Riepilogo_Dosi_'+new Date().toISOString().slice(0,7)+'.csv'; a.click(); URL.revokeObjectURL(url);
    }
    function exportAllJSON(){
      const data = serializeAll();
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download='inr-tracker-backup_'+new Date().toISOString().replace(/[:T]/g,'-').slice(0,16)+'.json'; a.click(); URL.revokeObjectURL(url);
    }
    function exportAllCSV(){
      const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
      const mapSt = { presa:'Presa', dimenticata:'Dimenticata', oggi:'Da prendere', other:'—' };
      const entries = Array.from(doses.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
      for (const [d, dd] of entries) {
        if (!dd) continue; const code = getStatusCode(d, dd); const st = mapSt[code] || '—';
        rows.push([d, fractionLabel(dd.fraction), (dd.baseMg??0).toFixed(2), (dd.totalMg??0).toFixed(2), st]);
      }
      const csv=toCSV(rows);
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
      const a=document.createElement('a'); a.href=url; a.download='INR_All_Doses_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(url);
    }

    function serializeAll(){ const dosesObj = Object.fromEntries(doses); return { __version: 1, exportedAt: new Date().toISOString(), nextDraw, inr, notes, doses: dosesObj }; }

    React.useEffect(()=>{
      try{
        const payload = serializeAll();
        localStorage.setItem('inr_auto_backup', JSON.stringify(payload));
        localStorage.setItem('inr_auto_backup_ts', new Date().toISOString());
      }catch{}
    },[doses,inr,nextDraw,notes]);

    function restoreFromAutoBackup(){
      try{
        const raw = localStorage.getItem('inr_auto_backup');
        if (!raw) { alert('Nessun backup trovato'); return; }
        const obj = JSON.parse(raw);
        importAllObject(obj, 'replace');
        alert('Ripristino completato dal backup automatico');
      }catch(e){ alert('Ripristino fallito: '+(e&&e.message?e.message:'errore')); }
    }

    function normalizeDose(date, v){ const base = (v && Number.isFinite(v.baseMg)) ? clamp(+v.baseMg, 0, 30) : 5; const fraction = (v && Number.isFinite(v.fraction)) ? clamp(+v.fraction, 0, 1) : 1; const totalMg = calcTotal(fraction, base); const taken = isFutureISO(date, today) ? false : !!(v && v.taken); return { fraction, baseMg: base, totalMg, taken }; }
    function importAllObject(obj, mode){
      if (!obj || typeof obj !== 'object') throw new Error('Formato file non valido.');
      const nextDrawIn = typeof obj.nextDraw === 'string' ? obj.nextDraw : nextDraw;
      const inrIn = Array.isArray(obj.inr) ? obj.inr.filter(e => e && e.date && Number.isFinite(+e.value)).map(e => ({ date: e.date, value: +e.value })) : inr;
      const notesIn = (obj.notes && typeof obj.notes === 'object') ? obj.notes : notes;
      const dosesIn = (obj.doses && typeof obj.doses === 'object') ? obj.doses : {};
      if (mode === 'replace') {
        const m = new Map(); for (const [k, v] of Object.entries(dosesIn)) m.set(k, normalizeDose(k, v));
        setDoses(m); setINR(inrIn); setNextDraw(nextDrawIn); setNotes(notesIn);
        return;
      }
      const m = new Map(doses); for (const [k, v] of Object.entries(dosesIn)) m.set(k, normalizeDose(k, v));
      setDoses(m); setINR(inrIn); setNextDraw(nextDrawIn); setNotes(notesIn);
    }

    const [noteDate,setNoteDate]=React.useState(today);
    function getNotes(date){ const arr = notes[date]; return Array.isArray(arr)? arr : []; }
    function addNote(date,text){ const t=(text||'').trim(); if(!t) return; setNotes(prev=>{ const next={...prev}; const arr=Array.isArray(next[date])? next[date].slice() : []; arr.push({ ts: new Date().toISOString(), text: t }); next[date]=arr; return next; }); }

    function DoseEditor({date, dose}){
      const fraction = (dose && dose.fraction != null) ? dose.fraction : 1;
      const baseMg = (dose && dose.baseMg != null) ? dose.baseMg : 5;
      const total = calcTotal(fraction, baseMg);
      return React.createElement('div',{style:{marginTop:6,display:'flex',alignItems:'center',gap:6,fontSize:12}},
        React.createElement('label',null,'Dose'),
        React.createElement('select',{value:String(fraction), onChange:e=>{
          const f=parseFloat(e.target.value);
          setDoses(prev=>{ const m=new Map(prev); const ex=m.get(date); if(!ex) return m; const base=ex.baseMg!=null?ex.baseMg:defaultBase; m.set(date,{...ex,fraction:f,totalMg:calcTotal(f,base)}); return m; });
        }},
          React.createElement('option',{value:'1'},'1'),
          React.createElement('option',{value:'0.75'},'3/4'),
          React.createElement('option',{value:'0.5'},'1/2'),
          React.createElement('option',{value:'0.25'},'1/4')
        ),
        React.createElement('span',{style:{fontSize:11,color:'#374151'}}, ' = '+ total.toLocaleString('it-IT',{ maximumFractionDigits: 2 }) +' mg')
      );
    }

    function RangeDoseForm({ onApply, defaultStart, defaultEnd }){
      const [start,setStart] = React.useState(defaultStart || today);
      const [end,setEnd] = React.useState(defaultEnd || iso(addDays(new Date(),7)));
      const [fraction,setFraction] = React.useState(1);
      const [baseMg,setBaseMg] = React.useState(5);
      const [overwrite,setOverwrite] = React.useState(true);
      const [alternate,setAlternate] = React.useState(false);
      const [fractionA,setFractionA] = React.useState(1);
      const [fractionB,setFractionB] = React.useState(0.5);
      const [startWith,setStartWith] = React.useState('A');
      const totalA = calcTotal(fractionA, baseMg);
      const totalB = calcTotal(fractionB, baseMg);
      return React.createElement('div',{style:{marginTop:12,borderTop:'1px solid #e5e7eb',paddingTop:12}},
        React.createElement('div',{style:{fontSize:14,fontWeight:600,marginBottom:6}},'Imposta dosaggio su intervallo'),
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}},
          React.createElement('div',null, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Dal'),
            React.createElement('input',{type:'date',value:start,onChange:e=>setStart(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}})),
          React.createElement('div',null, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Al'),
            React.createElement('input',{type:'date',value:end,onChange:e=>setEnd(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}})),
          React.createElement('div',null, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Base mg'),
            React.createElement('input',{type:'number',step:'0.25',min:'0',max:'30',value:baseMg,onChange:e=>setBaseMg(clamp(sanitize(e.target.value,5),0,30)),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}}),
            React.createElement('div',{style:{fontSize:11,color:'#6b7280',marginTop:4}},'Valido 0–30 mg')),
          React.createElement('div',{style:{display:'flex',alignItems:'end'}},
            React.createElement('label',{style:{fontSize:13,color:'#6b7280',display:'flex',alignItems:'center',gap:8}},
              React.createElement('input',{type:'checkbox',checked:alternate,onChange:e=>setAlternate(e.target.checked)}),'Alterna due dosaggi (A/B)')),
          React.createElement('div',null, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Frazione '+(alternate?'A':'(singola)')),
            React.createElement('select',{value:alternate?fractionA:fraction,onChange:e=> (alternate? setFractionA(parseFloat(e.target.value)) : setFraction(parseFloat(e.target.value))),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}},
              React.createElement('option',{value:'1'},'1'),React.createElement('option',{value:'0.75'},'3/4'),React.createElement('option',{value:'0.5'},'1/2'),React.createElement('option',{value:'0.25'},'1/4')
            ),
            React.createElement('div',{style:{fontSize:11,color:'#6b7280',marginTop:4}}, alternate ? ('A = '+ totalA +' mg') : ('Totale = '+ calcTotal(fraction,baseMg) +' mg'))
          ),
          React.createElement('div',{style:{display: alternate ? 'block':'none'}}, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Frazione B'),
            React.createElement('select',{value:fractionB,onChange:e=>setFractionB(parseFloat(e.target.value)),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}},
              React.createElement('option',{value:'1'},'1'),React.createElement('option',{value:'0.75'},'3/4'),React.createElement('option',{value:'0.5'},'1/2'),React.createElement('option',{value:'0.25'},'1/4')
            ),
            React.createElement('div',{style:{fontSize:11,color:'#6b7280',marginTop:4}}, 'B = '+ totalB +' mg')
          )
        ),
        alternate && React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginTop:8}},
          React.createElement('div',null, React.createElement('label',{style:{fontSize:12,color:'#6b7280'}},'Inizia con'),
            React.createElement('div',{style:{display:'flex',gap:12,alignItems:'center',border:'1px solid #e5e7eb',borderRadius:8,padding:'6px'}},
              React.createElement('label',null, React.createElement('input',{type:'radio',name:'startWith',checked:startWith==='A',onChange:()=>setStartWith('A')}),' A'),
              React.createElement('label',null, React.createElement('input',{type:'radio',name:'startWith',checked:startWith==='B',onChange:()=>setStartWith('B')}),' B')
            )
          )
        ),
        React.createElement('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:8,fontSize:13,color:'#6b7280'}},
          React.createElement('input',{type:'checkbox',checked:overwrite,onChange:e=>setOverwrite(e.target.checked)}),'Sovrascrivi giorni già impostati'
        ),
        React.createElement('div',null,
          React.createElement('button',{className:'btn', onClick:()=>onApply({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith})}, 'Applica intervallo')
        )
      );
    }

    const [noteDate,setNoteDate]=React.useState(today);
    function getNotes(date){ const arr = notes[date]; return Array.isArray(arr)? arr : []; }
    function addNote(date,text){ const t=(text||'').trim(); if(!t) return; setNotes(prev=>{ const next={...prev}; const arr=Array.isArray(next[date])? next[date].slice() : []; arr.push({ ts: new Date().toISOString(), text: t }); next[date]=arr; return next; }); }

    function Home(){
      return React.createElement(React.Fragment,null,
        React.createElement('div',{className:'grid'},
          React.createElement('div',{className:'card'},
            todayDose && todayDose.taken && React.createElement('div',{style:{position:'absolute',right:16,top:16,transform:'rotate(12deg)',border:'2px solid #16a34a',color:'#16a34a',padding:'6px 10px',borderRadius:8,fontWeight:800,opacity:.8}},'PRESA'),
            React.createElement('h2',null,'Dose di oggi'),
            React.createElement('p',{style:{fontSize:20,fontWeight:700}},
              todayDose ? (fractionLabel(todayDose.fraction)+' di '+todayDose.baseMg+' mg ('+todayDose.totalMg+' mg)') : '—'
            ),
            React.createElement('p',{style:{fontSize:13,color:'#6b7280',marginTop:4}}, fmt.format(new Date(today))),
            todayDose && React.createElement('div', {style:{marginTop:8}},
              React.createElement('button',{className:'btn', onClick:()=>toggleTaken(today)}, todayDose.taken?'Annulla presa':'Segna come presa')
            )
          ),
          React.createElement('div',{className:'card'},
            React.createElement('h2',null,'Dose di domani'),
            React.createElement('p',{style:{fontSize:16,fontWeight:700}},
              tomorrowDose ? (fractionLabel(tomorrowDose.fraction)+' di '+tomorrowDose.baseMg+' mg ('+tomorrowDose.totalMg+' mg)') : '—'
            )
          ),
          React.createElement('div',{className:'card'},
            React.createElement('h2',null,'Prossimo prelievo'),
            React.createElement('p',{style:{fontSize:16,fontWeight:700}}, (function(){ const diff=Math.round((new Date(nextDraw).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/86400000); return diff>=0? 'Tra '+diff+' giorni' : (-diff)+' giorni fa'; })()),
            React.createElement('input',{type:'date',value:nextDraw,onChange:e=>setNextDraw(e.target.value),style:{marginTop:8,border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:'100%'}})
          ),
          React.createElement('div',{className:'card'},
            React.createElement('h2',null,'INR corrente'),
            React.createElement('p',{style:{fontSize:24,fontWeight:800,color: (latestINR && latestINR>=2.5 && latestINR<=3.5)?'#16a34a':'#dc2626'}}, latestINR!=null? latestINR.toFixed(2) : '—')
          )
        ),
        React.createElement('div',{className:'card', 'data-hide-on-export':'true'},
          React.createElement(RangeDoseForm,{ onApply:applyRange })
        ),
        React.createElement('div',{className:'card'},
          React.createElement('h2',null,'Altre medicine'),
          React.createElement('div',{style:{display:'flex',gap:8,alignItems:'center',marginBottom:8}},
            React.createElement('input',{type:'date',value:noteDate,onChange:e=>setNoteDate(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px'}}),
            React.createElement('input',{id:'note-text',placeholder:'Es. antibiotico 500mg ore 14:30',style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',flex:1}}),
            React.createElement('button',{className:'btn', onClick:()=>{ const el=document.getElementById('note-text'); const val=el&&el.value? el.value.trim() : ''; if(val){ addNote(noteDate,val); el.value=''; } }}, 'Aggiungi')
          ),
          (getNotes(noteDate).length===0) ?
            React.createElement('div',{style:{fontSize:14,color:'#9ca3af'}},'Nessuna nota per questa data')
          : React.createElement('ul',null, getNotes(noteDate).slice().sort((a,b)=>b.ts.localeCompare(a.ts)).map((n,i)=>
              React.createElement('li',{key:n.ts+i,style:{fontSize:14,color:'#374151'}}, new Date(n.ts).toLocaleDateString('it-IT')+' '+new Date(n.ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+' – '+n.text)
            ))
        )
      );
    }

    function Dosi(){
      return React.createElement('div',{className:'card'},
        React.createElement('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:12}},
            React.createElement('h2',null,'Calendario dosi'),
            React.createElement('label',{style:{fontSize:14,color:'#374151',display:'flex',alignItems:'center',gap:6}},
              React.createElement('input',{type:'checkbox',checked:showOnlyWithDose,onChange:e=>setShowOnlyWithDose(e.target.checked)}),
              'Mostra solo giorni con dose'
            ),
            React.createElement('select',{value:statusFilter,onChange:e=>setStatusFilter(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',fontSize:13}},
              React.createElement('option',{value:'all'},'Tutti'),
              React.createElement('option',{value:'presa'},'Prese'),
              React.createElement('option',{value:'oggi'},'Da prendere'),
              React.createElement('option',{value:'dimenticata'},'Dimenticate')
            )
          ),
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,fontSize:14,color:'#374151'}},
            React.createElement('strong',null, monthStats.pct+'% prese'),
            React.createElement('span',{className:'legend'}, 
              React.createElement('span',null, React.createElement('i',{className:'dot',style:'background:#16a34a'}),' ', monthStats.taken),
              React.createElement('span',null, React.createElement('i',{className:'dot',style:'background:#f97316'}),' ', monthStats.pendingToday,' ', React.createElement('span',{style:{color:'#9ca3af'}},'(oggi)')),
              React.createElement('span',null, React.createElement('i',{className:'dot',style:'background:#fdba74'}),' ', monthStats.pendingFuture,' ', React.createElement('span',{style:{color:'#9ca3af'}},'(futuro)')),
              React.createElement('span',null, React.createElement('i',{className:'dot',style:'background:#dc2626'}),' ', monthStats.missed)
            ),
            React.createElement('span',null,'/ ',monthStats.total),
            React.createElement('button',{className:'btn',style:{marginLeft:8},onClick:exportMonthCSV},'Esporta CSV'),
            React.createElement('button',{className:'btn secondary',onClick:async()=>{ if(!dosiRef.current) return; try{ setPdfBusy(true); await exportElementToPDF(dosiRef.current); } catch(e){ alert(e.message||'Errore esportazione PDF'); } finally{ setPdfBusy(false); } }}, pdfBusy?'Creazione…':'Esporta PDF')
          )
        ),
        React.createElement('div',{'data-hide-on-export':'true'},
          React.createElement(RangeDoseForm,{ onApply:applyRange })
        ),
        React.createElement('div',{ref:dosiRef},
          React.createElement('div',{className:'cal', style:{marginTop:8}},
            (function(){
              const mondayIndex = days.length ? ((new Date(days[0]).getDay()+6)%7) : 0;
              const padded = Array.from({length:mondayIndex}, ()=>null).concat(days);
              return padded.filter(d=>{
                if (!showOnlyWithDose) return true;
                if (!d) return true;
                return doses.has(d);
              }).filter(d=>{
                if (!d) return true;
                if (statusFilter==='all') return true;
                const dd = doses.get(d);
                return getStatusCode(d,dd)===statusFilter;
              }).map((day,i)=>{
                if(!day) return React.createElement('div',{key:'pad-'+i});
                const dd=doses.get(day); const code=getStatusCode(day,dd); const isToday=day===today; const label = fmtFull.format(new Date(day));
                const fut=isFutureISO(day,today);
                return React.createElement('div',{key:day,className:'day'+(isToday?' today':'')},
                  React.createElement('div',{className:'meta'},
                    React.createElement('span',null,label),
                    React.createElement(StatusChip,{status:code})
                  ),
                  React.createElement('div',{className:'dose'}, dd? (fractionLabel(dd.fraction)+' di '+dd.baseMg+' mg ('+dd.totalMg+' mg)') : '—'),
                  (fut && dd) ? React.createElement('details',{style:{marginTop:6}},
                    React.createElement('summary',null,'Modifica'),
                    React.createElement(DoseEditor,{date:day,dose:dd})
                  ) : React.createElement('div',{style:{marginTop:6,fontSize:11,color:'#9ca3af'}}, !dd? 'Nessun dosaggio impostato' : 'Modifica disponibile solo per date future')
                );
              });
            })()
          )
        )
      );
    }

    function Storico(){
      const [newInrDate,setNewInrDate]=React.useState(today);
      const [newInrVal,setNewInrVal]=React.useState('');
      const data = inr.slice().sort((a,b)=>a.date.localeCompare(b.date));
      return React.createElement('div',{className:'card'},
        React.createElement('h2',null,'Storico + Grafico'),
        React.createElement('div',{style:{display:'flex',gap:8,marginBottom:12}},
          React.createElement('input',{type:'date',value:newInrDate,onChange:e=>setNewInrDate(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px'}}),
          React.createElement('input',{type:'number',step:'0.1',placeholder:'INR',value:newInrVal,onChange:e=>setNewInrVal(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:120}}),
          React.createElement('button',{className:'btn', onClick:()=>{ const v=parseFloat(newInrVal); if(!isNaN(v)){ setINR(prev=>[...prev,{date:newInrDate,value:v}]); setNewInrVal(''); } }}, 'Aggiungi')
        ),
        React.createElement('div',{style:{height:280}},
          React.createElement(ResponsiveContainer,{width:'100%',height:'100%'},
            React.createElement(BarChart,{data:data},
              React.createElement(CartesianGrid,{strokeDasharray:'3 3'}),
              React.createElement(XAxis,{dataKey:'date',minTickGap:24}),
              React.createElement(YAxis,{domain:[0,6]}),
              React.createElement(Tooltip,null),
              React.createElement(ReferenceArea,{y1:2.5,y2:3.5,fillOpacity:0.12}),
              React.createElement(ReferenceLine,{y:2.5,strokeDasharray:'4 4'}),
              React.createElement(ReferenceLine,{y:3.5,strokeDasharray:'4 4'}),
              React.createElement(Bar,{dataKey:'value',radius:[6,6,0,0]},
                data.map((e,i)=>React.createElement(Cell,{key:'c'+i,fill:(e.value<2.5||e.value>3.5)?'#dc2626':'#2563eb'})),
                React.createElement(LabelList,{dataKey:'value',position:'top'})
              )
            )
          )
        ),
        React.createElement('ul',{style:{marginTop:8,borderTop:'1px solid #e5e7eb',paddingTop:8}},
          inr.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(e =>
            React.createElement('li',{key:e.date+e.value,style:{display:'flex',justifyContent:'space-between',padding:'6px 0'}},
              React.createElement('span',{style:{fontSize:14,color:'#6b7280'}}, fmt.format(new Date(e.date))),
              React.createElement('span',{style:{fontSize:14,fontWeight:700, color:(e.value>=2.5&&e.value<=3.5)?'#16a34a':'#dc2626'}}, e.value.toFixed(2))
            )
          )
        )
      );
    }

    function Note(){
      return React.createElement('div',{className:'card'},
        React.createElement('h2',null,'Note – Altre medicine'),
        (Object.keys(notes).length===0) ? React.createElement('p',{style:{fontSize:14,color:'#6b7280'}},'Nessuna nota salvata. Aggiungine una dalla Home.')
        : React.createElement('div',{className:'grid'}, Object.entries(notes).sort(([d1],[d2])=>d2.localeCompare(d1)).map(([date, arr]) =>
            React.createElement('div',{key:date, className:'day'},
              React.createElement('div',{style:{fontSize:14,fontWeight:600,marginBottom:6}}, fmtFull.format(new Date(date)),' ', React.createElement('span',{style:{color:'#9ca3af'}}, '('+(Array.isArray(arr)?arr.length:0)+' note)')),
              React.createElement('ul',null, Array.isArray(arr) && arr.slice().sort((a,b)=> (b.ts||'').localeCompare(a.ts||'')).map((n,i)=>
                React.createElement('li',{key:(n.ts||'')+i,style:{fontSize:14,color:'#374151'}}, fmtFull.format(new Date(date)),' ', (n.ts? new Date(n.ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}) : '--:--'),' – ', n.text)
              ))
            )
          ))
      );
    }

    function Esporta(){
      const lastTs = localStorage.getItem('inr_auto_backup_ts');
      const [importMode,setImportMode]=React.useState('merge');
      function onImportFile(file){
        const reader=new FileReader();
        reader.onload=()=>{
          try{
            const obj=JSON.parse(String(reader.result||'{}'));
            importAllObject(obj, importMode);
            alert('Import completato.');
          }catch(e){ alert('Errore import: '+(e&&e.message?e.message:'file non valido')); }
        };
        reader.readAsText(file);
      }
      return React.createElement('div',{className:'card'},
        React.createElement('h2',null,'Backup & Ripristino dati'),
        React.createElement('div',{className:'grid',style:{gap:12}},
          React.createElement('div',{className:'day'},
            React.createElement('div',{style:{fontSize:14,fontWeight:600,marginBottom:6}},'Esporta tutto'),
            React.createElement('p',{style:{fontSize:14,color:'#6b7280',marginBottom:8}},'Scarica i dati completi in JSON o CSV.'),
            React.createElement('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
              React.createElement('button',{className:'btn',onClick:exportAllJSON},'Esporta JSON'),
              React.createElement('button',{className:'btn',onClick:exportAllCSV},'Esporta CSV completo')
            )
          ),
          React.createElement('div',{className:'day'},
            React.createElement('div',{style:{fontSize:14,fontWeight:600,marginBottom:6}},'Importa'),
            React.createElement('div',{style:{display:'flex',gap:16,alignItems:'center',marginBottom:8,fontSize:14}},
              React.createElement('label',null, React.createElement('input',{type:'radio',name:'im',checked:importMode==='merge',onChange:()=>setImportMode('merge')}),' Unisci (sovrascrive le stesse date)'),
              React.createElement('label',null, React.createElement('input',{type:'radio',name:'im',checked:importMode==='replace',onChange:()=>setImportMode('replace')}),' Sostituisci tutto')
            ),
            React.createElement('input',{type:'file',accept:'application/json',onChange:e=>{ const f=e.target.files&&e.target.files[0]; if(f) onImportFile(f); e.target.value=''; }}),
            React.createElement('p',{style:{fontSize:12,color:'#6b7280',marginTop:6}},'Nota: per le date future l\'indicatore "presa" verrà sempre impostato a false.')
          ),
          React.createElement('div',{className:'day'},
            React.createElement('div',{style:{fontSize:14,fontWeight:600,marginBottom:6}},'Anteprima dati correnti'),
            React.createElement('ul',null,
              React.createElement('li',null,'Dosi totali: ', Array.from(doses.keys()).length),
              React.createElement('li',null,'Valori INR: ', inr.length),
              React.createElement('li',null,'Giorni con note: ', Object.keys(notes||{}).length),
              React.createElement('li',null,'Prossimo prelievo: ', fmt.format(new Date(nextDraw))),
              React.createElement('li',null,'Ultimo backup automatico: ', lastTs? new Date(lastTs).toLocaleString('it-IT') : '—')
            ),
            React.createElement('div',{style:{marginTop:8,display:'flex',gap:8}},
              React.createElement('button',{className:'btn secondary',onClick:restoreFromAutoBackup},'Ripristina da backup automatico')
            )
          )
        )
      );
    }

    return React.createElement('div',{className:'container'},
      React.createElement('nav',{className:'nav'},
        React.createElement('div',{style:{display:'flex',gap:8}},
          [{id:'home',label:'Home'},{id:'dosi',label:'Dosi'},{id:'storico',label:'Storico'},{id:'note',label:'Note'},{id:'export',label:'Esporta/Importa'}].map(t=>
            React.createElement('button',{key:t.id,className:'btn '+(tab===t.id?'':'secondary'),onClick:()=>setTab(t.id)},t.label)
          )
        )
      ),
      tab==='home' && React.createElement(Home),
      tab==='dosi' && React.createElement(Dosi),
      tab==='storico' && React.createElement(Storico),
      tab==='note' && React.createElement(Note),
      tab==='export' && React.createElement(Esporta)
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();