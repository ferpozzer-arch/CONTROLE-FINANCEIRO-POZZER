const CATEGORIAS = ["Moradia","Alimentação","Transporte","Saúde","Lazer","Educação","Outros","Combustível","Pedágio","Reserva"];
const PERSON_LABEL = {FERNANDO:"Fernando", VANESSA:"Vanessa"};

let entradas = [];
let gastos = [];
let orcamento = {};
let currentTab = 'resumo';
let txType = 'gasto';
let historicoFilter = 'todos';
let viewDate = new Date();

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function brl(n){ n = Number(n)||0; return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

function esc(v){
  return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 1800);
}

async function loadAll(){
  entradas = await storageGet('entradas');
  gastos = await storageGet('gastos');
  orcamento = await storageGet('orcamento');

  if(entradas===null){
    entradas = [
      {id:uid(), data:"2026-04-01", tipo:"Salário", descricao:"", valor:6000, pessoa:"FERNANDO"},
      {id:uid(), data:"2026-04-01", tipo:"Salário", descricao:"", valor:5500, pessoa:"VANESSA"},
      {id:uid(), data:"2026-04-01", tipo:"Delegada", descricao:"", valor:1000, pessoa:"FERNANDO"}
    ];
    await storageSet('entradas', entradas);
  }
  if(gastos===null){
    gastos = [
      {id:uid(), data:"2026-04-05", categoria:"Alimentação", descricao:"", valor:1300, pessoa:"VANESSA", forma:"Crédito", tipoGasto:"Necessário"},
      {id:uid(), data:"2026-04-06", categoria:"Transporte", descricao:"", valor:200, pessoa:"FERNANDO", forma:"Crédito", tipoGasto:"Necessário"},
      {id:uid(), data:"2026-06-01", categoria:"Saúde", descricao:"", valor:1300, pessoa:"VANESSA", forma:"Pix", tipoGasto:"Necessário"}
    ];
    await storageSet('gastos', gastos);
  }
  if(orcamento===null){
    orcamento = {Moradia:1500, "Alimentação":800, Transporte:600, "Saúde":300, Lazer:400, "Educação":200, Outros:300, Combustível:0, "Pedágio":0, Reserva:0};
    await storageSet('orcamento', orcamento);
  }
  updateSyncBanner();
}

// ====== CONFIGURAÇÃO DA PLANILHA COMPARTILHADA (Google Sheets via Apps Script) ======
// Se vocês seguiram o passo a passo, cole a URL do Web App diretamente aqui. Assim, ao copiar
// este mesmo arquivo .html para o celular da Vanessa e para o notebook, os três já saem sincronizados
// sem precisar configurar nada em cada aparelho.
const API_URL_DEFAULT = "";

function getApiUrl(){
  try{
    const saved = localStorage.getItem('livrocaixa_api_url');
    if(saved) return saved;
  }catch(err){}
  return (API_URL_DEFAULT && API_URL_DEFAULT.trim().startsWith('http')) ? API_URL_DEFAULT.trim() : null;
}

async function apiGet(key){
  const url = getApiUrl();
  if(!url) return undefined; // sem API configurada
  try{
    const res = await fetch(url + '?key=' + encodeURIComponent(key), {method:'GET'});
    if(!res.ok) return undefined;
    const data = await res.json();
    return (data && data.value) ? JSON.parse(data.value) : null;
  }catch(err){ return undefined; }
}

async function apiSet(key, val){
  const url = getApiUrl();
  if(!url) return false;
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({key, value: JSON.stringify(val)})
    });
    return res.ok;
  }catch(err){ return false; }
}

// syncMode: 'sheets' (Google Sheets via Apps Script), 'claude' (storage do artefato Claude), 'local' (só neste aparelho)
let syncMode = 'local';
function hasSharedStorage(){ return typeof window.storage !== 'undefined' && window.storage !== null; }

async function storageGet(key){
  const viaApi = await apiGet(key);
  if(viaApi !== undefined){ syncMode = 'sheets'; return viaApi; }

  if(hasSharedStorage()){
    try{
      const r = await window.storage.get(key, true);
      syncMode = 'claude';
      return r ? JSON.parse(r.value) : null;
    }catch(err){ /* segue para localStorage */ }
  }

  syncMode = 'local';
  try{
    const raw = localStorage.getItem('livrocaixa_'+key);
    return raw ? JSON.parse(raw) : null;
  }catch(err){ return null; }
}

