(function(){
'use strict';
const h=React.createElement;
const {useState,useMemo,useEffect}=React;
const {BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ReferenceArea,ReferenceLine,ResponsiveContainer,Cell,LabelList}=Recharts;
const fmt=new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit'});
const todayISO=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const iso=d=>new Date(d).toISOString().slice(0,10);
const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sanitize=(v,f)=>{const n=Number(v);return Number.isFinite(n)?n:f;};
const fractionLabel=f=>(f===1?'1':f===0.75?'3/4':f===0.5?'1/2':'1/4');
const calcTotal=(f,b)=>+(f*b).toFixed(2);
const isFutureISO=(a,ref=todayISO())=>{const d=new Date(a);d.setHours(0,0,0,0);const t=new Date(ref);t.setHours(0,0,0,0);return d.getTime()>t.getTime();};
const toCSV=(rows,sep=';')=>rows.map(r=>r.map(x=>{const s=String(x==null?'':x);return(s.includes(sep)||s.includes('"')||/\s/.test(s))?('\"'+s.replace(/\"/g,'\"\"')+'\"'):s;}).join(sep)).join('\n');

function Card(p){return h('div',{className:'card '+(p.className||'')},p.children)}
function H(p){return h('h2',{style:{fontSize:'20px',fontWeight:600,marginBottom:8}},p.children)}

function RangeDoseForm({onApply,defaultStart,defaultEnd}){
  const [start,setStart]=useState(defaultStart||todayISO());
  const [end,setEnd]=useState(defaultEnd||iso(addDays(new Date(),7)));
  const [fraction,setFraction]=useState(1);
  const [baseMg,setBaseMg]=useState(5);
  const [overwrite,setOverwrite]=useState(True());
  const [alternate,setAlternate]=useState(False());
  const [fractionA,setFractionA]=useState(1);
  const [fractionB,setFractionB]=useState(0.5);
  const [startWith,setStartWith]=useState('A');
  function True(){return true} function False(){return false}
  const totalA=calcTotal(fractionA,baseMg), totalB=calcTotal(fractionB,baseMg);
  return h('div',{style:{marginTop:16,borderTop:'1px solid var(--border)',paddingTop:16}},
    h('div',{style:{fontSize:14,fontWeight:600,marginBottom:8}},'Imposta dosaggio su intervallo'),
    h('div',{className:'grid grid-2',style:{gap:8}},
      h('div',null,h('label',{className:'small'},'Dal'),
        h('input',{type:'date',value:start,onChange:e=>setStart(e.target.value),style:{width:'100%',padding:'6px',border:'1px solid var(--border)',borderRadius:8}})),
      h('div',null,h('label',{className:'small'},'Al'),
        h('input',{type:'date',value:end,onChange:e=>setEnd(e.target.value),style:{width:'100%',padding:'6px',border:'1px solid var(--border)',borderRadius:8}})),
      h('div',null,h('label',{className:'small'},'Base mg'),
        h('input',{type:'number',step:'0.25',min:'0',max:'30',value:baseMg,onChange:e=>setBaseMg(clamp(sanitize(e.target.value,5),0,30)),style:{width:'100%',padding:'6px',border:'1px solid var(--border)',borderRadius:8}}),
        h('div',{className:'small',style:{marginTop:4}},'Valido 0–30 mg')),
      h('label',{style:{display:'flex',alignItems:'center',gap:8}},
        h('input',{type:'checkbox',checked:alternate,onChange:e=>setAlternate(e.target.checked)}),'Alterna due dosaggi (A/B)'),
      h('div',null,h('label',{className:'small'},`Frazione ${alternate?'A':'(singola)'}`),
        h('select',{value:alternate?fractionA:fraction,onChange:e=>alternate?setFractionA(parseFloat(e.target.value)):setFraction(parseFloat(e.target.value)),style:{width:'100%',padding:'6px',border:'1px solid var(--border)',borderRadius:8}},
          h('option',{value:1},'1'),h('option',{value:0.75},'3/4'),h('option',{value:0.5},'1/2'),h('option',{value:0.25},'1/4')),
        h('div',{className:'small',style:{marginTop:4}},alternate?('A = '+totalA+' mg'):('Totale = '+calcTotal(fraction,baseMg)+' mg'))),
      alternate&&h('div',null,h('label',{className:'small'},'Frazione B'),
        h('select',{value:fractionB,onChange:e=>setFractionB(parseFloat(e.target.value)),style:{width:'100%',padding:'6px',border:'1px solid var(--border)',borderRadius:8}},
          h('option',{value:1},'1'),h('option',{value:0.75},'3/4'),h('option',{value:0.5},'1/2'),h('option',{value:0.25},'1/4')),
        h('div',{className:'small',style:{marginTop:4}},'B = '+totalB+' mg'))
    ),
    alternate&&h('div',{className:'grid',style:{gap:8,marginTop:8}},h('div',null,h('label',{className:'small'},'Inizia con'),
      h('div',{style:{display:'flex',gap:12,alignItems:'center',border:'1px solid var(--border)',borderRadius:8,padding:'6px 8px'}},
        h('label',{style:{display:'flex',gap:6,alignItems:'center'}},h('input',{type:'radio',name:'startWith',checked:startWith==='A',onChange:()=>setStartWith('A')}),'A'),
        h('label',{style:{display:'flex',gap:6,alignItems:'center'}},h('input',{type:'radio',name:'startWith',checked:startWith==='B',onChange:()=>setStartWith('B')}),'B')))),
    h('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:8}},
      h('input',{type:'checkbox',checked:overwrite,onChange:e=>setOverwrite(e.target.checked)}),'Sovrascrivi giorni già impostati'),
    h('div',null,h('button',{className:'btn btn-primary',onClick:()=>onApply({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith})},'Applica intervallo'))
  );
}

function App(){
  const [tab,setTab]=useState('home');
  const defaultBase=5;
  const [doses,setDoses]=useState(()=>{
    try{const fromDisk=localStorage.getItem('inr_data_doses');if(fromDisk)return new Map(Object.entries(JSON.parse(fromDisk)));}catch(e){}
    const m=new Map();const t=todayISO();
    for(let i=-5;i<=35;i++){const d=iso(addDays(new Date(),i));const arr=[1,0.75,0.5,0.25];const f=arr[Math.floor(Math.random()*arr.length)];const taken=isFutureISO(d,t)?False():Math.random()>0.5;m.set(d,{fraction:f,baseMg:defaultBase,totalMg:calcTotal(f,defaultBase),taken});}
    return m;
  });
  function False(){return false}
  useEffect(()=>{try{localStorage.setItem('inr_data_doses',JSON.stringify(Object.fromEntries(doses)));}catch(e){}},[doses]);
  const [inr,setINR]=useState([{date:iso(addDays(new Date(),-14)),value:2.8},{date:iso(addDays(new Date(),-7)),value:3.1},{date:iso(addDays(new Date(),-3)),value:2.4}]);
  const [nextDraw,setNextDraw]=useState(localStorage.getItem('inr_next_draw')||iso(addDays(new Date(),7)));
  useEffect(()=>{localStorage.setItem('inr_next_draw',nextDraw);},[nextDraw]);
  const today=todayISO();const tomorrow=iso(addDays(new Date(),1));
  const todayDose=doses.get(today);const tomorrowDose=doses.get(tomorrow);
  const latestINR=inr.length?inr.slice().sort((a,b)=>a.date.localeCompare(b.date))[inr.length-1].value:null;

  function toggleTaken(date){if(isFutureISO(date,today))return;const m=new Map(doses);const dd=m.get(date);if(dd){dd.taken=!dd.taken;m.set(date,{...dd});setDoses(m);}}
  function getStatusCode(date,dose){if(!dose)return'other';const d0=startOfDay(date),t0=startOfDay(today);if(d0<t0&&!dose.taken)return'dimenticata';if(dose.taken)return'presa';if(d0>=t0&&!dose.taken)return'oggi';return'other'}

  function applyRange({start,end,overwrite,baseMg,alternate,fraction,fractionA,fractionB,startWith}){
    const s=new Date(start);s.setHours(0,0,0,0);const e=new Date(end);e.setHours(0,0,0,0);if(isNaN(s.getTime())||isNaN(e.getTime())||s>e)return;
    const m=new Map(doses);const offset=startWith==='B'?1:0;let idx=0;
    for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){const key=iso(d);const future=isFutureISO(key,today);
      if(overwrite||!m.get(key)){const existing=m.get(key)||{taken:false};let fr=sanitize(fraction,1);if(alternate){const useA=((idx+offset)%2)===0;fr=useA?sanitize(fractionA,1):sanitize(fractionB,1);}const base=clamp(sanitize(baseMg,5),0,30);const taken=future?false:!!existing.taken;m.set(key,{...existing,fraction:fr,baseMg:base,totalMg:calcTotal(fr,base),taken});}
      idx++;}
    setDoses(m);
  }

  function exportMonthCSV(){
    const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
    const days=(function(){const base=new Date();const start=new Date(base.getFullYear(),base.getMonth(),1);const end=new Date(base.getFullYear(),base.getMonth()+1,0);const list=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))list.push(iso(d));return list;})();
    for(const d of days){const dd=doses.get(d);if(!dd)continue;const map={presa:'Presa',dimenticata:'Dimenticata',oggi:'Da prendere',other:'—'};const st=map[getStatusCode(d,dd)]||'—';rows.push([d,fractionLabel(dd.fraction),(dd.baseMg||0).toFixed(2),(dd.totalMg||0).toFixed(2),st]);}
    const csv=toCSV(rows);const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Riepilogo_Dosi_'+new Date().toISOString().slice(0,7)+'.csv';a.click();URL.revokeObjectURL(url);
  }
  function exportAllJSON(){const data={__version:1,exportedAt:new Date().toISOString(),nextDraw,inr,doses:Object.fromEntries(doses)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='inr-tracker-backup_'+new Date().toISOString().replace(/[:T]/g,'-').slice(0,16)+'.json';a.click();URL.revokeObjectURL(url);}
  function exportAllCSV(){const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];const mapSt={presa:'Presa',dimenticata:'Dimenticata',oggi:'Da prendere',other:'—'};const entries=Array.from(doses.entries()).sort((a,b)=>a[0].localeCompare(b[0]));for(const [d,dd] of entries){if(!dd)continue;const st=mapSt[getStatusCode(d,dd)]||'—';rows.push([d,fractionLabel(dd.fraction),(dd.baseMg||0).toFixed(2),(dd.totalMg||0).toFixed(2),st]);}const csv=toCSV(rows);const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='INR_All_Doses_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);}

  function Home(){return h(React.Fragment,null,
    h('div',{className:'grid grid-4'},
      h(Card,null,h(H,null,'Dose di oggi'),h('p',{style:{fontSize:22,fontWeight:700}},todayDose? (fractionLabel(todayDose.fraction)+' di '+todayDose.baseMg+' mg ('+todayDose.totalMg+' mg)'):'—'), h('p',{className:'small',style:{marginTop:4}},fmt.format(new Date(today))), todayDose && h('div',{style:{marginTop:12}},h('button',{className:'btn '+(todayDose.taken?'':'btn-primary'),onClick:()=>toggleTaken(today)},todayDose.taken?'Annulla':'Segna come presa')) ),
      h(Card,null,h(H,null,'Dose di domani'),h('p',{style:{fontSize:18,fontWeight:600}},tomorrowDose? (fractionLabel(tomorrowDose.fraction)+' di '+tomorrowDose.baseMg+' mg ('+tomorrowDose.totalMg+' mg)'):'—') ),
      h(Card,null,h(H,null,'Prossimo prelievo'),h('p',{style:{fontSize:18,fontWeight:600}},(function(){const diff=Math.round((new Date(nextDraw).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/86400000);return diff>=0?('Tra '+diff+' giorni'):(-diff+' giorni fa');})()), h('input',{type:'date',value:nextDraw,onChange:e=>setNextDraw(e.target.value),style:{marginTop:8,padding:'6px',border:'1px solid var(--border)',borderRadius:8,width:'100%'}}) ),
      h(Card,null,h(H,null,'INR corrente'), h('p',{style:{fontSize:24,fontWeight:700,color:(latestINR!=null&&latestINR>=2.5&&latestINR<=3.5)?'#16a34a':'#dc2626'}}, latestINR!=null?latestINR.toFixed(2):'—') )
    ),
    h(Card,null,h(RangeDoseForm,{onApply:applyRange}))
  );}

  function Storico(){
    const [newInrDate,setNewInrDate]=useState(todayISO());
    const [newInrVal,setNewInrVal]=useState('');
    const data=inr.slice().sort((a,b)=>a.date.localeCompare(b.date));
    return h(Card,null,
      h(H,null,'Storico + Grafico'),
      h('div',{style:{display:'flex',gap:8,marginBottom:12,alignItems:'center'}},
        h('input',{type:'date',value:newInrDate,onChange:e=>setNewInrDate(e.target.value),style:{padding:'6px',border:'1px solid var(--border)',borderRadius:8}}),
        h('input',{type:'number',step:'0.1',placeholder:'INR',value:newInrVal,onChange:e=>setNewInrVal(e.target.value),style:{padding:'6px',border:'1px solid var(--border)',borderRadius:8,width:100}}),
        h('button',{className:'btn btn-primary',onClick:()=>{const v=parseFloat(newInrVal);if(!isNaN(v)){setINR(inr.concat([{date:newInrDate,value:v}]));setNewInrVal('');}}},'Aggiungi')
      ),
      h('div',{style:{height:260}},
        h(ResponsiveContainer,{width:'100%',height:'100%'},
          h(BarChart,{data:data},
            h(CartesianGrid,{strokeDasharray:'3 3'}),
            h(XAxis,{dataKey:'date',tickFormatter:v=>fmt.format(new Date(v)),minTickGap:24}),
            h(YAxis,{domain:[0,6]}),
            h(Tooltip,{formatter:v=>Number(v).toFixed(2),labelFormatter:v=>fmt.format(new Date(v))}),
            h(ReferenceArea,{y1:2.5,y2:3.5,fillOpacity:0.12}),
            h(ReferenceLine,{y:2.5,strokeDasharray:'4 4'}),
            h(ReferenceLine,{y:3.5,strokeDasharray:'4 4'}),
            h(Bar,{dataKey:'value',radius:[6,6,0,0]},
              data.map((e,i)=>h(Cell,{key:'c'+i,fill:(e.value<2.5||e.value>3.5)?'#dc2626':'#2563eb'})),
              h(LabelList,{dataKey:'value',position:'top'})
            )
          )
        )
      )
    );
  }

  function Export(){
    useEffect(()=>{try{const payload={__version:1,exportedAt:new Date().toISOString(),nextDraw,inr,doses:Object.fromEntries(doses)};localStorage.setItem('inr_auto_backup',JSON.stringify(payload));localStorage.setItem('inr_auto_backup_ts',new Date().toISOString());}catch(e){}},[doses,inr,nextDraw]);
    const lastTs=localStorage.getItem('inr_auto_backup_ts');
    return h(Card,null,
      h(H,null,'Backup & Ripristino'),
      h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}}, 
        h('button',{className:'btn btn-primary',onClick:exportAllJSON},'Esporta JSON'),
        h('button',{className:'btn btn-primary',onClick:exportAllCSV},'Esporta CSV completo'),
        h('button',{className:'btn',onClick:exportMonthCSV},'Esporta CSV mese')
      ),
      h('div',{className:'small',style:{marginTop:8}},'Ultimo backup automatico: '+(lastTs?new Date(lastTs).toLocaleString('it-IT'):'—'))
    );
  }

  function Root(){
    const [tab,setTab]=useState('home');
    return h('div',{className:'container'},
      h('div',{className:'nav'},
        ['home','storico','export'].map(id=>h('button',{key:id,className:'btn '+(tab===id?'btn-primary':''),style:{marginRight:8},onClick:()=>setTab(id)}, id==='home'?'Home':id==='storico'?'Storico':'Esporta/Importa'))
      ),
      tab==='home'?h(Home):tab==='storico'?h(Storico):h(Export)
    );
  }

  const today=todayISO();
  const tomorrow=iso(addDays(new Date(),1));
  let doses=new Map(); try{const fromDisk=localStorage.getItem('inr_data_doses'); if(fromDisk) doses=new Map(Object.entries(JSON.parse(fromDisk)));}catch(e){}
  const todayDose=doses.get(today); const tomorrowDose=doses.get(tomorrow);

  ReactDOM.createRoot(document.getElementById('root')).render(h(Root));
})();