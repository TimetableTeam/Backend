# Tanseek realistic benchmark (simulated, anonymized)

This is **not collected university data**. It scales the approved synthetic fixture to several faculties and keeps the same PostgreSQL schema and CSV column names. All identities are invented. The timetable follows Saturday–Wednesday, 09:00–17:00, four 120-minute slots without breaks.

## Run

Keep the `Tanseek_CSV_Data` folder next to Menna's `Tanseek_Menna_Model_Starter.ipynb`. Copy that notebook into this folder and run from the top. The 11 labelled cases in `Tanseek_constraint_cases.csv` must all pass. The notebook's existing example for section 2 will still work. The `benchmark_requests.csv` file holds 500 additional *unlabelled* proposals across the larger dataset. Use them for throughput and distribution, not accuracy.

```python
import time
import pandas as pd
workload = pd.read_csv('benchmark_requests.csv')
start = time.perf_counter()
outputs = [check_allocation(r.term_id, r.section_id, r.requirement_id,
             r.instructor_id, r.room_id, r.weekday, r.starts_at, r.ends_at)
           for r in workload.itertuples(index=False)]
elapsed = time.perf_counter() - start
print(f'{len(outputs)} checks in {elapsed:.3f}s; {elapsed/len(outputs)*1000:.2f} ms/check')
print(pd.Series([x['primary_result'] for x in outputs]).value_counts())
```

To measure schedule quality, use number of placed weekly sessions, hard conflicts, utilization by room/day, and preference satisfaction. These proposals alone do not provide verified optimal schedules. For a real-world evaluation, collect de-identified university exports of sections and groups, required equipment and lab inventories, lecturer availability, closures and a verified published timetable. Obtain permission and strip personal emails/names before sharing.
