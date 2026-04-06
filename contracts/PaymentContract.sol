// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ModelRegistry.sol";

contract PaymentContract {

    ModelRegistry public registry;

    mapping(uint => uint) public usageCount;

    constructor(address _registryAddress) {
        registry = ModelRegistry(_registryAddress);
    }

    function payForModel(uint _modelId) public payable {
        ModelRegistry.Model memory model = registry.getModel(_modelId);

        require(model.id != 0, "Model does not exist");
        require(msg.value >= model.price, "Insufficient payment");

        payable(model.owner).transfer(msg.value);

        usageCount[_modelId]++;
    }

    function getUsage(uint _modelId) public view returns (uint) {
        return usageCount[_modelId];
    }
}