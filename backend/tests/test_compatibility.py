import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.compatibility import check_pair, build_matrix


def chiplet(cid, name, **specs):
    return {
        "id": cid,
        "name": name,
        "interface": "UCIe",
        "interconnect_specs": {
            "protocol": "UCIe",
            "protocol_version": "1.1",
            "signaling": "differential",
            "lane_count": 16,
            "bandwidth_gbps": 256,
            "package_types": ["2.5D", "3D"],
            "max_reach_mm": 10,
            "voltage_v": 0.8,
            "bump_pitch_um": 25,
            **specs,
        },
    }


def test_compatible_pair_when_all_required_specs_match():
    result = check_pair(chiplet(1, "Compute"), chiplet(2, "Memory"), required_bandwidth_gbps=200)
    assert result["status"] == "compatible"
    assert result["common_bandwidth_gbps"] == 256
    assert result["issues"] == []
    assert result["warnings"] == []


def test_detects_protocol_lane_voltage_and_package_mismatches():
    a = chiplet(1, "Compute")
    b = chiplet(2, "Memory", protocol="Other", lane_count=8, voltage_v=1.0, package_types=["organic"])
    result = check_pair(a, b)
    assert result["status"] == "incompatible"
    assert any("Protocol mismatch" in issue for issue in result["issues"])
    assert any("Lane-count mismatch" in issue for issue in result["issues"])
    assert any("Voltage mismatch" in issue for issue in result["issues"])
    assert any("No common supported package" in issue for issue in result["issues"])


def test_detects_insufficient_bandwidth():
    result = check_pair(chiplet(1, "Compute", bandwidth_gbps=64), chiplet(2, "Memory"), required_bandwidth_gbps=100)
    assert result["status"] == "incompatible"
    assert any("Insufficient bandwidth" in issue for issue in result["issues"])


def test_missing_specs_are_unknown_not_compatible():
    result = check_pair({"id": 1, "name": "A", "interface": "UCIe", "interconnect_specs": {}},
                        {"id": 2, "name": "B", "interface": "UCIe", "interconnect_specs": {}})
    assert result["status"] == "insufficient_data"
    assert result["warnings"]


def test_matrix_checks_each_unique_pair():
    result = build_matrix([chiplet(1, "A"), chiplet(2, "B"), chiplet(3, "C")])
    assert result["pair_count"] == 3
    assert len(result["pairs"]) == 3
