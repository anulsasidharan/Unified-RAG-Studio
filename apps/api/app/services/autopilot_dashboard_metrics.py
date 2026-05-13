"""Extract a typed metrics snapshot from persisted Autopilot orchestrator JSON (P7-5)."""

from __future__ import annotations

from typing import Any


def extract_dashboard_metrics(result: dict[str, Any] | None) -> dict[str, Any] | None:
    """Build a dict compatible with ``AutopilotDashboardMetricsSchema`` from ``AutopilotBuild.result``."""  # noqa: E501

    if not result or not isinstance(result, dict):
        return None
    so = result.get("stage_outputs")
    if not isinstance(so, dict):
        return None

    bundle: dict[str, Any] = {}

    ev = so.get("evaluation")
    if isinstance(ev, dict):
        m = ev.get("metrics")
        if isinstance(m, dict):
            quality: dict[str, Any] = {}
            for key in (
                "faithfulness",
                "answer_relevance",
                "context_precision",
                "context_recall",
                "avg_latency_ms",
            ):
                v = m.get(key)
                if isinstance(v, int | float):
                    quality[key] = float(v)
            if isinstance(ev.get("meets_targets"), bool):
                quality["meets_targets"] = ev["meets_targets"]
            if quality:
                bundle["quality"] = quality

    emb = so.get("embedding")
    benches: list[dict[str, Any]] = []
    if isinstance(emb, dict):
        rows = emb.get("candidates_tried")
        if isinstance(rows, list):
            for r in rows:
                if not isinstance(r, dict) or r.get("error"):
                    continue
                prov = str(r.get("provider") or "").strip()
                mod = str(r.get("model") or "").strip()
                label = f"{prov}/{mod}".strip("/") or mod or "unknown"
                row_out: dict[str, Any] = {"label": label}
                if isinstance(r.get("avg_latency_ms"), int | float):
                    row_out["latency_ms"] = float(r["avg_latency_ms"])
                if isinstance(r.get("composite_score"), int | float):
                    row_out["composite_score"] = float(r["composite_score"])
                if isinstance(r.get("texts_per_second"), int | float):
                    row_out["texts_per_second"] = float(r["texts_per_second"])
                benches.append(row_out)
        if benches:
            bundle["embedding_benchmarks"] = benches
        sel = emb.get("selected")
        if isinstance(sel, dict):
            p, m = str(sel.get("provider") or "").strip(), str(sel.get("model") or "").strip()
            lab = f"{p}/{m}".strip("/")
            if lab:
                bundle["selected_embedding_label"] = lab

    ret = so.get("retrieval")
    if isinstance(ret, dict):
        sel = ret.get("selected")
        perf = ret.get("performance")
        if isinstance(sel, dict):
            summ: dict[str, Any] = {}
            st = sel.get("strategy")
            if isinstance(st, str):
                summ["strategy"] = st
            tk = sel.get("top_k")
            if isinstance(tk, int | float):
                summ["top_k"] = int(tk)
            if isinstance(perf, dict):
                perf_map: dict[str, float] = {}
                for pk, pv in perf.items():
                    if isinstance(pk, str) and isinstance(pv, int | float):
                        perf_map[pk] = float(pv)
                if perf_map:
                    summ["performance"] = perf_map
            if summ:
                bundle["retrieval"] = summ

    return bundle or None
