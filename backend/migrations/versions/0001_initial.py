from alembic import op
import sqlalchemy as sa
revision="0001_initial"
down_revision=None
branch_labels=None
depends_on=None
def upgrade():
    op.create_table("chiplets",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("name",sa.String(120),nullable=False),sa.Column("category",sa.String(40),nullable=False),sa.Column("process_node_nm",sa.Integer(),nullable=False),sa.Column("area_mm2",sa.Float(),nullable=False),sa.Column("power_w",sa.Float(),nullable=False),sa.Column("unit_cost_usd",sa.Float(),nullable=False),sa.Column("performance_score",sa.Float(),nullable=False),sa.Column("thermal_limit_c",sa.Float(),nullable=False),sa.Column("interface",sa.String(60),nullable=False),sa.Column("maturity",sa.String(30),nullable=False),sa.Column("notes",sa.Text(),nullable=False))
    op.create_index("ix_chiplets_name","chiplets",["name"],unique=True); op.create_index("ix_chiplets_category","chiplets",["category"])
    op.create_table("products",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("name",sa.String(120),nullable=False),sa.Column("market_segment",sa.String(80),nullable=False),sa.Column("target_performance",sa.Float(),nullable=False),sa.Column("max_power_w",sa.Float(),nullable=False),sa.Column("max_area_mm2",sa.Float(),nullable=False),sa.Column("max_cost_usd",sa.Float(),nullable=False),sa.Column("max_junction_temp_c",sa.Float(),nullable=False),sa.Column("min_yield_pct",sa.Float(),nullable=False),sa.Column("annual_volume",sa.Integer(),nullable=False),sa.Column("created_at",sa.DateTime(),nullable=False))
    op.create_index("ix_products_name","products",["name"],unique=True)
    op.create_table("optimization_runs",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("status",sa.String(30),nullable=False),sa.Column("strategy",sa.String(50),nullable=False),sa.Column("created_at",sa.DateTime(),nullable=False),sa.Column("summary",sa.JSON(),nullable=False),sa.Column("solutions",sa.JSON(),nullable=False))
    op.create_table("portfolio_assignments",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("product_id",sa.Integer(),sa.ForeignKey("products.id"),nullable=False),sa.Column("chiplet_id",sa.Integer(),sa.ForeignKey("chiplets.id"),nullable=False),sa.Column("strategy",sa.String(20),nullable=False),sa.Column("reuse_group",sa.String(80),nullable=False),sa.Column("estimated_nre_usd",sa.Float(),nullable=False))
    op.create_index("ix_portfolio_assignments_product_id","portfolio_assignments",["product_id"]); op.create_index("ix_portfolio_assignments_chiplet_id","portfolio_assignments",["chiplet_id"])
def downgrade():
    op.drop_table("portfolio_assignments"); op.drop_table("optimization_runs"); op.drop_index("ix_products_name",table_name="products"); op.drop_table("products"); op.drop_index("ix_chiplets_category",table_name="chiplets"); op.drop_index("ix_chiplets_name",table_name="chiplets"); op.drop_table("chiplets")
