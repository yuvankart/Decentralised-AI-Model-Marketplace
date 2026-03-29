// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AIModelMarketplace {

    struct Model {
        uint id;
        address owner;
        string ipfsHash;
        uint pricePerUse;
    }

    uint public modelCount;
    mapping(uint => Model) public models;

    event ModelRegistered(uint id, address owner, string ipfsHash, uint price);
    event ModelUsed(uint id, address user);

    function registerModel(string memory _ipfsHash, uint _price) public {
        modelCount++;

        models[modelCount] = Model(
            modelCount,
            msg.sender,
            _ipfsHash,
            _price
        );

        emit ModelRegistered(modelCount, msg.sender, _ipfsHash, _price);
    }

    function useModel(uint _modelId) public payable {
        Model memory model = models[_modelId];

        require(model.id != 0, "Model does not exist");
        require(msg.value >= model.pricePerUse, "Insufficient payment");

        payable(model.owner).transfer(msg.value);

        emit ModelUsed(_modelId, msg.sender);
    }

    function getAllModels() public view returns (Model[] memory) {
        Model[] memory allModels = new Model[](modelCount);

        for (uint i = 1; i <= modelCount; i++) {
            allModels[i - 1] = models[i];
        }

        return allModels;
    }
}