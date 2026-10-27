from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class Chiplet(Base):
    __tablename__ = "chiplets"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    process_node_nm: Mapped[int] = mapped_column(Integer)
    area_mm2: Mapped[float] = mapped_column(Float)
    power_w: Mapped[float] = mapped_column(Float)
    unit_cost_usd: Mapped[float] = mapped_column(Float)
    performance_score: Mapped[float] = mapped_column(Float)
    thermal_limit_c: Mapped[float] = mapped_column(Float, default=95)
    interface: Mapped[str] = mapped_column(String(60), default="UCIe")
    maturity: Mapped[str] = mapped_column(String(30), default="production")
    notes: Mapped[str] = mapped_column(Text, default="")

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    market_segment: Mapped[str] = mapped_column(String(80))
    target_performance: Mapped[float] = mapped_column(Float)
    max_power_w: Mapped[float] = mapped_column(Float)
    max_area_mm2: Mapped[float] = mapped_column(Float)
    max_cost_usd: Mapped[float] = mapped_column(Float)
    max_junction_temp_c: Mapped[float] = mapped_column(Float, default=95)
    min_yield_pct: Mapped[float] = mapped_column(Float, default=90)
    annual_volume: Mapped[int] = mapped_column(Integer, default=100000)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class OptimizationRun(Base):
    __tablename__ = "optimization_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[str] = mapped_column(String(30), default="completed")
    strategy: Mapped[str] = mapped_column(String(50), default="NSGA-II")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    summary: Mapped[dict] = mapped_column(JSON, default=dict)
    solutions: Mapped[list] = mapped_column(JSON, default=list)

class PortfolioAssignment(Base):
    __tablename__ = "portfolio_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    chiplet_id: Mapped[int] = mapped_column(ForeignKey("chiplets.id"), index=True)
    strategy: Mapped[str] = mapped_column(String(20), default="reuse")
    reuse_group: Mapped[str] = mapped_column(String(80), default="")
    estimated_nre_usd: Mapped[float] = mapped_column(Float, default=0)
    product = relationship("Product")
    chiplet = relationship("Chiplet")
