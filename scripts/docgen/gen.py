"""Generate openapi.yaml and the endpoint-reference markdown fragments."""
import json, re, sys
from collections import OrderedDict, defaultdict
import yaml
from schemas import build, paginated
from errors import ERRORS
from endpoints import EP

import os as _os
HERE = _os.path.dirname(_os.path.abspath(__file__))
OUT = _os.path.normpath(_os.path.join(HERE, "..", "..", "docs", "04-backend-api"))
FRAG = _os.path.join(HERE, "frag")
PREFIX = "/api/v1"

RL = OrderedDict([
    ("none", "Not rate-limited (health probes; internal metrics)."),
    ("public", "60 / min per IP."),
    ("contact", "5 / h per IP."),
    ("auth_register", "5 / h per IP."),
    ("auth_login", "5 / min per (IP + email) and 20 / min per IP; account lockout after 5 failures within 15 min (locked 15 min)."),
    ("auth_mfa", "5 / min per session and 20 / h per user; 10 consecutive failures revoke the MFA-pending session."),
    ("auth_token", "10 / h per IP (verify-email, reset-password)."),
    ("auth_resend", "3 / h per user."),
    ("auth_forgot", "3 / h per email and 10 / h per IP (silently not sent above limit; response still 202)."),
    ("auth_password", "5 / h per user (change-password, MFA setup/disable, payout-method create)."),
    ("read", "600 / min per user."),
    ("write", "120 / min per user."),
    ("autosave", "60 / min per user per task."),
    ("upload", "600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof)."),
    ("download", "120 / min per user (presigned URL issuance, preview redirects)."),
    ("payout_request", "10 / h per user."),
    ("messaging", "30 / min per user."),
    ("attachment", "60 / h per user."),
    ("export", "10 / h per user."),
    ("ws", "10 connection attempts / min per user; max 5 concurrent sockets per user."),
])

