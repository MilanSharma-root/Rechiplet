from pydantic import BaseModel, ConfigDict, Field

class ChipletIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str
    process_node_nm: int = Field(gt=0)
    area_mm2: float = Field(gt=0)
    power_w: float = Field(gt=0)
    unit_cost_usd: float = Field(gt=0)
    performance_score: float = Field(gt=0)
    thermal_limit_c: float = Field(default=95, ge=40, le=200)
    interface: str = "UCIe"
    maturity: str = "production"
    notes: str = ""

class ChipletOut(ChipletIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    market_segment: str
    target_performance: float = Field(gt=0)
    max_power_w: float = Field(gt=0)
    max_area_mm2: float = Field(gt=0)
    max_cost_usd: float = Field(gt=0)
    max_junction_temp_c: float = Field(default=95, ge=40, le=200)
    min_yield_pct: float = Field(default=90, ge=0, le=100)
    annual_volume: int = Field(default=100000, gt=0)

class ProductOut(ProductIn):
    id: int
    model_config = ConfigDict(from_attributes=True)
