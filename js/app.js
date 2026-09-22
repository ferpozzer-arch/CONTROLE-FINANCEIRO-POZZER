const CATEGORIAS = ["Moradia","Alimentação","Transporte","Saúde","Lazer","Educação","Outros","Combustível","Pedágio","Reserva"];
const PERSON_LABEL = {FERNANDO:"Fernando", VANESSA:"Vanessa"};

let entradas = [];
let gastos = [];
let orcamento = {};
let faturas = [];
let contas = [];
let dividas = [];
let holerites = [];
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
function abrirLancamentoInteligente(){ document.getElementById('smartBg')?.classList.add('open'); }
function fecharLancamentoInteligente(){ document.getElementById('smartBg')?.classList.remove('open'); }
function abrirScannerDireto(){
  const input = document.getElementById('quickComprovante');
  if(input) input.click();
  else abrirCameraComprovante();
}

async function loadAll(){
  entradas = await storageGet('entradas');
  gastos = await storageGet('gastos');
  orcamento = await storageGet('orcamento');
  faturas = await storageGet('faturas');
  contas = await storageGet('contas');
  dividas = await storageGet('dividas');
  holerites = await storageGet('holerites');

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
  if(faturas===null){ faturas=[]; await storageSet('faturas', faturas); }
  if(contas===null){ contas=[]; await storageSet('contas', contas); }
  if(dividas===null){ dividas=[]; await storageSet('dividas', dividas); }
  if(holerites===null){ holerites=[]; await storageSet('holerites', holerites); }
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
    const total = (Array.isArray(entradas)?entradas.length:0) + (Array.isArray(gastos)?gastos.length:0) + (Array.isArray(faturas)?faturas.length:0) + (Array.isArray(contas)?contas.length:0) + (Array.isArray(holerites)?holerites.length:0);
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
    checarNotificacoes(false);
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
window.addEventListener('online', ()=>refreshData(true));
setInterval(()=>{ if(document.visibilityState==='visible') refreshData(true); }, 30000);

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
  if(document.getElementById('fParcelas')) document.getElementById('fParcelas').value = '1';
  if(document.getElementById('fRecorrencia')) document.getElementById('fRecorrencia').value = 'nao';
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
    const base = {
      id: editingId || uid(), data, categoria:document.getElementById('fCategoria').value,
      descricao:document.getElementById('fDescricao').value, valor, pessoa,
      forma:document.getElementById('fForma').value, tipoGasto:document.getElementById('fTipoGasto').value
    };
    const parcelas = Math.max(1, Number(document.getElementById('fParcelas')?.value || 1));
    const recorrencia = document.getElementById('fRecorrencia')?.value || 'nao';
    if(editingKind==='gasto' && editingId){
      const idx = gastos.findIndex(x=>x.id===editingId);
      if(idx>-1) gastos[idx] = base; else gastos.push(base);
    } else if(parcelas > 1){
      const grupo = uid();
      const valorParcela = Math.round((valor/parcelas)*100)/100;
      for(let i=0;i<parcelas;i++){
        const dt = new Date(data+'T00:00:00'); dt.setMonth(dt.getMonth()+i);
        gastos.push({...base, id:uid(), valor:valorParcela, data:dt.toISOString().slice(0,10), descricao:(base.descricao||base.categoria) + ` (${i+1}/${parcelas})`, parcelaAtual:i+1, parcelas, grupoParcelamento:grupo});
      }
    } else if(recorrencia === 'mensal'){
      const grupo = uid();
      for(let i=0;i<12;i++){
        const dt = new Date(data+'T00:00:00'); dt.setMonth(dt.getMonth()+i);
        gastos.push({...base, id:uid(), data:dt.toISOString().slice(0,10), descricao:(base.descricao||base.categoria) + ` (recorrente)`, recorrente:true, grupoRecorrencia:grupo});
      }
    } else {
      gastos.push(base);
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
  if(document.getElementById('fParcelas')) document.getElementById('fParcelas').value = '1';
  if(document.getElementById('fRecorrencia')) document.getElementById('fRecorrencia').value = 'nao';
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
  const payload = { entradas, gastos, orcamento, faturas, contas, dividas, holerites, exportadoEm: new Date().toISOString() };
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
    entradas = data.entradas; gastos = data.gastos; orcamento = data.orcamento || orcamento; faturas = data.faturas || []; contas = data.contas || []; dividas = data.dividas || []; holerites = data.holerites || [];
    await persist('entradas', entradas);
    await persist('gastos', gastos);
    await persist('orcamento', orcamento);
    await persist('faturas', faturas);
    await persist('contas', contas);
    await persist('dividas', dividas);
    await persist('holerites', holerites);
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
  else if(currentTab==='faturas') main.innerHTML = renderFaturasContas(d);
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
  const alertas = getAlertasVencimento(7);
  const plano = gerarPlanoDividas(d);
  const topCat = Object.entries(d.porCategoria).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])[0];
  const proximo = alertas[0];
  const saldoClass = d.saldo < 0 ? 'negative' : 'positive';
  const situacao = d.saldo < 0 ? 'Atenção necessária' : d.taxaPoupanca >= 10 ? 'Mês sob controle' : 'Margem apertada';
  const situacaoIcon = d.saldo < 0 ? '!' : '✓';
  return `
    <section class="premium-dashboard ${saldoClass}">
      <div class="dashboard-topline">
        <div>
          <span class="eyebrow">Situação do mês</span>
          <div class="dashboard-status"><span class="status-orb">${situacaoIcon}</span>${situacao}</div>
        </div>
        <span class="dashboard-month">${viewDate.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</span>
      </div>
      <div class="dashboard-balance-label">Saldo projetado</div>
      <div class="dashboard-balance">${brl(d.saldo)}</div>
      <div class="dashboard-caption">${d.saldo>=0?'o que permanece após os gastos lançados':'as despesas lançadas superam as receitas do mês'}</div>
      <div class="dashboard-stats">
        <div><span>Entradas</span><strong>${brl(d.totalEnt)}</strong></div>
        <div><span>Saídas</span><strong>${brl(d.totalGas)}</strong></div>
        <div><span>Margem</span><strong>${d.totalEnt>0?d.taxaPoupanca.toFixed(0)+'%':'—'}</strong></div>
      </div>
    </section>

    <section class="financial-guide-card">
      <div class="guide-head">
        <div class="guide-symbol">✦</div>
        <div><span class="eyebrow">Auxiliar financeiro</span><h3>O que fazer agora</h3></div>
      </div>
      <p>${esc(plano.resumo)}</p>
      <div class="guide-priority-grid">
        <div><span>Saldo devedor</span><b>${brl(plano.total)}</b></div>
        <div><span>Mínimos / mês</span><b>${brl(plano.minimos)}</b></div>
        <div><span>Extra possível</span><b>${brl(plano.extra)}</b></div>
      </div>
      <button class="guide-link" onclick="switchTab('orcamento')">Abrir plano de recuperação <span>→</span></button>
    </section>

    ${alertas.length ? `<section class="due-premium-card">
      <div class="panel-head"><div><span class="eyebrow">Agenda financeira</span><h3>Próximos vencimentos</h3></div><span class="alert-badge">${alertas.length}</span></div>
      ${alertas.slice(0,3).map(a=>`<div class="due-row"><div class="due-icon">${a.tipo==='fatura'?'💳':a.tipo==='divida'?'⚠️':'🧾'}</div><div class="due-main"><b>${esc(a.nome)}</b><span>${a.dias===0?'vence hoje':a.dias===1?'vence amanhã':`vence em ${a.dias} dias`} · ${fmtData(a.data)}</span></div><strong>${brl(a.valor)}</strong></div>`).join('')}
    </section>` : `<section class="quiet-card"><div class="quiet-icon">✓</div><div><b>Nenhum vencimento nos próximos 7 dias</b><span>Quando houver uma conta próxima, ela aparece aqui.</span></div></section>`}

    <section class="snapshot-grid">
      <div class="snapshot-card"><span>Maior categoria</span><b>${topCat?esc(topCat[0]):'Sem gastos'}</b><small>${topCat?brl(topCat[1]):'—'}</small></div>
      <div class="snapshot-card"><span>Próximo compromisso</span><b>${proximo?esc(proximo.nome):'Nenhum'}</b><small>${proximo?`${proximo.dias===0?'Hoje':proximo.dias===1?'Amanhã':`Em ${proximo.dias} dias`} · ${brl(proximo.valor)}`:'próximos 7 dias'}</small></div>
    </section>

    <div class="section-title premium-section-title">Gastos por pessoa<span class="rule"></span></div>
    <div class="person-row premium-person-row">
      <div class="person-card fernando"><div class="avatar fernando">F</div><div><div class="name">Fernando</div><div class="amt">${brl(d.porPessoaGasto.FERNANDO||0)}</div></div></div>
      <div class="person-card vanessa"><div class="avatar vanessa">V</div><div><div class="name">Vanessa</div><div class="amt">${brl(d.porPessoaGasto.VANESSA||0)}</div></div></div>
    </div>

    <div class="section-title premium-section-title">Categorias do mês<span class="rule"></span></div>
    <div class="cat-list premium-cat-list">
      ${CATEGORIAS.filter(c=>d.porCategoria[c]>0).slice(0,4).map(c=>{
        const gasto=d.porCategoria[c]||0, lim=Number(orcamento[c]||0);
        const pct=lim>0?Math.min(100,(gasto/lim)*100):0;
        return `<div class="cat-item"><div class="cat-top"><span class="name">${esc(c)}</span><span class="nums">${brl(gasto)}</span></div>${lim>0?`<div class="bar-track"><div class="bar-fill ${gasto>lim?'over':''}" style="width:${pct}%"></div></div><div class="cat-helper">${gasto>lim?'Acima do limite':`${Math.max(0,100-pct).toFixed(0)}% do limite ainda disponível`}</div>`:''}</div>`;
      }).join('') || `<div class="empty-state compact-empty">Ainda não há gastos neste mês.</div>`}
    </div>`;
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


