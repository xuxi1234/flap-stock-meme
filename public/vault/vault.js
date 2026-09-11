const templates = await fetch('./templates.json').then(r=>{if(!r.ok)throw Error('模板目录加载失败');return r.json()});
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const main=$('#main-content'),dialog=$('#vault-dialog');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const find=id=>templates.find(t=>t.id===id||t.id==='vault-'+id||t.deploy?.endsWith('/'+id))||templates.find(t=>t.id==='vault-percent-buyback');
let cat='all',timer;
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('on');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('on'),4000)}
function modal(html){$('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal()}
function info(){modal('<h2>蝴蝶股票金库</h2><p>已接入真实钱包、BSC 参数读取、交易模拟、钱包签名和交易回执。主网操作会实际产生网络费。</p><p>参考模板由原作者部署；平台佣金接收人已配置为蝴蝶股票地址，但不会转移第三方工厂的控制权或固定作者费用。Mint 独立工厂尚未部署。</p><button data-dismiss>开始使用</button>')}
function live(panel='launch',id='percent-buyback'){window.top.location.href='/?view=vault-live&panel='+encodeURIComponent(panel)+'&template='+encodeURIComponent(id.replace(/^vault-/,''))}
function category(b,open){b.classList.toggle('is-open',open);$('.category-toggle',b)?.setAttribute('aria-expanded',String(open));const p=$('.category-panel',b);if(p){p.hidden=!open;p.style.display=open?'':'none'}const hint=$('.cat-rail-hint',b);if(hint)hint.textContent=open?'收起':'展开'}
function filter(){const q=($('.search input')?.value||'').trim().toLowerCase();let total=0;$$('.category-block').forEach(b=>{let n=0;$$('.vault-shelf',b).forEach(c=>{const yes=(cat==='all'||cat===c.dataset.cat)&&c.textContent.toLowerCase().includes(q);c.hidden=!yes;if(yes)n++});b.hidden=!n;total+=n;if(q||cat!=='all')category(b,true)});let empty=$('#catalog-empty');if(!empty){empty=document.createElement('p');empty.id='catalog-empty';$('.vault-cat-rails')?.after(empty)}empty.textContent='没有找到对应金库。';empty.hidden=total>0;$$('.vault-cat-nav button').forEach(b=>{b.classList.toggle('is-active',b.dataset.cat===cat);b.setAttribute('aria-pressed',String(b.dataset.cat===cat))})}
function guide(){const s=$('.guide select');if(!s)return;const t=find(s.value),ps=$$('.guide-main p');if(ps[0])ps[0].textContent=t.name;if(ps[1])ps[1].textContent=t.summary.replace(/已验证，低风险。|已审计，/g,'');if(ps[2])ps[2].textContent=t.howto;const a=$$('.guide a').find(x=>x.textContent.includes('站内部署'));if(a)a.href='#configure='+t.id;const copy=$$('.guide button').find(x=>x.textContent.includes('工厂'));if(copy)copy.disabled=!t.factory}
function clean(){
  // Remove dated reference feeds and sample counters instead of calling them live.
  $$('.lp-token-list').forEach(e=>{e.innerHTML='<p class="preview-empty">通过链上交易记录与金库地址查询真实状态。</p><a class="preview-action" href="#panel=monitor">打开链上金库</a>'});
  $$('.fx-builder-tabs').forEach(e=>e.remove());
  $$('.fx-builder-panel').forEach(e=>{e.innerHTML='<div style="grid-column:1/-1"><h3>金库链上工具</h3><p>选择模板，读取合约参数，模拟后由钱包签名。创建结果以成功回执为准。</p><a class="preview-action" href="#configure=percent-buyback">一键部署</a> <a href="#panel=monitor">管理已有金库</a></div>'});
  $$('.lp-feed-tabs,.feed-rail,.deploy-sidebar,.gain-sidebar').forEach(e=>e.remove());
  $$('[title]').filter(e=>/样例|快照/.test(e.title)).forEach(e=>e.removeAttribute('title'));
}
main.innerHTML=$('#home-template').innerHTML;clean();$$('.category-block').forEach((b,i)=>category(b,i===0));guide();
function route(){const h=decodeURIComponent(location.hash.slice(1));if(h.startsWith('configure=')){const id=h.slice(10);live(id.includes('flap-mint')?'mint':'launch',id);return}if(h.startsWith('panel=')){const p=h.slice(6);if(p==='shop'){document.getElementById('vaults')?.scrollIntoView();return}live(p==='mint/live'?'mint':p==='market'?'history':'manage');return}if(h.startsWith('vault-')){const c=document.getElementById(h);if(c){category(c.closest('.category-block'),true);c.scrollIntoView({block:'center'})}}}
window.addEventListener('hashchange',route);route();
document.addEventListener('input',e=>{if(e.target.matches('.search input'))filter()});
document.addEventListener('change',e=>{if(e.target.matches('.guide select'))guide()});
document.addEventListener('click',async e=>{const b=e.target.closest('button,a');if(!b)return;
 if(b.matches('.dialog-close,[data-dismiss]')){dialog.close();return}if(b.matches('.lang-toggle')){info();return}
 if(b.closest('.vault-cat-nav')){cat=b.dataset.cat;filter();return}
 if(b.matches('.category-toggle')){const block=b.closest('.category-block');category(block,b.getAttribute('aria-expanded')!=='true');return}
 if(b.matches('.shelf-more')){const d=$('.shelf-details',b.closest('article')),open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));b.textContent=open?'收起详情':'看详情 / 填参';d.style.display=open?'block':'none';return}
 if(b.matches('.shelf-cover,.deploy-shot')){const img=$('img',b);modal('<h2>'+escape(img.alt)+'</h2><img class="preview-lightbox" src="'+escape(img.src)+'" alt="'+escape(img.alt)+'">');return}
 if(b.matches('.shelf-copy,.shelf-addr-copy')||b.closest('.guide')&&b.tagName==='BUTTON'){const t=b.closest('.guide')?find($('.guide select').value):find(b.closest('article').id),value=b.closest('.guide')&&!b.textContent.includes('工厂')?t.howto:t.factory;if(value)try{await navigator.clipboard.writeText(value);toast('已复制')}catch{modal('<h2>复制资料</h2><textarea class="preview-param-input" readonly>'+escape(value)+'</textarea>')}return}
 if(b.matches('.shelf-sec-btn')){live('manage');return}
});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
