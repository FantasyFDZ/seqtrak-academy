# 开发期诊断（只读）：列出 Codex 本地缓存里的可用模型，以及每个模型要求的最低客户端版本。
import json
import os

path = os.path.expanduser("~/.codex/models_cache.json")
data = json.load(open(path, encoding="utf-8"))

if isinstance(data, dict):
    print("top-level keys:", [k for k in data.keys()][:12])
    for k in ("fetched_at", "client_version", "etag"):
        if k in data:
            print(f"{k}: {str(data[k])[:80]}")
models = data.get("models") if isinstance(data, dict) else data
if not isinstance(models, list):
    print("unexpected shape; first 800 chars:")
    print(json.dumps(data, ensure_ascii=False)[:800])
    raise SystemExit

print(f"{len(models)} models")
if models and isinstance(models[0], dict):
    print("fields:", sorted(models[0].keys()))
for m in models:
    if not isinstance(m, dict):
        print(" ", str(m)[:100])
        continue
    slug = m.get("slug") or m.get("id") or m.get("model") or "?"
    extra = {k: m[k] for k in m if any(s in k for s in ("version", "visib", "support", "default", "priority")) and not isinstance(m[k], (dict,))}
    print(f"  {slug}  |  {m.get('display_name', '')}  |  {json.dumps(extra, ensure_ascii=False)[:260]}")
