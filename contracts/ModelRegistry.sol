// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ModelRegistry {

    struct Model {
        uint id;
        address owner;
        string ipfsHash;
        uint price;
    }

    uint public modelCount;

    mapping(uint => Model) public models;

    function registerModel(string memory _ipfsHash, uint _price) public {
        modelCount++;

        models[modelCount] = Model(
            modelCount,
            msg.sender,
            _ipfsHash,
            _price
        );
    }

    function getModel(uint _id) public view returns (Model memory) {
        return models[_id];
    }

    function listModels() public view returns (Model[] memory) {
        Model[] memory allModels = new Model[](modelCount);

        for (uint i = 1; i <= modelCount; i++) {
            allModels[i - 1] = models[i];
        }

        return allModels;
    }
}