async function storageSet(key, val){
  const url = getApiUrl();
  if(url){
    const ok = await apiSet(key, val);
    if(ok){ syncMode = 'sheets'; return true; }
  }
  if(hasSharedStorage()){
    try{
      await window.storage.set(key, JSON.stringify(val), true);
      syncMode = 'claude';
      return true;
    }catch(err){ /* segue para localStorage */ }
  }
  syncMode = 'local';
  try{
    localStorage.setItem('livrocaixa_'+key, JSON.stringify(val));
    return true;
  }catch(err){ return false; }
}

function updateSyncBanner(){
  const b = document.getElementById('syncBanner');
  if(!b) return;
  if(syncMode==='local'){
    b.style.display = 'block';
    b.innerHTML = '<b>Modo local neste aparelho.</b> Os lançamentos estão salvos só neste dispositivo. Toque em ⚙️ no topo para conectar à sincronização compartilhada.';
  } else {
    b.style.display = 'none';
  }
}

function openSettings(){
  document.getElementById('fApiUrl').value = getApiUrl() || '';
  document.getElementById('connStatus').textContent = '';
  document.getElementById('settingsBg').classList.add('open');
}
function closeSettings(){ document.getElementById('settingsBg').classList.remove('open'); }

async function testConnection(){
  const url = document.getElementById('fApiUrl').value.trim();
  const status = document.getElementById('connStatus');
  status.textContent = 'Testando…';
  if(!url){ status.textContent = 'Cole a URL do Web App antes de testar.'; return; }
  try{
    const res = await fetch(url + '?key=orcamento', {method:'GET'});
    if(res.ok){ status.textContent = '✅ Conectado com sucesso à planilha!'; }
    else{ status.textContent = '⚠️ A URL respondeu, mas com erro (status '+res.status+'). Confira o deploy do Apps Script.'; }
  }catch(err){ status.textContent = '❌ Não consegui conectar. Confira se a URL termina em /exec e se o deploy está com acesso "Qualquer pessoa".'; }
}

async function saveApiUrl(){
  const url = document.getElementById('fApiUrl').value.trim();
  try{
    if(url) localStorage.setItem('livrocaixa_api_url', url);
    else localStorage.removeItem('livrocaixa_api_url');
  }catch(err){}
  closeSettings();
  showToast('Configuração salva. Sincronizando…');
  await refreshData();
}

async function persist(key, val){
  const ok = await storageSet(key, val);
  if(!ok) showToast('Erro ao salvar. Tente novamente.');
  updateSyncBanner();
}

// Antes de gravar, busca a versão mais recente salva (caso o outro celular tenha lançado algo há poucos segundos),
// evitando que uma gravação sobrescreva o lançamento do outro.
async function fetchLatest(key, fallback){
  const v = await storageGet(key);
  return v===null ? fallback : v;
}

function updateSyncLabel(){
  const el = document.getElementById('syncLabel');
  if(!el) return;
  const now = new Date();
  const hora = now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const prefix = syncMode==='sheets' ? 'sincronizado (Google Sheets) às '
    : syncMode==='claude' ? 'sincronizado (Claude) às '
    : 'salvo neste aparelho às ';
  el.textContent = prefix + hora;

  const dot = document.getElementById('syncDot');
  if(dot) dot.style.background = syncMode==='local' ? 'var(--bad)' : 'var(--good)';

  const countEl = document.getElementById('syncCount');
  if(countEl){
    const total = (Array.isArray(entradas)?entradas.length:0) + (Array.isArray(gastos)?gastos.length:0);
    countEl.textContent = '· ' + total + ' lançamentos no total';
  }
}

let isRefreshing = false;
async function refreshData(silent){
  if(isRefreshing) return;
  isRefreshing = true;
  const btn = document.getElementById('refreshBtn');
  if(btn) btn.classList.add('spinning');
  try{
    await loadAll();
    render();
    updateSyncLabel();
    if(!silent) showToast('Dados atualizados!');
  } finally {
    isRefreshing = false;
    if(btn) btn.classList.remove('spinning');
  }
}

// Mantém os dois celulares em dia: ao voltar pro app ou trocar de aba, busca a versão mais recente sem precisar tocar em nada
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') refreshData(true); });
window.addEventListener('focus', ()=>refreshData(true));
window.addEventListener('pageshow', ()=>refreshData(true));

