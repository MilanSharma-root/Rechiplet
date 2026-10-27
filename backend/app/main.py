from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func, inspect, text
from .database import get_db, engine, Base
from .models import Chiplet, Product, OptimizationRun, PortfolioAssignment
from .schemas import ChipletIn, ChipletOut, ProductIn, ProductOut
from pydantic import BaseModel, Field
from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta, timezone
import os, hmac, hashlib, base64, json
from .optimizer import optimize_product, optimize_portfolio
from .compatibility import build_matrix, check_pair

app = FastAPI(title="ReChiplet API", version="0.1.0", description="Multi-Product Chiplet Lifecycle Optimizer")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173","http://127.0.0.1:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


# Lightweight signed bearer-token login for the local prototype. Configure credentials via environment variables.
AUTH_SECRET = os.getenv("RECHIPLET_AUTH_SECRET", "local-dev-secret-change-me")
LOGIN_USERNAME = os.getenv("RECHIPLET_LOGIN_USERNAME", "admin")
LOGIN_PASSWORD = os.getenv("RECHIPLET_LOGIN_PASSWORD", "Rechiplet@123")

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)

def make_token(username: str) -> str:
    payload = json.dumps({"sub": username, "exp": int((datetime.now(timezone.utc) + timedelta(hours=12)).timestamp())}, separators=(",", ":")).encode()
    body = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(AUTH_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + signature

def verify_token(token: str) -> bool:
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(AUTH_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        return payload.get("sub") == LOGIN_USERNAME and int(payload.get("exp", 0)) > int(datetime.now(timezone.utc).timestamp())
    except Exception:
        return False

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    valid_user = hmac.compare_digest(payload.username, LOGIN_USERNAME)
    valid_password = hmac.compare_digest(payload.password, LOGIN_PASSWORD)
    if not (valid_user and valid_password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {"access_token": make_token(payload.username), "token_type": "bearer", "username": payload.username, "expires_in": 43200}

@app.middleware("http")
async def require_login(request: Request, call_next):
    path = request.url.path
    if path == "/api/health" or path == "/api/auth/login" or not path.startswith("/api/"):
        return await call_next(request)
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if not verify_token(token):
        return JSONResponse(status_code=401, content={"detail":"Login required or session expired."})
    return await call_next(request)


# Lightweight SQLite migration for existing local databases.
@app.on_event("startup")
def ensure_interconnect_specs_column():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("chiplets")}
        if "interconnect_specs" not in columns:
            connection.execute(text("ALTER TABLE chiplets ADD COLUMN interconnect_specs JSON NOT NULL DEFAULT '{}'"))

class InterconnectSpecsIn(BaseModel):
    protocol: str = Field(min_length=1, max_length=60)
    protocol_version: str = Field(min_length=1, max_length=30)
    signaling: str = Field(min_length=1, max_length=60)
    lane_count: int = Field(gt=0, le=4096)
    bandwidth_gbps: float = Field(gt=0)
    package_types: list[str] = Field(min_length=1)
    max_reach_mm: float = Field(gt=0)
    voltage_v: float = Field(gt=0, le=10)
    bump_pitch_um: float = Field(gt=0, le=1000)

@app.put("/api/chiplets/{chiplet_id}/interconnect-specs")
def update_interconnect_specs(chiplet_id: int, payload: InterconnectSpecsIn, db: Session=Depends(get_db)):
    chiplet = db.get(Chiplet, chiplet_id)
    if not chiplet:
        raise HTTPException(404, "Chiplet not found.")
    chiplet.interconnect_specs = payload.model_dump()
    db.commit()
    db.refresh(chiplet)
    return {"chiplet_id": chiplet.id, "chiplet_name": chiplet.name, "interconnect_specs": chiplet.interconnect_specs}

@app.get("/api/compatibility/matrix")
def interconnect_compatibility_matrix(db: Session=Depends(get_db)):
    chiplets = db.scalars(select(Chiplet).order_by(Chiplet.id)).all()
    rows = [{"id": c.id, "name": c.name, "category": c.category, "interface": c.interface,
             "interconnect_specs": c.interconnect_specs or {}} for c in chiplets]
    return build_matrix(rows)

@app.get("/api/compatibility/check")
def interconnect_compatibility_check(chiplet_a_id: int, chiplet_b_id: int,
                                     required_bandwidth_gbps: float | None = None,
                                     db: Session=Depends(get_db)):
    if chiplet_a_id == chiplet_b_id:
        raise HTTPException(400, "Choose two different chiplets to check a link.")
    a, b = db.get(Chiplet, chiplet_a_id), db.get(Chiplet, chiplet_b_id)
    if not a or not b:
        raise HTTPException(404, "One or both chiplets were not found.")
    rows = [{"id": c.id, "name": c.name, "interface": c.interface,
             "interconnect_specs": c.interconnect_specs or {}} for c in (a, b)]
    return check_pair(rows[0], rows[1], required_bandwidth_gbps)

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

@app.post("/api/optimize/portfolio")
def run_portfolio_optimization(assumed_nre_per_chiplet_usd: float = 250000.0, db: Session=Depends(get_db)):
    """Optimize all configured products and return three comparable portfolio strategies."""
    ps=db.scalars(select(Product).order_by(Product.id)).all()
    cs=db.scalars(select(Chiplet).order_by(Chiplet.id)).all()
    if not ps:
        raise HTTPException(400, "Add at least one product before running portfolio optimization.")
    if len(cs) < 3:
        raise HTTPException(400, "Add at least three chiplets before running portfolio optimization.")
    products=[{"id":p.id,"name":p.name,"market_segment":p.market_segment,
        "target_performance":p.target_performance,"max_power_w":p.max_power_w,
        "max_area_mm2":p.max_area_mm2,"max_cost_usd":p.max_cost_usd,
        "max_junction_temp_c":p.max_junction_temp_c,"min_yield_pct":p.min_yield_pct,
        "annual_volume":p.annual_volume} for p in ps]
    chiplets=[{"id":c.id,"name":c.name,"category":c.category,"process_node_nm":c.process_node_nm,
        "area_mm2":c.area_mm2,"power_w":c.power_w,"unit_cost_usd":c.unit_cost_usd,
        "performance_score":c.performance_score,"thermal_limit_c":c.thermal_limit_c,
        "interface":c.interface,"interconnect_specs":c.interconnect_specs or {},"maturity":c.maturity} for c in cs]
    result=optimize_portfolio(products,chiplets,max(0.0, assumed_nre_per_chiplet_usd))
    summary={"product_count":len(ps),"chiplet_count":len(cs),"feasible":result["feasible"],
        "message":result["message"],"scenario_count":len(result["scenarios"])}
    run=OptimizationRun(status="completed",strategy="Portfolio NSGA-II",summary=summary,solutions=result["scenarios"])
    db.add(run)
    db.commit()
    db.refresh(run)
    return {"run_id":run.id,**result}


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
