import random
from collections import Counter
from deap import base, creator, tools, algorithms

MODEL_NOTE = (
    "Synthetic early-stage estimates. Thermal coupling, die-to-die bandwidth, packaging, yield, "
    "NRE and lifecycle economics need calibrated engineering models before design sign-off."
)

def optimize_product(product: dict, chiplets: list[dict], population_size: int = 64, generations: int = 24):
    if not chiplets:
        return {"feasible": False, "solutions": [], "message": "No chiplets available.", "model_note": MODEL_NOTE}
    if len(chiplets) < 3:
        return {"feasible": False, "solutions": [], "message": "At least three chiplets are required for this starter optimizer.", "model_note": MODEL_NOTE}
    if not hasattr(creator, "ReChipletFitness"):
        creator.create("ReChipletFitness", base.Fitness, weights=(-1.0, -1.0, 1.0))
    if not hasattr(creator, "ReChipletIndividual"):
        creator.create("ReChipletIndividual", list, fitness=creator.ReChipletFitness)
    toolbox = base.Toolbox()
    toolbox.register("gene", random.randrange, len(chiplets))
    toolbox.register("individual", tools.initRepeat, creator.ReChipletIndividual, toolbox.gene, n=3)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def evaluate(ind):
        # Repeated chiplet IDs do not represent a useful three-tile architecture.
        if len(set(ind)) != len(ind):
            return 1_000_000_000, 1_000_000_000, -1_000_000_000
        selected = [chiplets[i] for i in ind]
        perf = sum(c["performance_score"] for c in selected)
        power = sum(c["power_w"] for c in selected)
        area = sum(c["area_mm2"] for c in selected)
        cost = sum(c["unit_cost_usd"] for c in selected)
        compute = any(c["category"].lower() in ("compute", "accelerator") for c in selected)
        interface_compatible = len({c["interface"] for c in selected}) == 1
        violations = (0 if compute else 1) + (0 if interface_compatible else 1)
        violations += max(0, power-product["max_power_w"]) / max(product["max_power_w"], 1)
        violations += max(0, area-product["max_area_mm2"]) / max(product["max_area_mm2"], 1)
        violations += max(0, cost-product["max_cost_usd"]) / max(product["max_cost_usd"], 1)
        violations += max(0, product["target_performance"]-perf) / max(product["target_performance"], 1)
        penalty = violations * 1_000_000
        return cost+penalty, power+penalty, perf-penalty

    toolbox.register("evaluate", evaluate)
    toolbox.register("mate", tools.cxTwoPoint)
    toolbox.register("mutate", tools.mutUniformInt, low=0, up=len(chiplets)-1, indpb=0.25)
    toolbox.register("select", tools.selNSGA2)
    random.seed(42)
    pop = toolbox.population(n=population_size)
    for ind in pop:
        ind.fitness.values = toolbox.evaluate(ind)
    pop = toolbox.select(pop, len(pop))
    hof = tools.ParetoFront()
    for _ in range(generations):
        offspring = algorithms.varAnd(pop, toolbox, cxpb=0.65, mutpb=0.3)
        for ind in offspring:
            if not ind or len(set(ind)) != len(ind):
                ind[:] = random.sample(range(len(chiplets)), 3)
            if ind.fitness.valid:
                del ind.fitness.values
        for ind in offspring:
            ind.fitness.values = toolbox.evaluate(ind)
        pop = toolbox.select(pop + offspring, population_size)
        hof.update(pop)
    result, seen = [], set()
    for ind in list(hof) + pop:
        if len(set(ind)) != len(ind):
            continue
        chosen = [chiplets[i] for i in ind]
        signature = tuple(sorted(c["id"] for c in chosen))
        if signature in seen: continue
        seen.add(signature)
        perf = round(sum(c["performance_score"] for c in chosen), 2)
        power = round(sum(c["power_w"] for c in chosen), 2)
        area = round(sum(c["area_mm2"] for c in chosen), 2)
        cost = round(sum(c["unit_cost_usd"] for c in chosen), 2)
        compute = any(c["category"].lower() in ("compute", "accelerator") for c in chosen)
        interface_compatible = len({c["interface"] for c in chosen}) == 1
        feasible = compute and interface_compatible and power <= product["max_power_w"] and area <= product["max_area_mm2"] and cost <= product["max_cost_usd"] and perf >= product["target_performance"]
        result.append({"chiplet_ids":[c["id"] for c in chosen], "chiplet_names":[c["name"] for c in chosen],
            "strategy":"reuse" if all(c["maturity"]=="production" for c in chosen) else "modify",
            "estimated_cost_usd":cost,"estimated_power_w":power,"estimated_area_mm2":area,
            "performance_score":perf,"feasible":feasible,"interface_compatible":interface_compatible,"reuse_count":sum(c["maturity"]=="production" for c in chosen)})
    result.sort(key=lambda x:(not x["feasible"],x["estimated_cost_usd"],x["estimated_power_w"]))
    good = [x for x in result if x["feasible"]]
    return {"feasible":bool(good),"solutions":(good or result)[:30],
        "message":f"{len(good)} feasible candidate(s) found." if good else "No feasible candidate found; showing closest candidates.",
        "model_note":MODEL_NOTE}

