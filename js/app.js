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

function abrirMenuFerramentas(){ document.getElementById('toolsBg')?.classList.add('open'); }
function fecharMenuFerramentas(){ document.getElementById('toolsBg')?.classList.remove('open'); }
function abrirScannerDireto(){
  const input = document.getElementById('quickComprovante');
  if(input) input.click();
  else abrirCameraComprovante();
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
  resetScannerUI();
  document.querySelectorAll('#quickChips .chip').forEach(c=>c.classList.remove('active'));
  setTxType('gasto');
  document.querySelector('.modal h3').textContent = 'Novo lançamento';
  document.querySelector('.save-btn').textContent = 'Salvar lançamento';
  document.getElementById('modalBg').classList.add('open');
}
function closeModal(){ document.getElementById('modalBg').classList.remove('open'); }

function abrirImportadorSMS(){
  const bg = document.getElementById('smsBg');
  const txt = document.getElementById('smsTexto');
  if(txt) txt.value = '';
  if(bg) bg.classList.add('open');
}
function fecharImportadorSMS(){
  const bg = document.getElementById('smsBg');
  if(bg) bg.classList.remove('open');
}

function extrairDadosSMS(texto){
  const raw = String(texto||'');
  const up = raw.toUpperCase();
  const valor = extrairValorComprovante(raw) || (()=>{
    const m = raw.match(/(?:R\$|BRL|VALOR(?:\s+DE)?|COMPRA(?:\s+DE)?)[^0-9]{0,12}([0-9]{1,6}(?:[.,][0-9]{2}))/i);
    return m ? parseFloat(m[1].replace('.','').replace(',','.')) : null;
  })();
  const dataIso = extrairDataComprovante(raw) || new Date().toISOString().slice(0,10);
  let forma = 'Cartão Crédito';
  if(/DEBITO|DÉBITO|DEB\b/.test(up)) forma = 'Cartão Débito';
  if(/PIX/.test(up)) forma = 'Pix';
  const partes = raw.split(/\s+(?:EM|NO|NA|N[OA]|ESTABELECIMENTO|LOCAL|COMPRA)\s+/i);
  let descricao = '';
  if(partes.length>1){
    descricao = partes[partes.length-1]
      .replace(/\s+(?:NO\s+)?VALOR.*$/i,'')
      .replace(/\s+R\$.*$/i,'')
      .replace(/\s+EM\s+\d{1,2}[\/\-]\d{1,2}.*$/i,'')
      .replace(/\s+AS\s+\d{1,2}:\d{2}.*$/i,'')
      .trim();
  }
  if(!descricao){
    const m = raw.match(/(?:CARTAO|CARTÃO|COMPRA|APROVADA|AUTORIZADA).*?(?:EM|NO|NA)\s+([A-Z0-9 &.\-]{4,50})/i);
    descricao = m ? m[1].trim() : 'Compra por SMS';
  }
  descricao = descricao.replace(/[^\p{L}\p{N} &.\-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,48) || 'Compra por SMS';
  const sug = sugerirCategoriaDescricao(descricao + '\n' + raw);
  return {valor, dataIso, forma, categoria:sug.categoria || 'Outros', descricao: descricao || sug.descricao || 'Compra por SMS'};
}

function preencherLancamentoComDados(dados){
  openModal();
  setTxType('gasto');
  if(dados.dataIso) document.getElementById('fData').value = dados.dataIso;
  if(dados.valor) document.getElementById('fValor').value = Number(dados.valor).toFixed(2);
  if(dados.categoria) document.getElementById('fCategoria').value = dados.categoria;
  if(dados.forma) document.getElementById('fForma').value = dados.forma;
  if(dados.descricao) document.getElementById('fDescricao').value = dados.descricao;
  document.getElementById('fTipoGasto').value = 'Necessário';
}

function processarSMSManual(){
  const texto = document.getElementById('smsTexto')?.value || '';
  if(texto.trim().length < 8){ showToast('Cole o SMS do cartão primeiro.'); return; }
  const dados = extrairDadosSMS(texto);
  fecharImportadorSMS();
  preencherLancamentoComDados(dados);
  showToast(dados.valor ? 'SMS interpretado. Confira e salve.' : 'Não achei o valor. Confira os campos.');
}

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
  else if(currentTab==='graficos') main.innerHTML = renderGraficos(d);
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
    <div class="hero-actions">
      <label class="hero-btn camera" for="quickComprovante"><span>📷</span><b>IA do comprovante</b><small>Abre a câmera e preenche o gasto automaticamente</small></label>
      <button class="hero-btn" onclick="openModal()"><span>➕</span><b>Novo lançamento</b><small>Entrada ou gasto manual</small></button>
    </div>
    <div class="action-row compact">
      <div class="action-btn" onclick="switchTab('graficos')">📊 Gráficos</div>
      <div class="action-btn primary" onclick="gerarRelatorio()">📄 PDF do mês</div>
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

function gerarInsights(d){
  const msgs = [];
  const topCat = Object.entries(d.porCategoria).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])[0];
  if(d.saldo < 0) msgs.push('Atenção: o mês está negativo. Priorize revisar gastos supérfluos e compras no crédito.');
  else if(d.taxaPoupanca >= 20) msgs.push('Ótimo controle: vocês estão guardando pelo menos 20% da renda do mês.');
  else if(d.totalEnt > 0) msgs.push('Saldo positivo, mas a poupança está abaixo de 20%. Uma pequena meta de corte já melhora bastante.');
  if(topCat) msgs.push('Maior categoria de gasto: ' + topCat[0] + ' (' + brl(topCat[1]) + ').');
  if(d.superfluo > 0 && d.totalGas > 0 && d.superfluo/d.totalGas > .3) msgs.push('Supérfluos acima de 30% dos gastos. Vale definir limite para lazer/compras.');
  if(!msgs.length) msgs.push('Sem dados suficientes neste mês. Lance alguns gastos para a análise ficar mais precisa.');
  return msgs;
}

