# Import preparation report

## Result

**Ready for Tanseek v6.7+ after the existing migrations are applied.**

### Structural checks

- Sections with `requirement_id`: **100 / 100**
- Section requirement matching same course and term: **100 / 100**
- Broken source references found during preparation: **0**
- Benchmark app-data CSV rows handled by the importer: **1,993**

### Collision protection

The importer does not insert the source numeric IDs into identity columns. It creates/fetches records and keeps in-memory maps from source IDs to real DB IDs.

Namespaced records:

- Department codes: `BM_*`
- Department names: `Benchmark — ...`
- Rooms: building `Benchmark Building`
- Academic term: `Tanseek Benchmark 2027`

### Term lifecycle

The prepared academic term has no End Date. `ends_on` stays NULL until the application End Term flow assigns the final date.

### Accounts

All benchmark identities stay `INVITED`. The import does not create a known/shared password. Existing real SUPER_ADMIN/ADMIN accounts are untouched.

### Benchmark-only files

The 500 unlabelled benchmark requests and the labelled constraint cases are retained in `benchmark_tests/` and are not inserted into production scheduling tables.
