const express = require("express");
const { Web3 } = require("web3");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Ganache
const web3 = new Web3("http://127.0.0.1:7545");

// Replace with your deployed contract address

// Replace with ABI (we’ll get this next step)
const contractJSON = require("../build/contracts/AIModelMarketplace.json");

const contractABI = contractJSON.abi;
const contractAddress = contractJSON.networks["5777"].address;

const contract = new web3.eth.Contract(contractABI, contractAddress);

app.get("/", (req, res) => {
  res.send("Node Web3 Server Running");
});

app.get("/models", async (req, res) => {
  try {
    const models = await contract.methods.getAllModels().call();

    const formattedModels = models.map(m => ({
    id: m.id.toString(),
    owner: m.owner,
    ipfsHash: m.ipfsHash,
    pricePerUse: m.pricePerUse.toString()
    }));

    res.json(formattedModels);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching models");
  }
});

const axios = require("axios");

app.post("/use-model", async (req, res) => {
  try {
    const { modelId, inputData } = req.body;

    // 1️⃣ Get model from blockchain
    const model = await contract.methods.models(modelId).call();

    if (model.id === "0") {
      return res.status(404).json({ error: "Model not found" });
    }

    // 2️⃣ Call FastAPI (run AI model)
    const response = await axios.post("http://127.0.0.1:8000/run-model", null, {
      params: {
        model_id: parseInt(modelId),
        input_data: parseFloat(inputData)
      }
    });

    const result = response.data;

    // 3️⃣ Call smart contract (log usage / payment)
    const accounts = await web3.eth.getAccounts();

    await contract.methods.useModel(modelId).send({
      from: accounts[0],
      value: model.pricePerUse,
      gas: 3000000,
      gasPrice: "20000000000"
    });

    // 4️⃣ Return result
    const cleanModel = {
      id: model.id.toString(),
      owner: model.owner,
      ipfsHash: model.ipfsHash,
      pricePerUse: model.pricePerUse.toString()
    };

    res.json({
      model: cleanModel,
      result
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error using model" });
  }
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});