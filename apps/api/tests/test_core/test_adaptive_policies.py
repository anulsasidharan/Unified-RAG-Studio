from __future__ import annotations

from app.core.adaptive_policies import evaluate_adaptive_policies
from app.schemas.pipeline import AdaptivePolicyRuleSchema


def test_word_count_predicate() -> None:
    rules = [
        AdaptivePolicyRuleSchema(predicate="query_word_count_gt:3", action="use_larger_model"),
    ]
    assert evaluate_adaptive_policies(rules, query="one two three four") == ["use_larger_model"]
    assert evaluate_adaptive_policies(rules, query="a b") == []


def test_always_predicate() -> None:
    rules = [AdaptivePolicyRuleSchema(predicate="always", action="log_trace")]
    assert evaluate_adaptive_policies(rules, query="x") == ["log_trace"]