STATUS_TEXT = {101: "Switching Protocols", 200: "OK", 201: "Created", 202: "Accepted", 204: "No Content", 302: "Found", 400: "Bad Request",
               401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 412: "Precondition Failed", 413: "Content Too Large",
               415: "Unsupported Media Type", 422: "Unprocessable Content", 429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable"}

def op_id(e):
    parts = [x for x in e["p"].strip("/").split("/")]
    name = []
    for x in parts:
        if x.startswith("{"):
            name.append("by_" + x[1:-1].replace("_id", ""))
        else:
            name.append(re.sub(r"[^a-z0-9]+", "_", x))
    return e["m"].lower() + "_" + "_".join(name)

def path_params(p):
    return re.findall(r"{([a-z_]+)}", p)

MAINT_EXEMPT_PREFIXES = ("/healthz", "/readyz", "/metrics", "/auth/", "/admin/")

def maintenance_exempt(e):
    """AM-06: with maintenance_mode on, every non-admin call gets 503; health, auth and admin endpoints keep working."""
    return e["p"].startswith(MAINT_EXEMPT_PREFIXES) or e["admin"]

def all_errors(e):
    codes = list(e["err"])
    a = e["auth"]
    if e["body"]:
        codes += ["request.unsupported_media_type", "request.payload_too_large", "validation_error"]
        if e["ct"] == "json":
            codes.append("request.malformed")
    if e["q"] or e["paged"] or path_params(e["p"]):
        codes.append("validation_error")
    if path_params(e["p"]):
        codes.append("resource.not_found")
    if a == "user":
        codes += ["auth.not_authenticated", "auth.session_expired"]
        if e["verified"]:
            codes += ["auth.email_unverified", "auth.mfa_required"]
        if e["perm"]:
            codes.append("permission.denied")
        if e["admin"]:
            codes += ["auth.mfa_required", "auth.mfa_enrollment_required"]
        if e["onb"]:
            codes.append("auth.onboarding_required")
    if e["step"]:
        codes.append("auth.step_up_required")
    if e["csrf"]:
        codes += ["csrf.missing", "csrf.invalid"]
    if e["idem"]:
        codes += ["idempotency.key_invalid", "idempotency.key_reused", "idempotency.in_progress"]
        if e["idem"] == "required":
            codes.append("idempotency.key_required")
    if e["ifm"] == "optional":
        codes.append("precondition.failed")
    if e["ifm"] == "required":
        codes.append("precondition.required")
    if e["rl"] != "none":
        codes.append("rate_limited")
    if a != "internal":
        codes.append("internal_error")
    if not maintenance_exempt(e):
        codes.append("service_unavailable")
    seen, out = set(), []
    for c in codes:
        if c not in ERRORS:
            sys.exit(f"unknown error code {c} in {e['m']} {e['p']}")
        if c not in seen:
            seen.add(c); out.append(c)
    return out

def by_status(codes):
    d = defaultdict(list)
    for c in codes:
        d[ERRORS[c][0]].append(c)
    return dict(sorted(d.items()))

def perm_label(e):
    if e["auth"] == "public":
        return "Public (no session)" + (" · CSRF required" if e["csrf"] else "")
    if e["auth"] == "internal":
        return "Internal network only"
    bits = [f"`{e['perm']}`" if e["perm"] else "any signed-in user"]
    if e["admin"]:
        bits.append("admin MFA session")
    if e["step"]:
        bits.append("**step-up MFA ≤ 15 min**")
    if not e["verified"]:
        bits.append("allowed for pending_email / MFA-pending sessions")
    if e["onb"]:
        bits.append("onboarding completed")
    if e["csrf"]:
        bits.append("CSRF")
    return " · ".join(bits)

def build_openapi():
    S = paginated(build())
    comps = {
        "schemas": S,
        "securitySchemes": {
            "cookieAuth": {"type": "apiKey", "in": "cookie", "name": "dh_session",
                           "description": "Opaque 256-bit session token (base64url). HttpOnly; Secure; SameSite=Lax; Path=/. Server stores SHA-256 only."},
            "csrfToken": {"type": "apiKey", "in": "header", "name": "X-CSRF-Token",
                          "description": "Double-submit token; must equal the dh_csrf cookie and carry a valid HMAC bound to the session. Required on POST/PUT/PATCH/DELETE."},
        },
        "parameters": {
            "Page": {"name": "page", "in": "query", "required": False, "schema": {"type": "integer", "minimum": 1, "maximum": 10000, "default": 1}, "description": "1-based page number."},
            "PageSize": {"name": "page_size", "in": "query", "required": False, "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25}, "description": "Items per page (max 100)."},
            "Sort": {"name": "sort", "in": "query", "required": False,
                     "schema": {"type": "string", "pattern": "^-?[a-z_]+(,-?[a-z_]+){0,2}$", "maxLength": 100},
                     "description": "Comma-separated fields, `-` prefix = descending (e.g. `-created_at`). Allowed fields per operation in `x-sortable-fields`; unknown field → 422. `id` is always appended as tie-breaker."},
            "IdempotencyKey": {"name": "Idempotency-Key", "in": "header", "required": False,
                               "schema": {"type": "string", "minLength": 8, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]{8,128}$"},
                               "description": "Client-generated unique key (UUID v4 recommended). Same key + same body within 24 h replays the stored response (`Idempotent-Replayed: true`)."},
            "IdempotencyKeyRequired": {"name": "Idempotency-Key", "in": "header", "required": True,
                                       "schema": {"type": "string", "minLength": 8, "maxLength": 128, "pattern": "^[A-Za-z0-9_-]{8,128}$"},
                                       "description": "Required. Stored in payout_requests.client_idempotency_key (unique per user)."},
            "IfMatch": {"name": "If-Match", "in": "header", "required": False, "schema": {"type": "string", "maxLength": 32},
                        "description": "Resource `version` as returned in ETag (`\"4\"` or `4`). Mismatch → 412 precondition.failed."},
            "IfMatchRequired": {"name": "If-Match", "in": "header", "required": True, "schema": {"type": "string", "maxLength": 32},
                                "description": "Current annotation version. Mismatch → 409 annotation.version_conflict with server copy."},
            "XRequestId": {"name": "X-Request-ID", "in": "header", "required": False, "schema": {"type": "string", "maxLength": 64, "pattern": "^[A-Za-z0-9._-]{1,64}$"},
                           "description": "Optional client correlation id; generated when absent; echoed in response and error envelope."},
        },
        "headers": {
            "ETag": {"description": "Quoted resource version, e.g. `\"4\"`.", "schema": {"type": "string"}},
            "Location": {"description": "URL of the created resource or redirect target.", "schema": {"type": "string"}},
            "RetryAfter": {"description": "Seconds until the limit resets.", "schema": {"type": "integer"}},
            "XRequestId": {"description": "Request id (also in error envelope).", "schema": {"type": "string"}},
            "RateLimit": {"description": "IETF draft RateLimit header: `limit=120, remaining=97, reset=31`.", "schema": {"type": "string"}},
            "SetCookie": {"description": "dh_session and/or dh_csrf cookies.", "schema": {"type": "string"}},
            "IdempotentReplayed": {"description": "`true` when the response is a stored replay.", "schema": {"type": "string", "enum": ["true"]}},
        },
    }
    paths = {}
    tags = []
    for e in EP:
        if e["tag"] not in tags:
            tags.append(e["tag"])
        full = PREFIX + e["p"]
        op = {"tags": [e["tag"]], "summary": e["sum"], "operationId": op_id(e)}
        desc = e["desc"] or e["sum"] + "."
        op["description"] = desc
        params = []
        for pp in path_params(e["p"]):
            if pp == "page":
                sch = {"type": "integer", "minimum": 1, "maximum": 500}
            elif pp == "key":
                sch = {"type": "string", "pattern": "^[a-z][a-z0-9_]{1,63}$"}
            else:
                sch = {"type": "string", "format": "uuid"}
            params.append({"name": pp, "in": "path", "required": True, "schema": sch})
        for (n, sch, d) in e["q"]:
            if n == "status" or n.endswith("_status"):
                # AM-05: every status filter accepts comma-separated values (repeated keys are also accepted).
                params.append({"name": n, "in": "query", "required": False, "style": "form", "explode": False,
                               "schema": {"type": "array", "items": sch, "minItems": 1, "uniqueItems": True},
                               "description": (d + " " if d else "") + "Comma-separated list, e.g. `" + n + "=a,b` (repeated keys also accepted)."})
            else:
                params.append({"name": n, "in": "query", "required": False, "schema": sch, "description": d})
        if e["paged"]:
            params += [{"$ref": "#/components/parameters/Page"}, {"$ref": "#/components/parameters/PageSize"}, {"$ref": "#/components/parameters/Sort"}]
            if e["sort"]:
                op["x-sortable-fields"] = e["sort"]
        if e["idem"]:
            params.append({"$ref": "#/components/parameters/" + ("IdempotencyKeyRequired" if e["idem"] == "required" else "IdempotencyKey")})
        if e["ifm"]:
            params.append({"$ref": "#/components/parameters/" + ("IfMatchRequired" if e["ifm"] == "required" else "IfMatch")})
        if e["auth"] != "internal":
            params.append({"$ref": "#/components/parameters/XRequestId"})
        if params:
            op["parameters"] = params
        if e["auth"] in ("public", "internal"):
            op["security"] = [{"csrfToken": []}] if e["csrf"] else []
        else:
            op["security"] = [{"cookieAuth": [], "csrfToken": []}] if e["csrf"] else [{"cookieAuth": []}]
        op["x-permission"] = e["perm"] or ("public" if e["auth"] == "public" else ("internal" if e["auth"] == "internal" else "authenticated"))
        op["x-rate-limit"] = RL[e["rl"]]
        if e["admin"]:
            op["x-admin-mfa"] = True
        if e["step"]:
            op["x-step-up-mfa"] = True
        op["x-maintenance-exempt"] = maintenance_exempt(e)
        if e["body"]:
            ct = "application/json" if e["ct"] == "json" else "multipart/form-data"
            media = {"schema": {"$ref": f"#/components/schemas/{e['body']}"}}
            if e["req"] is not None:
                media["example"] = flowify(e["req"])
            op["requestBody"] = {"required": True, "content": {ct: media}}
        resps = {}
        ok = e["ok"]
        okr = {"description": STATUS_TEXT[ok]}
        hdrs = {"X-Request-ID": {"$ref": "#/components/headers/XRequestId"}}
        if e["rl"] not in ("none",):
            hdrs["RateLimit"] = {"$ref": "#/components/headers/RateLimit"}
        for h in e["rh"]:
            if h == "ETag": hdrs["ETag"] = {"$ref": "#/components/headers/ETag"}
            if h == "Location": hdrs["Location"] = {"$ref": "#/components/headers/Location"}
            if h == "Set-Cookie": hdrs["Set-Cookie"] = {"$ref": "#/components/headers/SetCookie"}
        if ok == 302:
            hdrs["Location"] = {"$ref": "#/components/headers/Location"}
        if e["idem"]:
            hdrs["Idempotent-Replayed"] = {"$ref": "#/components/headers/IdempotentReplayed"}
        if e["p"] in ("/auth/csrf", "/auth/logout", "/auth/mfa/verify", "/auth/mfa/enable", "/auth/change-password", "/auth/reset-password"):
            hdrs["Set-Cookie"] = {"$ref": "#/components/headers/SetCookie"}
        if e["auth"] != "internal":
            okr["headers"] = hdrs
        if e["resp"]:
            m = {"schema": {"$ref": f"#/components/schemas/{e['resp']}"}}
            if e["rex"] is not None:
                m["example"] = flowify(e["rex"])
            okr["content"] = {"application/json": m}
        elif e["p"] == "/metrics":
            okr["content"] = {"text/plain": {"schema": {"type": "string"}, "example": "# HELP http_requests_total Total requests\n# TYPE http_requests_total counter\nhttp_requests_total{route=\"/api/v1/datasets\",method=\"GET\",status=\"200\"} 1027\n"}}
        resps[str(ok)] = okr
        if e["p"] == "/readyz":
            resps["503"] = {"description": "Service Unavailable — a required dependency failed.", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Readiness"},
                            "example": {"status": "unavailable", "checks": {"postgres": "ok", "redis": "fail", "s3": "ok", "clamav": "ok", "migrations": "ok"}}}}}
        for st, codes in by_status(all_errors(e)).items():
            if e["p"] == "/readyz" and st == 503:
                continue
            det = {"reason": "maintenance"} if codes[0] == "service_unavailable" else None
            r = {"description": STATUS_TEXT[st] + ". Error codes: " + ", ".join(f"`{c}`" for c in codes),
                 "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"},
                                                  "example": flowify({"error": {"code": codes[0], "message": ERRORS[codes[0]][1], "details": det, "request_id": "req_01JBA7Q4M8"}})}}}
            if st in (429, 503):
                r["headers"] = {"Retry-After": {"$ref": "#/components/headers/RetryAfter"}}
            resps[str(st)] = r
        op["responses"] = resps
        paths.setdefault(full, {})[e["m"].lower()] = op
    tag_desc = {"Health": "Probes and metrics.", "Auth": "Registration, login, MFA, sessions, password flows.", "Me": "Self-service profile, onboarding, payout methods, verification.",
                "Public": "Unauthenticated catalogue endpoints.", "Datasets": "Contributor dataset lifecycle.", "Files": "File metadata, previews, text, downloads.",
                "Uploads": "Resumable S3 multipart uploads.", "Review": "Dataset review workflow.", "Finance": "Contributor wallet, earnings, withdrawals.",
                "Admin finance": "Payout processing, adjustments, ledger, pricing.", "Annotation": "Projects, tasks, editor, annotation review.",
                "Messaging": "Conversations, messages, attachments, WebSocket.", "Notifications": "In-app notifications.", "Admin users": "User administration and verification.",
                "Admin datasets": "Dataset administration and takedown.", "Exports": "Background dataset exports.", "Admin": "Analytics, audit, settings, roles."}
    doc = OrderedDict()
    doc["openapi"] = "3.1.0"
    doc["info"] = {"title": "DataHub API", "version": "1.1.0",
                   "summary": "Data marketplace & annotation platform API (documentation baseline).",
                   "description": ("Canonical contract per docs/ENGINEERING_BASELINE.md §12. All paths are under `/api/v1`; JSON (UTF-8) bodies; "
                                   "errors use `{\"error\":{\"code\",\"message\",\"details\",\"request_id\"}}`. Money fields are integer micro-USD (`*_micros`), "
                                   "sizes are integer bytes (`*_bytes`), timestamps RFC 3339 UTC. Cookie session `dh_session`; unsafe methods require `X-CSRF-Token`. "
                                   "Human-readable conventions, error catalogue and WebSocket protocol: docs/04-backend-api/API_DOCUMENTATION.md. "
                                   "The implementation's generated spec (FastAPI) is reconciled against this file in CI."),
                   "contact": {"name": "DataHub engineering (SKAI Technology)"},
                   "license": {"name": "Proprietary", "identifier": "LicenseRef-Proprietary"}}
    doc["servers"] = [{"url": "/", "description": "Same origin as the web app (Caddy in production; Next.js rewrite in development)."},
                      {"url": "http://localhost:8410", "description": "Local development API container (direct)."}]
    doc["tags"] = [{"name": t, "description": tag_desc.get(t, t)} for t in tags]
    doc["security"] = [{"cookieAuth": []}]
    doc["paths"] = paths
    doc["components"] = comps
    return doc

