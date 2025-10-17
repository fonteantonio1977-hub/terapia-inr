(function(){
  if(!window.React||!window.ReactDOM||!window.Recharts){
    document.getElementById('root').innerHTML = '<div style="padding:16px;color:#b91c1c">Errore: librerie vendor non caricate (controlla la cartella <code>vendor/</code>).</div>';
    return;
  }
  const h=React.createElement;
  const {useState,useMemo,useEffect} = React;
  const {BarChart,Bar,CartesianGrid,XAxis,YAxis,Tooltip,ReferenceArea,ReferenceLine,ResponsiveContainer,Cell,LabelList} = Recharts;

  const fmt=new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit'});
  const iso=(d)=>new Date(d).toISOString().slice(0,10);
  const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
  const todayISO=()=>new Date().toISOString().slice(0,10);
  const fractionLabel=(f)=>(f===1?'1':f===0.75?'3/4':f===0.5?'1/2':'1/4');
  const calcTotal=(f,b)=>+(f*b).toFixed(2);
  const toCSV=(rows,sep=';')=>rows.map(r=>r.map(x=>{const s=String(x??'');return(s.includes(sep)||s.includes('"')||/\s/.test(s))?'"'+s.replace(/"/g,'""')+'"':s;}).join(sep)).join('\n');

  function App(){
    const defaultBase=5;
    const [doses,setDoses]=useState(()=>{
      try{const raw=localStorage.getItem('inr_data_doses'); if(raw) return new Map(Object.entries(JSON.parse(raw)));}catch{}
      const m=new Map(); for(let i=-2;i<=14;i++){ const d=iso(addDays(new Date(),i)); const f=[1,.75,.5,.25][Math.floor(Math.random()*4)]; m.set(d,{fraction:f,baseMg:defaultBase,totalMg:calcTotal(f,defaultBase),taken:false}); } return m;
    });
    useEffect(()=>{ try{localStorage.setItem('inr_data_doses',JSON.stringify(Object.fromEntries(doses)));}catch{} },[doses]);

    const [inr,setINR]=useState(()=>{ try{const r=localStorage.getItem('inr_values'); if(r) return JSON.parse(r);}catch{} return [{date:iso(addDays(new Date(),-14)),value:2.8},{date:iso(addDays(new Date(),-7)),value:3.1},{date:iso(addDays(new Date(),-3)),value:2.4}]; });
    useEffect(()=>{ try{localStorage.setItem('inr_values',JSON.stringify(inr));}catch{} },[inr]);

    const [newInrDate,setNewInrDate]=useState(todayISO());
    const [newInrVal,setNewInrVal]=useState('');

    function exportAllJSON(){
      const data={__version:1,exportedAt:new Date().toISOString(),inr,doses:Object.fromEntries(doses)};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const a=document.createElement('a'); a.href=url; a.download='inr-tracker-backup_'+new Date().toISOString().slice(0,10)+'.json'; a.click(); URL.revokeObjectURL(url);
    }
    function exportAllCSV(){
      const rows=[["Data","Frazione","Base mg","Totale mg","Stato"]];
      const entries=[...doses.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
      for(const [d,dd] of entries){ rows.push([d,fractionLabel(dd.fraction),(dd.baseMg??0).toFixed(2),(dd.totalMg??0).toFixed(2), dd.taken?'Presa':'Da prendere']); }
      const csv=toCSV(rows); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download='INR_All_Doses_'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(url);
    }

    const today=todayISO();
    const todayDose=doses.get(today);
    const grafData=inr.slice().sort((a,b)=>a.date.localeCompare(b.date));

    return h('div',{className:'container'},
      h('div',{className:'nav'},
        h('strong',null,'INR & COUMADIN'),' – app stabile'
      ),
      h('div',{style:{display:'grid',gap:16}},
        h('div',{className:'card'},
          h('h2',null,'Dose di oggi'),
          h('p',{style:{fontSize:20,fontWeight:700}},
            todayDose ? (fractionLabel(todayDose.fraction)+' di '+todayDose.baseMg+' mg ('+todayDose.totalMg+' mg)') : '—'
          ),
          h('p',null, fmt.format(new Date(today)))
        ),
        h('div',{className:'card'},
          h('h2',null,'Storico + Grafico'),
          h('div',{style:{display:'flex',gap:8,marginBottom:12}},
            h('input',{type:'date',value:newInrDate,onChange:e=>setNewInrDate(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px'}}),
            h('input',{type:'number',step:'0.1',placeholder:'INR',value:newInrVal,onChange:e=>setNewInrVal(e.target.value),style:{border:'1px solid #e5e7eb',borderRadius:8,padding:'6px',width:120}}),
            h('button',{onClick:()=>{const v=parseFloat(newInrVal); if(!isNaN(v)){ setINR(prev=>[...prev,{date:newInrDate,value:v}]); setNewInrVal(''); }} ,style:{background:'#b91c1c',color:'#fff',border:'none',borderRadius:10,padding:'8px 12px',cursor:'pointer'}},'Aggiungi')
          ),
          h('div',{style:{height:260}},
            h(ResponsiveContainer,{width:'100%',height:'100%'},
              h(BarChart,{data:grafData},
                h(CartesianGrid,{strokeDasharray:'3 3'}),
                h(XAxis,{dataKey:'date',minTickGap:24}),
                h(YAxis,{domain:[0,6]}),
                h(Tooltip,null),
                h(ReferenceArea,{y1:2.5,y2:3.5,fillOpacity:0.12}),
                h(ReferenceLine,{y:2.5,strokeDasharray:'4 4'}),
                h(ReferenceLine,{y:3.5,strokeDasharray:'4 4'}),
                h(Bar,{dataKey:'value',radius:[6,6,0,0]},
                  grafData.map((e,i)=>h(Cell,{key:'c'+i,fill:(e.value<2.5||e.value>3.5)?'#dc2626':'#2563eb'})),
                  h(LabelList,{dataKey:'value',position:'top'})
                )
              )
            )
          )
        ),
        h('div',{className:'card'},
          h('h2',null,'Backup & Export'),
          h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
            h('button',{onClick:exportAllJSON,style:{background:'#b91c1c',color:'#fff',border:'none',borderRadius:10,padding:'8px 12px',cursor:'pointer'}},'Esporta JSON'),
            h('button',{onClick:exportAllCSV,style:{background:'#b91c1c',color:'#fff',border:'none',borderRadius:10,padding:'8px 12px',cursor:'pointer'}},'Esporta CSV')
          )
        )
      )
    );
  }
  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();