function isoHoje(){ return new Date().toISOString().slice(0,10); }
function diasAte(iso){
  if(!iso) return 9999;
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const alvo=new Date(iso+'T00:00:00');
  return Math.ceil((alvo-hoje)/86400000);
}
function getAlertasVencimento(janela=7){
  const lista=[];
  (Array.isArray(faturas)?faturas:[]).forEach(f=>{
    const dias=diasAte(f.vencimento);
    if(dias>=0 && dias<=janela && !f.paga) lista.push({tipo:'fatura',nome:f.cartao||'Fatura do cartão',valor:Number(f.valor||0),data:f.vencimento,dias,id:f.id});
  });
  (Array.isArray(contas)?contas:[]).forEach(c=>{
    const prox=proximoVencimentoConta(c);
    const dias=diasAte(prox);
    if(dias>=0 && dias<=janela) lista.push({tipo:'conta',nome:c.nome||'Conta',valor:Number(c.valor||0),data:prox,dias,id:c.id});
  });
  (Array.isArray(dividas)?dividas:[]).filter(d=>!d.quitada && Number(d.dia||0)>0).forEach(d=>{
    const prox=proximoVencimentoConta({dia:d.dia});
    const dias=diasAte(prox);
    if(dias>=0 && dias<=janela) lista.push({tipo:'divida',nome:d.nome||'Dívida',valor:Number(d.minimo||0),data:prox,dias,id:d.id});
  });
  return lista.sort((a,b)=>a.dias-b.dias || b.valor-a.valor);
}
function proximoVencimentoConta(c){
  const hoje=new Date();
  const dia=Math.max(1,Math.min(31,Number(c.dia)||1));
  let d=new Date(hoje.getFullYear(),hoje.getMonth(),dia);
  if(d < new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate())) d=new Date(hoje.getFullYear(),hoje.getMonth()+1,dia);
  return d.toISOString().slice(0,10);
}
function gerarInsightsInteligentes(d){
  const msgs=[];
  const serie=faturaSeries(6);
  const atual=serie.length?serie[serie.length-1].total:0;
  const ant=serie.length>1?serie[serie.length-2].total:0;
  if(atual>0 && ant>0){
    const dif=((atual-ant)/ant)*100;
    msgs.push(dif>5?`As faturas somadas subiram ${Math.abs(dif).toFixed(0)}% em relação ao mês anterior.`:dif<-5?`As faturas somadas caíram ${Math.abs(dif).toFixed(0)}% em relação ao mês anterior.`:`As faturas estão praticamente estáveis em relação ao mês anterior.`);
  }
  if(d.saldo<0) msgs.push('O saldo do mês está negativo. Vale reduzir gastos não essenciais antes dos próximos vencimentos.');
  else if(d.totalEnt>0 && d.taxaPoupanca<10) msgs.push('O saldo está positivo, mas a margem de segurança está baixa. Uma reserva de pelo menos 10% da renda deixaria o mês mais confortável.');
  else if(d.totalEnt>0) msgs.push(`Vocês estão com ${brl(d.saldo)} de saldo no mês e ${d.taxaPoupanca.toFixed(0)}% da renda preservada.`);
  const alertas=getAlertasVencimento(7);
  if(alertas.length) msgs.push(`${alertas.length} conta${alertas.length>1?'s':''} vence${alertas.length===1?'':'m'} nos próximos 7 dias, somando ${brl(alertas.reduce((s,a)=>s+a.valor,0))}.`);
  if(!msgs.length) msgs.push('Cadastre receitas, despesas e faturas para eu conseguir apontar tendências e vencimentos importantes.');
  return msgs;
}
function faturaSeries(n=8){
  const out=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label=d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.','');
    const total=(Array.isArray(faturas)?faturas:[]).filter(f=>(f.competencia||f.vencimento||'').slice(0,7)===key).reduce((s,f)=>s+Number(f.valor||0),0);
    out.push({key,label,total});
  }
  return out;
}
function renderFaturaChart(){
  const serie=faturaSeries(8), max=Math.max(1,...serie.map(x=>x.total));
  return `<div class="invoice-chart">${serie.map(x=>`<div class="inv-col"><div class="inv-value">${x.total?brl(x.total).replace('R$ ','R$'):''}</div><div class="inv-bar-wrap"><i style="height:${x.total?Math.max(5,(x.total/max)*100):2}%"></i></div><small>${esc(x.label)}</small></div>`).join('')}</div>`;
}
function renderFaturasContas(d){
  const fs=(Array.isArray(faturas)?faturas:[]).slice().sort((a,b)=>(b.vencimento||'').localeCompare(a.vencimento||''));
  const cs=(Array.isArray(contas)?contas:[]).slice().sort((a,b)=>Number(a.dia||0)-Number(b.dia||0));
  const hs=(Array.isArray(holerites)?holerites:[]).slice().sort((a,b)=>(b.competencia||'').localeCompare(a.competencia||''));
  const totalAtual=faturaSeries(1)[0]?.total||0;
  const alertas=getAlertasVencimento(7);
  return `
    <section class="docs-intro">
      <span class="eyebrow">Central de documentos</span>
      <h2>O que deseja adicionar?</h2>
      <p>Envie PDF, imagem, captura de tela ou use a câmera. O app lê o documento e pede sua confirmação antes de salvar.</p>
      <div class="docs-grid">
        <div class="doc-action-card invoice-action">
          <div class="doc-action-icon">💳</div>
          <div class="doc-action-copy"><b>Fatura do cartão</b><span>Valor total, vencimento e competência</span></div>
          <label class="doc-main-btn" for="invoiceFile">Adicionar fatura</label>
          <button class="doc-camera-btn" onclick="document.getElementById('invoiceCamera').click()">📷 Câmera</button>
        </div>
        <div class="doc-action-card payroll-action">
          <div class="doc-action-icon">💰</div>
          <div class="doc-action-copy"><b>Holerite / salário</b><span>Valor líquido, competência e pessoa</span></div>
          <label class="doc-main-btn" for="payrollFile">Adicionar holerite</label>
          <button class="doc-camera-btn" onclick="document.getElementById('payrollCamera').click()">📷 Câmera</button>
        </div>
      </div>
      <input id="invoiceFile" type="file" accept="application/pdf,image/*" style="display:none" onchange="importarFaturaArquivo(this)">
      <input id="invoiceCamera" type="file" accept="image/*" capture="environment" style="display:none" onchange="importarFaturaArquivo(this)">
      <input id="payrollFile" type="file" accept="application/pdf,image/*" style="display:none" onchange="importarHoleriteArquivo(this)">
      <input id="payrollCamera" type="file" accept="image/*" capture="environment" style="display:none" onchange="importarHoleriteArquivo(this)">
    </section>
    <section class="invoice-hero invoice-summary">
      <div><span class="eyebrow">Cartões neste mês</span><h2>${brl(totalAtual)}</h2><p>Soma de todas as faturas cadastradas.</p></div>
      <div class="mini-stat"><span>Holerites</span><b>${hs.length}</b></div>
    </section>
    <section class="chart-panel"><div class="panel-head"><div><span class="eyebrow">Evolução</span><h3>Faturas somadas por mês</h3></div></div>${renderFaturaChart()}</section>
    <section class="ai-panel"><div class="ai-icon">✦</div><div><span class="eyebrow">Análise automática</span>${gerarInsightsInteligentes(d).map(m=>`<p>${esc(m)}</p>`).join('')}</div></section>
    ${alertas.length?`<section class="alert-panel"><div class="panel-head"><div><span class="eyebrow">Alertas</span><h3>Vencimentos nos próximos 7 dias</h3></div></div>${alertas.map(a=>`<div class="due-row"><div class="due-icon">${a.tipo==='fatura'?'💳':a.tipo==='divida'?'⚠️':'🧾'}</div><div class="due-main"><b>${esc(a.nome)}</b><span>${a.dias===0?'vence hoje':a.dias===1?'vence amanhã':`vence em ${a.dias} dias`} · ${fmtData(a.data)}</span></div><strong>${brl(a.valor)}</strong></div>`).join('')}</section>`:''}
    <div class="section-title">Faturas cadastradas<span class="rule"></span></div>
    <div class="invoice-list">${fs.length?fs.map(f=>`<div class="invoice-card"><div class="invoice-card-top"><div><b>${esc(f.cartao||'Cartão')}</b><span>${esc(f.competencia||'')} · vence ${fmtData(f.vencimento)} · ${esc(f.origem||'arquivo')}</span></div><strong>${brl(f.valor)}</strong></div><div class="invoice-actions"><button onclick="toggleFaturaPaga('${f.id}')">${f.paga?'✓ Paga':'Marcar paga'}</button><button class="danger-link" onclick="excluirFatura('${f.id}')">Excluir</button></div></div>`).join(''):`<div class="empty-state"><div class="big">💳</div>Adicione PDF, imagem ou captura de tela da fatura.<br>O app tenta identificar cartão, total e vencimento.</div>`}</div>

    <div class="section-title">Holerites cadastrados<span class="rule"></span></div>
    <div class="invoice-list">${hs.length?hs.map(h=>`<div class="invoice-card"><div class="invoice-card-top"><div><b>${esc(PERSON_LABEL[h.pessoa]||h.pessoa||'Holerite')}</b><span>${esc(h.competencia||'')} · ${h.lancado?'lançado nas receitas':'somente arquivado'}</span></div><strong>${brl(h.liquido)}</strong></div><div class="invoice-actions"><button class="danger-link" onclick="excluirHolerite('${h.id}')">Excluir</button></div></div>`).join(''):`<div class="info-note">Nenhum holerite importado ainda.</div>`}</div>

    <div class="section-title">Contas recorrentes<span class="rule"></span></div>
    <div class="account-add"><input id="contaNome" placeholder="Ex: Escola"><input id="contaValor" type="number" step="0.01" placeholder="Valor"><input id="contaDia" type="number" min="1" max="31" placeholder="Dia"><button onclick="adicionarConta()">Adicionar</button></div>
    <div class="invoice-list">${cs.length?cs.map(c=>`<div class="invoice-card"><div class="invoice-card-top"><div><b>${esc(c.nome)}</b><span>todo dia ${Number(c.dia)} · próximo ${fmtData(proximoVencimentoConta(c))}</span></div><strong>${brl(c.valor)}</strong></div><div class="invoice-actions"><button class="danger-link" onclick="excluirConta('${c.id}')">Excluir</button></div></div>`).join(''):`<div class="info-note">Cadastre escola, condomínio, energia, internet ou qualquer conta mensal.</div>`}</div>
    <button class="notification-btn" onclick="ativarAlertas()">🔔 Ativar alertas de vencimento</button>
    <div class="info-note"><b>Alertas:</b> o app avisa com antecedência e também no dia do vencimento. Para notificações mesmo com o app totalmente fechado, será necessário ativarmos push pelo servidor em uma próxima etapa; nesta versão a verificação acontece ao abrir/voltar ao app e enquanto ele estiver em uso.</div>`;
}

