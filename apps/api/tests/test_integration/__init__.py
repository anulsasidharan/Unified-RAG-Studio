"""Cross-service backend integration tests (P10-2).

Run against PostgreSQL (+ Redis/Qdrant) in CI (`tests.yml` integration job).
Locally defaults follow root ``tests/conftest.py`` (SQLite) unless DATABASE_URL overrides.
"""
