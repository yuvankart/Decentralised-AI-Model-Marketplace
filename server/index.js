const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const fs = require("fs");
const express = require("express");
const { Web3 } = require("web3");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const ModelRegistryJSON = require("../build/contracts/ModelRegistry.json");
const PaymentJSON = require("../build/contracts/PaymentContract.json");
const ReputationJSON = require("../build/contracts/ReputationContract.json");

const app = express();
const upload = multer();
const web3 = new Web3(process.env.GANACHE_URL || "http://127.0.0.1:7545");

const DEFAULT_NETWORK_ID = process.env.TRUFFLE_NETWORK_ID || "5777";
const DEFAULT_MODEL_PRICE = process.env.DEFAULT_MODEL_PRICE_WEI || "100";
const MODEL_RUNNER_URL = process.env.MODEL_RUNNER_URL || "http://127.0.0.1:8000/run-model";
const MODEL_CACHE_DIR = path.resolve(__dirname, "model-cache");
const WEB3_BUNDLE_PATH = path.resolve(__dirname, "node_modules", "web3", "dist", "web3.min.js");
const SUPPORTED_MODEL_EXTENSIONS = new Set([".json", ".onnx"]);

app.use(cors());
app.use(express.json());

function getDeployedAddress(artifact) {
  const network =
    artifact.networks[DEFAULT_NETWORK_ID] ||
    artifact.networks[Object.keys(artifact.networks)[0]];

  if (!network?.address) {
    throw new Error(`${artifact.contractName} has not been deployed yet`);
  }

  return network.address;
}

const modelRegistry = new web3.eth.Contract(
  ModelRegistryJSON.abi,
  getDeployedAddress(ModelRegistryJSON)
);

const paymentContract = new web3.eth.Contract(
  PaymentJSON.abi,
  getDeployedAddress(PaymentJSON)
);

const reputationContract = new web3.eth.Contract(
  ReputationJSON.abi,
  getDeployedAddress(ReputationJSON)
);

function formatModel(model) {
  return {
    id: model.id.toString(),
    owner: model.owner,
    ipfsHash: model.ipfsHash,
    price: model.price.toString(),
  };
}

function isMissingModel(model) {
  return !model || model.id.toString() === "0";
}

async function getSender(requestedAccount) {
  const accounts = await web3.eth.getAccounts();
  if (!accounts.length) {
    throw new Error("No unlocked Ganache accounts found");
  }

  if (requestedAccount) {
    const normalizedAccount = requestedAccount.toLowerCase();
    const matchingAccount = accounts.find(
      (account) => account.toLowerCase() === normalizedAccount
    );

    if (matchingAccount) {
      return matchingAccount;
    }

    console.warn(
      `Requested account ${requestedAccount} is not unlocked in Ganache; using ${accounts[0]} instead.`
    );
  }

  return accounts[0];
}

async function addModelStats(model) {
  const id = model.id.toString();
  const [usageCount, averageRating] = await Promise.all([
    paymentContract.methods.getUsage(id).call(),
    reputationContract.methods.getAverageRating(id).call(),
  ]);

  return {
    ...formatModel(model),
    usageCount: usageCount.toString(),
    averageRating: averageRating.toString(),
  };
}

function parseModelSpec(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error("Uploaded model must be a valid JSON file");
  }
}

function validateModelSpec(modelSpec) {
  if (!modelSpec || Array.isArray(modelSpec) || typeof modelSpec !== "object") {
    throw new Error("Uploaded model spec must be a JSON object");
  }

  if (modelSpec.type && !["linear", "multiply", "add"].includes(modelSpec.type)) {
    throw new Error("Unsupported model type. Use linear, multiply, or add");
  }
}

function getModelCachePath(cid, extension = ".json") {
  const safeCid = cid.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(MODEL_CACHE_DIR, `${safeCid}${extension}`);
}

async function cacheModelSpec(cid, modelSpec) {
  fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
  await fs.promises.writeFile(
    getModelCachePath(cid, ".json"),
    JSON.stringify(modelSpec, null, 2)
  );
}

