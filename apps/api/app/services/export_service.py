"""Designer export — generate artefacts from ``PipelineConfigurationSchema``."""

from __future__ import annotations

import re

from app.schemas.designer import ExportFormat, ExportRequest, ExportResponse
from app.services.export_generators import (
    generate_docker_compose,
    generate_kubernetes,
    generate_python_code,
    generate_terraform,
    generate_yaml,
)

_CONTENT_TYPES: dict[ExportFormat, str] = {
    "python": "text/x-python",
    "yaml": "application/yaml",
    "terraform": "application/hcl",
    "docker-compose": "application/yaml",
    "k8s": "application/yaml",
}

_EXTENSIONS: dict[ExportFormat, str] = {
    "python": ".py",
    "yaml": ".yaml",
    "terraform": ".tf",
    "docker-compose": ".yml",
    "k8s": ".yaml",
}


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name.lower())
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s or "pipeline"


def _filename_for(config_name: str, fmt: ExportFormat) -> str:
    base = _slugify(config_name)
    if fmt == "terraform":
        return f"{base}-main{_EXTENSIONS[fmt]}"
    if fmt == "docker-compose":
        return "docker-compose.yml"
    if fmt == "k8s":
        return f"{base}-k8s-manifests{_EXTENSIONS[fmt]}"
    return f"{base}{_EXTENSIONS[fmt]}"


class ExportService:
    """Maps pipeline configs to downloadable text artefacts."""

    @staticmethod
    def export(body: ExportRequest) -> ExportResponse:
        cfg = body.config
        fmt = body.format
        if fmt == "python":
            code = generate_python_code(cfg)
        elif fmt == "yaml":
            code = generate_yaml(cfg)
        elif fmt == "terraform":
            code = generate_terraform(cfg)
        elif fmt == "docker-compose":
            code = generate_docker_compose(cfg)
        elif fmt == "k8s":
            code = generate_kubernetes(cfg)
        else:
            raise ValueError(f"unsupported export format: {fmt}")
        return ExportResponse(
            code=code,
            filename=_filename_for(cfg.name, fmt),
            format=fmt,
            content_type=_CONTENT_TYPES[fmt],
        )