async function lerTextoDocumento(file, rotulo='documento'){
  if(!file) throw new Error('Arquivo ausente');
  const isPdf=file.type==='application/pdf' || /\.pdf$/i.test(file.name||'');
  if(isPdf){
    const pdfjsLib=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc=window.PDFJS_CDN;
    const bytes=new Uint8Array(await file.arrayBuffer());
    const pdf=await pdfjsLib.getDocument({data:bytes}).promise;
    let texto='';
    for(let p=1;p<=Math.min(pdf.numPages,5);p++){
      const page=await pdf.getPage(p); const tc=await page.getTextContent();
      texto+=' '+tc.items.map(i=>i.str).join(' ');
    }
    if(texto.replace(/\s+/g,' ').trim().length>40) return texto;
    if(typeof Tesseract==='undefined') return texto;
    // PDF escaneado: converte a primeira página em imagem e aplica OCR.
    const page=await pdf.getPage(1);
    const viewport=page.getViewport({scale:1.7});
    const canvas=document.createElement('canvas'); canvas.width=viewport.width; canvas.height=viewport.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const {data}=await Tesseract.recognize(canvas.toDataURL('image/jpeg',.9),'por+eng');
    return data.text||'';
  }
  if(typeof Tesseract==='undefined') throw new Error('OCR indisponível');
  const dataUrl=await reduzirImagemParaOCR(file);
  const {data}=await Tesseract.recognize(dataUrl,'por+eng');
  return data.text||'';
}

