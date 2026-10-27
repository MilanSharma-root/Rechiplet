import random
from deap import base, creator, tools, algorithms

def optimize_product(product: dict, chiplets: list[dict], population_size: int = 64, generations: int = 24):
    if not chiplets:
        return {"feasible": False, "solutions": [], "message": "No chiplets available."}
    if not hasattr(creator, "ReChipletFitness"):
        creator.create("ReChipletFitness", base.Fitness, weights=(-1.0, -1.0, 1.0))
    if not hasattr(creator, "ReChipletIndividual"):
        creator.create("ReChipletIndividual", list, fitness=creator.ReChipletFitness)
    toolbox = base.Toolbox()
    toolbox.register("gene", random.randrange, len(chiplets))
    toolbox.register("individual", tools.initRepeat, creator.ReChipletIndividual, toolbox.gene, n=3)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def evaluate(ind):
        selected = [chiplets[i] for i in ind]
        perf = sum(c["performance_score"] for c in selected)
        power = sum(c["power_w"] for c in selected)
        area = sum(c["area_mm2"] for c in selected)
        cost = sum(c["unit_cost_usd"] for c in selected)
        compute = any(c["category"].lower() in ("compute", "accelerator") for c in selected)
        violations = (0 if compute else 1)
        violations += max(0, power-product["max_power_w"]) / max(product["max_power_w"], 1)
        violations += max(0, area-product["max_area_mm2"]) / max(product["max_area_mm2"], 1)
        violations += max(0, cost-product["max_cost_usd"]) / max(product["max_cost_usd"], 1)
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
            if not ind: ind.append(random.randrange(len(chiplets)))
            del ind.fitness.values
        for ind in offspring:
            ind.fitness.values = toolbox.evaluate(ind)
        pop = toolbox.select(pop + offspring, population_size)
        hof.update(pop)
    result, seen = [], set()
    for ind in list(hof) + pop:
        chosen = [chiplets[i] for i in ind]
        signature = tuple(sorted(c["id"] for c in chosen))
        if signature in seen: continue
        seen.add(signature)
        perf = round(sum(c["performance_score"] for c in chosen), 2)
        power = round(sum(c["power_w"] for c in chosen), 2)
        area = round(sum(c["area_mm2"] for c in chosen), 2)
        cost = round(sum(c["unit_cost_usd"] for c in chosen), 2)
        compute = any(c["category"].lower() in ("compute", "accelerator") for c in chosen)
        feasible = compute and power <= product["max_power_w"] and area <= product["max_area_mm2"] and cost <= product["max_cost_usd"] and perf >= product["target_performance"]
        result.append({"chiplet_ids":[c["id"] for c in chosen], "chiplet_names":[c["name"] for c in chosen],
            "strategy":"reuse" if all(c["maturity"]=="production" for c in chosen) else "modify",
            "estimated_cost_usd":cost,"estimated_power_w":power,"estimated_area_mm2":area,
            "performance_score":perf,"feasible":feasible,"reuse_count":sum(c["maturity"]=="production" for c in chosen)})
    result.sort(key=lambda x:(not x["feasible"],x["estimated_cost_usd"],x["estimated_power_w"]))
    good = [x for x in result if x["feasible"]]
    return {"feasible":bool(good),"solutions":(good or result)[:30],
        "message":f"{len(good)} feasible candidate(s) found." if good else "No feasible candidate found; showing closest candidates.",
        "model_note":"Synthetic early-stage estimates; calibrate engineering models before using for design decisions."}
