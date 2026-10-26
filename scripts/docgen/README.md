# scripts/docgen — API documentation generator

Generates the three API documents from one endpoint catalogue so they cannot drift apart:

| Output | Produced by | Inputs |
|---|---|---|
| `docs/04-backend-api/openapi.yaml` | `gen.py` | `endpoints.py`, `schemas.py`, `examples.py`, `errors.py` |
| `docs/04-backend-api/API_DOCUMENTATION.md` | `gen.py` (writes `frag/*.md`) then `assemble.py` | `api_doc_template.md` + `frag/endpoints.md`, `frag/errors.md`, `frag/ratelimits.md`, `frag/index.md` |
| `docs/04-backend-api/AUTH_AUTHORIZATION.md` | `authz.py` | `auth_template.md` + endpoint × role matrix (`frag/authz_matrix.md`) |

**Never edit the three output files by hand** — edit the sources here and regenerate. Prose that is not endpoint-specific lives in the two `*_template.md` files (`{{ENDPOINTS}}`, `{{ERRORS}}`, `{{RATELIMITS}}`, `{{INDEX}}`, `{{MATRIX}}`, `{{COUNT}}` are placeholders).

## Source files

- `endpoints.py` — the catalogue: one `ep(method, path, tag, summary, ...)` call per operation (permission, MFA/step-up flags, rate-limit class, query params, request/response schema names and examples, endpoint-specific error codes).
- `schemas.py` — JSON Schemas for `components/schemas` (enums, objects, `Paginated*` wrappers).
- `examples.py` — shared example objects (ids, users, datasets, payouts …).
- `errors.py` — error-code catalogue `code → (HTTP status, message, when raised)`.
- `gen.py` — builds the OpenAPI document, common errors per endpoint, rate-limit classes (`RL`), maintenance-mode exemption (AM-06) and the markdown fragments.
- `authz.py` — role → permission map (baseline §6) and resource-rule table for the authorization matrix.

All paths are resolved relative to this directory, so the scripts can be run from any working directory.

## Run (from the repository root)

```bash
uv run --with pyyaml python scripts/docgen/gen.py        # openapi.yaml + frag/*.md
uv run --with pyyaml python scripts/docgen/assemble.py   # API_DOCUMENTATION.md
uv run --with pyyaml python scripts/docgen/authz.py      # AUTH_AUTHORIZATION.md
uv run --with openapi-spec-validator --with pyyaml python -c \
  "from openapi_spec_validator import validate; import yaml; validate(yaml.safe_load(open('docs/04-backend-api/openapi.yaml'))); print('valid')"
rm -rf scripts/docgen/__pycache__
```

Order matters: `assemble.py` reads the fragments written by `gen.py`. `gen.py` exits with an error if an endpoint references an unknown error code; `assemble.py`/`authz.py` assert that no `{{placeholder}}` is left.

## Change rules

- Endpoint set and semantics follow `docs/ENGINEERING_BASELINE.md` §12 and its §16 amendments; a new or changed endpoint needs a `DECISION_LOG.md` entry.
- Commit the regenerated outputs in the same change as the source edit.
