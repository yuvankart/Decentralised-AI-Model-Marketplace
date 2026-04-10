# Decentralized AI Model Marketplace Prototype

This project is a prototype DApp where a model creator can upload a model file, register it on-chain, and another user can pay to use it and rate it.

The current implementation supports:

- JSON model specifications
- Small single-input ONNX regression models
- MetaMask-approved blockchain transactions
- IPFS storage through Pinata
- Local blockchain testing through Ganache

## Tech Stack

- Solidity
- Truffle
- Ganache
- MetaMask
- Node.js / Express
- FastAPI
- IPFS / Pinata
- Web3.js

## Project Structure

- `contracts/` - smart contracts
- `migrations/` - Truffle migrations
- `server/` - Node.js API server
- `backend/` - FastAPI model execution backend
- `frontend/` - HTML/CSS/JS frontend
- `build/contracts/` - compiled contract artifacts

## Prerequisites

Install these before running:

- Node.js 18+ and npm
- Python 3.11+ or compatible Python 3 environment
- Ganache
- MetaMask browser extension

## 1. Install Dependencies

From the project root:

```bash
npm install
```

From the backend folder:

```bash
cd backend
python3 -m venv venv
venv/bin/pip install fastapi uvicorn onnx onnxruntime numpy
cd ..
```

From the server folder:

```bash
cd server
npm install
cd ..
```

## 2. Configure Environment Variables

Create a file named `.env` in the project root:
For this you have to create an account in pinata and get the api keys. So please do this beforehand. I have provided my own pinata api keys, so please dont upload this project anywhere.
```env
PINATA_API_KEY=your_pinata_api_key(use mine if needed -> 9092f858d6b0cd7fb15c)
PINATA_SECRET_API_KEY=your_pinata_secret_api_key(07134fac9d879e126e934354af5325c85726df01d4302801b840789218cab258)
GANACHE_URL=http://127.0.0.1:7545
TRUFFLE_NETWORK_ID=5777
MODEL_RUNNER_URL=http://127.0.0.1:8000/run-model
DEFAULT_MODEL_PRICE_WEI=100
```

If your Ganache instance shows a different chain/network id, keep Ganache and MetaMask aligned with that local network.

## 3. Start Ganache

Open Ganache and start a local workspace.

Default RPC URL used by this project:

```text
http://127.0.0.1:7545
```

## 4. Connect MetaMask to Ganache

In MetaMask:

1. Add a custom local network using Ganache RPC URL
2. Import a Ganache account using one of Ganache's private keys(You might need to import 2 accounts so that you can use one for model owner and one fro model user.)
3. Switch MetaMask to the Ganache network

This is important because blockchain write actions in the frontend are signed through MetaMask.

## 5. Compile and Deploy Contracts

From the project root:

```bash
npm run deploy
```

This runs Truffle migration and deploys:

- `ModelRegistry`
- `PaymentContract`
- `ReputationContract`

## 6. Start the Full Local Demo

From the project root:

```bash
npm run demo
```

This starts:

- Frontend: `http://127.0.0.1:5173`
- Node API: `http://127.0.0.1:3001`
- FastAPI backend: `http://127.0.0.1:8000`

Open this in the browser:

```text
http://127.0.0.1:5173
```

If the browser was already open, do a hard refresh after restarting the demo.

## 7. Sample Model Files

### Sample JSON Model

File:

```text
backend/sample_models/triple_plus_one.json
```

This model computes:

```text
y = 3x + 1
```

So if the input is `4`, the expected output is:

```text
13
```

### Sample ONNX Model

File:

```text
backend/sample_models/small_regression.onnx
```

This ONNX model computes:

```text
y = 2x + 1
```

So if the input is `4`, the expected output is:

```text
9
```

## 8. How to Use the Application

### Upload and Register a Model

1. Open the frontend
2. Click `Connect MetaMask`(do this after you setup or import the accounts in the MetaMask from Ganache network).Once again this requires Ganache to be running simultaneously.
3. Choose a sample file(do this using one account and use the model using another account to really test the project's use):
   - `backend/sample_models/triple_plus_one.json`, or
   - `backend/sample_models/small_regression.onnx`
4. Enter a price in wei
5. Click `Upload and Register`
6. Approve the transaction in MetaMask

### View Available Models

1. Click `Refresh Models`
2. The registered models will appear in the list

### Pay and Run a Model

1. Click `Select` for a model
2. Enter an input value
3. Click `Pay and Run`
4. Approve the payment transaction in MetaMask
5. The result will appear in the result log

### Rate a Model

1. Enter the model id
2. Choose a rating
3. Click `Submit Rating`
4. Approve the rating transaction in MetaMask

## 9. Verification Endpoints

These endpoints should respond when the demo is running:

- Node server:

```text
http://127.0.0.1:3001/
```

- FastAPI backend:

```text
http://127.0.0.1:8000/
```

## 10. Notes for Evaluators

- The blockchain write transactions are approved through MetaMask.
- The Node.js server uploads model files to Pinata and coordinates execution.
- The FastAPI backend executes JSON model specs and small ONNX regression models.
- ONNX execution is currently intended for models uploaded through this app, because the server caches uploaded files locally for reliable execution.

## 11. Known Limitations

- ONNX support is currently limited to small single-input regression models
- The project is designed for local Ganache testing
- FastAPI execution is still centralized, even though storage and transactions are decentralized
- Pinata API keys are required for fresh uploads

## 12. Useful Commands

From the project root:

```bash
npm run compile
npm run deploy
npm run demo
```

From the backend folder:

```bash
venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

From the server folder:

```bash
node index.js
```