async function importarFaturaArquivo(input){
  const file=input?.files?.[0]; if(!file) return;
  showToast('Lendo a fatura…');
  try{
    const texto=await lerTextoDocumento(file,'fatura');
    const info=extrairDadosFatura(texto,file.name||'captura de tela');
    info.origem=(file.type==='application/pdf'||/\.pdf$/i.test(file.name||''))?'PDF':'imagem/captura';
    abrirConfirmacaoFatura(info,file.name||'captura de tela');
  }catch(err){ console.error(err); showToast('Não consegui ler esse arquivo. Confira os dados manualmente.'); }
  input.value='';
}
// Compatibilidade com versões anteriores.
async function importarFaturaPDF(input){ return importarFaturaArquivo(input); }

function extrairDadosFatura(texto,nomeArquivo){
  const t=String(texto||'').replace(/\s+/g,' '), up=t.toUpperCase();
  const cartoes=['NUBANK','ITAÚ','ITAU','SANTANDER','BRADESCO','INTER','C6','XP','CAIXA','BANCO DO BRASIL','SICREDI','SICOOB'];
  const cartao=cartoes.find(x=>up.includes(x)) || nomeArquivo.replace(/\.pdf$/i,'').slice(0,30) || 'Cartão';
  let valor=null;
  const valRes=[/(?:TOTAL\s+DA\s+FATURA|VALOR\s+TOTAL|TOTAL\s+A\s+PAGAR|PAGUE\s+AT[ÉE])[^R$0-9]{0,30}(?:R\$\s*)?([0-9\.]+,[0-9]{2})/i,/(?:R\$\s*)([0-9\.]+,[0-9]{2})/g];
  for(const re of valRes){ const ms=[...t.matchAll(re)]; if(ms.length){ const vals=ms.map(m=>parseValorBR(m[1])).filter(v=>v>0&&v<1000000); if(vals.length){ valor=Math.max(...vals); break; } } }
  let venc=null;
  const vencRe=/(?:VENCIMENTO|VENCE\s+EM|DATA\s+DE\s+VENCIMENTO)[^0-9]{0,25}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i;
  const mv=t.match(vencRe) || t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if(mv){ let y=Number(mv[3]); if(y<100)y+=2000; venc=`${y}-${String(mv[2]).padStart(2,'0')}-${String(mv[1]).padStart(2,'0')}`; }
  if(!venc){ const d=new Date(); venc=new Date(d.getFullYear(),d.getMonth()+1,10).toISOString().slice(0,10); }
  const vd=new Date(venc+'T00:00:00'); vd.setMonth(vd.getMonth()-1);
  const competencia=`${vd.getFullYear()}-${String(vd.getMonth()+1).padStart(2,'0')}`;
  return {cartao,valor:valor||0,vencimento:venc,competencia};
}
function abrirConfirmacaoFatura(info,nomeArquivo){
  const wrap=document.createElement('div'); wrap.className='modal-bg open'; wrap.id='invoiceConfirmBg';
  wrap.innerHTML=`<div class="modal"><button class="close-x" onclick="document.getElementById('invoiceConfirmBg').remove()">✕</button><h3>Confirmar fatura</h3><div class="info-note" style="text-align:left;margin-top:0">Confira os dados que o leitor encontrou em <b>${esc(nomeArquivo)}</b>.</div><label>Cartão</label><input id="invCartao" value="${esc(info.cartao)}"><div class="row2"><div><label>Valor total</label><input id="invValor" type="number" step="0.01" value="${Number(info.valor||0).toFixed(2)}"></div><div><label>Vencimento</label><input id="invVenc" type="date" value="${esc(info.vencimento)}"></div></div><label>Competência</label><input id="invComp" type="month" value="${esc(info.competencia)}"><input id="invOrigem" type="hidden" value="${esc(info.origem||'arquivo')}"><button class="save-btn" onclick="salvarFaturaConfirmada('${esc(nomeArquivo)}')">Salvar fatura</button></div>`;
  document.getElementById('appShell').appendChild(wrap);
}
async function salvarFaturaConfirmada(nomeArquivo){
  faturas=await fetchLatest('faturas',faturas||[]); if(!Array.isArray(faturas))faturas=[];
  faturas.push({id:uid(),cartao:document.getElementById('invCartao').value.trim()||'Cartão',valor:Number(document.getElementById('invValor').value)||0,vencimento:document.getElementById('invVenc').value,competencia:document.getElementById('invComp').value,arquivo:nomeArquivo,origem:document.getElementById('invOrigem')?.value||'arquivo',paga:false,criadoEm:new Date().toISOString()});
  await persist('faturas',faturas); document.getElementById('invoiceConfirmBg')?.remove(); render(); updateSyncLabel(); showToast('Fatura adicionada!'); checarNotificacoes();
}
async function toggleFaturaPaga(id){ faturas=await fetchLatest('faturas',faturas||[]); const f=faturas.find(x=>x.id===id); if(f)f.paga=!f.paga; await persist('faturas',faturas); render(); }
async function excluirFatura(id){ if(!confirm('Excluir esta fatura?'))return; faturas=(await fetchLatest('faturas',faturas||[])).filter(x=>x.id!==id); await persist('faturas',faturas); render(); }
async function adicionarConta(){
  const nome=document.getElementById('contaNome').value.trim(), valor=Number(document.getElementById('contaValor').value)||0, dia=Number(document.getElementById('contaDia').value)||0;
  if(!nome||dia<1||dia>31){showToast('Informe nome e dia de vencimento.');return;}
  contas=await fetchLatest('contas',contas||[]); if(!Array.isArray(contas))contas=[]; contas.push({id:uid(),nome,valor,dia}); await persist('contas',contas); render(); showToast('Conta adicionada!');
}
async function excluirConta(id){ if(!confirm('Excluir esta conta?'))return; contas=(await fetchLatest('contas',contas||[])).filter(x=>x.id!==id); await persist('contas',contas); render(); }
async function ativarAlertas(){
  if(!('Notification' in window)){showToast('Este navegador não oferece notificações.');return;}
  const p=await Notification.requestPermission(); showToast(p==='granted'?'Alertas ativados!':'Permissão de notificações não concedida.'); if(p==='granted')checarNotificacoes(true);
}
async function checarNotificacoes(forcar=false){
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  const alertas=getAlertasVencimento(7).filter(a=>[7,3,2,1,0].includes(a.dias));
  if(!alertas.length)return;
  for(const a of alertas){
    const chave=`fin_notify_${isoHoje()}_${a.tipo}_${a.id}_${a.dias}`;
    if(!forcar && localStorage.getItem(chave)) continue;
    const quando=a.dias===0?'VENCE HOJE':a.dias===1?'vence amanhã':`vence em ${a.dias} dias`;
    const titulo=a.dias===0?'⚠️ Vencimento hoje':'🔔 Vencimento próximo';
    const body=`${a.nome}: ${brl(a.valor)} · ${quando}`;
    try{
      const reg=await navigator.serviceWorker?.ready;
      if(reg) await reg.showNotification(titulo,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:`finance-due-${a.tipo}-${a.id}-${a.dias}`,renotify:true});
      else new Notification(titulo,{body});
      localStorage.setItem(chave,'1');
    }catch(e){}
  }
}

