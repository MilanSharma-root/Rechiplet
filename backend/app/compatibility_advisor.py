from __future__ import annotations

from typing import Any

from .compatibility import check_pair


def _norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def _candidate_score(source: dict[str, Any], candidate: dict[str, Any], result: dict[str, Any]) -> tuple[float, list[str]]:
    """Explainable heuristic fit score, not an ML probability."""
    a = source.get("interconnect_specs") or {}
    b = candidate.get("interconnect_specs") or {}
    factors: list[tuple[str, float, bool, str]] = [
        ("Interface", 20, bool(source.get("interface") and candidate.get("interface") and _norm(source.get("interface")) == _norm(candidate.get("interface"))), "Interface names match"),
        ("Protocol", 15, bool(a.get("protocol") and b.get("protocol") and _norm(a.get("protocol")) == _norm(b.get("protocol"))), "Protocol matches"),
        ("Protocol version", 10, bool(a.get("protocol_version") and b.get("protocol_version") and _norm(a.get("protocol_version")) == _norm(b.get("protocol_version"))), "Protocol versions match"),
        ("Signaling", 10, bool(a.get("signaling") and b.get("signaling") and _norm(a.get("signaling")) == _norm(b.get("signaling"))), "Signaling modes match"),
        ("Lane count", 10, a.get("lane_count") is not None and b.get("lane_count") is not None and a.get("lane_count") == b.get("lane_count"), "Lane counts match"),
        ("Package", 10, bool(set(map(_norm, a.get("package_types") or [])) & set(map(_norm, b.get("package_types") or []))), "At least one package type is shared"),
        ("Voltage", 10, a.get("voltage_v") is not None and b.get("voltage_v") is not None and abs(float(a["voltage_v"]) - float(b["voltage_v"])) <= 0.05, "Voltage values are within the screening tolerance"),
        ("Bump pitch", 5, a.get("bump_pitch_um") is not None and b.get("bump_pitch_um") is not None and abs(float(a["bump_pitch_um"]) - float(b["bump_pitch_um"])) <= 0.1, "Bump pitch values are within the screening tolerance"),
        ("Reach", 5, a.get("max_reach_mm") is not None and b.get("max_reach_mm") is not None and min(float(a["max_reach_mm"]), float(b["max_reach_mm"])) > 0, "Both chiplets declare positive reach"),
        ("Bandwidth", 5, a.get("bandwidth_gbps") is not None and b.get("bandwidth_gbps") is not None, "Both chiplets declare bandwidth"),
    ]
    known_weight = sum(weight for _, weight, known, _ in factors if known)
    passed_weight = sum(weight for _, weight, known, _ in factors if known and _factor_passed(_, source, candidate, a, b))
    # For the transparent fit score, known failed factors score zero; unknown factors are not silently treated as passing.
    score = round(100 * passed_weight / sum(weight for _, weight, _, _ in factors), 1)
    reasons = [description for _, _, known, description in factors if known and _factor_passed(_, source, candidate, a, b)]
    if result.get("warnings"):
        reasons.append(f"{len(result['warnings'])} specification check(s) need review")
    if result.get("common_bandwidth_gbps") is not None:
        reasons.append(f"Common bandwidth capacity: {result['common_bandwidth_gbps']:g} Gbps")
    return score, reasons


def _factor_passed(label: str, source: dict[str, Any], candidate: dict[str, Any], a: dict[str, Any], b: dict[str, Any]) -> bool:
    if label == "Interface":
        return bool(source.get("interface") and candidate.get("interface") and _norm(source.get("interface")) == _norm(candidate.get("interface")))
    if label in {"Protocol", "Protocol version", "Signaling"}:
        key = {"Protocol": "protocol", "Protocol version": "protocol_version", "Signaling": "signaling"}[label]
        return bool(a.get(key) and b.get(key) and _norm(a.get(key)) == _norm(b.get(key)))
    if label == "Lane count":
        return a.get("lane_count") is not None and b.get("lane_count") is not None and a.get("lane_count") == b.get("lane_count")
    if label == "Package":
        return bool(set(map(_norm, a.get("package_types") or [])) & set(map(_norm, b.get("package_types") or [])))
    if label == "Voltage":
        return a.get("voltage_v") is not None and b.get("voltage_v") is not None and abs(float(a["voltage_v"]) - float(b["voltage_v"])) <= 0.05
    if label == "Bump pitch":
        return a.get("bump_pitch_um") is not None and b.get("bump_pitch_um") is not None and abs(float(a["bump_pitch_um"]) - float(b["bump_pitch_um"])) <= 0.1
    if label == "Reach":
        return a.get("max_reach_mm") is not None and b.get("max_reach_mm") is not None and min(float(a["max_reach_mm"]), float(b["max_reach_mm"])) > 0
    if label == "Bandwidth":
        return a.get("bandwidth_gbps") is not None and b.get("bandwidth_gbps") is not None
    return False


def advise_compatibility(source: dict[str, Any], chiplets: list[dict[str, Any]], required_bandwidth_gbps: float | None = None) -> dict[str, Any]:
    """Rank candidates with explainable rules while preserving hard compatibility failures."""
    recommendations: list[dict[str, Any]] = []
    needs_review: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []

    for candidate in chiplets:
        if candidate.get("id") == source.get("id"):
            continue
        result = check_pair(source, candidate, required_bandwidth_gbps)
        score, reasons = _candidate_score(source, candidate, result)
        item = {
            "chiplet": {"id": candidate.get("id"), "name": candidate.get("name"), "category": candidate.get("category")},
            "status": result["status"],
            "fit_score": score,
            "score_type": "heuristic_fit_not_probability",
            "reasons": reasons,
            "issues": result["issues"],
            "warnings": result["warnings"],
            "common_bandwidth_gbps": result.get("common_bandwidth_gbps"),
            "checks": result.get("checks", {}),
        }
        if result["status"] == "compatible":
            recommendations.append(item)
        elif result["status"] == "insufficient_data":
            needs_review.append(item)
        else:
            rejected.append(item)

    recommendations.sort(key=lambda item: (-item["fit_score"], -(item["common_bandwidth_gbps"] or 0), item["chiplet"]["name"] or ""))
    needs_review.sort(key=lambda item: (-item["fit_score"], item["chiplet"]["name"] or ""))
    rejected.sort(key=lambda item: (item["chiplet"]["name"] or ""))
    return {
        "source_chiplet": {"id": source.get("id"), "name": source.get("name")},
        "required_bandwidth_gbps": required_bandwidth_gbps,
        "recommendations": recommendations,
        "needs_review": needs_review,
        "rejected": rejected,
        "method": "Explainable rule-based hybrid ranking; not a trained ML model and fit_score is not a probability.",
        "safety_note": "Candidates with hard incompatibility findings are never returned as recommendations. 'Needs review' candidates have missing specifications and are not declared compatible. Verify against vendor datasheets and full electrical/package sign-off requirements.",
    }
