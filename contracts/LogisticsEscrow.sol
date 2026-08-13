// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LogisticsEscrow {
    address public owner;

    struct Agreement {
        address shipper;
        address carrier;
        uint256 totalAmount;
        uint256 remainingAmount;
        bool funded;
        bool completed;
        uint256 deadline;
        uint256 milestoneCount;
        mapping(uint256 => Milestone) milestones;
        mapping(uint256 => bool) milestonePaid;
        AgreementStatus status;
    }

    enum AgreementStatus { Pending, Active, Completed, Refunded }

    struct Milestone {
        string description;
        uint256 percentage;
        bool verified;
        bool paid;
    }

    mapping(uint256 => Agreement) public agreements;
    uint256 public agreementCounter;

    constructor() {
        owner = msg.sender;
    }

    event AgreementCreated(uint256 indexed agreementId, address shipper, address carrier);
    event EscrowDeposited(uint256 indexed agreementId, uint256 amount);
    event MilestoneVerified(uint256 indexed agreementId, uint256 milestoneId);
    event PaymentReleased(uint256 indexed agreementId, uint256 milestoneId, uint256 amount);
    event Refunded(uint256 indexed agreementId, uint256 amount);

    modifier onlyShipper(uint256 _agreementId) {
        require(msg.sender == agreements[_agreementId].shipper, "Only shipper");
        _;
    }

    modifier onlyCarrier(uint256 _agreementId) {
        require(msg.sender == agreements[_agreementId].carrier, "Only carrier");
        _;
    }

    modifier agreementExists(uint256 _agreementId) {
        require(agreements[_agreementId].shipper != address(0), "Agreement does not exist");
        _;
    }

    function createAgreement(
        address _carrier,
        uint256 _totalAmount,
        uint256 _deadline,
        string[] memory _milestoneDescriptions,
        uint256[] memory _milestonePercentages
    ) external returns (uint256) {
        require(_carrier != address(0), "Invalid carrier");
        require(_totalAmount > 0, "Total amount must be > 0");
        require(_deadline > block.timestamp, "Deadline must be in future");
        require(_milestoneDescriptions.length == _milestonePercentages.length, "Mismatch");

        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _milestonePercentages.length; i++) {
            totalPercentage += _milestonePercentages[i];
        }
        require(totalPercentage == 100, "Total percentage must be 100%");

        uint256 agreementId = agreementCounter++;
        Agreement storage agreement = agreements[agreementId];
        agreement.shipper = msg.sender;
        agreement.carrier = _carrier;
        agreement.totalAmount = _totalAmount;
        agreement.remainingAmount = 0;
        agreement.funded = false;
        agreement.completed = false;
        agreement.deadline = _deadline;
        agreement.milestoneCount = _milestoneDescriptions.length;
        agreement.status = AgreementStatus.Pending;

        for (uint256 i = 0; i < _milestoneDescriptions.length; i++) {
            agreement.milestones[i].description = _milestoneDescriptions[i];
            agreement.milestones[i].percentage = _milestonePercentages[i];
            agreement.milestones[i].verified = false;
            agreement.milestones[i].paid = false;
        }

        emit AgreementCreated(agreementId, msg.sender, _carrier);
        return agreementId;
    }

    function depositEscrow(uint256 _agreementId) external payable agreementExists(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.shipper, "Only shipper can deposit");
        require(!agreement.funded, "Already funded");
        require(msg.value == agreement.totalAmount, "Incorrect amount");
        require(agreement.status == AgreementStatus.Pending, "Invalid status");

        agreement.remainingAmount = msg.value;
        agreement.funded = true;
        agreement.status = AgreementStatus.Active;

        emit EscrowDeposited(_agreementId, msg.value);
    }

    function verifyMilestone(uint256 _agreementId, uint256 _milestoneId)
        external
        agreementExists(_agreementId)
        onlyShipper(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.funded, "Escrow not funded");
        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
        require(!agreement.milestones[_milestoneId].verified, "Already verified");
        require(block.timestamp <= agreement.deadline, "Deadline passed");

        agreement.milestones[_milestoneId].verified = true;
        emit MilestoneVerified(_agreementId, _milestoneId);
    }

    function releasePayment(uint256 _agreementId, uint256 _milestoneId)
        external
        agreementExists(_agreementId)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.funded, "Escrow not funded");
        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
        require(agreement.milestones[_milestoneId].verified, "Milestone not verified");
        require(!agreement.milestones[_milestoneId].paid, "Already paid");
        require(!agreement.milestonePaid[_milestoneId], "Payment already released");

        uint256 paymentAmount = (agreement.totalAmount * agreement.milestones[_milestoneId].percentage) / 100;
        require(paymentAmount <= agreement.remainingAmount, "Insufficient escrow balance");

        agreement.milestones[_milestoneId].paid = true;
        agreement.milestonePaid[_milestoneId] = true;
        agreement.remainingAmount -= paymentAmount;

        (bool success, ) = payable(agreement.carrier).call{value: paymentAmount}("");
        require(success, "Payment transfer failed");

        emit PaymentReleased(_agreementId, _milestoneId, paymentAmount);

        bool allComplete = true;
        for (uint256 i = 0; i < agreement.milestoneCount; i++) {
            if (!agreement.milestones[i].paid) {
                allComplete = false;
                break;
            }
        }
        if (allComplete) {
            agreement.status = AgreementStatus.Completed;
            agreement.completed = true;
        }
    }

    function refund(uint256 _agreementId) external agreementExists(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.funded, "Escrow not funded");
        require(block.timestamp > agreement.deadline, "Deadline not passed yet");
        require(agreement.remainingAmount > 0, "No balance to refund");

        uint256 refundAmount = agreement.remainingAmount;
        agreement.remainingAmount = 0;
        agreement.status = AgreementStatus.Refunded;

        (bool success, ) = payable(agreement.shipper).call{value: refundAmount}("");
        require(success, "Refund transfer failed");

        emit Refunded(_agreementId, refundAmount);
    }

    // ✅ View functions – they use uint256 agreementId (same as onchain_id)
    function getEscrowBalance(uint256 _agreementId) external view agreementExists(_agreementId) returns (uint256) {
        return agreements[_agreementId].remainingAmount;
    }

    function getAgreementDetails(uint256 _agreementId)
        external
        view
        agreementExists(_agreementId)
        returns (
            address shipper,
            address carrier,
            uint256 totalAmount,
            uint256 remainingAmount,
            bool funded,
            bool completed,
            uint256 deadline,
            AgreementStatus status
        )
    {
        Agreement storage agreement = agreements[_agreementId];
        return (
            agreement.shipper,
            agreement.carrier,
            agreement.totalAmount,
            agreement.remainingAmount,
            agreement.funded,
            agreement.completed,
            agreement.deadline,
            agreement.status
        );
    }

    function getMilestone(uint256 _agreementId, uint256 _milestoneId)
        external
        view
        agreementExists(_agreementId)
        returns (string memory description, uint256 percentage, bool verified, bool paid)
    {
        Agreement storage agreement = agreements[_agreementId];
        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
        Milestone storage milestone = agreement.milestones[_milestoneId];
        return (milestone.description, milestone.percentage, milestone.verified, milestone.paid);
    }
}