async function forceAppUpdate(){
  try{ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs) await r.update(); showToast('Atualização verificada. Reabrindo…'); setTimeout(()=>location.reload(true),600); }catch(e){ location.reload(true); }
}


function totalDividas(){ return (dividas||[]).reduce((s,x)=>s+Number(x.saldo||0),0); }
function totalMinimosDividas(){ return (dividas||[]).filter(x=>!x.quitada).reduce((s,x)=>s+Number(x.minimo||0),0); }
function prioridadeDividas(){
  return (dividas||[]).filter(x=>!x.quitada && Number(x.saldo||0)>0).slice().sort((a,b)=>{
    const ja=Number(a.juros||0), jb=Number(b.juros||0);
    if(jb!==ja) return jb-ja;
    return Number(a.saldo||0)-Number(b.saldo||0);
  });
}
function gerarPlanoDividas(d){
  const ativas=prioridadeDividas();
  const total=totalDividas();
  const minimos=totalMinimosDividas();
  const vencimentos=getAlertasVencimento(7).reduce((s,a)=>s+Number(a.valor||0),0);
  const sobra=Math.max(0,Number(d.saldo||0));
  if(!ativas.length){
    return {resumo:sobra>0?`Não há dívidas cadastradas. Antes de aumentar o padrão de gastos, mantenham uma reserva para imprevistos e planejem a sobra de ${brl(sobra)}.`:'Cadastrem as dívidas para eu montar uma ordem de pagamento e um plano realista.', total, minimos, extra:0, alvo:null, passos:[]};
  }
  const alvo=ativas[0];
  const reservaOperacional=Math.min(sobra, Math.max(0, Math.min(1000, d.totalEnt*0.05)));
  const extra=Math.max(0, sobra-reservaOperacional);
  let resumo='';
  if(d.saldo<0) resumo=`O mês está negativo em ${brl(Math.abs(d.saldo))}. Agora a prioridade é parar de aumentar a dívida: contas essenciais, mínimos e corte temporário de supérfluos.`;
  else if(extra<=0) resumo=`Há ${brl(total)} em dívidas cadastradas. A sobra atual é pequena; mantenham os pagamentos mínimos em dia e evitem novas compras parceladas enquanto ajustam o orçamento.`;
  else resumo=`Depois de preservar ${brl(reservaOperacional)} para imprevistos do mês, há até ${brl(extra)} para acelerar a saída das dívidas. Pela taxa informada, a prioridade é ${alvo.nome}.`;
  const passos=[];
  passos.push(`Garanta primeiro moradia, alimentação, saúde, transporte e contas com vencimento próximo.`);
  if(minimos>0) passos.push(`Separe ${brl(minimos)} para os pagamentos mínimos/parcelas das dívidas cadastradas.`);
  if(extra>0) passos.push(`Direcione até ${brl(extra)} como pagamento extra para ${alvo.nome}, sem criar nova dívida para isso.`);
  passos.push(`Quando ${alvo.nome} for quitada, transfira o valor que era pago nela para a próxima dívida da lista.`);
  return {resumo,total,minimos,extra,alvo,passos,vencimentos,reservaOperacional};
}

