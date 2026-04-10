from pathlib import Path

import onnx
from onnx import TensorProto, helper


OUTPUT_DIR = Path(__file__).resolve().parent / "sample_models"
OUTPUT_PATH = OUTPUT_DIR / "small_regression.onnx"


def build_small_regression_model() -> onnx.ModelProto:
    input_tensor = helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 1])
    output_tensor = helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 1])

    weights = helper.make_tensor(
        name="weights",
        data_type=TensorProto.FLOAT,
        dims=[1, 1],
        vals=[2.0],
    )
    bias = helper.make_tensor(
        name="bias",
        data_type=TensorProto.FLOAT,
        dims=[1],
        vals=[1.0],
    )

    matmul_node = helper.make_node("MatMul", inputs=["input", "weights"], outputs=["linear"])
    add_node = helper.make_node("Add", inputs=["linear", "bias"], outputs=["output"])

    graph = helper.make_graph(
        [matmul_node, add_node],
        "SmallRegressionModel",
        [input_tensor],
        [output_tensor],
        initializer=[weights, bias],
    )

    model = helper.make_model(graph, producer_name="decentralised-ai-model-marketplace")
    model.ir_version = 10

    for opset in model.opset_import:
        opset.version = 13

    onnx.checker.check_model(model)
    return model


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model = build_small_regression_model()
    onnx.save(model, OUTPUT_PATH)
    print(f"Wrote sample ONNX model to {OUTPUT_PATH}")
    print("This model computes: y = 2x + 1")


if __name__ == "__main__":
    main()
