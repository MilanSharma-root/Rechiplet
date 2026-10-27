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
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [health,setHealth]=useState('checking')

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

 async function optimizePortfolio(){
  setLoading(true);setError('')
  try{
   const {data}=await api.post('/optimize/portfolio')
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
     <Title eyebrow="PORTFOLIO INTELLIGENCE" title="Design smarter. Reuse further." sub="Optimize chiplet architectures across every product in the portfolio, then compare cost, performance, power and reuse." action={<button className="primary" onClick={()=>setTab('Product Portfolio')}>Inspect portfolio →</button>}/>
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
     <Title eyebrow="MULTI-PRODUCT STRATEGY" title="Product portfolio" sub="Review the constraints for every product before running one optimization across the entire portfolio." action={<button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}><Sparkles size={15}/>{loading?'Optimizing…':'Optimize all products'}</button>}/>
     <div className="portfolio"><div className="panel"><h3>Products ({products.length})</h3>{products.map(p=><button className={'product-choice '+(selected===p.id?'chosen':'')} key={p.id} onClick={()=>setSelected(p.id)}><Cpu/><span><b>{p.name}</b><small>{p.market_segment}</small></span></button>)}</div>
      {product&&<div className="panel detail"><span className="eyebrow">PRODUCT REQUIREMENTS</span><h2>{product.name}</h2><p>{product.market_segment} · Annual volume {product.annual_volume.toLocaleString()} · Yield target {product.min_yield_pct}%</p><div className="requirements">{[['Performance target',product.target_performance+' pts'],['Maximum power',product.max_power_w+' W'],['Maximum area',product.max_area_mm2+' mm²'],['Maximum cost',money(product.max_cost_usd)],['Max junction temp',product.max_junction_temp_c+'°C'],['Annual volume',product.annual_volume.toLocaleString()]].map(([a,b])=><div key={a}><small>{a}</small><b>{b}</b></div>)}</div><h3>Available design blocks</h3>{chiplets.slice(0,6).map(c=><div className="available" key={c.id}><span>{c.name}<small>{c.category} · {c.process_node_nm} nm</small></span><b>{c.power_w} W</b></div>)}<button className="primary full" onClick={optimizePortfolio} disabled={loading}>{loading?'Optimizing portfolio…':'Run portfolio optimization'}</button></div>}
     </div>
     <div className="notice"><Workflow/><div><b>One run, every product</b><p>Product selection here is for inspecting requirements. The optimization action evaluates all products together and returns three portfolio strategies, not just one product result.</p></div></div>
    </>}

    {tab==='Portfolio Optimization'&&<>
     <Title eyebrow="MULTI-OBJECTIVE DESIGN SPACE" title="Portfolio optimization studio" sub="Run NSGA-II for each product and compare portfolio-wide cost, power, performance and chiplet reuse." action={<button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}><Play size={15}/>{loading?'Searching all products…':'Run portfolio optimization'}</button>}/>
     {!portfolio?<div className="empty"><Gauge size={35}/><h2>Optimize the complete portfolio</h2><p>One run evaluates every configured product and returns three comparable strategies: lowest cost, balanced, and highest performance.</p><button className="primary" onClick={optimizePortfolio} disabled={loading||!products.length}>{loading?'Running NSGA-II for all products…':'Start portfolio optimization'}</button><small>{products.length} products · {chiplets.length} available chiplet designs</small></div>:<>
      <div className="notice"><ShieldCheck/><div><b>{portfolio.message}</b><p>Run #{portfolio.run_id} · NSGA-II candidate search per product followed by portfolio-level strategy comparison. {portfolio.model_note}</p></div></div>
      <div className="scenario-tabs">{portfolio.scenarios.map(s=><button key={s.key} className={'scenario-tab '+(scenarioKey===s.key?'selected':'')} onClick={()=>setScenarioKey(s.key)}><span>{s.key==='lowest_cost'?<Wallet size={17}/>:s.key==='balanced'?<Scale size={17}/>:<Zap size={17}/>}</span><b>{s.label}</b><small>{s.summary.feasible_product_count}/{s.summary.product_count} products feasible</small></button>)}</div>
      {currentScenario&&<><div className="scenario-intro"><div><span className="eyebrow">SELECTED PORTFOLIO STRATEGY</span><h2>{currentScenario.label}</h2><p>{currentScenario.description}</p></div><span className={'status-tag '+(currentScenario.summary.feasible_product_count===currentScenario.summary.product_count?'good':'warn')}>{currentScenario.summary.feasible_product_count===currentScenario.summary.product_count?'All products feasible':'Feasibility review needed'}</span></div>
       <div className="metrics">{[[Wallet,'Combined BOM estimate',money(currentScenario.summary.total_estimated_cost_usd),'Sum of selected product architectures'],[Zap,'Combined power total',currentScenario.summary.total_estimated_power_w+' W','Per-product power estimates summed'],[PackageCheck,'Feasible products',currentScenario.summary.feasible_product_count+' / '+currentScenario.summary.product_count,'Meet configured limits'],[GitCompareArrows,'Shared chiplet designs',currentScenario.summary.shared_chiplet_count,'Used in 2+ product architectures']].map(([I,l,v,n]:any)=><div className="metric" key={l}><I/><span>{l}</span><b>{v}</b><small>{n}</small></div>)}</div>
       <div className="section-head"><div><h2>Recommended architecture by product</h2><p>Each row is selected from that product's NSGA-II candidate set for the active portfolio strategy.</p></div></div>
       <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>STATUS</th><th>SELECTED CHIPLET COMBINATION</th><th>COST</th><th>POWER</th><th>AREA</th><th>PERFORMANCE</th></tr></thead><tbody>{currentScenario.architectures.map(a=><tr key={a.product_id}><td><b>{a.product_name}</b><small>{a.market_segment}</small></td><td><span className={'pill '+(a.feasible?'':'review')}>{a.feasible?'Feasible':'Review'}</span></td><td>{a.solution?.chiplet_names.join(' + ')||a.message||'No candidate found'}</td><td>{a.solution?money(a.solution.estimated_cost_usd):'—'}</td><td>{a.solution?a.solution.estimated_power_w+' W':'—'}</td><td>{a.solution?a.solution.estimated_area_mm2+' mm²':'—'}</td><td>{a.solution?.performance_score??'—'}</td></tr>)}</tbody></table></div>
       <div className="charts"><div className="panel"><h3>Cost vs performance by product</h3><Plot data={[{x:currentScenario.architectures.filter(a=>a.solution).map(a=>a.solution!.estimated_cost_usd),y:currentScenario.architectures.filter(a=>a.solution).map(a=>a.solution!.performance_score),text:currentScenario.architectures.filter(a=>a.solution).map(a=>a.product_name),mode:'markers+text',type:'scatter',textposition:'top center',hovertemplate:'%{text}<br>Cost $%{x}<br>Performance %{y}<extra></extra>',marker:{size:13,color:'#315efb'}}]} layout={{autosize:true,height:320,margin:{l:50,r:15,t:15,b:45},paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',xaxis:{title:'Estimated product BOM cost ($)',gridcolor:'#edf1f6'},yaxis:{title:'Performance score',gridcolor:'#edf1f6'}}} config={{responsive:true,displayModeBar:false}} style={{width:'100%'}}/></div>
        <div className="panel"><h3>Shared chiplet reuse map</h3>{currentScenario.shared_chiplets.length===0?<div className="empty compact"><Boxes size={28}/><p>No chiplet design appears in more than one selected architecture for this strategy.</p></div>:currentScenario.shared_chiplets.map(c=><div className="reuse-row" key={c.chiplet_id}><div className="reuse-icon"><Boxes size={17}/></div><div className="reuse-detail"><b>{c.chiplet_name}</b><small>{c.products.join(' · ')}</small></div><span className="reuse-count">{c.product_count} products</span></div>)}</div>
       </div>
       <div className="notice"><ShieldCheck/><div><b>How to interpret this result</b><p>Lowest Cost prioritizes product BOM cost, Balanced trades off cost, power, area and performance, and Highest Performance prioritizes performance while preferring feasible candidates. Shared chiplets indicate reusable design assets, not a claim that one physical die is shared between manufactured products. Values are illustrative model estimates.</p></div></div>
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