function monthKey(d){ return d.toISOString().slice(0,7); }
function inCurrentMonth(dateStr){ return (dateStr||'').slice(0,7) === monthKey(viewDate); }

function changeMonth(delta){
  viewDate.setMonth(viewDate.getMonth()+delta);
  render();
}

function switchTab(tab){
  currentTab = tab;
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  render();
}

function setTxType(t){
  txType = t;
  document.getElementById('btnTypeOut').classList.toggle('sel', t==='gasto');
  document.getElementById('btnTypeIn').classList.toggle('sel', t==='entrada');
  document.getElementById('gastoFields').style.display = t==='gasto' ? 'block':'none';
  document.getElementById('entradaFields').style.display = t==='entrada' ? 'block':'none';
}

function setQuickValor(v){
  document.getElementById('fValor').value = v;
  document.querySelectorAll('#quickChips .chip').forEach(c=>c.classList.toggle('active', c.textContent.trim()==='R$ '+v));
}

function openModal(){
  editingKind = null; editingId = null;
  const catSel = document.getElementById('fCategoria');
  catSel.innerHTML = CATEGORIAS.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('fData').value = new Date().toISOString().slice(0,10);
  document.getElementById('fValor').value = '';
  document.getElementById('fDescricao').value = '';
  document.querySelectorAll('#quickChips .chip').forEach(c=>c.classList.remove('active'));
  setTxType('gasto');
  document.querySelector('.modal h3').textContent = 'Novo lançamento';
  document.querySelector('.save-btn').textContent = 'Salvar lançamento';
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

async function saveTransaction(){
  const valor = parseFloat(document.getElementById('fValor').value);
  const data = document.getElementById('fData').value;
  const pessoa = document.getElementById('fPessoa').value;
  if(!data || !valor || valor<=0){ showToast('Preencha data e valor.'); return; }

  const saveBtn = document.querySelector('.save-btn');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Salvando…'; }

  if(txType==='gasto'){
    gastos = await fetchLatest('gastos', gastos);
    const novo = {
      id: editingId || uid(), data, categoria:document.getElementById('fCategoria').value,
      descricao:document.getElementById('fDescricao').value, valor, pessoa,
      forma:document.getElementById('fForma').value, tipoGasto:document.getElementById('fTipoGasto').value
    };
    if(editingKind==='gasto' && editingId){
      const idx = gastos.findIndex(x=>x.id===editingId);
      if(idx>-1) gastos[idx] = novo; else gastos.push(novo);
    } else {
      gastos.push(novo);
    }
    await persist('gastos', gastos);
  } else {
    entradas = await fetchLatest('entradas', entradas);
    const novo = {
      id: editingId || uid(), data, tipo:document.getElementById('fTipoEntrada').value,
      descricao:document.getElementById('fDescricao').value, valor, pessoa
    };
    if(editingKind==='entrada' && editingId){
      const idx = entradas.findIndex(x=>x.id===editingId);
      if(idx>-1) entradas[idx] = novo; else entradas.push(novo);
    } else {
      entradas.push(novo);
    }
    await persist('entradas', entradas);
  }
  if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Salvar lançamento'; }
  editingKind = null; editingId = null;
  updateSyncLabel();
  closeModal();
  showToast('Lançamento salvo!');
  render();
}

let editingKind = null;
let editingId = null;

function openEditModal(kind, id){
  const item = (kind==='gasto' ? gastos : entradas).find(x=>x.id===id);
  if(!item) return;
  editingKind = kind; editingId = id;

  const catSel = document.getElementById('fCategoria');
  catSel.innerHTML = CATEGORIAS.map(c=>`<option>${c}</option>`).join('');
  document.getElementById('fData').value = item.data || '';
  document.getElementById('fValor').value = item.valor || '';
  document.getElementById('fPessoa').value = item.pessoa || 'FERNANDO';
  document.getElementById('fDescricao').value = item.descricao || '';
  document.querySelectorAll('#quickChips .chip').forEach(c=>c.classList.remove('active'));
  setTxType(kind);

  if(kind==='gasto'){
    document.getElementById('fCategoria').value = item.categoria || CATEGORIAS[0];
    document.getElementById('fForma').value = item.forma || 'Pix';
    document.getElementById('fTipoGasto').value = item.tipoGasto || 'Necessário';
  } else {
    document.getElementById('fTipoEntrada').value = item.tipo || 'Salário';
  }

  document.querySelector('.modal h3').textContent = 'Editar lançamento';
  document.querySelector('.save-btn').textContent = 'Salvar alterações';
  document.getElementById('modalBg').classList.add('open');
}

async function deleteTx(kind, id){
  if(kind==='gasto'){
    gastos = await fetchLatest('gastos', gastos);
    gastos = gastos.filter(x=>x.id!==id);
    await persist('gastos', gastos);
  } else {
    entradas = await fetchLatest('entradas', entradas);
    entradas = entradas.filter(x=>x.id!==id);
    await persist('entradas', entradas);
  }
  updateSyncLabel();
  render();
}

// ===== Backup: exportar/importar todos os dados como arquivo JSON =====
function exportarBackup(){
  const payload = { entradas, gastos, orcamento, exportadoEm: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'controle-financeiro-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup baixado!');
}

async function importarBackupArquivo(file){
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data.entradas || !data.gastos) throw new Error('Formato inválido');
    entradas = data.entradas; gastos = data.gastos; orcamento = data.orcamento || orcamento;
    await persist('entradas', entradas);
    await persist('gastos', gastos);
    await persist('orcamento', orcamento);
    showToast('Backup restaurado com sucesso!');
    render();
  }catch(err){
    showToast('Não consegui ler esse arquivo de backup.');
  }
}