function mesNumeroPorNome(txt){
  const meses={JANEIRO:1,FEVEREIRO:2,FEV:2,MARCO:3,'MARÇO':3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12};
  const up=String(txt||'').toUpperCase();
  for(const [nome,n] of Object.entries(meses)){ if(up.includes(nome)) return n; }
  return null;
}
function extrairDadosHolerite(texto,nomeArquivo){
  const t=normalizarTextoOCR(texto), up=t.toUpperCase();
  let liquido=0;
  const patterns=[
    /(?:VALOR\s+L[IÍ]QUIDO|L[IÍ]QUIDO\s+A\s+RECEBER|TOTAL\s+L[IÍ]QUIDO|SAL[AÁ]RIO\s+L[IÍ]QUIDO|L[IÍ]QUIDO)[^0-9R$]{0,35}(?:R\$\s*)?([0-9\.]+,[0-9]{2})/gi,
    /(?:R\$\s*)([0-9\.]+,[0-9]{2})/g
  ];
  for(const re of patterns){ const ms=[...t.matchAll(re)]; if(ms.length){ const vals=ms.map(m=>parseValorBR(m[1])).filter(v=>v>0&&v<1000000); if(vals.length){liquido=patterns.indexOf(re)===0?vals[0]:Math.max(...vals);break;} } }
  let competencia='';
  const comp=t.match(/(?:COMPET[EÊ]NCIA|REFER[EÊ]NCIA|M[EÊ]S\/ANO)[^0-9A-Z]{0,20}(\d{1,2})[\/\-.](20\d{2})/i);
  if(comp) competencia=`${comp[2]}-${String(Number(comp[1])).padStart(2,'0')}`;
  if(!competencia){
    const ano=(t.match(/\b(20\d{2})\b/)||[])[1]; const mes=mesNumeroPorNome(up);
    if(ano&&mes) competencia=`${ano}-${String(mes).padStart(2,'0')}`;
  }
  if(!competencia) competencia=new Date().toISOString().slice(0,7);
  let pessoa='FERNANDO';
  if(/VANESSA/i.test(up)) pessoa='VANESSA';
  else if(/FERNANDO/i.test(up)) pessoa='FERNANDO';
  return {liquido,competencia,pessoa,arquivo:nomeArquivo||'holerite'};
}
async function importarHoleriteArquivo(input){
  const file=input?.files?.[0]; if(!file)return;
  showToast('Lendo o holerite…');
  try{
    const texto=await lerTextoDocumento(file,'holerite');
    abrirConfirmacaoHolerite(extrairDadosHolerite(texto,file.name||'captura de tela'));
  }catch(err){console.error(err);showToast('Não consegui ler esse holerite. Tente outra imagem ou PDF.');}
  input.value='';
}
function abrirConfirmacaoHolerite(info){
  const wrap=document.createElement('div'); wrap.className='modal-bg open'; wrap.id='payrollConfirmBg';
  wrap.innerHTML=`<div class="modal"><button class="close-x" onclick="document.getElementById('payrollConfirmBg').remove()">✕</button><h3>Confirmar holerite</h3><div class="info-note" style="text-align:left;margin-top:0">Confira o valor líquido e a competência. Nada é lançado sem sua confirmação.</div><label>Pessoa</label><select id="payPessoa"><option value="FERNANDO" ${info.pessoa==='FERNANDO'?'selected':''}>Fernando</option><option value="VANESSA" ${info.pessoa==='VANESSA'?'selected':''}>Vanessa</option></select><div class="row2"><div><label>Valor líquido</label><input id="payLiquido" type="number" step="0.01" value="${Number(info.liquido||0).toFixed(2)}"></div><div><label>Competência</label><input id="payComp" type="month" value="${esc(info.competencia)}"></div></div><label class="check-row"><input id="payLancar" type="checkbox" checked> Lançar automaticamente este valor como receita do mês</label><input id="payArquivo" type="hidden" value="${esc(info.arquivo)}"><button class="save-btn" onclick="salvarHoleriteConfirmado()">Salvar holerite</button></div>`;
  document.getElementById('appShell').appendChild(wrap);
}
async function salvarHoleriteConfirmado(){
  const pessoa=document.getElementById('payPessoa').value;
  const liquido=Number(document.getElementById('payLiquido').value)||0;
  const competencia=document.getElementById('payComp').value;
  const lancar=document.getElementById('payLancar').checked;
  const arquivo=document.getElementById('payArquivo').value;
  if(liquido<=0||!competencia){showToast('Confira valor e competência.');return;}
  holerites=await fetchLatest('holerites',holerites||[]); if(!Array.isArray(holerites))holerites=[];
  const id=uid();
  holerites.push({id,pessoa,liquido,competencia,arquivo,lancado:lancar,criadoEm:new Date().toISOString()});
  await persist('holerites',holerites);
  if(lancar){
    entradas=await fetchLatest('entradas',entradas||[]); if(!Array.isArray(entradas))entradas=[];
    const existe=entradas.some(e=>e.origemHoleriteId===id);
    if(!existe){entradas.push({id:uid(),data:`${competencia}-01`,tipo:'Salário',descricao:'Importado do holerite',valor:liquido,pessoa,origemHoleriteId:id}); await persist('entradas',entradas);}
  }
  document.getElementById('payrollConfirmBg')?.remove(); render(); updateSyncLabel(); showToast('Holerite salvo!');
}
async function excluirHolerite(id){
  if(!confirm('Excluir este holerite?'))return;
  holerites=await fetchLatest('holerites',holerites||[]); const h=holerites.find(x=>x.id===id);
  holerites=holerites.filter(x=>x.id!==id); await persist('holerites',holerites);
  if(h?.lancado){entradas=await fetchLatest('entradas',entradas||[]); entradas=entradas.filter(e=>e.origemHoleriteId!==id); await persist('entradas',entradas);}
  render(); updateSyncLabel();
}