class FlowDict(dict):
    pass

class FlowList(list):
    pass

def flowify(o):
    if isinstance(o, dict):
        return FlowDict({k: flowify(v) for k, v in o.items()})
    if isinstance(o, list):
        return FlowList([flowify(v) for v in o])
    return o

# ------------------------- markdown -------------------------
def compact(o, ind=0):
    one = json.dumps(o, ensure_ascii=False)
    if len(one) + ind <= 110 or not isinstance(o, (dict, list)) or not o:
        return one
    pad = "  " * (ind + 1)
    if isinstance(o, dict):
        items = [f'{pad}{json.dumps(k, ensure_ascii=False)}: {compact(v, ind + 1)}' for k, v in o.items()]
        return "{\n" + ",\n".join(items) + "\n" + "  " * ind + "}"
    items = [pad + compact(v, ind + 1) for v in o]
    return "[\n" + ",\n".join(items) + "\n" + "  " * ind + "]"

def md_endpoints():
    out = []
    tags = []
    for e in EP:
        if e["tag"] not in tags:
            tags.append(e["tag"])
    n = 0
    for ti, t in enumerate(tags, 1):
        out.append(f"### 10.{ti} {t}\n")
        for e in [x for x in EP if x["tag"] == t]:
            n += 1
            out.append(f"#### `{e['m']} {PREFIX}{e['p']}` — {e['sum']}\n")
            out.append(f"- **Access:** {perm_label(e)}")
            out.append(f"- **Rate limit:** {RL[e['rl']]}")
            if maintenance_exempt(e) and e["auth"] != "internal":
                out.append("- **Maintenance mode:** exempt — keeps working while `maintenance_mode` is on (AM-06).")
            hdr = []
            if e["idem"]: hdr.append(f"`Idempotency-Key` ({e['idem']})")
            if e["ifm"]: hdr.append(f"`If-Match` ({e['ifm']})")
            if hdr: out.append("- **Headers:** " + " · ".join(hdr))
            if e["q"] or e["paged"]:
                qs = [f"`{n_}` — {d}" for (n_, _, d) in e["q"]]
                if e["paged"]:
                    qs.append("`page`, `page_size`, `sort`" + (f" (sortable: {', '.join('`'+x+'`' for x in e['sort'])})" if e["sort"] else ""))
                out.append("- **Query:** " + "; ".join(qs))
            if e["desc"]:
                out.append("")
                out.append(e["desc"])
            if e["body"]:
                out.append("")
                out.append(f"**Request** (`{e['body']}`, {'application/json' if e['ct']=='json' else 'multipart/form-data'}):")
                out.append("```json\n" + compact(e["req"]) + "\n```")
            out.append("")
            if e["resp"]:
                out.append(f"**Response `{e['ok']} {STATUS_TEXT[e['ok']]}`** (`{e['resp']}`):")
                out.append("```json\n" + compact(e["rex"]) + "\n```")
            else:
                out.append(f"**Response `{e['ok']} {STATUS_TEXT[e['ok']]}`** — no JSON body.")
            if e["val"]:
                out.append("")
                out.append("**Validation:** " + "; ".join(e["val"]) + ".")
            errs = all_errors(e)
            bs = by_status(errs)
            sts = [str(e["ok"])] + [str(s_) for s_ in bs]
            if e["p"] == "/readyz" and "503" not in sts: sts.append("503")
            out.append("")
            out.append("**Status codes:** " + ", ".join(sts))
            spec = [c for c in errs if c in e["err"]]
            common = [c for c in errs if c not in e["err"]]
            if spec:
                out.append("")
                out.append("**Endpoint-specific errors:** " + ", ".join(f"`{c}` ({ERRORS[c][0]})" for c in spec))
            if common:
                out.append("")
                out.append("**Common errors:** " + ", ".join(f"`{c}`" for c in common))
            out.append("")
    return "\n".join(out), n