// ===== Relatório mensal para impressão / PDF =====
function gerarRelatorio(){
  const d = computeMonthData();
  const mesLabel = viewDate.toLocaleDateString('pt-BR',{month:'long', year:'numeric'});
  const geradoEm = new Date().toLocaleString('pt-BR');

  const entRows = d.entMes.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||''))
    .map(e=>`<tr><td>${fmtData(e.data)}</td><td>${esc(e.tipo||'')}</td><td>${esc(PERSON_LABEL[e.pessoa]||e.pessoa)}</td><td>${esc(e.descricao||'—')}</td><td style="text-align:right">${brl(e.valor)}</td></tr>`).join('');

  const gasRows = d.gasMes.slice().sort((a,b)=>(a.data||'').localeCompare(b.data||''))
    .map(g=>`<tr><td>${fmtData(g.data)}</td><td>${esc(g.categoria||'')}</td><td>${esc(PERSON_LABEL[g.pessoa]||g.pessoa)}</td><td>${esc(g.forma||'')}</td><td>${esc(g.tipoGasto||'')}</td><td>${esc(g.descricao||'—')}</td><td style="text-align:right">${brl(g.valor)}</td></tr>`).join('');

  const orc = orcamento || {};
  const catRows = CATEGORIAS.map(c=>{
    const lim = Number(orc[c]||0), gasto = d.porCategoria[c]||0, diff = lim-gasto;
    if(lim===0 && gasto===0) return '';
    return `<tr><td>${esc(c)}</td><td style="text-align:right">${lim>0?brl(lim):'—'}</td><td style="text-align:right">${brl(gasto)}</td><td style="text-align:right; color:${diff<0?'#A83A2E':'#2F6B4F'}">${lim>0?brl(diff):'—'}</td></tr>`;
  }).join('');

  document.getElementById('printReport').innerHTML = `
    <div class="rep-page">
      <div class="rep-header">
        <div><h1>Controle Financeiro</h1><div class="sub">Fernando & Vanessa · Relatório de ${mesLabel}</div></div>
        <div class="when">Gerado em<br>${geradoEm}</div>
      </div>

      <div class="rep-grid">
        <div class="rep-card"><div class="k">Entradas</div><div class="v">${brl(d.totalEnt)}</div></div>
        <div class="rep-card"><div class="k">Gastos</div><div class="v">${brl(d.totalGas)}</div></div>
        <div class="rep-card"><div class="k">Saldo</div><div class="v">${brl(d.saldo)}</div></div>
        <div class="rep-card"><div class="k">Poupança</div><div class="v">${d.taxaPoupanca.toFixed(0)}%</div></div>
      </div>

      <div class="rep-section-title">Entradas do mês</div>
      ${d.entMes.length ? `<table class="rep-table"><tr><th>Data</th><th>Tipo</th><th>Pessoa</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>${entRows}</table>` : `<div class="rep-empty">Nenhuma entrada registrada neste mês.</div>`}

      <div class="rep-section-title">Gastos do mês</div>
      ${d.gasMes.length ? `<table class="rep-table"><tr><th>Data</th><th>Categoria</th><th>Pessoa</th><th>Pagamento</th><th>Tipo</th><th>Descrição</th><th style="text-align:right">Valor</th></tr>${gasRows}</table>` : `<div class="rep-empty">Nenhum gasto registrado neste mês.</div>`}

      <div class="rep-section-title">Orçamento vs. realizado</div>
      ${catRows ? `<table class="rep-table"><tr><th>Categoria</th><th style="text-align:right">Limite</th><th style="text-align:right">Gasto</th><th style="text-align:right">Diferença</th></tr>${catRows}</table>` : `<div class="rep-empty">Nenhum limite de orçamento configurado.</div>`}

      <div class="rep-footer">Relatório gerado automaticamente pelo app Controle Financeiro</div>
    </div>
  `;
  setTimeout(()=>window.print(), 150);
}

