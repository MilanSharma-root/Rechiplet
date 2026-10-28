import {Component,useEffect,useMemo,useState} from 'react'
import type {ErrorInfo,ReactNode} from 'react'
import Plot from 'react-plotly.js'
import {Activity,Boxes,Cpu,Gauge,Layers3,LayoutDashboard,Network,Play,RefreshCw,Search,ShieldCheck,Sparkles,Zap,Wallet,Scale,GitCompare,PackageCheck,Workflow} from 'lucide-react'
import {api,Chiplet,Product,PortfolioResult,PortfolioScenario,CompatibilityMatrix} from './api'

type Tab='Overview'|'Chiplet Library'|'Product Portfolio'|'Portfolio Optimization'|'Interconnect Compatibility'
const nav:{label:Tab;icon:any}[]=[
 {label:'Overview',icon:LayoutDashboard},
 {label:'Chiplet Library',icon:Layers3},
 {label:'Product Portfolio',icon:Network},
 {label:'Portfolio Optimization',icon:Gauge},
 {label:'Interconnect Compatibility',icon:Workflow}
]
const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v)
function readableError(value:any,fallback:string):string{
 if(typeof value==='string') return value
 if(Array.isArray(value)) return value.map(item=>typeof item==='string'?item:item?.msg||JSON.stringify(item)).join('; ')
 if(value&&typeof value==='object') return value.msg||value.message||value.detail||JSON.stringify(value)
 return fallback
}