function renderMiniPie(d){
  const total = d.totalGas || 0;
  const cats = Object.entries(d.porCategoria).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!total || !cats.length) return '<div class="empty-state"><div class="big">📊</div>Sem gastos para montar o gráfico.</div>';
  let acc = 0;
  const colors = ['#B8902E','#2F6B4F','#A83A2E','#3B6E8F','#A14C6B','#7A6A42'];
  const gradients = cats.map(([c,v],i)=>{ const start=acc; const end=acc+(v/total)*100; acc=end; return `${colors[i]} ${start}% ${end}%`; }).join(',');
  return `<div class="chart-card"><div class="pie" style="background:conic-gradient(${gradients});"></div><div class="legend">${cats.map(([c,v],i)=>`<div><i style="background:${colors[i]}"></i><span>${esc(c)}</span><b>${brl(v)}</b></div>`).join('')}</div></div>`;
}

function monthSeries(){
  const out=[];
  for(let i=5;i>=0;i--){
    const d=new Date(viewDate); d.setMonth(viewDate.getMonth()-i);
    const key=monthKey(d);
    const label=d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    const ent=entradas.filter(e=>(e.data||'').slice(0,7)===key).reduce((s,e)=>s+Number(e.valor||0),0);
    const gas=gastos.filter(g=>(g.data||'').slice(0,7)===key).reduce((s,g)=>s+Number(g.valor||0),0);
    out.push({label, ent, gas, saldo:ent-gas});
  }
  return out;
}

function renderBars(series){
  const max=Math.max(1,...series.flatMap(x=>[x.ent,x.gas,Math.abs(x.saldo)]));
  return `<div class="bar-chart">${series.map(x=>`<div class="bar-col"><div class="bars"><i class="in" style="height:${Math.max(3,(x.ent/max)*100)}%"></i><i class="out" style="height:${Math.max(3,(x.gas/max)*100)}%"></i></div><small>${esc(x.label)}</small></div>`).join('')}</div><div class="chart-hint"><span class="dot in"></span>Entradas <span class="dot out"></span>Gastos</div>`;
}