function fmtData(iso){
  if(!iso) return '—';
  return new Date(iso+'T00:00:00').toLocaleDateString('pt-BR');
}

async function updateLimite(cat, val){
  orcamento = await fetchLatest('orcamento', orcamento);
  orcamento[cat] = parseFloat(val)||0;
  await persist('orcamento', orcamento);
  updateSyncLabel();
  render();
}

function computeMonthData(){
  const ent = Array.isArray(entradas) ? entradas : [];
  const gas = Array.isArray(gastos) ? gastos : [];
  const entMes = ent.filter(e=>inCurrentMonth(e.data));
  const gasMes = gas.filter(g=>inCurrentMonth(g.data));
  const totalEnt = entMes.reduce((s,e)=>s+Number(e.valor||0),0);
  const totalGas = gasMes.reduce((s,g)=>s+Number(g.valor||0),0);
  const saldo = totalEnt - totalGas;
  const porCategoria = {};
  CATEGORIAS.forEach(c=>porCategoria[c]=0);
  gasMes.forEach(g=>{ porCategoria[g.categoria] = (porCategoria[g.categoria]||0) + Number(g.valor||0); });
  const porPessoaGasto = {FERNANDO:0, VANESSA:0};
  gasMes.forEach(g=>{ if(porPessoaGasto[g.pessoa]===undefined) porPessoaGasto[g.pessoa]=0; porPessoaGasto[g.pessoa]+=Number(g.valor||0); });
  const porPessoaEntrada = {FERNANDO:0, VANESSA:0};
  entMes.forEach(e=>{ if(porPessoaEntrada[e.pessoa]===undefined) porPessoaEntrada[e.pessoa]=0; porPessoaEntrada[e.pessoa]+=Number(e.valor||0); });

  const orc = orcamento || {};
  const necessario = gasMes.filter(g=>g.tipoGasto!=='Supérfluo').reduce((s,g)=>s+Number(g.valor||0),0);
  const superfluo = gasMes.filter(g=>g.tipoGasto==='Supérfluo').reduce((s,g)=>s+Number(g.valor||0),0);
  const taxaPoupanca = totalEnt>0 ? (saldo/totalEnt)*100 : 0;
  const limiteTotal = CATEGORIAS.reduce((s,c)=>s+Number(orc[c]||0),0);

  return {entMes, gasMes, totalEnt, totalGas, saldo, porCategoria, porPessoaGasto, porPessoaEntrada,
    necessario, superfluo, taxaPoupanca, limiteTotal};
}

function render(){
 try{
  document.getElementById('monthLabel').textContent =
    viewDate.toLocaleDateString('pt-BR',{month:'long', year:'numeric'});

  const d = computeMonthData();
  const balEl = document.getElementById('balanceValue');
  balEl.textContent = brl(d.saldo);
  balEl.classList.toggle('neg', d.saldo<0);
  const chip = document.getElementById('statusChip');
  chip.textContent = d.saldo>=0 ? '🟢 Positivo' : '🔴 Atenção, saldo negativo';

  const main = document.getElementById('mainContent');
  if(currentTab==='resumo') main.innerHTML = renderResumo(d);
  else if(currentTab==='historico') main.innerHTML = renderHistorico(d);
  else main.innerHTML = renderOrcamento(d);

  if(currentTab==='orcamento'){
    CATEGORIAS.forEach(c=>{
      const inp = document.getElementById('lim_'+c);
      if(inp) inp.addEventListener('change', e=>updateLimite(c, e.target.value));
    });
  }
 }catch(err){
   console.error('Erro ao renderizar:', err);
   document.getElementById('mainContent').innerHTML =
     `<div class="empty-state"><div class="big">⚠️</div>Algo deu errado ao carregar os dados.<br>Toque em 🔄 no topo para tentar de novo.</div>`;
 }
}

