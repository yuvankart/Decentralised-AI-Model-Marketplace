# Frontend

Open `index.html` in a browser after starting the backend services.

Required services:

```bash
cd backend
venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
cd server
node index.js
```

The frontend calls the Node API at `http://127.0.0.1:3001` by default.

Model upload support:

- JSON model specs (`.json`)
- Small single-input ONNX regression models (`.onnx`)

Sample ONNX model for demo:

```text
backend/sample_models/small_regression.onnx
```

That sample model computes:

```text
y = 2x + 1
```

So if the input is `4`, the expected output is `9`.

Note:

- ONNX execution works for models uploaded through this app because the Node server caches the uploaded file locally after Pinata upload.
- Registering an existing IPFS CID as ONNX is not yet fully supported unless that same file has already been cached locally by the server.
