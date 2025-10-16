(function(){
  if(!window.React||!window.ReactDOM||!window.Recharts){
    document.getElementById('root').innerHTML = '<div style="padding:16px;color:#b91c1c">Errore: librerie vendor non caricate.</div>';
    return;
  }
  const h=React.createElement;
  const {useState,useMemo,useEffect} = React;
  const {BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ReferenceArea,ReferenceLine,ResponsiveContainer,Cell,LabelList} = Recharts;
  const fmt=new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit'});
  const fmtFull=new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'short'});
  const todayISO=()=>new Date().toISOString().slice(0,10);
  const iso=(d)=>new Date(d).toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const startOfDay=(d)=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
  const clamp=(v,mi,ma)=>Math.max(mi,Math.min(ma,v));
  const sanitize=(v,fb)=>{const n=Number(v);return Number.isFinite(n)?n:fb;};
  const calcTotal=(f,b)=>+(f*b).toFixed(2);
  const isFutureISO=(a,ref=todayISO())=>{const d=new Date(a);d.setHours(0,0,0,0);const t=new Date(ref);t.setHours(0,0,0,0);return d.getTime()>t.getTime();};
  const fractionLabel=(f)=>(f===1?'1':(f===0.75?'3/4':(f===0.5?'1/2':'1/4')));
  function inputStyle(){return{width:'100%',padding:'6px',border:'1px solid #e5e7eb',borderRadius:8};}
  function Dot(props){return h('span',{style:{display:'inline-block',width:8,height:8,borderRadius:9999,verticalAlign:'middle',background:props.color||'#000'}});}

  function toCSV(rows,sep=';'){return rows.map(r=>r.map(x=>{const s=String(x==null?'':x);return(s.includes(sep)||s.includes('"')||/\s/.test(s))?'"'+s.replace(/"/g,'""')+'"':s;}).join(sep)).join('\n');}

  function RangeDoseForm({onApply,defaultStart,defaultEnd}){
    const [start,setStart]=useState(defaultStart||todayISO());
    const [end,setEnd]=useState(defaultEnd||iso(addDays(new Date(),7)));
    const [fraction,setFraction]=useState(1);
    const [baseMg,setBaseMg]=useState(5);
    const [overwrite,setOverwrite]=useState(true);
    const [alternate,setAlternate]=useState(false);
    const [fractionA,setFractionA]=useState(1);
    const [fractionB,setFractionB]=useState(0.5);
    const [startWith,setStartWith]=useState('A');
    const totalA=calcTotal(fractionA,baseMg);
    const totalB=calcTotal(fractionB,baseMg);
    return h('div',{style:{marginTop:16,borderTop:'1px solid #e5e7eb',paddingTop:16}},
      h('div',{style:{fontSize:14,fontWeight:600,marginBottom:8}},'Imposta dosaggio su intervallo'),
      h('div',{className:'grid grid-2',style:{gap:8}},
        h('div',null,h('label',{className:'small'},'Dal'),h('input',{type:'date',value:start,onChange:e=>setStart(e.target.value),style:inputStyle()})),
        h('div',null,h('label',{className:'small'},'Al'),h('input',{type:'date',value:end,onChange:e=>setEnd(e.target.value),style:inputStyle()})),
        h('div',null,h('label',{className:'small'},'Base mg'),
          h('input',{type:'number',step:'0.25',min:'0',max:'30',value:baseMg,onChange:e=>setBaseMg(clamp(sanitize(e.target.value,5),0,30)),style:inputStyle()}),
          h('div',{className:'small',style:{marginTop:4}},'Valido 0–30 mg')
        ),
        h('div',{style:{display:'flex',alignItems:'end'}},h('label',{className:'small',style:{display:'flex',alignItems:'center',gap:8}},h('input',{type:'checkbox',checked:alternate,onChange:e=>setAlternate(e.target.checked)}),'Alterna due dosaggi (A/B)')),
        h('div',null,
          h('label',{className:'small'},'Frazione '+(alternate?'A':'(singola)')),
          h('select',{value:alternate?fractionA:fraction,onChange:e=>(alternate?setFractionA(parseFloat(e.target.value)):setFraction(parseFloat(e.target.value))),style:inputStyle()},
            h('option',{value:1},'1'),h('option',{value:0.75},'3/4'),h('option',{value:0.5},'1/2'),h('option',{value:0.25},'1/4'),
          ),
          h('div',{className:'small',style:{marginTop:4}}, alternate?('A = '+totalA+' mg'):('Totale = '+calcTotal(fraction,baseMg)+' mg'))
        ),
        alternate?h('div',null,
          h('label',{className:'small'},'Frazione B'),
          h('select',{value:fractionB,onChange:e=>setFractionB(parseFloat(e.target.value)),style:inputStyle()},
            h('option',{value:1},'1'),h('option',{value:0.75},'3/4'),h('option',{value:0.5},'1/2'),h('option',{value:0.25},'1/4'),
          ),
          h('div',{className:'small',style:{marginTop:4}},'B = '+totalB+' mg')
        ):null
      ),
      alternate && h('div',{className:'grid',style:{gap:8,marginTop:8}},
        h('div',null,
          h('label',{className:'small'},'Inizia con'),
          h('div',{style:{display:'flex',gap:12,alignItems:'center',border:'1px solid #e5e7eb',borderRadius:8,padding:'6px 8px'}},
            h('label',{style:{display:'flex',gap:6,alignItems:'center'}}, h('input',{type:'radio',name:'sw',checked:startWith==='A',onChange:()=>setStartWith('A')}),'A'),
            h('label',{style:{display:'flex',gap:6,alignItems:'center'}}, h('input',{type:'radio',name:'sw',checked:startWith==='B',onChange:()=>setStartWith('B')}),'B'),
          )
        )
      ),
      h('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:8}},
        h('input',{type:'checkbox',checked:overwrite,onChange:e=>setOverwrite(e.target.checked)}),'Sovrascrivi giorni già impostati'
      ),
      h('div',null,h('button',{className:'btn btn-primary',onClick:()=>onApply({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith})},'Applica intervallo'))
    );
  }

  function App(){
    const [tab,setTab]=useState('home');
    const defaultBase=5;
    const [doses,setDoses]=useState(()=>{
      try{const d=localStorage.getItem('inr_data_doses'); if(d) return new Map(Object.entries(JSON.parse(d)));}catch(e){}
      const m=new Map(); const t=todayISO();
      for(let i=-5;i<=35;i++){const d=iso(addDays(new Date(),i));const fr=[1,.75,.5,.25]; const f=fr[Math.floor(Math.random()*fr.length)]; const taken=isFutureISO(d,t)?false:Math.random()>0.5; m.set(d,{fraction:f,baseMg:defaultBase,totalMg:calcTotal(f,defaultBase),taken});}
      return m;
    });
    useEffect(()=>{try{localStorage.setItem('inr_data_doses',JSON.stringify(Object.fromEntries(doses)));}catch{}},[doses]);

    const [inr,setINR]=useState(()=>{
      try{const r=localStorage.getItem('inr_values'); if(r) return JSON.parse(r);}catch{}
      return [{date:iso(addDays(new Date(),-14)),value:2.8},{date:iso(addDays(new Date(),-7)),value:3.1},{date:iso(addDays(new Date(),-3)),value:2.4}];
    });
    useEffect(()=>{try{localStorage.setItem('inr_values',JSON.stringify(inr));}catch{}},[inr]);
    const [nextDraw,setNextDraw]=useState(localStorage.getItem('inr_next_draw')||iso(addDays(new Date(),7)));
    useEffect(()=>{localStorage.setItem('inr_next_draw',nextDraw);},[nextDraw]);

    const today=todayISO(); const tomorrow=iso(addDays(new Date(),1));
    const todayDose=doses.get(today); const tomorrowDose=doses.get(tomorrow);
    const latestINR=inr.length?inr.slice().sort((a,b)=>a.date.localeCompare(b.date))[inr.length-1].value:null;

    function toggleTaken(date){ if(isFutureISO(date,today)) return; const m=new Map(doses); const dd=m.get(date); if(dd){ dd.taken=!dd.taken; m.set(date,{...dd}); setDoses(m);} }
    function getStatus(date,dose){ if(!dose) return {code:'other'}; const d0=startOfDay(date); const t0=startOfDay(today); if(d0<t0 && !dose.taken) return {code:'dimenticata'}; if(dose.taken) return {code:'presa'}; if(d0>=t0 && !dose.taken) return {code:'oggi'}; return {code:'other'}; }
    function getStatusCode(date,dose){ try{const r=getStatus(date,dose); return (r&&typeof r.code==='string')?r.code:'other';}catch{return'other';} }

    const days=useMemo(()=>{
      const base=new Date(); const start=new Date(base.getFullYear(),base.getMonth(),1); const end=new Date(base.getFullYear(),base.getMonth()+1,0);
      const list=[]; for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) list.push(iso(d)); return list;
    },[]);

    function applyRange({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith}){
      const s=new Date(start); s.setHours(0,0,0,0); const e=new Date(end); e.setHours(0,0,0,0); if(isNaN(s.getTime())||isNaN(e.getTime())||s>e) return;
      const m=new Map(doses); const offset=startWith==='B'?1:0; let idx=0;
      for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
        const key=iso(d); const future=isFutureISO(key,today);
        if(overwrite || !m.get(key)){
          const existing = m.get(key) || {taken:false};
          let fr = sanitize(fraction,1);
          if(alternate){ const useA = ((idx+offset)%2)===0; fr = useA ? sanitize(fractionA,1) : sanitize(fractionB,1); }
          const base= clamp(sanitize(baseMg,5),0,30);
          const taken = future ? false : !!existing.taken;
          m.set(key,{...existing,fraction:fr,baseMg:base,totalMg:calcTotal(fr,base),taken});
        }
        idx++;
      }
      setDoses(m);
    }

    const monthStats = useMemo(()=>{
      let total=0,taken=0,missed=0,pendingToday=0,pendingFuture=0;
      const tISO=todayISO();
      for(const d of days){
        const dd=doses.get(d); if(!dd) continue; total++;
        const st=getStatusCode(d,dd);
        if(st==='presa') taken++; else if(st==='dimenticata') missed++; else if(st==='oggi'){ if(d===tISO) pendingToday++; else pendingFuture++; }
      }
      const pct = total ? Math.round((taken/total)*100) : 0;
      return {total,taken,missed,pendingToday,pendingFuture,pct};
    },[doses,days]);

    function exportMonthCSV(){
      const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
      const map={presa:'Presa',dimenticata:'Dimenticata',oggi:'Da prendere',other:'—'};
      for(const d of days){
        const dd=doses.get(d); if(!dd) continue;
        const st=map[getStatusCode(d,dd)]||'—';
        rows.push([d, (dd.fraction===1?'1':dd.fraction===0.75?'3/4':dd.fraction===0.5?'1/2':'1/4'), (dd.baseMg||0).toFixed(2),(dd.totalMg||0).toFixed(2), st]);
      }
      const csv=toCSV(rows); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
      const a=document.createElement('a'); a.href=url; a.download='Riepilogo_Dosi_'+new Date().toISOString().slice(0,7)+'.csv'; a.click(); URL.revokeObjectURL(url);
    }
    function exportAllJSON(){
      const data={__version:1,exportedAt:new Date().toISOString(),nextDraw,inr,doses:Object.fromEntries(doses)};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download='inr-tracker-backup_'+new Date().toISOString().replace(/[:T]/g,'-').slice(0,16)+'.json'; a.click(); URL.revokeObjectURL(url);
    }
    function exportAllCSV(){
      const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
      const mapSt={presa:'Presa',dimenticata:'Dimenticata',oggi:'Da prendere',other:'—'};
      const entries=Array.from(doses.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
      for(const [d,dd] of entries){
        if(!dd) continue; const code=getStatusCode(d,dd); const st=mapSt[code]||'—';
        rows.push([d,(dd.fraction===1?'1':dd.fraction===0.75?'3/4':dd.fraction===0.5?'1/2':'1/4'),(dd.baseMg||0).toFixed(2),(dd.totalMg||0).toFixed(2),st]);
      }
      const csv=toCSV(rows); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
      const a=document.createElement('a'); a.href=url; a.download='INR_All_Doses_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(url);
    }

    function Home(){
      const today=todayISO(); const tomorrow=iso(addDays(new Date(),1));
      const [nextDraw,setNextDraw]=React.useState(localStorage.getItem('inr_next_draw')||iso(addDays(new Date(),7)));
      useEffect(()=>{localStorage.setItem('inr_next_draw',nextDraw);},[nextDraw]);
      return h(React.Fragment,null,
        h('div',{className:'grid grid-4'},
          h('div',{className:'card',style:{gridColumn:'1 / -1'}},
            h('div',{style:{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}},
              h('div',null,
                h('h2',{style:{fontSize:20,fontWeight:600,marginBottom:8}},'Dose di oggi'),
                h('p',{style:{fontSize:22,fontWeight:700}},
                  (function(){const d=localStorage.getItem('inr_data_doses'); const map=d?new Map(Object.entries(JSON.parse(d))):new Map(); const todayDose=map.get(today); return todayDose ? ((todayDose.fraction===1?'1':todayDose.fraction===0.75?'3/4':todayDose.fraction===0.5?'1/2':'1/4')+' di '+todayDose.baseMg+' mg ('+todayDose.totalMg+' mg)') : '—';})()
                ),
                h('p',{className:'small',style:{marginTop:4}},fmt.format(new Date(today)))
              ),
              h('div',null,
                h('span',{className:'small'},'Vedi tab Dosi per segnare come presa.')
              )
            )
          )
        ),
        h('div',{className:'card'}, h(RangeDoseForm,{onApply:applyRange}))
      );
    }

    function Storico(){
      const [inr,setINR]=useState(()=>{try{const r=localStorage.getItem('inr_values'); if(r) return JSON.parse(r);}catch{} return [{date:iso(addDays(new Date(),-14)),value:2.8},{date:iso(addDays(new Date(),-7)),value:3.1},{date:iso(addDays(new Date(),-3)),value:2.4}];});
      useEffect(()=>{try{localStorage.setItem('inr_values',JSON.stringify(inr));}catch{}},[inr]);
      const [newInrDate,setNewInrDate]=useState(todayISO());
      const [newInrVal,setNewInrVal]=useState('');
      const data=inr.slice().sort((a,b)=>a.date.localeCompare(b.date));
      return h('div',{className:'card'},
        h('h2',null,'Storico + Grafico'),
        h('div',{style:{display:'flex',gap:8,marginBottom:12,alignItems:'center'}},
          h('input',{type:'date',value:newInrDate,onChange:e=>setNewInrDate(e.target.value),style:inputStyle()}),
          h('input',{type:'number',step:'0.1',placeholder:'INR',value:newInrVal,onChange:e=>setNewInrVal(e.target.value),style:inputStyle()}),
          h('button',{className:'btn btn-primary',onClick:()=>{const v=parseFloat(newInrVal); if(!isNaN(v)){ setINR(prev=>[...prev,{date:newInrDate,value:v}]); setNewInrVal('');}}},'Aggiungi')
        ),
        h('div',{style:{height:260}},
          h(ResponsiveContainer,{width:'100%',height:'100%'},
            h(BarChart,{data:data},
              h(CartesianGrid,{strokeDasharray:"3 3"}),
              h(XAxis,{dataKey:'date',tickFormatter:(v)=>fmt.format(new Date(v)),minTickGap:24}),
              h(YAxis,{domain:[0,6]}),
              h(Tooltip,{formatter:(v)=>Number(v).toFixed(2),labelFormatter:(v)=>fmt.format(new Date(v))}),
              h(ReferenceArea,{y1:2.5,y2:3.5,fillOpacity:0.12}),
              h(ReferenceLine,{y:2.5,strokeDasharray:"4 4"}),
              h(ReferenceLine,{y:3.5,strokeDasharray:"4 4"}),
              h(Bar,{dataKey:'value',radius:[6,6,0,0]},
                data.map((entry, index) => h(Cell,{key:'c'+index, fill: (entry.value<2.5 || entry.value>3.5) ? '#dc2626' : '#2563eb'})),
                h(LabelList,{dataKey:'value',position:'top'})
              )
            )
          )
        )
      );
    }

    function Export(){
      return h('div',{className:'card'},
        h('h2',null,'Backup & Ripristino'),
        h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
          h('button',{className:'btn btn-primary',onClick:exportAllJSON},'Esporta JSON'),
          h('button',{className:'btn btn-primary',onClick:exportAllCSV},'Esporta CSV completo')
        )
      );
    }

    function Nav({tab,setTab}){
      const btn=(id,label)=>h('button',{className:'btn '+(tab===id?'btn-primary':''),style:{marginRight:8},onClick:()=>setTab(id)},label);
      return h('div',{className:'nav'}, btn('home','Home'), btn('dosi','Dosi'), btn('storico','Storico'), btn('export','Esporta/Importa'));
    }

    function Shell(){
      const [tab,setTab]=useState('home');
      return h('div',{className:'container'},
        h(Nav,{tab,setTab}),
        tab==='home'?h(Home): tab==='dosi'?h(App.prototype.Dosi||function(){return h('div',{className:'card'},'Apri versione Dosi dal pacchetto completo.');})()
        : tab==='storico'?h(Storico): h(Export)
      );
    }

    ReactDOM.createRoot(document.getElementById('root')).render(h(Shell));
})();