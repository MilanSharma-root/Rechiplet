from __future__ import annotations

from typing import Any

KNOWN_PROTOCOLS = {"ucie", "infinity fabric", "infinity-fabric", "bunch of wires", "boW", "proprietary"}

def check_pair(a: dict[str, Any], b: dict[str, Any], required_bandwidth_gbps: float | None = None) -> dict[str, Any]:
    """Early-stage compatibility screening; missing fields are unknown, never assumed compatible."""
    issues: list[str] = []
    warnings: list[str] = []
    sa = a.get("interconnect_specs") or {}
    sb = b.get("interconnect_specs") or {}
    iface_a = str(a.get("interface") or "").strip().lower()
    iface_b = str(b.get("interface") or "").strip().lower()
    if not iface_a or not iface_b:
        warnings.append("Interface name missing on one or both chiplets")
    elif iface_a != iface_b:
        issues.append(f"Interface mismatch: {a.get('interface')} vs {b.get('interface')}")

    for key, label in (("protocol", "Protocol"), ("protocol_version", "Protocol version"), ("signaling", "Signaling mode")):
        va, vb = str(sa.get(key) or "").strip().lower(), str(sb.get(key) or "").strip().lower()
        if va and vb and va != vb:
            issues.append(f"{label} mismatch: {sa.get(key)} vs {sb.get(key)}")
        elif not va or not vb:
            warnings.append(f"{label} cannot be verified (missing specification)")

    lanes_a, lanes_b = sa.get("lane_count"), sb.get("lane_count")
    if lanes_a is not None and lanes_b is not None:
        if int(lanes_a) != int(lanes_b):
            issues.append(f"Lane-count mismatch: {lanes_a} vs {lanes_b}")
    else:
        warnings.append("Lane-count compatibility unknown")

    bw_a, bw_b = sa.get("bandwidth_gbps"), sb.get("bandwidth_gbps")
    if bw_a is not None and bw_b is not None:
        common_bw = min(float(bw_a), float(bw_b))
        if required_bandwidth_gbps is not None and common_bw < required_bandwidth_gbps:
            issues.append(f"Insufficient bandwidth: common capacity {common_bw:g} Gbps, required {required_bandwidth_gbps:g} Gbps")
    else:
        common_bw = None
        warnings.append("Bandwidth capacity cannot be verified")
    if required_bandwidth_gbps is not None and required_bandwidth_gbps <= 0:
        issues.append("Required bandwidth must be greater than zero")

    pkg_a = {str(x).strip().lower() for x in (sa.get("package_types") or [])}
    pkg_b = {str(x).strip().lower() for x in (sb.get("package_types") or [])}
    if pkg_a and pkg_b:
        if not pkg_a.intersection(pkg_b):
            issues.append("No common supported package type")
    else:
        warnings.append("Package compatibility unknown (package types missing)")

    voltage_a, voltage_b = sa.get("voltage_v"), sb.get("voltage_v")
    if voltage_a is not None and voltage_b is not None:
        if abs(float(voltage_a) - float(voltage_b)) > 0.05:
            issues.append(f"Voltage mismatch: {voltage_a} V vs {voltage_b} V")
    else:
        warnings.append("Voltage compatibility unknown")
    pitch_a, pitch_b = sa.get("bump_pitch_um"), sb.get("bump_pitch_um")
    if pitch_a is not None and pitch_b is not None and abs(float(pitch_a)-float(pitch_b)) > 0.1:
        issues.append(f"Bump-pitch mismatch: {pitch_a} µm vs {pitch_b} µm")
    elif pitch_a is None or pitch_b is None:
        warnings.append("Bump-pitch compatibility unknown")
    reach_a, reach_b = sa.get("max_reach_mm"), sb.get("max_reach_mm")
    if reach_a is not None and reach_b is not None and min(float(reach_a), float(reach_b)) <= 0:
        issues.append("Maximum supported interconnect reach must be positive")
    elif reach_a is None or reach_b is None:
        warnings.append("Interconnect reach not specified")

    status = "incompatible" if issues else ("insufficient_data" if warnings else "compatible")
    return {
        "chiplet_a": {"id": a.get("id"), "name": a.get("name")},
        "chiplet_b": {"id": b.get("id"), "name": b.get("name")},
        "status": status,
        "common_bandwidth_gbps": common_bw,
        "required_bandwidth_gbps": required_bandwidth_gbps,
        "issues": issues,
        "warnings": warnings,
        "checks": {
            "interface": "fail" if any("Interface mismatch" in x for x in issues) else ("unknown" if not iface_a or not iface_b else "pass"),
            "protocol": "fail" if any("Protocol mismatch" in x or "Protocol version mismatch" in x for x in issues) else ("unknown" if not sa.get("protocol") or not sb.get("protocol") else "pass"),
            "lanes": "fail" if any("Lane-count mismatch" in x for x in issues) else ("unknown" if lanes_a is None or lanes_b is None else "pass"),
            "bandwidth": "fail" if any("Insufficient bandwidth" in x for x in issues) else ("unknown" if bw_a is None or bw_b is None else "pass"),
            "package": "fail" if any("No common supported package" in x for x in issues) else ("unknown" if not pkg_a or not pkg_b else "pass"),
            "electrical": "fail" if any("Voltage mismatch" in x or "Bump-pitch mismatch" in x for x in issues) else ("unknown" if voltage_a is None or voltage_b is None or pitch_a is None or pitch_b is None else "pass"),
        },
        "disclaimer": "Early-stage screening only; verify against vendor datasheets, PHY/controller requirements, package design rules, SI/PI and thermal analysis before sign-off."
    }

def build_matrix(chiplets: list[dict]) -> dict[str, Any]:
    pairs = []
    for i, a in enumerate(chiplets):
        for b in chiplets[i+1:]:
            pairs.append(check_pair(a, b))
    counts = {key: sum(1 for p in pairs if p["status"] == key) for key in ("compatible", "incompatible", "insufficient_data")}
    return {"chiplet_count": len(chiplets), "pair_count": len(pairs), "summary": counts, "pairs": pairs}
