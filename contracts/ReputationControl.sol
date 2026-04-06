// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ModelRegistry.sol";

contract ReputationContract {

    ModelRegistry public registry;

    mapping(uint => uint) public totalRatings;
    mapping(uint => uint) public ratingCount;

    constructor(address _registryAddress) {
        registry = ModelRegistry(_registryAddress);
    }

    function rateModel(uint _modelId, uint _rating) public {
        require(_rating >= 1 && _rating <= 5, "Invalid rating");

        ModelRegistry.Model memory model = registry.getModel(_modelId);
        require(model.id != 0, "Model does not exist");

        totalRatings[_modelId] += _rating;
        ratingCount[_modelId] += 1;
    }

    function getAverageRating(uint _modelId) public view returns (uint) {
        if (ratingCount[_modelId] == 0) {
            return 0;
        }

        return totalRatings[_modelId] / ratingCount[_modelId];
    }
}