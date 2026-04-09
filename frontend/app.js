const state = {
  account: "",
  web3: null,
  contracts: null,
};

const apiBaseInput = document.querySelector("#apiBase");
const walletAddress = document.querySelector("#walletAddress");
const connectWalletButton = document.querySelector("#connectWallet");
const uploadForm = document.querySelector("#uploadForm");
const registerForm = document.querySelector("#registerForm");
const useForm = document.querySelector("#useForm");
const rateForm = document.querySelector("#rateForm");
const refreshModelsButton = document.querySelector("#refreshModels");
const modelsList = document.querySelector("#modelsList");
const resultLog = document.querySelector("#resultLog");
const LEGACY_GAS_PRICE = "20000000000";

function getApiBase() {
  return apiBaseInput.value.replace(/\/$/, "");
}

function writeLog(message, isError = false) {
  resultLog.textContent =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  resultLog.classList.toggle("status-error", isError);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === "string" ? body : body.error || "Request failed";
    throw new Error(message);
  }

  return body;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillModelId(modelId) {
  document.querySelector("#useModelId").value = modelId;
  document.querySelector("#rateModelId").value = modelId;
  writeLog(`Selected model ${modelId}.`);
}

function renderModels(models) {
  if (!models.length) {
    modelsList.innerHTML = '<p class="muted">No models registered yet.</p>';
    return;
  }

  modelsList.innerHTML = models
    .map(
      (model) => `
        <article class="model-row">
          <div>
            <h3>${escapeHtml(model.id)}. ${escapeHtml(model.ipfsHash)}</h3>
            <dl>
              <dt>Owner</dt>
              <dd>${escapeHtml(model.owner)}</dd>
              <dt>Price</dt>
              <dd>${escapeHtml(model.price)} wei</dd>
              <dt>Usage</dt>
              <dd>${escapeHtml(model.usageCount || "0")}</dd>
              <dt>Average rating</dt>
              <dd>${escapeHtml(model.averageRating || "0")}</dd>
            </dl>
          </div>
          <div class="model-actions">
            <button type="button" data-model-id="${escapeHtml(model.id)}">Select</button>
          </div>
        </article>
      `
    )
    .join("");

  modelsList.querySelectorAll("[data-model-id]").forEach((button) => {
    button.addEventListener("click", () => fillModelId(button.dataset.modelId));
  });
}

async function refreshModels({ updateLog = false } = {}) {
  try {
    refreshModelsButton.disabled = true;
    const models = await requestJson("/models");
    renderModels(models);
    if (updateLog) {
      writeLog({ message: "Models loaded", count: models.length });
    }
  } catch (error) {
    writeLog(error.message, true);
  } finally {
    refreshModelsButton.disabled = false;
  }
}

async function ensureWalletConnected() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not available in this browser.");
  }

  if (!state.account) {
    await connectWallet();
  }

  if (!state.account) {
    throw new Error("Connect MetaMask before sending blockchain transactions.");
  }
}

async function loadContractConfig() {
  const config = await requestJson("/contract-config");

  if (!window.Web3) {
    throw new Error("Web3 bundle did not load.");
  }

  if (!state.web3) {
    state.web3 = new window.Web3(window.ethereum);
  }

  state.contracts = {
    config,
    modelRegistry: new state.web3.eth.Contract(
      config.contracts.modelRegistry.abi,
      config.contracts.modelRegistry.address
    ),
    paymentContract: new state.web3.eth.Contract(
      config.contracts.paymentContract.abi,
      config.contracts.paymentContract.address
    ),
    reputationContract: new state.web3.eth.Contract(
      config.contracts.reputationContract.abi,
      config.contracts.reputationContract.address
    ),
  };
}

async function ensureContractsLoaded() {
  if (!state.contracts) {
    await loadContractConfig();
  }

  return state.contracts;
}

async function sendLegacyTransaction(method, options = {}) {
  const txOptions = {
    from: state.account,
    gasPrice: LEGACY_GAS_PRICE,
    ...options,
  };

  return method.send(txOptions);
}

async function connectWallet() {
  if (!window.ethereum) {
    writeLog("MetaMask is not available in this browser.", true);
    return;
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  state.account = accounts[0] || "";
  walletAddress.textContent = state.account
    ? `Connected: ${state.account}`
    : "Wallet not connected";

  await ensureContractsLoaded();
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    state.account = accounts[0] || "";
    walletAddress.textContent = state.account
      ? `Connected: ${state.account}`
      : "Wallet not connected";
  });
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await ensureWalletConnected();
    const contracts = await ensureContractsLoaded();

    const formData = new FormData(uploadForm);
    const price = formData.get("price");
    const uploadResult = await requestJson("/upload-model", {
      method: "POST",
      body: formData,
    });

    const receipt = await sendLegacyTransaction(
      contracts.modelRegistry.methods.registerModel(uploadResult.cid, price)
    );

    writeLog({
      message: "Model uploaded to IPFS and registered on-chain through MetaMask.",
      cid: uploadResult.cid,
      transactionHash: receipt.transactionHash,
      from: state.account,
    });
    await refreshModels({ updateLog: false });
    uploadForm.reset();
    document.querySelector("#modelPrice").value = "100";
  } catch (error) {
    writeLog(error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await ensureWalletConnected();
    const contracts = await ensureContractsLoaded();
    const data = Object.fromEntries(new FormData(registerForm).entries());

    const receipt = await sendLegacyTransaction(
      contracts.modelRegistry.methods.registerModel(data.ipfsHash, data.price)
    );

    writeLog({
      message: "Existing IPFS model registered through MetaMask.",
      ipfsHash: data.ipfsHash,
      transactionHash: receipt.transactionHash,
      from: state.account,
    });
    await refreshModels({ updateLog: false });
    registerForm.reset();
    document.querySelector("#registerPrice").value = "100";
  } catch (error) {
    writeLog(error.message, true);
  }
});

useForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await ensureWalletConnected();
    const contracts = await ensureContractsLoaded();
    const data = Object.fromEntries(new FormData(useForm).entries());
    const model = await contracts.modelRegistry.methods.getModel(data.modelId).call();

    if (!model || model.id.toString() === "0") {
      throw new Error("Model not found");
    }

    const paymentReceipt = await sendLegacyTransaction(
      contracts.paymentContract.methods.payForModel(data.modelId),
      {
        value: model.price.toString(),
      }
    );

    const result = await requestJson("/use-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: data.modelId,
        inputData: data.inputData,
      }),
    });

    writeLog({
      message: "Payment confirmed in MetaMask and model executed.",
      paymentTransactionHash: paymentReceipt.transactionHash,
      from: state.account,
      result,
    });
    await refreshModels({ updateLog: false });
  } catch (error) {
    writeLog(error.message, true);
  }
});

rateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await ensureWalletConnected();
    const contracts = await ensureContractsLoaded();
    const data = Object.fromEntries(new FormData(rateForm).entries());

    const receipt = await sendLegacyTransaction(
      contracts.reputationContract.methods.rateModel(data.modelId, data.rating)
    );

    writeLog({
      message: "Rating submitted through MetaMask.",
      modelId: data.modelId,
      rating: data.rating,
      transactionHash: receipt.transactionHash,
      from: state.account,
    });
    await refreshModels({ updateLog: false });
  } catch (error) {
    writeLog(error.message, true);
  }
});

connectWalletButton.addEventListener("click", connectWallet);
refreshModelsButton.addEventListener("click", () => refreshModels({ updateLog: true }));

refreshModels();
