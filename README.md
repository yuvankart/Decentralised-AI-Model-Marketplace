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
- Pinata account with API key and secret

## 1. Install Dependencies

From the project root:

```bash
npm install
```

From the backend folder:

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
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

You need a Pinata account and API keys for fresh model uploads.

```env
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_api_key
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
2. Import a Ganache account using one of Ganache's private keys
3. Optionally import a second Ganache account if you want to demonstrate one account as the model owner and another as the model user
4. Switch MetaMask to the Ganache network

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

If `npm run demo` does not start because Python packages are missing, make sure the backend setup in Step 1 was completed successfully.

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
2. Make sure Ganache is still running and MetaMask is connected to the Ganache network
3. Click `Connect MetaMask`
4. Choose a sample file. For a complete demo, you can upload using one Ganache account and use the model from a different Ganache account:
   - `backend/sample_models/triple_plus_one.json`, or
   - `backend/sample_models/small_regression.onnx`
5. Enter a price in wei
6. Click `Upload and Register`
7. Approve the transaction in MetaMask

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
- Existing arbitrary IPFS CIDs are easiest to use with JSON models. ONNX execution is most reliable when the ONNX file is uploaded through this application.

## 11. Known Limitations

- ONNX support is currently limited to small single-input regression models
- The project is designed for local Ganache testing
- FastAPI execution is still centralized, even though storage and transactions are decentralized
- Pinata API keys are required for fresh uploads
- There is currently no automated smart contract test suite included in the repository

## 12. Useful Commands

From the project root:

```bash
npm run compile
npm run deploy
npm run backend
npm run server
npm run frontend
npm run demo
```

From the backend folder, you can also start FastAPI manually with:

```bash
venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

From the server folder:

```bash
node index.js
```