async function cacheModelFile(cid, extension, buffer) {
  fs.mkdirSync(MODEL_CACHE_DIR, { recursive: true });
  const filePath = getModelCachePath(cid, extension);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

async function getCachedModelSpec(cid) {
  try {
    const rawModel = await fs.promises.readFile(getModelCachePath(cid, ".json"), "utf8");
    return JSON.parse(rawModel);
  } catch {
    return null;
  }
}

async function getCachedModelFile(cid) {
  for (const extension of SUPPORTED_MODEL_EXTENSIONS) {
    try {
      const filePath = getModelCachePath(cid, extension);
      await fs.promises.access(filePath, fs.constants.R_OK);
      return {
        path: filePath,
        format: extension === ".onnx" ? "onnx" : "json",
      };
    } catch {
      continue;
    }
  }

  return null;
}

function getUploadedExtension(file) {
  return path.extname(file.originalname || "").toLowerCase();
}

app.get("/", (req, res) => {
  res.json({ message: "Node Web3 Server Running" });
});

app.get("/web3.min.js", (req, res) => {
  res.sendFile(WEB3_BUNDLE_PATH);
});

app.get("/contract-config", async (req, res) => {
  try {
    const chainId = await web3.eth.getChainId();

    res.json({
      chainId: chainId.toString(),
      contracts: {
        modelRegistry: {
          address: getDeployedAddress(ModelRegistryJSON),
          abi: ModelRegistryJSON.abi,
        },
        paymentContract: {
          address: getDeployedAddress(PaymentJSON),
          abi: PaymentJSON.abi,
        },
        reputationContract: {
          address: getDeployedAddress(ReputationJSON),
          abi: ReputationJSON.abi,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error loading contract configuration" });
  }
});

app.get("/models", async (req, res) => {
  try {
    const models = await modelRegistry.methods.listModels().call();
    const formattedModels = await Promise.all(models.map(addModelStats));

    res.json(formattedModels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching models" });
  }
});

app.post("/register-model", async (req, res) => {
  try {
    const { ipfsHash, price = DEFAULT_MODEL_PRICE, account } = req.body;

    if (!ipfsHash) {
      return res.status(400).json({ error: "ipfsHash is required" });
    }

    const from = await getSender(account);
    const receipt = await modelRegistry.methods.registerModel(ipfsHash, price).send({
      from,
      gas: 3000000,
      gasPrice: "20000000000",
    });

    const modelId = await modelRegistry.methods.modelCount().call();
    const model = await modelRegistry.methods.getModel(modelId).call();

    res.json({
      message: "Model registered",
      model: formatModel(model),
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error registering model" });
  }
});

app.post("/upload-model", upload.single("file"), async (req, res) => {
  try {
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

    if (!pinataApiKey || !pinataSecretApiKey) {
      return res.status(500).json({
        error: "Pinata credentials are not configured",
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const extension = getUploadedExtension(req.file);
    if (!SUPPORTED_MODEL_EXTENSIONS.has(extension)) {
      return res.status(400).json({
        error: "Unsupported model file. Upload a .json or .onnx model.",
      });
    }

    let modelSpec = null;
    let modelFormat = extension === ".onnx" ? "onnx" : "json";

    if (modelFormat === "json") {
      modelSpec = parseModelSpec(req.file.buffer);
      validateModelSpec(modelSpec);
    }

    const data = new FormData();
    data.append("file", req.file.buffer, req.file.originalname);

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      data,
      {
        headers: {
          ...data.getHeaders(),
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretApiKey,
        },
      }
    );

    const cid = response.data.IpfsHash;
    if (modelFormat === "json") {
      await cacheModelSpec(cid, modelSpec);
    } else {
      await cacheModelFile(cid, extension, req.file.buffer);
    }

    const price = req.body.price || DEFAULT_MODEL_PRICE;

    res.json({
      message: "Model uploaded to IPFS. Register it with MetaMask.",
      cid,
      price: price.toString(),
      modelFormat,
      modelSpec,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.post("/use-model", async (req, res) => {
  try {
    const { modelId, inputData } = req.body;

    if (!modelId || inputData === undefined) {
      return res.status(400).json({ error: "modelId and inputData are required" });
    }

    const model = await modelRegistry.methods.getModel(modelId).call();

    if (isMissingModel(model)) {
      return res.status(404).json({ error: "Model not found" });
    }

    const cachedModel = await getCachedModelFile(model.ipfsHash);
    const requestBody = {};

    if (cachedModel?.format === "json") {
      requestBody.model_spec = await getCachedModelSpec(model.ipfsHash);
      requestBody.model_format = "json";
    }

    if (cachedModel?.format === "onnx") {
      requestBody.model_format = "onnx";
      requestBody.model_path = cachedModel.path;
    }

    const response = await axios.post(
      MODEL_RUNNER_URL,
      Object.keys(requestBody).length ? requestBody : null,
      {
      params: {
        model_id: Number(modelId),
        input_data: Number(inputData),
        ipfs_hash: model.ipfsHash,
      },
      }
    );

    res.json({
      message: "Model executed after payment",
      model: formatModel(model),
      modelFormat: cachedModel?.format || "unknown",
      result: response.data,
    });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Error using model" });
  }
});

app.post("/rate-model", async (req, res) => {
  try {
    const { modelId, rating, account } = req.body;

    if (!modelId || rating === undefined) {
      return res.status(400).json({ error: "modelId and rating are required" });
    }

    const from = await getSender(account);
    const receipt = await reputationContract.methods.rateModel(modelId, rating).send({
      from,
      gas: 3000000,
      gasPrice: "20000000000",
    });

    const averageRating = await reputationContract.methods.getAverageRating(modelId).call();

    res.json({
      message: "Model rated",
      modelId: modelId.toString(),
      averageRating: averageRating.toString(),
      transactionHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error rating model" });
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