async function adicionarDivida(){
  const nome=document.getElementById('divNome')?.value.trim();
  const saldo=Number(document.getElementById('divSaldo')?.value)||0;
  const minimo=Number(document.getElementById('divMinimo')?.value)||0;
  const juros=Number(document.getElementById('divJuros')?.value)||0;
  const dia=Number(document.getElementById('divDia')?.value)||0;
  if(!nome||saldo<=0){ showToast('Informe a dívida e o saldo devedor.'); return; }
  dividas=await fetchLatest('dividas',dividas||[]); if(!Array.isArray(dividas))dividas=[];
  dividas.push({id:uid(),nome,saldo,minimo,juros,dia,quitada:false,criadoEm:new Date().toISOString()});
  await persist('dividas',dividas); render(); showToast('Dívida adicionada ao plano.');
}
async function excluirDivida(id){ if(!confirm('Excluir esta dívida do plano?'))return; dividas=(await fetchLatest('dividas',dividas||[])).filter(x=>x.id!==id); await persist('dividas',dividas); render(); }
async function quitarDivida(id){ dividas=await fetchLatest('dividas',dividas||[]); const d=dividas.find(x=>x.id===id); if(d){d.quitada=!d.quitada;if(d.quitada)d.saldo=0;} await persist('dividas',dividas); render(); }
async function atualizarSaldoDivida(id){
  const el=document.getElementById('saldoDiv_'+id); const novo=Number(el?.value)||0;
  dividas=await fetchLatest('dividas',dividas||[]); const d=dividas.find(x=>x.id===id); if(d){d.saldo=novo;d.quitada=novo<=0;} await persist('dividas',dividas); render(); showToast('Saldo atualizado.');
}

