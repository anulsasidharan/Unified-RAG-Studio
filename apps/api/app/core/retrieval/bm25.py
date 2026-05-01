"""Okapi BM25 lexical scoring over a tokenised corpus (in-memory).

Used by hybrid retrieval when a caller supplies the same chunk texts that were
indexed, enabling dense + sparse fusion without a separate search engine.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import math
import re

_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


@dataclass
class BM25Index:
    """Lightweight BM25 over pre-tokenised documents."""

    tokenized_docs: list[list[str]]
    k1: float = 1.5
    b: float = 0.75
    _counters: list[Counter[str]] | None = None
    _doc_lens: list[int] | None = None
    _avgdl: float = 0.0
    _N: int = 0
    _idf: dict[str, float] | None = None

    def __post_init__(self) -> None:
        self._N = len(self.tokenized_docs)
        self._counters = [Counter(d) for d in self.tokenized_docs]
        self._doc_lens = [len(d) for d in self.tokenized_docs]
        total = sum(self._doc_lens) if self._doc_lens else 0
        self._avgdl = total / max(self._N, 1)
        df: dict[str, int] = {}
        for c in self._counters:
            for w in c:
                df[w] = df.get(w, 0) + 1
        self._idf = {}
        for w, freq in df.items():
            self._idf[w] = math.log((self._N - freq + 0.5) / (freq + 0.5) + 1.0)

    def scores(self, query: str) -> list[float]:
        """Return BM25 score per document (same order as corpus)."""
        if self._idf is None or self._counters is None or self._doc_lens is None:
            return []
        q_terms = tokenize(query)
        if not q_terms:
            return [0.0] * self._N
        out = [0.0] * self._N
        for i, ctr in enumerate(self._counters):
            dl = self._doc_lens[i]
            denom_norm = self.k1 * (1 - self.b + self.b * dl / max(self._avgdl, 1e-9))
            s = 0.0
            for q in q_terms:
                idf = self._idf.get(q)
                if idf is None:
                    continue
                tf = ctr.get(q, 0)
                if tf == 0:
                    continue
                s += idf * (tf * (self.k1 + 1)) / (tf + denom_norm)
            out[i] = s
        return out

    def top_indices(self, query: str, k: int) -> list[int]:
        scores = self.scores(query)
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
        return ranked[:k]