function renderResumo(d){
  return `
    <div class="action-row">
      <div class="action-btn primary" onclick="gerarRelatorio()">📄 Relatório PDF do mês</div>
      <div class="action-btn" onclick="exportarBackup()">💾 Backup</div>
    </div>
    <div class="grid2">
      <div class="card in"><div class="k">Entradas</div><div class="v">${brl(d.totalEnt)}</div></div>
      <div class="card out"><div class="k">Gastos</div><div class="v">${brl(d.totalGas)}</div></div>
    </div>

    <div class="section-title">Por pessoa<span class="rule"></span></div>
    <div class="person-row">
      <div class="person-card fernando">
        <div class="avatar fernando">F</div>
        <div><div class="name">Fernando gastou</div><div class="amt">${brl(d.porPessoaGasto.FERNANDO||0)}</div></div>
      </div>
      <div class="person-card vanessa">
        <div class="avatar vanessa">V</div>
        <div><div class="name">Vanessa gastou</div><div class="amt">${brl(d.porPessoaGasto.VANESSA||0)}</div></div>
      </div>
    </div>

    <div class="section-title">Saúde financeira do mês<span class="rule"></span></div>
    <div class="cat-item">
      <div class="cat-top"><span class="name">Taxa de poupança</span><span class="nums">${d.taxaPoupanca.toFixed(0)}% da renda</span></div>
      <div class="bar-track"><div class="bar-fill ${d.taxaPoupanca<0?'over':''}" style="width:${Math.max(0,Math.min(100,d.taxaPoupanca))}%"></div></div>
      <div class="cat-diff ${d.taxaPoupanca>=20?'pos':'neg'}">${
        d.taxaPoupanca>=20
          ? 'Ótimo: acima da meta clássica de guardar 20% da renda.'
          : d.taxaPoupanca>=0
            ? 'Abaixo dos 20% recomendados como referência de poupança — dá pra apertar um pouco.'
            : 'Vocês gastaram mais do que entrou neste mês. Vale revisar os gastos supérfluos abaixo.'
      }</div>
    </div>
    ${d.totalGas>0 ? `
    <div class="cat-item" style="margin-top:10px;">
      <div class="cat-top"><span class="name">Essencial vs. supérfluo</span><span class="nums">${brl(d.necessario)} · ${brl(d.superfluo)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.necessario/d.totalGas)*100}%; background:var(--good);"></div></div>
      <div class="cat-diff pos">${((d.superfluo/d.totalGas)*100).toFixed(0)}% dos gastos foram supérfluos${(d.superfluo/d.totalGas)>0.3 ? ' — bem acima da referência de ~30% (regra 50/30/20)' : ''}</div>
    </div>` : ''}
    ${d.limiteTotal>0 ? `
    <div class="cat-item" style="margin-top:10px;">
      <div class="cat-top"><span class="name">Orçamento combinado</span><span class="nums">${brl(d.totalGas)} / ${brl(d.limiteTotal)}</span></div>
      <div class="bar-track"><div class="bar-fill ${d.totalGas>d.limiteTotal?'over':''}" style="width:${Math.min(100,(d.totalGas/d.limiteTotal)*100)}%"></div></div>
    </div>` : ''}

    <div class="section-title">Gastos por categoria<span class="rule"></span></div>
    <div class="cat-list">
      ${CATEGORIAS.filter(c=>d.porCategoria[c]>0).length ? CATEGORIAS.filter(c=>d.porCategoria[c]>0).map(c=>{
        const gasto = d.porCategoria[c]||0;
        const lim = orcamento[c]||0;
        const pct = lim>0 ? Math.min(100,(gasto/lim)*100) : (gasto>0?100:0);
        const over = lim>0 && gasto>lim;
        return `<div class="cat-item">
          <div class="cat-top"><span class="name">${esc(c)}</span><span class="nums">${brl(gasto)}${lim>0? ' / '+brl(lim):''}</span></div>
          <div class="bar-track"><div class="bar-fill ${over?'over':''}" style="width:${pct}%"></div></div>
        </div>`;
      }).join('') : `<div class="empty-state"><div class="big">🗒️</div>Nenhum gasto registrado neste mês.</div>`}
    </div>
  `;
}