function AppContent({onLogout}:{onLogout:()=>void}){
 const [tab,setTab]=useState<Tab>('Overview')
 const [chiplets,setChiplets]=useState<Chiplet[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [metrics,setMetrics]=useState<any>({})
 const [compatibility,setCompatibility]=useState<CompatibilityMatrix|null>(null)
 const [compatibilityLoading,setCompatibilityLoading]=useState(false)
 const [pairBandwidth,setPairBandwidth]=useState('')
 const [specChipletId,setSpecChipletId]=useState('')
 const [specSaving,setSpecSaving]=useState(false)
 const [specMessage,setSpecMessage]=useState('')
 const [specForm,setSpecForm]=useState({protocol:'UCIe',protocol_version:'1.1',signaling:'differential',lane_count:'16',bandwidth_gbps:'256',package_types:'2.5D, 3D',max_reach_mm:'10',voltage_v:'0.8',bump_pitch_um:'25'})
 const [selected,setSelected]=useState<number|null>(null)
 const [portfolio,setPortfolio]=useState<PortfolioResult|null>(null)
 const [scenarioKey,setScenarioKey]=useState<'lowest_cost'|'balanced'|'highest_performance'>('balanced')
 const [loading,setLoading]=useState(false)
 const [assumedNre,setAssumedNre]=useState('250000')
 const [selectedReuseChiplet,setSelectedReuseChiplet]=useState<number|null>(null)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [health,setHealth]=useState('checking')
 const [showAddProduct,setShowAddProduct]=useState(false)
 const [savingProduct,setSavingProduct]=useState(false)
 const [productForm,setProductForm]=useState({name:'',market_segment:'Consumer Electronics',target_performance:'100',max_power_w:'100',max_area_mm2:'200',max_cost_usd:'500',max_junction_temp_c:'95',min_yield_pct:'90',annual_volume:'100000'})

 async function load(){
  try{
   const [h,c,p,m]=await Promise.all([api.get('/health'),api.get('/chiplets'),api.get('/products'),api.get('/dashboard')])
   setHealth(h.data.status);setChiplets(c.data);setSpecChipletId(old=>old||String(c.data[0]?.id??''));setProducts(p.data);setMetrics(m.data)
   setSelected(old=>old??p.data[0]?.id??null);setError('')
   try{const k=await api.get('/compatibility/matrix');setCompatibility(k.data)}catch(e){console.warn('Compatibility matrix unavailable; other dashboard data loaded.',e)}
  }catch(e:any){
   setHealth('offline')
   const detail=e?.response?.data?.detail||e?.message||'Cannot reach the API.'
   setError('Backend connection failed: '+detail+'. Check http://127.0.0.1:8000/api/health and keep the backend terminal open.')
  }
 }
 useEffect(()=>{void load()},[])
 const filtered=useMemo(()=>chiplets.filter(c=>`${c.name} ${c.category} ${c.interface}`.toLowerCase().includes(search.toLowerCase())),[chiplets,search])
 const product=products.find(p=>p.id===selected)
 const currentScenario:PortfolioScenario|undefined=portfolio?.scenarios.find(s=>s.key===scenarioKey)??portfolio?.scenarios[1]??portfolio?.scenarios[0]

 async function createProduct(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  setSavingProduct(true);setError('')
  try{
   const payload={...productForm,target_performance:Number(productForm.target_performance),max_power_w:Number(productForm.max_power_w),max_area_mm2:Number(productForm.max_area_mm2),max_cost_usd:Number(productForm.max_cost_usd),max_junction_temp_c:Number(productForm.max_junction_temp_c),min_yield_pct:Number(productForm.min_yield_pct),annual_volume:Number(productForm.annual_volume)}
   const {data}=await api.post('/products',payload)
   await load()
   setSelected(data.id)
   setShowAddProduct(false)
   setProductForm({name:'',market_segment:'Consumer Electronics',target_performance:'100',max_power_w:'100',max_area_mm2:'200',max_cost_usd:'500',max_junction_temp_c:'95',min_yield_pct:'90',annual_volume:'100000'})
  }catch(e:any){
   setError(readableError(e?.response?.data?.detail||e?.message,'Could not add product.'))
  }finally{setSavingProduct(false)}
 }

 async function saveInterconnectSpecs(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault()
  if(!specChipletId){setError('Choose a chiplet to update.');return}
  if(!Number.isInteger(Number(specForm.lane_count))||Number(specForm.lane_count)<=0){setError('Lane count must be a positive whole number (for example, 8 or 16).');return}
  if(!specForm.package_types.split(',').some(x=>x.trim())){setError('Enter at least one supported package type.');return}
  setSpecSaving(true);setError('');setSpecMessage('')
  try{
   const payload={protocol:specForm.protocol.trim(),protocol_version:specForm.protocol_version.trim(),signaling:specForm.signaling.trim(),lane_count:parseInt(specForm.lane_count,10),bandwidth_gbps:Number(specForm.bandwidth_gbps),package_types:specForm.package_types.split(',').map(x=>x.trim()).filter(Boolean),max_reach_mm:Number(specForm.max_reach_mm),voltage_v:Number(specForm.voltage_v),bump_pitch_um:Number(specForm.bump_pitch_um)}
   await api.put('/chiplets/'+specChipletId+'/interconnect-specs',payload)
   await load()
   setSpecMessage('Interconnect specifications saved. Compatibility checks have been refreshed.')
   setError('')
  }catch(e:any){setError(readableError(e?.response?.data?.detail,'Could not save interconnect specifications.'))}
  finally{setSpecSaving(false)}
 }

 async function optimizePortfolio(){
  setLoading(true);setError('')
  try{
   const {data}=await api.post('/optimize/portfolio',null,{params:{assumed_nre_per_chiplet_usd:Math.max(0,Number(assumedNre)||0)}})
   if(!data || !Array.isArray(data.scenarios) || data.scenarios.length===0){
    throw new Error('Backend response did not contain portfolio scenarios. Check the API terminal and /docs.')
   }
   setPortfolio(data as PortfolioResult);setScenarioKey('balanced');setTab('Portfolio Optimization')
   await load()
  }catch(e:any){
   console.error('Portfolio optimization failed:', e)
   setError(readableError(e?.response?.data?.detail||e?.message,'Portfolio optimization failed. Check the backend terminal and API docs.'))
  }finally{setLoading(false)}
 }

 return <div className="shell">
  <aside className="sidebar">
   <div className="brand"><div className="brand-icon"><Cpu/></div><div><b>ReChiplet</b><small>CHIPLET LIFECYCLE OS</small></div></div>
   <div className="nav-label">WORKSPACE</div>
   {nav.map(n=>{const I=n.icon;return <button key={n.label} className={'nav '+(tab===n.label?'active':'')} onClick={()=>setTab(n.label)}><I size={18}/>{n.label}</button>})}
   <div className="side-bottom"><span className={'dot '+(health==='ok'?'':'off')}/>{health==='ok'?'API Connected':health==='checking'?'Checking API':'API Offline'}<small>PORTFOLIO OPTIMIZER · 0.2.0</small></div>
  </aside>
  <main className="main">
   <header className="topbar"><span>Workspace　/　<b>{tab}</b></span><div className="topbar-actions"><span className="online">● Engineering workspace</span><button className="refresh" onClick={()=>void load()} title="Refresh data" aria-label="Refresh data"><RefreshCw size={16}/></button><span className="avatar" aria-label="ReChiplet account">RC</span><button className="logout-button" onClick={onLogout}>Sign out</button></div></header>
   <section className="content">
    {error&&<div className="error">{error}<button onClick={()=>setError('')}>×</button></div>}

    {tab==='Interconnect Compatibility'&&<>
     <Title eyebrow="ENGINEERING SCREENING" title="Interconnect compatibility" sub="Pairwise checks across your chiplet library. Missing specifications are flagged as unknown, never silently treated as compatible." action={<button className="secondary-action" onClick={async()=>{setCompatibilityLoading(true);try{const {data}=await api.get('/compatibility/matrix');setCompatibility(data);setError('')}catch{setError('Could not refresh compatibility matrix. Check the API and chiplet specifications.')}finally{setCompatibilityLoading(false)}}} disabled={compatibilityLoading}><RefreshCw size={14}/>{compatibilityLoading?'Checking…':'Refresh checks'}</button>}/>
     <div className="notice"><ShieldCheck/><div><b>Screening, not sign-off</b><p>Checks use the specifications entered for each chiplet. Verify against vendor datasheets, PHY/controller requirements, package design rules and SI/PI analysis before committing to a physical design.</p></div></div>
     {compatibility&&<><div className="metrics compatibility-metrics">{[['Chiplets in library',compatibility.chiplet_count],['Pairwise links checked',compatibility.pair_count],['Compatible',compatibility.summary.compatible||0],['Incompatible',compatibility.summary.incompatible||0],['Insufficient data',compatibility.summary.insufficient_data||0]].map(([label,value]:any)=><div className="metric" key={label}><Network/><span>{label}</span><b>{value}</b><small>Library-level pair screening</small></div>)}</div>
     <div className="panel"><h2>Chiplet interconnect specifications</h2><p className="chart-hint">Enter values from the chiplet vendor datasheet. Package types can be comma-separated, for example: 2.5D, 3D.</p><form className="interconnect-spec-form" onSubmit={saveInterconnectSpecs}><label>Chiplet<select value={specChipletId} onChange={e=>{setSpecChipletId(e.target.value);const c=chiplets.find(x=>String(x.id)===e.target.value);if(c?.interconnect_specs&&Object.keys(c.interconnect_specs).length)setSpecForm({protocol:c.interconnect_specs.protocol||'UCIe',protocol_version:c.interconnect_specs.protocol_version||'1.1',signaling:c.interconnect_specs.signaling||'differential',lane_count:String(c.interconnect_specs.lane_count||16),bandwidth_gbps:String(c.interconnect_specs.bandwidth_gbps||256),package_types:(c.interconnect_specs.package_types||['2.5D','3D']).join(', '),max_reach_mm:String(c.interconnect_specs.max_reach_mm||10),voltage_v:String(c.interconnect_specs.voltage_v||0.8),bump_pitch_um:String(c.interconnect_specs.bump_pitch_um||25)})}} required><option value="">Select chiplet</option>{chiplets.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{([['protocol','Protocol'],['protocol_version','Protocol version'],['signaling','Signaling mode'],['lane_count','Lane count'],['bandwidth_gbps','Bandwidth (Gbps)'],['package_types','Supported package types'],['max_reach_mm','Max reach (mm)'],['voltage_v','Voltage (V)'],['bump_pitch_um','Bump pitch (µm)']] as const).map(([key,label])=><label key={key}>{label}<input required value={specForm[key]} type={['lane_count','bandwidth_gbps','max_reach_mm','voltage_v','bump_pitch_um'].includes(key)?'number':'text'} min={key==='lane_count'?'1':['bandwidth_gbps','max_reach_mm','voltage_v','bump_pitch_um'].includes(key)?'0.01':undefined} step={key==='lane_count'?'1':'any'} onChange={e=>setSpecForm(old=>({...old,[key]:e.target.value}))}/></label>)}<button className="primary" type="submit" disabled={specSaving||!specChipletId}>{specSaving?'Saving…':'Save specifications & refresh checks'}</button></form>{specMessage&&<p className="success-message" role="status">{specMessage}</p>}</div>
     <div className="panel"><div className="section-head"><div><h2>Pairwise compatibility matrix</h2><p>Every unordered pair of chiplets is checked against available interface and interconnect metadata.</p></div></div>
     {compatibility.pairs.length===0?<div className="empty compact"><Workflow size={28}/><p>Add at least two chiplets to run pairwise checks.</p></div>:<div className="table-wrap"><table><thead><tr><th>CHIPLET A</th><th>CHIPLET B</th><th>INTERFACE</th><th>PROTOCOL / VERSION</th><th>LANES</th><th>BANDWIDTH</th><th>PACKAGE</th><th>STATUS</th></tr></thead><tbody>{compatibility.pairs.filter(pair=>pair.status!=='insufficient_data').map((pair,i)=>{const a=chiplets.find(c=>c.id===pair.chiplet_a.id);const b=chiplets.find(c=>c.id===pair.chiplet_b.id);const sa=a?.interconnect_specs||{};const sb=b?.interconnect_specs||{};return <tr key={pair.chiplet_a.id+'-'+pair.chiplet_b.id}><td><b>{pair.chiplet_a.name}</b></td><td><b>{pair.chiplet_b.name}</b></td><td>{a?.interface||'—'} / {b?.interface||'—'}</td><td>{sa.protocol||'Unknown'} {sa.protocol_version||''} / {sb.protocol||'Unknown'} {sb.protocol_version||''}</td><td>{sa.lane_count??'?' } / {sb.lane_count??'?'}</td><td>{sa.bandwidth_gbps??'?'} / {sb.bandwidth_gbps??'?'} Gbps</td><td>{(sa.package_types||[]).join(', ')||'?'} / {(sb.package_types||[]).join(', ')||'?'}</td><td><span className={'compat-status '+pair.status}>{pair.status.replace('_',' ')}</span><div className="compat-issues">{pair.issues.map((issue,j)=><small key={'i'+j}>⚠ {issue}</small>)}{pair.warnings.filter(warning=>!['Protocol cannot be verified (missing specification)','Protocol version cannot be verified (missing specification)','Signaling mode cannot be verified (missing specification)'].includes(warning)).slice(0,3).map((warning,j)=><small key={'w'+j}>ⓘ {warning}</small>)}</div></td></tr>})}</tbody></table></div>}</div>
     <div className="panel"><h2>Check a specific link</h2><p className="chart-hint">Select two chiplets and optionally specify the bandwidth the link must carry.</p><div className="compat-pair-form"><label>Chiplet A<select id="compat-a">{chiplets.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Chiplet B<select id="compat-b">{chiplets.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Required bandwidth (Gbps)<input type="number" min="0.01" step="1" value={pairBandwidth} onChange={e=>setPairBandwidth(e.target.value)} placeholder="Optional"/></label><button className="primary" disabled={chiplets.length<2||compatibilityLoading} onClick={async()=>{const aa=(document.getElementById('compat-a') as HTMLSelectElement|null)?.value;const bb=(document.getElementById('compat-b') as HTMLSelectElement|null)?.value;if(!aa||!bb||aa===bb){setError('Choose two different chiplets.');return}setCompatibilityLoading(true);try{const {data}=await api.get('/compatibility/check',{params:{chiplet_a_id:Number(aa),chiplet_b_id:Number(bb),...(pairBandwidth?{required_bandwidth_gbps:Number(pairBandwidth)}:{})}});setError('');window.alert(data.status.toUpperCase()+'\\n\\n'+[...data.issues,...data.warnings].join('\\n')+'\\n\\n'+data.disclaimer)}catch{setError('Could not check this pair.')}finally{setCompatibilityLoading(false)}}}>Check selected pair</button></div></div></>}
    </>}
    {tab==='Overview'&&<>
     <div className="hero"><div className="hero-copy"><span className="eyebrow">✦ PORTFOLIO-WIDE OPTIMIZATION</span><h2>One chiplet strategy.<br/><em>Multiple product wins.</em></h2><p>Run the NSGA-II search for every configured product. Compare economy, balanced and performance-focused portfolios, and see which chiplet designs can be reused.</p><button className="hero-button" onClick={optimizePortfolio} disabled={loading||!products.length}><Play size={15}/>{loading?'Optimizing all products…':'Run Portfolio Optimization'}</button></div><div className="chip-art"><div className="orbit"/><div className="chip center"><Cpu/><b>SoC</b></div><div className="chip left"><Zap/>Compute</div><div className="chip right"><Boxes/>Memory</div><div className="chip bottom"><Network/>I/O</div></div></div>
     <div className="metrics">{[[Layers3,'Chiplets in library',metrics.chiplet_count??chiplets.length,'Reusable design blocks'],[Network,'Products in portfolio',metrics.product_count??products.length,'Optimized together'],[Activity,'Optimization runs',metrics.optimization_runs??0,'Saved experiment history'],[RefreshCw,'Shared reuse groups',metrics.shared_reuse_groups??0,'Portfolio assignments']].map(([I,l,v,n]:any)=><div className="metric" key={l}><I/><span>{l}</span><b>{v}</b><small>{n}</small></div>)}</div>
     <Section title="Portfolio at a glance" sub="Product targets loaded from the database" action={()=>setTab('Product Portfolio')}/>
     <div className="cards">{products.map((p,i)=><article className="product" key={p.id}><div className={'picon p'+i}><Cpu/></div><small>{p.market_segment}</small><h3>{p.name}</h3><div className="row"><span>Performance target</span><b>{p.target_performance} pts</b></div><div className="bar"><i style={{width:Math.min(100,p.target_performance)+'%'}}/></div><div className="row"><span>Power ceiling</span><b>{p.max_power_w} W</b></div><div className="row"><span>Cost ceiling</span><b>{money(p.max_cost_usd)}</b></div><button className="card-link" onClick={()=>{setSelected(p.id);setTab('Product Portfolio')}}>Inspect requirements ↗</button></article>)}</div>
     <div className="notice"><ShieldCheck/><div><b>Engineering guardrails</b><p>All starter values are illustrative. The optimizer screens cost, power, area and performance, but detailed thermal, packaging, yield and lifecycle models require engineering calibration.</p></div></div>
    </>}

    {tab==='Chiplet Library'&&<>
     <Title eyebrow="DESIGN ASSET MANAGEMENT" title="Chiplet library" sub="Inventory of reusable compute, memory, accelerator, control and I/O building blocks." action={<button className="primary" onClick={()=>setTab('Portfolio Optimization')}>Optimize portfolio →</button>}/>
     <div className="toolbar"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chiplets, categories, interfaces…"/></div><span>{filtered.length} of {chiplets.length} chiplets</span></div>
     <div className="table-wrap"><table><thead><tr><th>CHIPLET</th><th>CATEGORY</th><th>NODE</th><th>AREA</th><th>POWER</th><th>PERFORMANCE</th><th>UNIT COST</th><th>THERMAL LIMIT</th><th>MATURITY</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td><b>{c.name}</b><small>{c.interface} interface</small></td><td>{c.category}</td><td>{c.process_node_nm} nm</td><td>{c.area_mm2} mm²</td><td>{c.power_w} W</td><td>{c.performance_score}</td><td>{money(c.unit_cost_usd)}</td><td>{c.thermal_limit_c}°C</td><td><span className="pill">{c.maturity}</span></td></tr>)}</tbody></table></div>
     <div className="notice"><Boxes/><div><b>Inventory model</b><p>Each record represents a reusable chiplet design asset. Reuse across products is counted as design reuse; per-product bill-of-material estimates still include the selected chiplet in each product architecture.</p></div></div>
    </>}

    {tab==='Product Portfolio'&&<>
     <Title eyebrow="MULTI-PRODUCT STRATEGY" title="Product portfolio" sub="Review the constraints for every product before running one optimization across the entire portfolio." action={<div className="portfolio-actions"><button className="secondary-action" onClick={()=>setShowAddProduct(true)}>＋ Add product</button><button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}><Sparkles size={15}/>{loading?'Optimizing…':'Optimize all products'}</button></div>}/>
     <div className="portfolio"><div className="panel"><h3>Products ({products.length})</h3>{products.map(p=><button className={'product-choice '+(selected===p.id?'chosen':'')} key={p.id} onClick={()=>setSelected(p.id)}><Cpu/><span><b>{p.name}</b><small>{p.market_segment}</small></span></button>)}</div>
      {product&&<div className="panel detail"><span className="eyebrow">PRODUCT REQUIREMENTS</span><h2>{product.name}</h2><p>{product.market_segment} · Annual volume {product.annual_volume.toLocaleString()} · Yield target {product.min_yield_pct}%</p><div className="requirements">{[['Performance target',product.target_performance+' pts'],['Maximum power',product.max_power_w+' W'],['Maximum area',product.max_area_mm2+' mm²'],['Maximum cost',money(product.max_cost_usd)],['Max junction temp',product.max_junction_temp_c+'°C'],['Annual volume',product.annual_volume.toLocaleString()]].map(([a,b])=><div key={a}><small>{a}</small><b>{b}</b></div>)}</div><h3>Available design blocks</h3>{chiplets.slice(0,6).map(c=><div className="available" key={c.id}><span>{c.name}<small>{c.category} · {c.process_node_nm} nm</small></span><b>{c.power_w} W</b></div>)}<button className="primary full" onClick={optimizePortfolio} disabled={loading}>{loading?'Optimizing portfolio…':'Run portfolio optimization'}</button></div>}
     </div>
     {showAddProduct&&<div className="modal-backdrop"><form className="add-product-modal" onSubmit={createProduct}><div className="modal-heading"><div><span className="eyebrow">PORTFOLIO SETUP</span><h2>Add a product</h2><p>Enter the product targets used by the architecture optimizer.</p></div><button type="button" className="modal-close" onClick={()=>setShowAddProduct(false)}>×</button></div><div className="product-form-grid"><label>Product name<input required minLength={2} maxLength={120} value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Edge AI Gateway"/></label><label>Market segment<select value={productForm.market_segment} onChange={e=>setProductForm({...productForm,market_segment:e.target.value})}><option>Consumer Electronics</option><option>Automotive</option><option>Data Center</option><option>Industrial IoT</option><option>Mobile</option><option>Edge AI</option><option>Networking</option><option>Medical Devices</option></select></label><label>Target performance<input type="number" min="0.01" step="any" required value={productForm.target_performance} onChange={e=>setProductForm({...productForm,target_performance:e.target.value})}/></label><label>Maximum power (W)<input type="number" min="0.01" step="any" required value={productForm.max_power_w} onChange={e=>setProductForm({...productForm,max_power_w:e.target.value})}/></label><label>Maximum area (mm²)<input type="number" min="0.01" step="any" required value={productForm.max_area_mm2} onChange={e=>setProductForm({...productForm,max_area_mm2:e.target.value})}/></label><label>Maximum cost (USD)<input type="number" min="0.01" step="any" required value={productForm.max_cost_usd} onChange={e=>setProductForm({...productForm,max_cost_usd:e.target.value})}/></label><label>Max junction temperature (°C)<input type="number" min="40" max="200" required value={productForm.max_junction_temp_c} onChange={e=>setProductForm({...productForm,max_junction_temp_c:e.target.value})}/></label><label>Minimum yield (%)<input type="number" min="0" max="100" step="any" required value={productForm.min_yield_pct} onChange={e=>setProductForm({...productForm,min_yield_pct:e.target.value})}/></label><label>Annual volume<input type="number" min="1" step="1" required value={productForm.annual_volume} onChange={e=>setProductForm({...productForm,annual_volume:e.target.value})}/></label></div><div className="modal-actions"><button type="button" className="secondary-action" onClick={()=>setShowAddProduct(false)}>Cancel</button><button className="primary" type="submit" disabled={savingProduct}>{savingProduct?'Saving product…':'Save product'}</button></div></form></div>}
     <div className="notice"><Workflow/><div><b>One run, every product</b><p>Product selection here is for inspecting requirements. The optimization action evaluates all products together and returns three portfolio strategies, not just one product result.</p></div></div>
    </>}

    {tab==='Portfolio Optimization'&&<>
     <Title eyebrow="MULTI-OBJECTIVE DESIGN SPACE" title="Portfolio optimization studio" sub="Run NSGA-II for each product and compare portfolio-wide cost, power, performance and chiplet reuse." action={<button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}><Play size={15}/>{loading?'Searching all products…':'Run portfolio optimization'}</button>}/>
     {!portfolio?<div className="empty"><Gauge size={35}/><h2>Optimize the complete portfolio</h2><p>One run evaluates every configured product and returns three comparable strategies: lowest cost, balanced, and highest performance.</p><button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}>{loading?'Running NSGA-II for all products…':'Start portfolio optimization'}</button><small>{products.length} products · {chiplets.length} available chiplet designs</small></div>:<>
      <div className="notice"><ShieldCheck/><div><b>{portfolio.message}</b><p>Run #{portfolio.run_id} · NSGA-II candidate search per product followed by portfolio-level strategy comparison. {portfolio.model_note}</p></div></div>
      <div className="scenario-tabs">{portfolio.scenarios.map(s=><button key={s.key} className={'scenario-tab '+(scenarioKey===s.key?'selected':'')} onClick={()=>setScenarioKey(s.key)}><span>{s.key==='lowest_cost'?<Wallet size={17}/>:s.key==='balanced'?<Scale size={17}/>:<Zap size={17}/>}</span><b>{s.label}</b><small>{s.summary.feasible_product_count}/{s.summary.product_count} products feasible</small></button>)}</div>
      {currentScenario&&<><div className="scenario-intro"><div><span className="eyebrow">SELECTED PORTFOLIO STRATEGY</span><h2>{currentScenario.label}</h2><p>{currentScenario.description}</p></div><span className={'status-tag '+(currentScenario.summary.feasible_product_count===currentScenario.summary.product_count?'good':'warn')}>{currentScenario.summary.feasible_product_count===currentScenario.summary.product_count?'All products feasible':'Feasibility review needed'}</span></div>
       <div className="panel reuse-assumption" style={{marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><h3 style={{marginBottom:5}}>Reuse benefit assumptions</h3><p style={{margin:0,fontSize:11,color:'#7889a9'}}>Set the estimated non-recurring engineering (NRE) cost avoided for each additional product reusing a chiplet design. This affects reuse-benefit estimates only, not BOM cost.</p></div><label style={{display:'grid',gap:6,fontSize:11,fontWeight:700,color:'#34435c',minWidth:180}}>NRE avoided per reuse event (USD)<input type="number" min="0" step="10000" value={assumedNre} onChange={e=>setAssumedNre(e.target.value)} style={{padding:'10px 12px',border:'1px solid #dce4f0',borderRadius:7,font:'12px DM Sans',width:'100%'}}/></label><button className="secondary-action" onClick={optimizePortfolio} disabled={loading}>{loading?'Recalculating…':'Recalculate benefit'}</button></div>
       <div className="metrics">{[[Wallet,'Combined BOM estimate',money(currentScenario.summary.total_estimated_cost_usd),'Sum of selected product architectures'],[Zap,'Combined power total',currentScenario.summary.total_estimated_power_w+' W','Per-product power estimates summed'],[PackageCheck,'Feasible products',currentScenario.summary.feasible_product_count+' / '+currentScenario.summary.product_count,'Meet configured limits'],[GitCompare,'Estimated reuse benefit',money(currentScenario.summary.estimated_nre_savings_usd),'Avoided duplicate design NRE estimate']].map(([I,l,v,n]:any)=><div className="metric" key={l}><I/><span>{l}</span><b>{v}</b><small>{n}</small></div>)}</div>
       <div className="section-head"><div><h2>Recommended architecture by product</h2><p>Each row is selected from that product's NSGA-II candidate set for the active portfolio strategy.</p></div></div>
       <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>STATUS</th><th>SELECTED CHIPLET COMBINATION</th><th>COST</th><th>POWER</th><th>AREA</th><th>PERFORMANCE</th></tr></thead><tbody>{currentScenario.architectures.map(a=><tr key={a.product_id}><td><b>{a.product_name}</b><small>{a.market_segment}</small></td><td><span className={'pill '+(a.feasible?'':'review')}>{a.feasible?'Feasible':'Review'}</span></td><td>{a.solution?.chiplet_names.join(' + ')||a.message||'No candidate found'}</td><td>{a.solution?money(a.solution.estimated_cost_usd):'—'}</td><td>{a.solution?a.solution.estimated_power_w+' W':'—'}</td><td>{a.solution?a.solution.estimated_area_mm2+' mm²':'—'}</td><td>{a.solution?.performance_score??'—'}</td></tr>)}</tbody></table></div>
       <div className="charts"><div className="panel comparison-panel"><h3>Product cost & performance comparison</h3><p className="chart-hint">Compare products directly. Lower cost is better; higher performance is better.</p><div className="comparison-charts"><div className="comparison-chart"><h4>Estimated BOM cost</h4><Plot data={[{type:'bar',orientation:'h',x:currentScenario.architectures.filter(a=>a.solution).map(a=>a.solution!.estimated_cost_usd),y:currentScenario.architectures.filter(a=>a.solution).map(a=>a.product_name),text:currentScenario.architectures.filter(a=>a.solution).map(a=>money(a.solution!.estimated_cost_usd)),textposition:'outside',cliponaxis:false,marker:{color:'#5277f5'},hovertemplate:'<b>%{y}</b><br>Estimated cost: $%{x:,.0f}<extra></extra>'}]} layout={{autosize:true,height:Math.max(250,currentScenario.architectures.filter(a=>a.solution).length*48),margin:{l:190,r:85,t:10,b:70},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',showlegend:false,xaxis:{title:'Cost (USD)',gridcolor:'#edf1f6',rangemode:'tozero',automargin:true,tickangle:0},yaxis:{automargin:true,autorange:'reversed',gridcolor:'rgba(0,0,0,0)',tickfont:{size:10}}}} config={{responsive:true,displayModeBar:false}} style={{width:'100%'}}/></div><div className="comparison-chart"><h4>Performance score</h4><Plot data={[{type:'bar',orientation:'h',x:currentScenario.architectures.filter(a=>a.solution).map(a=>a.solution!.performance_score),y:currentScenario.architectures.filter(a=>a.solution).map(a=>a.product_name),text:currentScenario.architectures.filter(a=>a.solution).map(a=>String(a.solution!.performance_score)),textposition:'outside',cliponaxis:false,marker:{color:'#16a57a'},hovertemplate:'<b>%{y}</b><br>Performance score: %{x}<extra></extra>'}]} layout={{autosize:true,height:Math.max(250,currentScenario.architectures.filter(a=>a.solution).length*48),margin:{l:190,r:75,t:10,b:70},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',showlegend:false,xaxis:{title:'Performance score',gridcolor:'#edf1f6',rangemode:'tozero',automargin:true,tickangle:0},yaxis:{automargin:true,autorange:'reversed',gridcolor:'rgba(0,0,0,0)',tickfont:{size:10}}}} config={{responsive:true,displayModeBar:false}} style={{width:'100%'}}/></div></div></div>
        <div className="panel"><h3>Shared chiplet reuse map</h3>{currentScenario.shared_chiplets.length===0?<div className="empty compact"><Boxes size={28}/><p>No chiplet design appears in more than one selected architecture for this strategy.</p></div>:currentScenario.shared_chiplets.map(c=><button type="button" className="reuse-row reuse-row-clickable" key={c.chiplet_id} onClick={()=>setSelectedReuseChiplet(c.chiplet_id)} aria-label={`View details for ${c.chiplet_name}`}><div className="reuse-icon"><Boxes size={17}/></div><div className="reuse-detail"><b>{c.chiplet_name}</b><small>{c.products.join(' · ')}</small><small className="reuse-open-hint">Click to view chiplet specifications, usage and savings breakdown ↗</small></div><span className="reuse-count">{c.product_count} products · {money(c.estimated_nre_avoided_usd)} avoided NRE</span></button>)}</div>
       </div>
       {selectedReuseChiplet!==null&&(()=>{const reuse=currentScenario.shared_chiplets.find(item=>item.chiplet_id===selectedReuseChiplet);const detail=chiplets.find(item=>item.id===selectedReuseChiplet);if(!reuse||!detail)return null;const reuseEvents=Math.max(0,reuse.product_count-1);const totalNre=reuse.estimated_nre_avoided_usd;const nreEach=Number(assumedNre)||0;const reuseProducts=currentScenario.architectures.filter(item=>item.solution?.chiplet_ids.includes(selectedReuseChiplet));return <div className="reuse-modal-backdrop" role="presentation" onClick={()=>setSelectedReuseChiplet(null)}><section className="reuse-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reuse-detail-title" onClick={event=>event.stopPropagation()}><div className="reuse-modal-header"><div className="reuse-icon large"><Boxes size={22}/></div><div className="reuse-modal-title"><span className="eyebrow">SHARED CHIPLET DETAIL</span><h2 id="reuse-detail-title">{detail.name}</h2><p>{detail.category} · {detail.interface} interface · {detail.maturity}</p></div><button type="button" className="modal-close" aria-label="Close details" onClick={()=>setSelectedReuseChiplet(null)}>×</button></div><div className="reuse-detail-stats"><div><small>Products reusing design</small><b>{reuse.product_count}</b><span>{reuse.products.join(' · ')}</span></div><div><small>Estimated NRE avoided</small><b>{money(totalNre)}</b><span>{reuseEvents} additional reuse event(s)</span></div><div><small>Assumed NRE per reuse</small><b>{money(nreEach)}</b><span>Editable in the portfolio assumptions</span></div></div><div className="reuse-modal-section"><h3>Technical specifications</h3><div className="reuse-spec-grid"><div><small>Chiplet category</small><b>{detail.category}</b></div><div><small>Process node</small><b>{detail.process_node_nm} nm</b></div><div><small>Area</small><b>{detail.area_mm2} mm²</b></div><div><small>Power</small><b>{detail.power_w} W</b></div><div><small>Performance score</small><b>{detail.performance_score}</b></div><div><small>Unit cost estimate</small><b>{money(detail.unit_cost_usd)}</b></div><div><small>Thermal limit</small><b>{detail.thermal_limit_c}°C</b></div><div><small>Interface</small><b>{detail.interface}</b></div><div><small>Design maturity</small><b>{detail.maturity}</b></div><div><small>Design notes</small><b>{detail.notes?.trim()||'No additional notes provided'}</b></div></div></div><div className="reuse-modal-section"><h3>Used by these product architectures</h3>{reuseProducts.map(item=><div className="reuse-product-detail" key={item.product_id}><div><b>{item.product_name}</b><small>{item.market_segment}</small><small>{item.solution?.chiplet_names.join(' + ')}</small></div><span className={'pill '+(item.feasible?'':'review')}>{item.feasible?'Feasible':'Review needed'}</span></div>)}</div><div className="reuse-calculation"><h3>How the benefit is calculated</h3><p>Estimated avoided duplicate design NRE = (number of products using this chiplet − 1) × assumed NRE per reuse event.</p><div className="reuse-equation">({reuse.product_count} − 1) × {money(nreEach)} = <b>{money(totalNre)}</b></div><small>This is an illustrative engineering-design cost avoidance estimate, not guaranteed cash savings or a reduction in per-unit manufacturing/BOM cost. Replace the assumption with your organization's validated NRE figures.</small></div><div className="reuse-modal-footer"><button type="button" className="secondary-action" onClick={()=>setSelectedReuseChiplet(null)}>Close details</button></div></section></div>})()}
       <div className="notice"><ShieldCheck/><div><b>How to interpret this result</b><p>Lowest Cost prioritizes product BOM cost, Balanced trades off cost, power, area and performance, and Highest Performance prioritizes performance while preferring feasible candidates. Shared chiplets indicate reusable design assets, not a claim that one physical die is shared between manufactured products. Reuse benefit estimates avoided duplicate design NRE using the assumption above; it is not a reduction in recurring BOM cost. Values are illustrative and should be replaced with company-specific NRE data.</p></div></div>
      </>}
     </>}
    </>}
    <footer>ReChiplet · Multi-product chiplet lifecycle optimizer <span>Illustrative estimates · Not fabrication sign-off data</span></footer>
   </section>
  </main>
 </div>
}

function Title({eyebrow,title,sub,action}:any){return <div className="title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{sub}</p></div>{action}</div>}
function Section({title,sub,action}:any){return <div className="section-head"><div><h2>{title}</h2><p>{sub}</p></div><button onClick={action}>View portfolio ↗</button></div>}


class AppErrorBoundary extends Component<{children:ReactNode},{hasError:boolean;message:string}> {
 constructor(props:{children:React.ReactNode}){super(props);this.state={hasError:false,message:''}}
 static getDerivedStateFromError(error:Error){return {hasError:true,message:error?.message||'Unknown rendering error'}}
 componentDidCatch(error:Error,info:ErrorInfo){console.error('ReChiplet UI rendering error:',error,info)}
 render(){
  if(this.state.hasError){
   return <div style={{fontFamily:'Arial,sans-serif',maxWidth:760,margin:'60px auto',padding:28,color:'#192741'}}>
    <h1 style={{marginBottom:8}}>ReChiplet encountered a display error</h1>
    <p>The page is protected from a blank screen. This error occurred while displaying optimization results.</p>
    <pre style={{whiteSpace:'pre-wrap',background:'#fff1f0',border:'1px solid #f0c9c5',borderRadius:8,padding:14,color:'#8f3030'}}>{this.state.message}</pre>
    <button onClick={()=>this.setState({hasError:false,message:''})} style={{padding:'10px 14px',background:'#315efb',color:'#fff',border:0,borderRadius:7,cursor:'pointer'}}>Try rendering again</button>
    <p style={{color:'#68758a',fontSize:13}}>If it repeats, open the browser console (F12 → Console) and share the first red error.</p>
   </div>
  }
  return this.props.children
 }
}
function LoginScreen({onLogin}:{onLogin:()=>void}){
 const [username,setUsername]=useState('admin')
 const [password,setPassword]=useState('')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');try{const {data}=await api.post('/auth/login',{username,password});localStorage.setItem('rechiplet_access_token',data.access_token);onLogin()}catch(e:any){setMessage(readableError(e?.response?.data?.detail,'Login failed. Check the API and credentials.'))}finally{setBusy(false)}}
 return <main className="login-screen"><section className="login-card"><div className="login-brand"><div className="login-mark"><Boxes size={25}/></div><span>ReChiplet</span></div><span className="eyebrow">CHIPLET LIFECYCLE OPTIMIZER</span><h1>Welcome back</h1><p className="login-subtitle">Sign in to access your chiplet library, product portfolio and architecture tools.</p><form onSubmit={submit} className="login-form"><label>Username<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{message&&<p className="login-error" role="alert">{message}</p>}<button type="submit" className="primary login-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form><p className="login-hint">Local demo credentials: <b>admin</b> / <b>Rechiplet@123</b></p><small className="login-security-note">Change the demo credentials and token secret through backend environment variables before deploying publicly.</small></section></main>
}
function AuthenticatedApp(){
 const [loggedIn,setLoggedIn]=useState(()=>Boolean(localStorage.getItem('rechiplet_access_token')))
 useEffect(()=>{const expired=()=>setLoggedIn(false);window.addEventListener('rechiplet-session-expired',expired);return()=>window.removeEventListener('rechiplet-session-expired',expired)},[])
 if(!loggedIn)return <LoginScreen onLogin={()=>setLoggedIn(true)}/>
 return <div className="authenticated-shell"><AppErrorBoundary><AppContent onLogout={()=>{localStorage.removeItem('rechiplet_access_token');setLoggedIn(false)}}/></AppErrorBoundary></div>
}
export default function App(){return <AuthenticatedApp/>}
