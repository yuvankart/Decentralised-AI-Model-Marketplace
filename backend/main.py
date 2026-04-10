import json
import os
import tempfile
from functools import lru_cache
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from fastapi import Body, FastAPI, HTTPException

try:
    import numpy as np
    import onnxruntime as ort
except ImportError:
    np = None
    ort = None

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


def fetch_model_bytes(ipfs_hash: str) -> bytes:
    errors = []

    for url in build_ipfs_urls(ipfs_hash):
        try:
            with urlopen(url, timeout=10) as response:
                return response.read()
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


def validate_model_spec(model_spec: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(model_spec, dict):
        raise HTTPException(status_code=400, detail="Model spec must be a JSON object")

    if "type" in model_spec and not isinstance(model_spec["type"], str):
        raise HTTPException(status_code=400, detail="Model field 'type' must be a string")

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


def ensure_onnx_runtime() -> None:
    if np is None or ort is None:
        raise HTTPException(
            status_code=500,
            detail="ONNX support is not installed. Install onnxruntime and numpy in the backend environment.",
        )


def run_onnx_model(model_path: str, input_data: float | int) -> dict[str, Any]:
    ensure_onnx_runtime()

    try:
        session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not load ONNX model: {exc}") from exc

    inputs = session.get_inputs()
    outputs = session.get_outputs()

    if len(inputs) != 1:
        raise HTTPException(status_code=400, detail="Only single-input ONNX models are supported")

    input_tensor = np.array([[float(input_data)]], dtype=np.float32)

    try:
      raw_output = session.run(None, {inputs[0].name: input_tensor})
    except Exception:
      try:
          input_tensor = np.array([float(input_data)], dtype=np.float32)
          raw_output = session.run(None, {inputs[0].name: input_tensor})
      except Exception as exc:
          raise HTTPException(status_code=400, detail=f"ONNX inference failed: {exc}") from exc

    first_output = raw_output[0]
    output_array = np.asarray(first_output)
    scalar_output = float(output_array.reshape(-1)[0])

    return {
        "model_name": os.path.basename(model_path),
        "model_type": "onnx",
        "input_name": inputs[0].name,
        "output_name": outputs[0].name if outputs else "output",
        "result": scalar_output,
    }


def materialize_onnx_file(ipfs_hash: str) -> str:
    raw_model = fetch_model_bytes(ipfs_hash)
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".onnx")
    temp_file.write(raw_model)
    temp_file.flush()
    temp_file.close()
    return temp_file.name


@app.get("/")
def home():
    return {"message": "AI Marketplace Backend Running"}


@app.post("/predict")
def predict(input_data: float | int):
    result = run_model_spec(DEFAULT_MODEL_SPEC, input_data)
    return {"input": input_data, "result": result}

@app.post("/run-model")
def run_model(
    model_id: int,
    input_data: float | int,
    ipfs_hash: str | None = None,
    model_format: str | None = Body(default=None, embed=True),
    model_path: str | None = Body(default=None, embed=True),
    model_spec: dict[str, Any] | None = Body(default=None, embed=True),
):
    # The Node server checks the blockchain registry before calling this endpoint.
    if model_id < 1:
        raise HTTPException(status_code=404, detail="Model not found")

    if model_format == "onnx":
        resolved_model_path = model_path or (materialize_onnx_file(ipfs_hash) if ipfs_hash else None)
        if not resolved_model_path:
            raise HTTPException(status_code=400, detail="ONNX model path or IPFS hash is required")

        onnx_result = run_onnx_model(resolved_model_path, input_data)
        return {
            "model_id": model_id,
            "model_name": onnx_result["model_name"],
            "model_type": onnx_result["model_type"],
            "input": input_data,
            "input_name": onnx_result["input_name"],
            "output_name": onnx_result["output_name"],
            "result": onnx_result["result"],
        }

    spec = validate_model_spec(model_spec) if model_spec else load_model_spec(ipfs_hash)
    result = run_model_spec(spec, input_data)

    return {
        "model_id": model_id,
        "model_name": spec.get("name", "Unnamed model"),
        "model_type": spec.get("type", "linear"),
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
