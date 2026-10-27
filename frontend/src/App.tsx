import {Component,useEffect,useMemo,useState} from 'react'
import type {ErrorInfo,ReactNode} from 'react'
import Plot from 'react-plotly.js'
import {Activity,Boxes,Cpu,Gauge,Layers3,LayoutDashboard,Network,Play,RefreshCw,Search,ShieldCheck,Sparkles,Zap,Wallet,Scale,GitCompare,PackageCheck,Workflow} from 'lucide-react'
import {api,Chiplet,Product,PortfolioResult,PortfolioScenario} from './api'

type Tab='Overview'|'Chiplet Library'|'Product Portfolio'|'Portfolio Optimization'
const nav:{label:Tab;icon:any}[]=[
 {label:'Overview',icon:LayoutDashboard},
 {label:'Chiplet Library',icon:Layers3},
 {label:'Product Portfolio',icon:Network},
 {label:'Portfolio Optimization',icon:Gauge}
]
const money=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v)

function AppContent(){
 const [tab,setTab]=useState<Tab>('Overview')
 const [chiplets,setChiplets]=useState<Chiplet[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [metrics,setMetrics]=useState<any>({})
 const [selected,setSelected]=useState<number|null>(null)
 const [portfolio,setPortfolio]=useState<PortfolioResult|null>(null)
 const [scenarioKey,setScenarioKey]=useState<'lowest_cost'|'balanced'|'highest_performance'>('balanced')
 const [loading,setLoading]=useState(false)
 const [assumedNre,setAssumedNre]=useState('250000')
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [health,setHealth]=useState('checking')
 const [showAddProduct,setShowAddProduct]=useState(false)
 const [savingProduct,setSavingProduct]=useState(false)
 const [productForm,setProductForm]=useState({name:'',market_segment:'Consumer Electronics',target_performance:'100',max_power_w:'100',max_area_mm2:'200',max_cost_usd:'500',max_junction_temp_c:'95',min_yield_pct:'90',annual_volume:'100000'})

 async function load(){
  try{
   const [c,p,m,h]=await Promise.all([api.get('/chiplets'),api.get('/products'),api.get('/dashboard'),api.get('/health')])
   setChiplets(c.data);setProducts(p.data);setMetrics(m.data);setHealth(h.data.status)
   setSelected(old=>old??p.data[0]?.id??null);setError('')
  }catch{
   setHealth('offline');setError('API unavailable. Run start.bat and refresh this page.')
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
   setError(e?.response?.data?.detail?.[0]?.msg||e?.response?.data?.detail||e?.message||'Could not add product.')
  }finally{setSavingProduct(false)}
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
   setError(e?.response?.data?.detail||e?.message||'Portfolio optimization failed. Check the backend terminal and API docs.')
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
   <header className="topbar"><span>Workspace　/　<b>{tab}</b></span><div><span className="online">● Engineering workspace</span><button className="refresh" onClick={()=>void load()} title="Refresh data"><RefreshCw size={16}/></button><span className="avatar">RC</span></div></header>
   <section className="content">
    {error&&<div className="error">{error}<button onClick={()=>setError('')}>×</button></div>}

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
        <div className="panel"><h3>Shared chiplet reuse map</h3>{currentScenario.shared_chiplets.length===0?<div className="empty compact"><Boxes size={28}/><p>No chiplet design appears in more than one selected architecture for this strategy.</p></div>:currentScenario.shared_chiplets.map(c=><div className="reuse-row" key={c.chiplet_id}><div className="reuse-icon"><Boxes size={17}/></div><div className="reuse-detail"><b>{c.chiplet_name}</b><small>{c.products.join(' · ')}</small></div><span className="reuse-count">{c.product_count} products · {money(c.estimated_nre_avoided_usd)} avoided NRE</span></div>)}</div>
       </div>       <div className="notice"><ShieldCheck/><div><b>How to interpret this result</b><p>Lowest Cost prioritizes product BOM cost, Balanced trades off cost, power, area and performance, and Highest Performance prioritizes performance while preferring feasible candidates. Shared chiplets indicate reusable design assets, not a claim that one physical die is shared between manufactured products. Reuse benefit estimates avoided duplicate design NRE using the assumption above; it is not a reduction in recurring BOM cost. Values are illustrative and should be replaced with company-specific NRE data.</p></div></div>
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
export default function App(){return <AppErrorBoundary><AppContent/></AppErrorBoundary>}
