#!/usr/bin/env python3
"""
Synthetic dataset generator for robot program validation.
Generates a JSONL file where each line is a training example:
{
  "input": { "files": ["FILENAME"], "file_content": "...", "what_to_check": "...", "logic": "..." },
  "label": { "status": "OK|NOK|NA", "summary": "explanation...", "filesSearched": 1, "filesFound": 1, "filesNotFound": 0 }
}

Run:
  python generate_dataset.py --size 5000 --out train.jsonl
"""
import argparse
import json
import random
import textwrap

VALIDATORS = [
    "cycle_comment",
    "cycle_call",
    "cycle_call_inst",
    "cycle_starts_ends",
    "present_order",
    "payload_comment",
    "present_common",
    "plc_zone_count",
    "plc_zone_cycle",
    "pr_trajectory_comment"
]

SUMMARY_TEMPLATES = {
    "OK": [
        "Found required patterns; no conflicts detected.",
        "All cycles present and unique; checks passed.",
        "Expected sequence and comments are present."
    ],
    "NOK": [
        "Missing required comment or label on cycle.",
        "Duplicate zone numbers found within the same cycle.",
        "CALL target missing or incorrect order detected."
    ],
    "NA": [
        "No applicable files were found to perform this check.",
        "The file content does not include relevant constructs; skipping.",
        "Not applicable for this program type."
    ]
}

FILE_TEMPLATES = {
    "cycle_comment": [
        "LBL[01] ; CYCLE_START\nMOVE LBL[01] ; some code\nLBL[01:Check] ; comment present",
        "LBL[01]\nMOVE LBL[02]\n-- no comment present here"
    ],
    "cycle_call": [
        "CALL Traj123\n...\nCALL Traj123",
        "CALL Traj1\n...\n-- missing call target"
    ],
    "cycle_call_inst": [
        "CALL_PRG('PROG', 'NAME', 5)\n...",
        "CALL_PRG('PROG','NAME',5)\nCALL_PRG('PROG','NAME',5)"
    ],
    "cycle_starts_ends": [
        "LBL[01] ; start\n...\nLBL[02] ; end",
        "LBL[01]\n...\n-- missing end label"
    ],
    "present_order": [
        "PR[1: X ]\nPR[2: Y ]\nPR[3: Z ]",
        "PR[2: Y ]\nPR[1: X ]\n-- wrong order"
    ],
    "payload_comment": [
        "; PAYLOAD OK\nSET PAYLOAD, 10",
        "SET PAYLOAD, 10\n-- missing payload comment"
    ],
    "present_common": [
        "PRESENT ON\n...",
        "-- no PRESENT instruction here"
    ],
    "plc_zone_count": [
        "ZON_IN(1)\nZON_IN(2)\nZON_IN(3)",
        "ZON_IN(1)\nZON_IN(1)\n-- duplicate zone number"
    ],
    "plc_zone_cycle": [
        "LBL[01]\nZON_IN(1)\nLBL[02]\nZON_IN(2)",
        "LBL[01]\nZON_IN(1)\nZON_IN(01)\n-- duplicate within cycle"
    ],
    "pr_trajectory_comment": [
        "PR[1: Move to start]\nTRAJ 1\n-- comment ok",
        "PR[1:]\nTRAJ 1\n-- empty PR comment"
    ]
}


def choose_status(validator, file_content):
    # Simple heuristics to choose OK/NOK/NA for synthetic labeling
    if "--" in file_content:
        return "NOK"
    if "missing" in file_content.lower():
        return "NOK"
    if "no " in file_content.lower() or "-- no" in file_content.lower():
        return "NA"
    return "OK"


def make_example(validator):
    file_content = random.choice(FILE_TEMPLATES.get(validator, ["-- no data"]))
    status = choose_status(validator, file_content)
    summary = random.choice(SUMMARY_TEMPLATES[status])

    example = {
        "input": {
            "files": [f"{validator}_example_{random.randint(1,9999)}.LS"],
            "file_content": file_content,
            "what_to_check": "" if validator == "present_common" else "check for specific pattern",
            "logic": validator
        },
        "label": {
            "status": status,
            "summary": summary,
            "filesSearched": 1,
            "filesFound": 1 if status != "NA" else 0,
            "filesNotFound": 0 if status != "NA" else 1
        }
    }
    return example


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic JSONL dataset for robot validation")
    parser.add_argument("--size", type=int, default=5000, help="Number of examples to generate")
    parser.add_argument("--out", type=str, default="train.jsonl", help="Output JSONL file path")
    args = parser.parse_args()

    size = max(1, args.size)
    per_validator = max(1, size // len(VALIDATORS))

    with open(args.out, "w", encoding="utf-8") as f:
        count = 0
        for v in VALIDATORS:
            for _ in range(per_validator):
                ex = make_example(v)
                f.write(json.dumps(ex, ensure_ascii=False) + "\n")
                count += 1

        # If there is remainder, fill with random validators
        while count < size:
            v = random.choice(VALIDATORS)
            ex = make_example(v)
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")
            count += 1

    print(f"Wrote {count} examples to {args.out}")


if __name__ == "__main__":
    main()
