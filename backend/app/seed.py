from sqlalchemy import select
from .database import Base, engine, SessionLocal
from .models import Chiplet, Product

CHIPLETS = [
 dict(name="Atlas CPU Compute",category="compute",process_node_nm=5,area_mm2=82,power_w=42,unit_cost_usd=118,performance_score=68,thermal_limit_c=95,interface="UCIe",maturity="production",notes="Illustrative general-purpose compute tile."),
 dict(name="Nova AI Accelerator",category="accelerator",process_node_nm=5,area_mm2=96,power_w=58,unit_cost_usd=154,performance_score=92,thermal_limit_c=98,interface="UCIe",maturity="production",notes="Illustrative throughput accelerator."),
 dict(name="Orion CPU Tile",category="compute",process_node_nm=7,area_mm2=105,power_w=50,unit_cost_usd=90,performance_score=52,thermal_limit_c=92,interface="UCIe",maturity="production",notes="Illustrative cost-oriented compute."),
 dict(name="MemBridge HBM Interface",category="memory",process_node_nm=12,area_mm2=34,power_w=12,unit_cost_usd=46,performance_score=18,thermal_limit_c=90,interface="UCIe",maturity="production",notes="Illustrative memory interface tile."),
 dict(name="IO Fabric Tile",category="io",process_node_nm=12,area_mm2=28,power_w=9,unit_cost_usd=28,performance_score=12,thermal_limit_c=90,interface="UCIe",maturity="production",notes="Illustrative connectivity tile."),
 dict(name="Secure Control Tile",category="control",process_node_nm=16,area_mm2=16,power_w=4,unit_cost_usd=12,performance_score=6,thermal_limit_c=85,interface="UCIe",maturity="prototype",notes="Illustrative security/control tile."),
 dict(name="Edge NPU Tile",category="accelerator",process_node_nm=6,area_mm2=42,power_w=18,unit_cost_usd=52,performance_score=35,thermal_limit_c=90,interface="UCIe",maturity="production",notes="Illustrative low-power inference tile."),
 dict(name="Cache Expansion Tile",category="memory",process_node_nm=7,area_mm2=22,power_w=7,unit_cost_usd=24,performance_score=10,thermal_limit_c=88,interface="UCIe",maturity="engineering",notes="Illustrative cache extension."),
]
PRODUCTS = [
 dict(name="Edge AI Module",market_segment="Edge AI",target_performance=35,max_power_w=55,max_area_mm2=130,max_cost_usd=180,max_junction_temp_c=92,min_yield_pct=90,annual_volume=250000),
 dict(name="Cloud Inference Accelerator",market_segment="Data Center",target_performance=80,max_power_w=100,max_area_mm2=230,max_cost_usd=340,max_junction_temp_c=98,min_yield_pct=92,annual_volume=80000),
 dict(name="Efficient Compute SoC",market_segment="Client Computing",target_performance=48,max_power_w=75,max_area_mm2=190,max_cost_usd=240,max_junction_temp_c=95,min_yield_pct=93,annual_volume=400000),
]
def seed():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for row in CHIPLETS:
            if not db.scalar(select(Chiplet).where(Chiplet.name==row["name"])): db.add(Chiplet(**row))
        for row in PRODUCTS:
            if not db.scalar(select(Product).where(Product.name==row["name"])): db.add(Product(**row))
        db.commit()
if __name__ == "__main__":
    seed()
    print("Sample chiplets and products seeded.")
