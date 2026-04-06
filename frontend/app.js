const state = {
  account: "",
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

function getApiBase() {
  return apiBaseInput.value.replace(/\/$/, "");
}

function writeLog(message, isError = false) {
  resultLog.textContent =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  resultLog.classList.toggle("status-error", isError);
}

function getAccountPayload() {
  return state.account ? { account: state.account } : {};
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshModels() {
  try {
    refreshModelsButton.disabled = true;
    const models = await requestJson("/models");
    renderModels(models);
    writeLog({ message: "Models loaded", count: models.length });
  } catch (error) {
    writeLog(error.message, true);
  } finally {
    refreshModelsButton.disabled = false;
  }
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(uploadForm);
  if (state.account) {
    formData.append("account", state.account);
  }

  try {
    const result = await requestJson("/upload-model", {
      method: "POST",
      body: formData,
    });
    writeLog(result);
    await refreshModels();
    uploadForm.reset();
    document.querySelector("#modelPrice").value = "100";
  } catch (error) {
    writeLog(error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(registerForm).entries());

  try {
    const result = await requestJson("/register-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        ...getAccountPayload(),
      }),
    });
    writeLog(result);
    await refreshModels();
    registerForm.reset();
    document.querySelector("#registerPrice").value = "100";
  } catch (error) {
    writeLog(error.message, true);
  }
});

useForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(useForm).entries());

  try {
    const result = await requestJson("/use-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        ...getAccountPayload(),
      }),
    });
    writeLog(result);
    await refreshModels();
  } catch (error) {
    writeLog(error.message, true);
  }
});

rateForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(rateForm).entries());

  try {
    const result = await requestJson("/rate-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        ...getAccountPayload(),
      }),
    });
    writeLog(result);
    await refreshModels();
  } catch (error) {
    writeLog(error.message, true);
  }
});

connectWalletButton.addEventListener("click", connectWallet);
refreshModelsButton.addEventListener("click", refreshModels);

refreshModels();
