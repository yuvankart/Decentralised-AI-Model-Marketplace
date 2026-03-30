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

app.listen(3001, () => {
  console.log("Server running on port 3001");
});