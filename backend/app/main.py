from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from .database import get_db
from .models import Chiplet, Product, OptimizationRun, PortfolioAssignment
from .schemas import ChipletIn, ChipletOut, ProductIn, ProductOut
from .optimizer import optimize_product

app = FastAPI(title="ReChiplet API", version="0.1.0", description="Multi-Product Chiplet Lifecycle Optimizer")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173","http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health(): return {"status":"ok","service":"rechiplet-api","version":"0.1.0"}

@app.get("/api/dashboard")
def dashboard(db: Session=Depends(get_db)):
    latest = db.scalar(select(OptimizationRun).order_by(OptimizationRun.id.desc()).limit(1))
    assignments = db.scalars(select(PortfolioAssignment)).all()
    return {"chiplet_count":db.scalar(select(func.count(Chiplet.id))) or 0,
      "product_count":db.scalar(select(func.count(Product.id))) or 0,
      "optimization_runs":db.scalar(select(func.count(OptimizationRun.id))) or 0,
      "shared_reuse_groups":len({a.reuse_group for a in assignments if a.reuse_group}),
      "latest_run":{"id":latest.id,"created_at":latest.created_at.isoformat(),"summary":latest.summary} if latest else None}

@app.get("/api/chiplets",response_model=list[ChipletOut])
def list_chiplets(category:str|None=None,db:Session=Depends(get_db)):
    stmt=select(Chiplet).order_by(Chiplet.id)
    if category: stmt=stmt.where(Chiplet.category==category)
    return db.scalars(stmt).all()

@app.post("/api/chiplets",response_model=ChipletOut,status_code=201)
def create_chiplet(payload:ChipletIn,db:Session=Depends(get_db)):
    if db.scalar(select(Chiplet).where(Chiplet.name==payload.name)): raise HTTPException(409,"Chiplet name already exists.")
    obj=Chiplet(**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@app.get("/api/products",response_model=list[ProductOut])
def list_products(db:Session=Depends(get_db)): return db.scalars(select(Product).order_by(Product.id)).all()

@app.post("/api/products",response_model=ProductOut,status_code=201)
def create_product(payload:ProductIn,db:Session=Depends(get_db)):
    if db.scalar(select(Product).where(Product.name==payload.name)): raise HTTPException(409,"Product name already exists.")
    obj=Product(**payload.model_dump()); db.add(obj); db.commit(); db.refresh(obj); return obj

@app.get("/api/optimizations")
def list_optimizations(db:Session=Depends(get_db)):
    return [{"id":r.id,"status":r.status,"strategy":r.strategy,"created_at":r.created_at.isoformat(),"summary":r.summary,"solutions":r.solutions} for r in db.scalars(select(OptimizationRun).order_by(OptimizationRun.id.desc()).limit(20)).all()]

@app.post("/api/optimize/{product_id}")
def run_optimization(product_id:int,db:Session=Depends(get_db)):
    p=db.get(Product,product_id)
    if not p: raise HTTPException(404,"Product not found.")
    cs=db.scalars(select(Chiplet).order_by(Chiplet.id)).all()
    product={"target_performance":p.target_performance,"max_power_w":p.max_power_w,"max_area_mm2":p.max_area_mm2,"max_cost_usd":p.max_cost_usd}
    chiplets=[{"id":c.id,"name":c.name,"category":c.category,"process_node_nm":c.process_node_nm,"area_mm2":c.area_mm2,"power_w":c.power_w,"unit_cost_usd":c.unit_cost_usd,"performance_score":c.performance_score,"thermal_limit_c":c.thermal_limit_c,"interface":c.interface,"maturity":c.maturity} for c in cs]
    result=optimize_product(product,chiplets)
    run=OptimizationRun(status="completed",strategy="NSGA-II",summary={"product_id":p.id,"product_name":p.name,"feasible":result["feasible"],"message":result["message"],"model_note":result["model_note"]},solutions=result["solutions"])
    db.add(run); db.commit(); db.refresh(run)
    return {"run_id":run.id,"product":p.name,**result}

@app.get("/api/portfolio/reuse")
def portfolio_reuse(db:Session=Depends(get_db)):
    ps=db.scalars(select(Product).order_by(Product.id)).all(); cs=db.scalars(select(Chiplet).order_by(Chiplet.id)).all()
    return {"products":[{"id":p.id,"name":p.name,"market_segment":p.market_segment} for p in ps],
      "chiplets":[{"id":c.id,"name":c.name,"category":c.category,"maturity":c.maturity,"estimated_cost_usd":c.unit_cost_usd,"power_w":c.power_w} for c in cs],
      "note":"Portfolio-level reuse opportunities are shown; approved per-product assignments are a next-stage feature."}
