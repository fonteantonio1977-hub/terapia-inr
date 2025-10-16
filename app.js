(function(){const root=document.getElementById('root'); if(!window.React||!window.ReactDOM){root.textContent='Errore: React non caricato.';return;}
const h=React.createElement;
function App(){return h('div',{className:'container'}, h('div',{className:'nav'}, 'INR & COUMADIN – App caricata'), h('div',{className:'card'}, 'Qui va la tua app completa (calendario, grafico, export).'));}
ReactDOM.createRoot(root).render(h(App));})();