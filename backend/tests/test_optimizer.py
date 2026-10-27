import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.optimizer import optimize_product, optimize_portfolio


def sample_chiplets():
    return [
        {"id": 1, "name": "Compute A", "category": "compute", "process_node_nm": 5, "area_mm2": 20, "power_w": 15, "unit_cost_usd": 40, "performance_score": 45, "thermal_limit_c": 95, "interface": "UCIe", "maturity": "production"},
        {"id": 2, "name": "Memory A", "category": "memory", "process_node_nm": 7, "area_mm2": 12, "power_w": 8, "unit_cost_usd": 20, "performance_score": 20, "thermal_limit_c": 90, "interface": "UCIe", "maturity": "production"},
        {"id": 3, "name": "I/O A", "category": "io", "process_node_nm": 12, "area_mm2": 10, "power_w": 5, "unit_cost_usd": 15, "performance_score": 12, "thermal_limit_c": 85, "interface": "UCIe", "maturity": "production"},
        {"id": 4, "name": "Compute B", "category": "accelerator", "process_node_nm": 4, "area_mm2": 30, "power_w": 25, "unit_cost_usd": 65, "performance_score": 70, "thermal_limit_c": 100, "interface": "UCIe", "maturity": "prototype"},
        {"id": 5, "name": "Memory B", "category": "memory", "process_node_nm": 5, "area_mm2": 18, "power_w": 12, "unit_cost_usd": 35, "performance_score": 35, "thermal_limit_c": 95, "interface": "UCIe", "maturity": "production"},
    ]


def sample_product():
    return {
        "id": 1, "name": "Test SoC", "market_segment": "Edge AI",
        "target_performance": 60, "max_power_w": 70, "max_area_mm2": 100,
        "max_cost_usd": 200, "max_junction_temp_c": 95,
        "min_yield_pct": 90, "annual_volume": 10000,
    }


def test_product_optimizer_returns_unique_architectures():
    result = optimize_product(sample_product(), sample_chiplets(), population_size=20, generations=3)
    assert result["solutions"]
    for solution in result["solutions"]:
        assert len(solution["chiplet_ids"]) == 3
        assert len(set(solution["chiplet_ids"])) == 3
        assert solution["estimated_cost_usd"] > 0
        assert solution["estimated_power_w"] > 0
        assert isinstance(solution["feasible"], bool)


def test_portfolio_returns_three_named_strategies():
    result = optimize_portfolio([sample_product()], sample_chiplets())
    assert len(result["scenarios"]) == 3
    assert [s["key"] for s in result["scenarios"]] == ["lowest_cost", "balanced", "highest_performance"]
    for scenario in result["scenarios"]:
        assert scenario["summary"]["product_count"] == 1
        assert len(scenario["architectures"]) == 1
        assert scenario["architectures"][0]["solution"] is not None


def test_portfolio_handles_no_products():
    result = optimize_portfolio([], sample_chiplets())
    assert result["feasible"] is False
    assert result["scenarios"] == []


def test_optimizer_rejects_too_few_chiplets():
    result = optimize_product(sample_product(), sample_chiplets()[:2])
    assert result["feasible"] is False
    assert result["solutions"] == []

def test_portfolio_quantifies_reuse_nre_savings():
    first = sample_product()
    second = {**sample_product(), "id": 2, "name": "Second SoC"}
    result = optimize_portfolio([first, second], sample_chiplets(), assumed_nre_per_chiplet_usd=1000)
    assert len(result["scenarios"]) == 3
    for scenario in result["scenarios"]:
        summary = scenario["summary"]
        assert summary["estimated_nre_savings_usd"] == summary["reuse_events"] * 1000
        assert summary["shared_chiplet_count"] == len(scenario["shared_chiplets"])
        for chiplet in scenario["shared_chiplets"]:
            assert chiplet["product_count"] >= 2
            assert chiplet["reuse_events"] == chiplet["product_count"] - 1
            assert chiplet["estimated_nre_avoided_usd"] == chiplet["reuse_events"] * 1000

