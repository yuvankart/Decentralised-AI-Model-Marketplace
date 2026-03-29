from fastapi import FastAPI

app = FastAPI()

# Dummy ML model (for now)
def simple_model(x: float):
    return x * 2


@app.get("/")
def home():
    return {"message": "AI Marketplace Backend Running"}


@app.post("/predict")
def predict(input_data: float):
    result = simple_model(input_data)
    return {"input": input_data, "result": result}

@app.post("/run-model")
def run_model(model_id: int, input_data: float):
    # Simulating fetching model (later from blockchain/IPFS)

    if model_id != 1:
        return {"error": "Model not found"}

    result = simple_model(input_data)

    return {
        "model_id": model_id,
        "input": input_data,
        "result": result
    }