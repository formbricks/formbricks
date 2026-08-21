"""Schemathesis extensions for the v3 API contract tests (ENG-2191).

Two jobs, both generic over the contract rather than per endpoint:

1. Teach Schemathesis the ``cuid2`` string format every v3 identifier declares. Without it an
   unknown format degrades to an arbitrary string — including values like ``""`` or ``"0"`` that
   route somewhere other than the operation under test, producing failures that say nothing about
   the contract.

2. Point identifiers at the seeded data so authenticated endpoints answer with real payloads
   instead of a wall of 401/403s. Substitution is keyed by parameter name and operationId, from the
   map ``db:seed:contract`` writes (``fixtures.json``) — nothing here is registered per test, so a
   newly documented endpoint is exercised the moment it lands in the bundle. An id the map does not
   mention keeps its generated cuid2 and gets the documented 403, which is still a contract check.

Everything runs in ``before_call`` because that is the one place a value always wins: cases derived
from the spec's own examples never reach ``map_query`` / ``map_path_parameters`` with a populated
dict, so overriding there would silently skip exactly the operations that carry examples.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import schemathesis
from hypothesis import strategies as st

FIXTURES_ENV_VAR = "V3_CONTRACT_FIXTURES"
DEFAULT_FIXTURES_PATH = Path(__file__).with_name("fixtures.json")

# cuid2 as the v3 routes validate it (`z.cuid2()` in packages/types/common.ts): lowercase
# alphanumeric. The fixed length keeps generated ids visually distinct from real ones in reports.
CUID2_STRATEGY = st.from_regex(r"\A[a-z][a-z0-9]{23}\Z")

# Any parameter or body field with this name identifies the tenant, on every current and future v3
# operation, so it is substituted globally rather than per operation.
WORKSPACE_FIELD = "workspaceId"


def _load_fixtures() -> dict[str, Any]:
    path = Path(os.environ.get(FIXTURES_ENV_VAR) or DEFAULT_FIXTURES_PATH)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RuntimeError(
            f"Contract fixtures not found at {path}. Run "
            "`pnpm --filter=@formbricks/database db:seed:contract -- --out <path>` first, or point "
            f"{FIXTURES_ENV_VAR} at the file it wrote. Running without it would test an empty "
            "workspace and report a green run that proves nothing."
        ) from exc


_FIXTURES = _load_fixtures()
WORKSPACE_ID: str = _FIXTURES["workspaceId"]
# Defaults keyed by parameter name, used by every operation without a more specific entry.
READ_IDS: dict[str, str] = _FIXTURES.get("read", {})
# Per-operationId overrides: {"deleteSurveyV3": {"path": {...}, "body": {...}}}. Mutating operations
# get their own disposable resource here so a DELETE cannot decide what a GET elsewhere sees.
OPERATION_IDS: dict[str, dict[str, dict[str, str]]] = _FIXTURES.get("operations", {})

schemathesis.openapi.format("cuid2", CUID2_STRATEGY)


def _operation_id(case: Any) -> str | None:
    definition = getattr(case.operation, "definition", None)
    raw = getattr(definition, "raw", None)
    return raw.get("operationId") if isinstance(raw, dict) else None


def _substitute(container: Any, overrides: dict[str, str], defaults: dict[str, str]) -> None:
    """Replace known identifiers in place, leaving unknown fields to the generated data.

    Recursive because identifiers are not always top level: `POST /api/v3/surveys/validate` carries
    the workspace under `data.workspaceId`, and a workflow definition references its trigger survey
    from inside `definition.trigger.config`. Every name handled here means the same thing wherever it
    appears in this API, so descending is safe.
    """
    if isinstance(container, list):
        for item in container:
            _substitute(item, overrides, defaults)
        return

    if not isinstance(container, dict):
        return

    for name, value in container.items():
        if name == WORKSPACE_FIELD:
            container[name] = WORKSPACE_ID
        elif name in overrides:
            container[name] = overrides[name]
        elif name in defaults:
            container[name] = defaults[name]
        else:
            _substitute(value, overrides, defaults)


@schemathesis.hook
def before_call(ctx: Any, case: Any, transport_kwargs: dict[str, Any]) -> None:  # noqa: ARG001
    operation = OPERATION_IDS.get(_operation_id(case) or "", {})

    _substitute(case.path_parameters, operation.get("path", {}), READ_IDS)
    _substitute(case.query, operation.get("query", {}), READ_IDS)
    # Body identifiers are substituted too: `POST /api/v3/surveys` carries its workspaceId in the
    # body, and `POST /api/v3/tags/{tagId}/merge` names the surviving tag there. Read defaults apply
    # so a generated workflow definition points its trigger at a survey that exists.
    _substitute(case.body, operation.get("body", {}), READ_IDS)
