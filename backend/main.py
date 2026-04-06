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

IPFS_GATEWAY_URL = os.getenv("IPFS_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs/")


def build_ipfs_url(ipfs_hash: str) -> str:
    if ipfs_hash.startswith("http://") or ipfs_hash.startswith("https://"):
        return ipfs_hash

    cid = ipfs_hash.replace("ipfs://", "", 1)
    gateway = IPFS_GATEWAY_URL.rstrip("/")
    return f"{gateway}/{cid}"


@lru_cache(maxsize=128)
def load_model_spec(ipfs_hash: str | None) -> dict[str, Any]:
    if not ipfs_hash:
        return DEFAULT_MODEL_SPEC

    url = build_ipfs_url(ipfs_hash)

    try:
        with urlopen(url, timeout=10) as response:
            raw_model = response.read().decode("utf-8")
    except HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch model from IPFS: HTTP {exc.code}") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch model from IPFS: {exc.reason}") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Timed out fetching model from IPFS") from exc

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