function renderGraficos(d){
  const insights = gerarInsights(d);
  return `
    <div class="section-title">Gráficos e análise<span class="rule"></span></div>
    <div class="insight-card"><div class="insight-title">🤖 Análise financeira automática</div>${insights.map(x=>`<p>${esc(x)}</p>`).join('')}</div>
    <div class="grid2">
      <div class="card in"><div class="k">Entradas</div><div class="v">${brl(d.totalEnt)}</div></div>
      <div class="card out"><div class="k">Gastos</div><div class="v">${brl(d.totalGas)}</div></div>
    </div>
    <div class="section-title">Pizza por categoria<span class="rule"></span></div>
    ${renderMiniPie(d)}
    <div class="section-title">Evolução dos últimos 6 meses<span class="rule"></span></div>
    <div class="chart-card">${renderBars(monthSeries())}</div>
    <div class="section-title">Pessoa no mês<span class="rule"></span></div>
    <div class="person-row">
      <div class="person-card fernando"><div class="avatar fernando">F</div><div><div class="name">Fernando</div><div class="amt">${brl(d.porPessoaGasto.FERNANDO||0)}</div></div></div>
      <div class="person-card vanessa"><div class="avatar vanessa">V</div><div><div class="name">Vanessa</div><div class="amt">${brl(d.porPessoaGasto.VANESSA||0)}</div></div></div>
    </div>
    <div class="action-row" style="margin-top:16px"><div class="action-btn primary" onclick="gerarRelatorio()">📄 Gerar PDF do mês</div></div>
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


// ===== Scanner de comprovantes por câmera/OCR =====
// Funciona melhor em HTTPS ou localhost. No celular, o input abre a câmera traseira.

function resetScannerUI(){
  const preview = document.getElementById('scanPreview');
  const result = document.getElementById('scanResult');
  const img = document.getElementById('receiptImg');
  const bar = document.getElementById('scanProgressBar');
  const st = document.getElementById('scanStatus');
  if(preview) preview.style.display = 'none';
  if(result){ result.style.display = 'none'; result.innerHTML = ''; }
  if(img) img.removeAttribute('src');
  if(bar) bar.style.width = '0%';
  if(st) st.textContent = 'Aguardando imagem…';
}


function capturarComprovanteRapido(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  openModal();
  setTimeout(() => {
    processarComprovante(file);
    input.value = '';
  }, 80);
}

function abrirCameraComprovante(){
  const input = document.getElementById('fComprovante');
  if(!input){ showToast('Scanner indisponível neste navegador.'); return; }
  if(location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'){
    showToast('Para abrir câmera no celular, publique o app em HTTPS.');
  }
  input.click();
}

function setScanProgress(texto, pct){
  const st = document.getElementById('scanStatus');
  const bar = document.getElementById('scanProgressBar');
  if(st) st.textContent = texto;
  if(bar) bar.style.width = Math.max(0, Math.min(100, pct||0)) + '%';
}

function normalizarTextoOCR(texto){
  return String(texto||'')
    .replace(/[|]/g,'I')
    .replace(/[”“]/g,'"')
    .replace(/\s+/g,' ')
    .trim();
}

function parseValorBR(str){
  if(!str) return null;
  let s = String(str).replace(/[^0-9,\.]/g,'');
  if(!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const dec = Math.max(lastComma,lastDot);
  if(dec >= 0){
    const int = s.slice(0,dec).replace(/[^0-9]/g,'');
    const cents = s.slice(dec+1).replace(/[^0-9]/g,'').slice(0,2).padEnd(2,'0');
    return Number(int + '.' + cents);
  }
  return Number(s);
}

function extrairValorComprovante(texto){
  const t = texto.toUpperCase();
  const candidates = [];
  const patterns = [
    /(VALOR\s*(TOTAL)?|TOTAL\s*(R\$)?|COMPRA|PAGAMENTO|DEBITO|D[EÉ]BITO|CR[EÉ]DITO)[^0-9R$]{0,18}(R\$\s*)?([0-9]{1,3}(?:[\.\s][0-9]{3})*[,\.][0-9]{2}|[0-9]+[,\.][0-9]{2})/gi,
    /(R\$\s*)([0-9]{1,3}(?:[\.\s][0-9]{3})*[,\.][0-9]{2}|[0-9]+[,\.][0-9]{2})/gi,
    /\b([0-9]{1,3}(?:[\.\s][0-9]{3})*[,\.][0-9]{2}|[0-9]+[,\.][0-9]{2})\b/g
  ];
  patterns.forEach((re, idx)=>{
    let m;
    while((m = re.exec(t)) !== null){
      const raw = m[m.length-1];
      const valor = parseValorBR(raw);
      if(valor && valor > 0 && valor < 100000){
        let score = idx===0 ? 30 : idx===1 ? 20 : 10;
        const before = t.slice(Math.max(0, m.index-40), m.index+80);
        if(/TOTAL|VALOR|COMPRA|PAGAMENTO/.test(before)) score += 20;
        if(/TROCO|SALDO|AUTORIZ|NSU|CNPJ|CPF|CUPOM/.test(before)) score -= 8;
        candidates.push({valor, score, raw});
      }
    }
  });
  if(!candidates.length) return null;
  candidates.sort((a,b)=> b.score-a.score || b.valor-a.valor);
  return candidates[0].valor;
}

function extrairDataComprovante(texto){
  const t = texto;
  const re = /(\b\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  let m;
  while((m = re.exec(t)) !== null){
    let dia = Number(m[1]), mes = Number(m[2]), ano = Number(m[3]);
    if(ano < 100) ano += 2000;
    if(dia>=1 && dia<=31 && mes>=1 && mes<=12 && ano>=2020 && ano<=2100){
      return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    }
  }
  return new Date().toISOString().slice(0,10);
}

function extrairFormaComprovante(texto){
  const t = texto.toUpperCase();
  if(/PIX/.test(t)) return 'Pix';
  if(/D[EÉ]BITO|DEBITO|DEB\b/.test(t)) return 'Débito';
  if(/CR[EÉ]DITO|CREDITO|CRED\b|PARCEL/.test(t)) return 'Crédito';
  if(/DINHEIRO|ESP[EÉ]CIE/.test(t)) return 'Dinheiro';
  return 'Crédito';
}

function sugerirCategoriaDescricao(texto){
  const up = texto.toUpperCase();
  const regras = [
    [/POSTO|COMBUST|GASOL|ETANOL|SHELL|IPIRANGA|RAIZEN|ALE|PETROBRAS/, 'Combustível', 'Posto / combustível'],
    [/PEDAG|SEM PARAR|VELOE|CONECTCAR/, 'Pedágio', 'Pedágio'],
    [/MERCADO|SUPERMERC|ATACAD|ASSAI|ATACAD[AÃ]O|CARREFOUR|EXTRA|DIA |PADARIA|HORTIFRUTI/, 'Alimentação', 'Supermercado / alimentação'],
    [/IFOOD|RESTAUR|LANCH|PIZZ|BURGER|CAF[EÉ]|A[ÇC]AI/, 'Alimentação', 'Restaurante / alimentação'],
    [/UBER|99|METRO|METR[ÔO]|ESTACION|PARKING|TAXI|T[ÁA]XI/, 'Transporte', 'Transporte'],
    [/FARMAC|DROGA|DROGARIA|HOSPITAL|CLINIC|LABORAT|EXAME/, 'Saúde', 'Saúde'],
    [/CINEMA|NETFLIX|SPOTIFY|AMAZON PRIME|INGRESSO|BAR /, 'Lazer', 'Lazer'],
    [/ESCOLA|CURSO|FACUL|LIVRARIA|PAPELARIA/, 'Educação', 'Educação'],
    [/ALUGUEL|CONDOM|ENERGIA|SABESP|ENEL|INTERNET|VIVO|CLARO|TIM/, 'Moradia', 'Moradia']
  ];
  for(const [re, cat, desc] of regras){ if(re.test(up)) return {categoria:cat, descricao:desc}; }
  const linhas = String(texto||'').split(/\n+/).map(x=>x.trim()).filter(x=>x.length>3);
  const loja = linhas.find(l=> !/CNPJ|CPF|VALOR|TOTAL|AUTORIZ|NSU|CUPOM|SAT|DATA|HORA/i.test(l));
  return {categoria:'Outros', descricao: loja ? loja.slice(0,48) : 'Comprovante da maquininha'};
}

async function reduzirImagemParaOCR(file){
  const img = document.getElementById('receiptImg');
  const canvas = document.getElementById('receiptCanvas');
  const url = URL.createObjectURL(file);
  await new Promise((resolve, reject)=>{
    img.onload = resolve; img.onerror = reject; img.src = url;
  });
  const maxW = 1400;
  const scale = Math.min(1, maxW / img.naturalWidth);
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', .92);
}

async function processarComprovante(file){
  const preview = document.getElementById('scanPreview');
  const result = document.getElementById('scanResult');
  if(preview) preview.style.display = 'flex';
  if(result){ result.style.display = 'block'; result.innerHTML = 'Preparando imagem…'; }
  setTxType('gasto');
  setScanProgress('Preparando imagem…', 8);
  try{
    const dataUrl = await reduzirImagemParaOCR(file);
    if(typeof Tesseract === 'undefined'){
      setScanProgress('OCR não carregou.', 0);
      if(result) result.innerHTML = 'Não consegui carregar o leitor de texto. Verifique a internet e tente de novo.';
      return;
    }
    setScanProgress('Lendo texto do comprovante…', 18);
    const { data } = await Tesseract.recognize(dataUrl, 'por+eng', {
      logger: m => {
        if(m.status === 'recognizing text') setScanProgress('Lendo texto do comprovante…', 18 + Math.round((m.progress||0)*72));
        else if(m.status) setScanProgress(m.status, 12);
      }
    });
    const texto = normalizarTextoOCR(data.text || '');
    const valor = extrairValorComprovante(texto);
    const dataIso = extrairDataComprovante(data.text || texto);
    const forma = extrairFormaComprovante(texto);
    const sug = sugerirCategoriaDescricao(data.text || texto);

    if(dataIso) document.getElementById('fData').value = dataIso;
    if(valor) document.getElementById('fValor').value = valor.toFixed(2);
    if(sug.categoria) document.getElementById('fCategoria').value = sug.categoria;
    if(forma) document.getElementById('fForma').value = forma;
    if(sug.descricao && !document.getElementById('fDescricao').value) document.getElementById('fDescricao').value = sug.descricao;
    document.getElementById('fTipoGasto').value = 'Necessário';

    setScanProgress('Leitura concluída. Confira antes de salvar.', 100);
    const conf = Math.round(data.confidence || 0);
    if(result){
      result.innerHTML = `
        <b>IA local preencheu o lançamento automaticamente.</b><br>
        Valor: <b>${valor ? brl(valor) : 'não identificado'}</b> · Data: <b>${fmtData(dataIso)}</b> · Pagamento: <b>${esc(forma)}</b><br>
        Categoria sugerida: <b>${esc(sug.categoria)}</b> · Descrição: <b>${esc(sug.descricao)}</b>
        <div class="scan-confidence">Precisão OCR aproximada: ${conf}%</div>
        <div class="scan-actions">
          <button type="button" onclick="abrirCameraComprovante()">Tirar outra foto</button>
          <button type="button" onclick="document.getElementById('scanResult').style.display='none'">Ok, conferir campos</button>
        </div>`;
    }
    if(!valor) showToast('Não achei o valor. Preencha manualmente.');
  }catch(err){
    console.error(err);
    setScanProgress('Falha na leitura.', 0);
    if(result) result.innerHTML = 'Não consegui ler esse comprovante. Tente uma foto mais reta, com boa luz, ou preencha manualmente.';
  }
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