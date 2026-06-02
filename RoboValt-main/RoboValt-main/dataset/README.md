Dataset schema and usage

This folder contains a synthetic JSONL dataset generator for training an LLM to reproduce the deterministic validators in this project.

Schema (one JSON object per line):

- input: object
  - files: array of file names (strings)
  - file_content: string containing the file or snippet to evaluate
  - what_to_check: short description of the checkpoint
  - logic: string identifier of the validator (e.g., "cycle_comment")

- label: object
  - status: one of "OK", "NOK", "NA"
  - summary: textual explanation or short rationale
  - filesSearched: integer
  - filesFound: integer
  - filesNotFound: integer

Usage:

1. Generate a dataset (default 5000 examples):

```bash
python generate_dataset.py --size 5000 --out train.jsonl
```

2. Inspect a small sample:

```bash
head -n 20 train.jsonl
```

3. Use JSONL for instruction/supervised fine-tuning or conversion to other formats.

Notes:
- This generator creates synthetic examples using simple templates. For best model performance, augment with real examples from your database (see next steps below).
- If you want me to extract real rows from the app database and convert them to the same schema, confirm and provide DB access or allow me to run a local read using the connection string in `Controllers/DataprocessingController.cs`.