function renderOrcamento(d){
  const plano=gerarPlanoDividas(d);
  const ranking=prioridadeDividas();
  const rows = CATEGORIAS.map(c=>{
    const lim = orcamento[c]||0;
    const gasto = d.porCategoria[c]||0;
    const diff = lim - gasto;
    const pct = lim>0 ? Math.min(100,(gasto/lim)*100) : (gasto>0?100:0);
    const over = lim>0 && gasto>lim;
    return `<div class="cat-item"><div class="cat-top"><span class="name">${esc(c)}</span><span class="nums">${brl(gasto)} gasto</span></div><div class="bar-track"><div class="bar-fill ${over?'over':''}" style="width:${pct}%"></div></div><div class="cat-diff ${diff>=0?'pos':'neg'}">${diff>=0? 'Sobra '+brl(diff) : 'Estourou '+brl(Math.abs(diff))}</div><label style="margin-top:10px;">Limite mensal</label><input type="number" id="lim_${esc(c)}" value="${lim}" step="10" inputmode="decimal"></div>`;
  }).join('');
  return `<section class="debt-hero"><span class="eyebrow">Plano de recuperação</span><h2>${plano.total>0?brl(plano.total):'Cadastre suas dívidas'}</h2><p>${esc(plano.resumo)}</p><div class="debt-metrics"><div><span>Saldo devedor</span><b>${brl(plano.total)}</b></div><div><span>Mínimos / mês</span><b>${brl(plano.minimos)}</b></div><div><span>Extra possível</span><b>${brl(plano.extra)}</b></div></div></section>
    ${plano.passos.length?`<section class="ai-plan"><div class="panel-head"><div><span class="eyebrow">Auxiliar financeiro</span><h3>O que fazer agora</h3></div></div>${plano.passos.map((x,i)=>`<div class="plan-step"><span>${i+1}</span><p>${esc(x)}</p></div>`).join('')}<div class="plan-note">O plano usa os dados informados no app. Juros, multas e propostas de renegociação podem alterar a melhor ordem de pagamento.</div></section>`:''}
    <div class="section-title">Dívidas<span class="rule"></span></div>
    <div class="debt-add"><input id="divNome" placeholder="Ex: Cartão Nubank"><input id="divSaldo" type="number" step="0.01" placeholder="Saldo devedor"><input id="divMinimo" type="number" step="0.01" placeholder="Parcela/mínimo"><input id="divJuros" type="number" step="0.01" placeholder="Juros % ao mês"><input id="divDia" type="number" min="1" max="31" placeholder="Dia venc."><button onclick="adicionarDivida()">Adicionar dívida</button></div>
    <div class="debt-list">${ranking.length?ranking.map((x,i)=>`<div class="debt-card"><div class="debt-rank">${i+1}</div><div class="debt-main"><div class="debt-name">${esc(x.nome)}</div><div class="debt-meta">${Number(x.juros||0)>0?`${Number(x.juros).toFixed(2)}% a.m. · `:''}${Number(x.minimo||0)>0?`mínimo ${brl(x.minimo)} · `:''}${Number(x.dia||0)>0?`vence dia ${x.dia}`:'sem vencimento informado'}</div><div class="debt-edit"><input id="saldoDiv_${x.id}" type="number" step="0.01" value="${Number(x.saldo||0).toFixed(2)}"><button onclick="atualizarSaldoDivida('${x.id}')">Atualizar saldo</button></div></div><div class="debt-value"><b>${brl(x.saldo)}</b><button onclick="quitarDivida('${x.id}')">Quitar</button><button class="danger-link" onclick="excluirDivida('${x.id}')">Excluir</button></div></div>`).join(''):`<div class="empty-state compact-empty">Cadastre empréstimos, cartões parcelados, cheque especial ou outras dívidas. Informe a taxa de juros se souber; isso melhora a ordem de prioridade.</div>`}</div>
    <div class="section-title">Limites do mês<span class="rule"></span></div><div class="cat-list">${rows}</div><div class="info-note">Enquanto houver dívida cara, o assistente prioriza contas essenciais, pagamentos mínimos e redução da dívida antes de sugerir aumentar gastos ou investir sobras.</div>`;
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
  const input = document.getElementById('smartCamera') || document.getElementById('quickComprovante');
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
  setTimeout(()=>checarNotificacoes(false),800);
})();

// Registra o service worker (permite instalar como app de verdade e abrir offline).
// Só funciona quando o site está em https:// (não funciona abrindo o arquivo direto no computador).
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{ /* sem suporte, segue normal */ });
  });
}