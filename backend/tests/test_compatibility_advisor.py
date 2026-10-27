import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.compatibility_advisor import advise_compatibility


def chiplet(cid, name, **specs):
    return {
        "id": cid,
        "name": name,
        "category": "compute",
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


def test_advisor_ranks_compatible_candidates_and_explains_score():
    source = chiplet(1, "Source")
    strong = chiplet(2, "Strong candidate", bandwidth_gbps=512)
    weaker = chiplet(3, "Lower bandwidth", bandwidth_gbps=128)
    result = advise_compatibility(source, [source, weaker, strong], required_bandwidth_gbps=100)

    assert [item["chiplet"]["id"] for item in result["recommendations"]] == [2, 3]
    assert result["recommendations"][0]["fit_score"] >= result["recommendations"][1]["fit_score"]
    assert result["recommendations"][0]["reasons"]
    assert result["recommendations"][0]["score_type"] == "heuristic_fit_not_probability"


def test_hard_incompatibility_is_never_recommended():
    source = chiplet(1, "Source")
    incompatible = chiplet(2, "Wrong voltage", voltage_v=1.2)
    result = advise_compatibility(source, [source, incompatible])

    assert result["recommendations"] == []
    assert len(result["rejected"]) == 1
    assert result["rejected"][0]["status"] == "incompatible"
    assert any("Voltage mismatch" in issue for issue in result["rejected"][0]["issues"])


def test_missing_specs_go_to_review_not_recommendations():
    source = chiplet(1, "Source")
    unknown = {"id": 2, "name": "Unknown", "category": "io", "interface": "UCIe", "interconnect_specs": {}}
    result = advise_compatibility(source, [source, unknown])

    assert result["recommendations"] == []
    assert len(result["needs_review"]) == 1
    assert result["needs_review"][0]["status"] == "insufficient_data"
    assert result["needs_review"][0]["warnings"]