def md_errors():
    rows = ["| Code | HTTP | Default message | Raised when |", "|---|---|---|---|"]
    for c, (st, msg, when) in ERRORS.items():
        rows.append(f"| `{c}` | {st} | {msg} | {when.replace('|', '/')} |")
    return "\n".join(rows)

def md_rl():
    use = defaultdict(list)
    for e in EP:
        use[e["rl"]].append(f"{e['m']} {e['p']}")
    rows = ["| Class | Limit | Applies to |", "|---|---|---|"]
    for k, v in RL.items():
        ap = use.get(k, [])
        if k == "read":
            aps = f"All other authenticated GETs ({len(ap)} endpoints)"
        elif k == "write":
            aps = f"All other authenticated unsafe methods ({len(ap)} endpoints)"
        else:
            aps = ", ".join(f"`{x}`" for x in ap)
        rows.append(f"| `{k}` | {v} | {aps} |")
    return "\n".join(rows)

def md_index():
    rows = ["| # | Method | Path | Permission | Notes |", "|---|---|---|---|---|"]
    for i, e in enumerate(EP, 1):
        notes = []
        if e["admin"]: notes.append("admin MFA")
        if e["step"]: notes.append("step-up")
        if e["idem"]: notes.append(f"Idempotency-Key {e['idem']}")
        if e["ifm"]: notes.append(f"If-Match {e['ifm']}")
        p = e["perm"] or e["auth"]
        rows.append(f"| {i} | {e['m']} | `{PREFIX}{e['p']}` | `{p.replace(' | ', '` or `')}` | {', '.join(notes)} |")
    return "\n".join(rows)