function renderHistorico(d){
  let items = [];
  entradas.forEach(e=>items.push({kind:'entrada', ...e}));
  gastos.forEach(g=>items.push({kind:'gasto', ...g}));
  items = items.filter(i=>inCurrentMonth(i.data));
  if(historicoFilter==='entradas') items = items.filter(i=>i.kind==='entrada');
  if(historicoFilter==='gastos') items = items.filter(i=>i.kind==='gasto');
  items.sort((a,b)=> (b.data||'').localeCompare(a.data||''));

  const rows = items.map(i=>{
    const isIn = i.kind==='entrada';
    const dataFmt = i.data ? new Date(i.data+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '—';
    const titulo = isIn ? (i.tipo||'Entrada') : (i.categoria||'Gasto');
    const sub = [dataFmt, PERSON_LABEL[i.pessoa]||i.pessoa, !isIn ? i.forma : null, i.descricao||null].filter(Boolean).join(' · ');
    return `<div class="tx-item" onclick="openEditModal('${i.kind}','${i.id}')">
      <div class="tx-icon ${isIn?'in':'out'}">${isIn?'💰':'💸'}</div>
      <div class="tx-mid"><div class="l1">${esc(titulo)}</div><div class="l2">${esc(sub)}</div></div>
      <div class="tx-val ${isIn?'in':'out'}">${isIn?'+':'-'} ${brl(i.valor)}</div>
      <button class="tx-del" onclick="event.stopPropagation(); deleteTx('${i.kind}','${i.id}')">✕</button>
    </div>`;
  }).join('');

  return `
    <div class="action-row">
      <div class="action-btn primary" onclick="gerarRelatorio()">📄 Relatório PDF do mês</div>
    </div>
    <div class="filter-row">
      <div class="chip ${historicoFilter==='todos'?'active':''}" onclick="setHistFilter('todos')">Todos</div>
      <div class="chip ${historicoFilter==='entradas'?'active':''}" onclick="setHistFilter('entradas')">Entradas</div>
      <div class="chip ${historicoFilter==='gastos'?'active':''}" onclick="setHistFilter('gastos')">Gastos</div>
    </div>
    <div class="tx-list">
      ${items.length ? rows : `<div class="empty-state"><div class="big">📭</div>Nada por aqui neste mês.<br>Toque no + para lançar.</div>`}
    </div>
    <div class="info-note">Toque num lançamento para editar. Toque no ✕ para excluir.</div>
  `;
}
function setHistFilter(f){ historicoFilter=f; render(); }

function renderOrcamento(d){
  const rows = CATEGORIAS.map(c=>{
    const lim = orcamento[c]||0;
    const gasto = d.porCategoria[c]||0;
    const diff = lim - gasto;
    const pct = lim>0 ? Math.min(100,(gasto/lim)*100) : (gasto>0?100:0);
    const over = lim>0 && gasto>lim;
    return `<div class="cat-item">
      <div class="cat-top"><span class="name">${esc(c)}</span><span class="nums">${brl(gasto)} gasto</span></div>
      <div class="bar-track"><div class="bar-fill ${over?'over':''}" style="width:${pct}%"></div></div>
      <div class="cat-diff ${diff>=0?'pos':'neg'}">${diff>=0? 'Sobra '+brl(diff) : 'Estourou '+brl(Math.abs(diff))}</div>
      <label style="margin-top:10px;">Limite mensal</label>
      <input type="number" id="lim_${esc(c)}" value="${lim}" step="10" inputmode="decimal">
    </div>`;
  }).join('');
  return `<div class="section-title">Planejamento por categoria<span class="rule"></span></div>
    <div class="cat-list">${rows}</div>
    <div class="info-note">Ajuste os limites conforme o combinado do mês. As mudanças são salvas automaticamente e valem para todos os meses.</div>`;
}

(async function init(){
  await loadAll();
  render();
  updateSyncLabel();
  const splash = document.getElementById('splash');
  if(splash) splash.classList.add('hide');
})();

// Registra o service worker (permite instalar como app de verdade e abrir offline).
// Só funciona quando o site está em https:// (não funciona abrindo o arquivo direto no computador).
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{ /* sem suporte, segue normal */ });
  });
}