def optimize_portfolio(products: list[dict], chiplets: list[dict]):
    """Run the NSGA-II product search for every product, then compare portfolio-wide scenarios."""
    if not products:
        return {"feasible": False, "scenarios": [], "message": "No products are configured.", "model_note": MODEL_NOTE}
    if len(chiplets) < 3:
        return {"feasible": False, "scenarios": [], "message": "At least three chiplets are required.", "model_note": MODEL_NOTE}

    per_product = []
    for product in products:
        result = optimize_product(product, chiplets)
        candidates = result["solutions"]
        if not candidates:
            per_product.append({"product": product, "candidates": [], "feasible": False, "message": result["message"]})
            continue
        feasible_candidates = [c for c in candidates if c["feasible"]]
        per_product.append({"product": product, "candidates": feasible_candidates or candidates,
                            "feasible": bool(feasible_candidates), "message": result["message"]})

    def pick(item, scenario):
        candidates = item["candidates"]
        if not candidates:
            return None
        p = item["product"]
        if scenario == "lowest_cost":
            return min(candidates, key=lambda c: (not c["feasible"], c["estimated_cost_usd"], c["estimated_power_w"]))
        if scenario == "highest_performance":
            return max(candidates, key=lambda c: (c["feasible"], c["performance_score"], -c["estimated_cost_usd"]))
        # Normalized weighted score: lower cost/power/area, while meeting target performance.
        def score(c):
            cost = c["estimated_cost_usd"] / max(p["max_cost_usd"], 1)
            power = c["estimated_power_w"] / max(p["max_power_w"], 1)
            area = c["estimated_area_mm2"] / max(p["max_area_mm2"], 1)
            performance = min(c["performance_score"] / max(p["target_performance"], 1), 1.5)
            return (not c["feasible"], 0.40*cost + 0.30*power + 0.15*area - 0.15*performance)
        return min(candidates, key=score)

    definitions = [
        ("lowest_cost", "Lowest Cost", "Minimize portfolio bill-of-material estimates while respecting each product's constraints where feasible."),
        ("balanced", "Balanced Portfolio", "Balance cost, power, area and performance across all products."),
        ("highest_performance", "Highest Performance", "Prefer the highest-performing feasible architecture for each product; cost may be higher.")
    ]
    scenarios = []
    for key, label, description in definitions:
        architectures = []
        usage = Counter()
        total_cost = total_power = total_area = 0.0
        feasible_count = 0
        for item in per_product:
            p = item["product"]
            candidate = pick(item, key)
            if candidate is None:
                architectures.append({"product_id": p["id"], "product_name": p["name"], "market_segment": p["market_segment"], "feasible": False, "message": item["message"], "solution": None})
                continue
            architectures.append({"product_id": p["id"], "product_name": p["name"], "market_segment": p["market_segment"], "feasible": candidate["feasible"], "solution": candidate})
            total_cost += candidate["estimated_cost_usd"]
            total_power += candidate["estimated_power_w"]
            total_area += candidate["estimated_area_mm2"]
            feasible_count += int(candidate["feasible"])
            for cid in set(candidate["chiplet_ids"]):
                usage[cid] += 1
        shared_ids = {cid for cid, count in usage.items() if count > 1}
        shared = [{"chiplet_id": c["id"], "chiplet_name": c["name"], "product_count": usage[c["id"]], "products": [a["product_name"] for a in architectures if a.get("solution") and c["id"] in a["solution"]["chiplet_ids"]]} for c in chiplets if c["id"] in shared_ids]
        scenarios.append({
            "key": key, "label": label, "description": description, "architectures": architectures,
            "summary": {"product_count": len(products), "feasible_product_count": feasible_count,
                "total_estimated_cost_usd": round(total_cost, 2), "total_estimated_power_w": round(total_power, 2),
                "total_estimated_area_mm2": round(total_area, 2), "shared_chiplet_count": len(shared)},
            "shared_chiplets": shared
        })
    return {"feasible": all(s["summary"]["feasible_product_count"] == len(products) for s in scenarios),
        "scenarios": scenarios,
        "message": f"Evaluated {len(products)} products across {len(scenarios)} portfolio strategies.",
        "model_note": MODEL_NOTE}
