import json
import os
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from fastapi import FastAPI, HTTPException

app = FastAPI()

DEFAULT_MODEL_SPEC = {
    "name": "Development double model",
    "type": "linear",
    "weight": 2,
    "bias": 0,
}

DEFAULT_IPFS_GATEWAYS = [
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://w3s.link/ipfs/",
]

IPFS_GATEWAY_URLS = [
    gateway.strip()
    for gateway in os.getenv("IPFS_GATEWAY_URLS", ",".join(DEFAULT_IPFS_GATEWAYS)).split(",")
    if gateway.strip()
]


def build_ipfs_urls(ipfs_hash: str) -> list[str]:
    if ipfs_hash.startswith("http://") or ipfs_hash.startswith("https://"):
        return [ipfs_hash]

    cid = ipfs_hash.replace("ipfs://", "", 1)
    return [f"{gateway.rstrip('/')}/{cid}" for gateway in IPFS_GATEWAY_URLS]


def fetch_model_spec(ipfs_hash: str) -> str:
    errors = []

    for url in build_ipfs_urls(ipfs_hash):
        try:
            with urlopen(url, timeout=10) as response:
                return response.read().decode("utf-8")
        except HTTPError as exc:
            errors.append(f"{url} -> HTTP {exc.code}")
        except URLError as exc:
            errors.append(f"{url} -> {exc.reason}")
        except TimeoutError:
            errors.append(f"{url} -> timed out")

    detail = "; ".join(errors) if errors else "no IPFS gateways configured"
    raise HTTPException(status_code=502, detail=f"Could not fetch model from IPFS: {detail}")


@lru_cache(maxsize=128)
def load_model_spec(ipfs_hash: str | None) -> dict[str, Any]:
    if not ipfs_hash:
        return DEFAULT_MODEL_SPEC

    raw_model = fetch_model_spec(ipfs_hash)

    try:
        model_spec = json.loads(raw_model)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Uploaded model must be a JSON model spec") from exc

    if not isinstance(model_spec, dict):
        raise HTTPException(status_code=400, detail="Uploaded model spec must be a JSON object")

    return model_spec


def get_number(model_spec: dict[str, Any], key: str, default: float) -> float:
    try:
        return float(model_spec.get(key, default))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Model field '{key}' must be a number") from exc


def run_model_spec(model_spec: dict[str, Any], input_data: float | int) -> float:
    model_type = model_spec.get("type", "linear")
    x = float(input_data)

    if model_type == "linear":
        weight = get_number(model_spec, "weight", 1)
        bias = get_number(model_spec, "bias", 0)
        return (weight * x) + bias

    if model_type == "multiply":
        factor = get_number(model_spec, "factor", 1)
        return factor * x

    if model_type == "add":
        value = get_number(model_spec, "value", 0)
        return x + value

    raise HTTPException(status_code=400, detail=f"Unsupported model type: {model_type}")


@app.get("/")
def home():
    return {"message": "AI Marketplace Backend Running"}


@app.post("/predict")
def predict(input_data: float | int):
    result = run_model_spec(DEFAULT_MODEL_SPEC, input_data)
    return {"input": input_data, "result": result}

@app.post("/run-model")
def run_model(model_id: int, input_data: float | int, ipfs_hash: str | None = None):
    # The Node server checks the blockchain registry before calling this endpoint.
    if model_id < 1:
        raise HTTPException(status_code=404, detail="Model not found")

    model_spec = load_model_spec(ipfs_hash)
    result = run_model_spec(model_spec, input_data)

    return {
        "model_id": model_id,
        "model_name": model_spec.get("name", "Unnamed model"),
        "model_type": model_spec.get("type", "linear"),
        "input": input_data,
        "result": result
    }

@app.get("/model-spec-example")
def model_spec_example():
    return {
        "name": "Example linear model",
        "type": "linear",
        "weight": 2.5,
        "bias": 1
    }