if __name__ == "__main__":
    import os
    os.makedirs(FRAG, exist_ok=True)
    doc = build_openapi()
    class D(yaml.SafeDumper):
        pass
    def flow(dumper, o):
        return dumper.represent_mapping("tag:yaml.org,2002:map", o.items(), flow_style=True) if isinstance(o, FlowDict) else None
    D.add_representer(FlowDict, lambda d, o: d.represent_mapping("tag:yaml.org,2002:map", dict(o).items(), flow_style=True))
    D.add_representer(FlowList, lambda d, o: d.represent_sequence("tag:yaml.org,2002:seq", list(o), flow_style=True))
    D.add_representer(OrderedDict, lambda d, o: d.represent_dict(o.items()))
    D.ignore_aliases = lambda self, data: True
    with open(f"{OUT}/openapi.yaml", "w") as f:
        f.write("# DataHub OpenAPI 3.1 specification — Document control: v1.1, 2026-10-26, Baseline (§16 amendments applied).\n")
        f.write("# Canonical source: docs/ENGINEERING_BASELINE.md §12. Human-readable companion: API_DOCUMENTATION.md.\n")
        yaml.dump(doc, f, Dumper=D, sort_keys=False, allow_unicode=True, width=140)
    eps, n = md_endpoints()
    open(f"{FRAG}/endpoints.md", "w").write(eps)
    open(f"{FRAG}/errors.md", "w").write(md_errors())
    open(f"{FRAG}/ratelimits.md", "w").write(md_rl())
    open(f"{FRAG}/index.md", "w").write(md_index())
    print("endpoints:", n, "paths:", len(doc["paths"]), "schemas:", len(doc["components"]["schemas"]), "errors:", len(ERRORS))
