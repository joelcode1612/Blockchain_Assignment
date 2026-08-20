// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LogisticsEscrow {

    // =====================================================
    // ENUMS
    // =====================================================

    enum Role {
        None,
        Shipper,
        Carrier
    }

    enum AgreementStatus {
        PendingAcceptance,
        AwaitingFunding,
        Active,
        Completed,
        Rejected,
        Cancelled,
        Refunded,
        Expired
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Verified,
        Paid
    }

    // =====================================================
    // STRUCTS
    // =====================================================

    struct Milestone {
        uint256 milestoneId;
        uint256 paymentPercentage;
        MilestoneStatus status;
        uint256 submittedAt;
        uint256 verifiedAt;
        uint256 paymentReleasedAt;
        string description;  // kept for UI display
    }

    struct Agreement {
        uint256 agreementId;
        address shipper;
        address carrier;
        uint256 escrowAmount;
        uint256 releasedAmount;
        uint256 deadline;
        AgreementStatus status;
        uint256 createdAt;
        bool carrierAccepted;
        bool refundExecuted;
        uint256 milestoneCount;
        mapping(uint256 => Milestone) milestones;
        mapping(uint256 => bool) milestonePaid;
    }

    // =====================================================
    // STATE VARIABLES
    // =====================================================

    mapping(address => Role) public userRoles;
    mapping(uint256 => Agreement) private agreements;
    mapping(address => uint256[]) private shipperAgreements;
    mapping(address => uint256[]) private carrierAgreements;
    mapping(address => uint256) public reputation;  // Simple reputation score

    uint256 public agreementCounter;
    address public owner;

    // =====================================================
    // EVENTS
    // =====================================================

    event UserRegistered(address indexed walletAddress, Role role);
    event AgreementCreated(uint256 indexed agreementId, address indexed shipper, address indexed carrier, uint256 escrowAmount, uint256 deadline);
    event AgreementAccepted(uint256 indexed agreementId, address indexed carrier);
    event AgreementRejected(uint256 indexed agreementId, address indexed carrier);
    event AgreementCancelled(uint256 indexed agreementId, address indexed shipper);
    event EscrowDeposited(uint256 indexed agreementId, address indexed shipper, uint256 amount);
    event MilestoneSubmitted(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed carrier);
    event MilestoneVerified(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed shipper);
    event PaymentReleased(uint256 indexed agreementId, uint256 indexed milestoneId, address indexed receiver, uint256 amount);
    event RefundExecuted(uint256 indexed agreementId, address indexed shipper, uint256 amount);
    event ReputationRewarded(uint256 indexed agreementId, address indexed carrier, uint256 amount);

    // =====================================================
    // MODIFIERS
    // =====================================================

    modifier onlyRegistered() {
        require(userRoles[msg.sender] != Role.None, "User is not registered");
        _;
    }

    modifier onlyShipper() {
        require(userRoles[msg.sender] == Role.Shipper, "Only Shipper can perform this action");
        _;
    }

    modifier onlyCarrier(uint256 _agreementId) {
        require(userRoles[msg.sender] == Role.Carrier, "Only Carrier can perform this action");
        require(agreements[_agreementId].carrier == msg.sender, "Not assigned Carrier");
        _;
    }

    modifier agreementExists(uint256 _agreementId) {
        require(_agreementId > 0 && _agreementId <= agreementCounter, "Agreement does not exist");
        _;
    }

    modifier onlyShipperOfAgreement(uint256 _agreementId) {
        require(msg.sender == agreements[_agreementId].shipper, "Only shipper can perform this action");
        _;
    }

    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    constructor() {
        owner = msg.sender;
    }

    // =====================================================
    // MODULE 1 — REGISTER & LOGIN
    // =====================================================

    function registerUser(Role _role) external {
        require(userRoles[msg.sender] == Role.None, "Wallet already registered");
        require(_role == Role.Shipper || _role == Role.Carrier, "Invalid role");

        userRoles[msg.sender] = _role;

        emit UserRegistered(msg.sender, _role);
    }

    function login() external view returns (bool authenticated, Role role) {
        Role currentRole = userRoles[msg.sender];
        if (currentRole == Role.None) {
            return (false, Role.None);
        }
        return (true, currentRole);
    }

    function getRole(address _wallet) external view returns (Role) {
        return userRoles[_wallet];
    }

    function isRegistered(address _wallet) external view returns (bool) {
        return userRoles[_wallet] != Role.None;
    }

    // =====================================================
    // MODULE 2 — CREATE AGREEMENT
    // =====================================================

    function createAgreement(
        address _carrier,
        uint256 _escrowAmount,
        uint256 _deadline,
        string[] calldata _milestoneDescriptions,
        uint256[] calldata _paymentPercentages
    ) external onlyShipper returns (uint256) {

        require(userRoles[_carrier] == Role.Carrier, "Selected user is not Carrier");
        require(_carrier != msg.sender, "Cannot assign yourself");
        require(_escrowAmount > 0, "Escrow amount must be greater than zero");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(_paymentPercentages.length > 0, "At least one milestone required");
        require(_milestoneDescriptions.length == _paymentPercentages.length, "Mismatch");

        uint256 totalPercentage = 0;
        for (uint256 i = 0; i < _paymentPercentages.length; i++) {
            require(_paymentPercentages[i] > 0, "Invalid milestone percentage");
            totalPercentage += _paymentPercentages[i];
        }
        require(totalPercentage == 100, "Percentages must equal 100");

        agreementCounter++;
        Agreement storage agreement = agreements[agreementCounter];

        agreement.agreementId = agreementCounter;
        agreement.shipper = msg.sender;
        agreement.carrier = _carrier;
        agreement.escrowAmount = _escrowAmount;
        agreement.releasedAmount = 0;
        agreement.deadline = _deadline;
        agreement.status = AgreementStatus.PendingAcceptance;
        agreement.createdAt = block.timestamp;
        agreement.carrierAccepted = false;
        agreement.refundExecuted = false;
        agreement.milestoneCount = _paymentPercentages.length;

        for (uint256 i = 0; i < _paymentPercentages.length; i++) {
            agreement.milestones[i] = Milestone({
                milestoneId: i,
                paymentPercentage: _paymentPercentages[i],
                status: MilestoneStatus.Pending,
                submittedAt: 0,
                verifiedAt: 0,
                paymentReleasedAt: 0,
                description: _milestoneDescriptions[i]
            });
            agreement.milestonePaid[i] = false;
        }

        shipperAgreements[msg.sender].push(agreementCounter);
        carrierAgreements[_carrier].push(agreementCounter);

        emit AgreementCreated(agreementCounter, msg.sender, _carrier, _escrowAmount, _deadline);

        return agreementCounter;
    }

    // =====================================================
    // MODULE 3 — ACCEPT, REJECT, CANCEL
    // =====================================================

    function acceptAgreement(uint256 _agreementId) external agreementExists(_agreementId) onlyCarrier(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.status == AgreementStatus.PendingAcceptance, "Agreement is not pending");

        agreement.carrierAccepted = true;
        agreement.status = AgreementStatus.AwaitingFunding;

        emit AgreementAccepted(_agreementId, msg.sender);
    }

    function rejectAgreement(uint256 _agreementId) external agreementExists(_agreementId) onlyCarrier(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.status == AgreementStatus.PendingAcceptance, "Agreement is not pending");

        agreement.status = AgreementStatus.Rejected;

        emit AgreementRejected(_agreementId, msg.sender);
    }

    function cancelAgreement(uint256 _agreementId) external agreementExists(_agreementId) onlyShipper {
        Agreement storage agreement = agreements[_agreementId];
        require(agreement.shipper == msg.sender, "Only agreement Shipper");
        require(
            agreement.status == AgreementStatus.PendingAcceptance ||
            agreement.status == AgreementStatus.AwaitingFunding,
            "Agreement cannot be cancelled"
        );

        agreement.status = AgreementStatus.Cancelled;

        emit AgreementCancelled(_agreementId, msg.sender);
    }

    // =====================================================
    // MODULE 4 — ESCROW DEPOSIT
    // =====================================================

    function depositEscrow(uint256 _agreementId) external payable agreementExists(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.shipper, "Only shipper can deposit");
        require(!agreement.refundExecuted, "Refund already executed");
        require(agreement.status == AgreementStatus.AwaitingFunding || agreement.status == AgreementStatus.Active, "Invalid status");
        require(msg.value == agreement.escrowAmount, "Incorrect amount");

        agreement.status = AgreementStatus.Active;

        emit EscrowDeposited(_agreementId, msg.sender, msg.value);
    }

    // =====================================================
    // MODULE 5 — MILESTONE SUBMIT, VERIFY, RELEASE
    // =====================================================

    // function submitMilestone(uint256 _agreementId, uint256 _milestoneId) external agreementExists(_agreementId) onlyCarrier(_agreementId) {
    //     Agreement storage agreement = agreements[_agreementId];
    //     require(agreement.status == AgreementStatus.Active, "Agreement not active");
    //     require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
    //     require(agreement.milestones[_milestoneId].status == MilestoneStatus.Pending, "Milestone not pending");

    //     agreement.milestones[_milestoneId].status = MilestoneStatus.Submitted;
    //     agreement.milestones[_milestoneId].submittedAt = block.timestamp;

    //     emit MilestoneSubmitted(_agreementId, _milestoneId, msg.sender);
    // }

    function submitMilestone(uint256 _agreementId,uint256 _milestoneId) external agreementExists(_agreementId) onlyCarrier(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];

        require(agreement.status == AgreementStatus.Active, "Agreement not active");

        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");

        // Milestones must be completed sequentially.
        // The first milestone can be submitted immediately.
        // Every later milestone requires the previous milestone
        // to have been verified by the shipper.
        if (_milestoneId > 0) {
        require(
            agreement.milestones[_milestoneId - 1].status == MilestoneStatus.Verified ||
            agreement.milestones[_milestoneId - 1].status == MilestoneStatus.Paid,
            "Previous milestone not verified or paid"
        );
    }

        require(agreement.milestones[_milestoneId].status == MilestoneStatus.Pending, "Milestone not pending");

        agreement.milestones[_milestoneId].status = MilestoneStatus.Submitted;
        agreement.milestones[_milestoneId].submittedAt = block.timestamp;

        emit MilestoneSubmitted(_agreementId, _milestoneId, msg.sender);
    }

    function verifyMilestone(uint256 _agreementId, uint256 _milestoneId) external agreementExists(_agreementId) onlyShipper {
        Agreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.shipper, "Only shipper can verify");
        require(agreement.status == AgreementStatus.Active, "Agreement not active");
        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
        require(agreement.milestones[_milestoneId].status == MilestoneStatus.Submitted, "Milestone not submitted");
        require(block.timestamp <= agreement.deadline, "Deadline passed");

        agreement.milestones[_milestoneId].status = MilestoneStatus.Verified;
        agreement.milestones[_milestoneId].verifiedAt = block.timestamp;

        emit MilestoneVerified(_agreementId, _milestoneId, msg.sender);
    }

    function releasePayment(uint256 _agreementId, uint256 _milestoneId) external agreementExists(_agreementId) onlyShipper {
        Agreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.shipper, "Only shipper can release");
        require(agreement.status == AgreementStatus.Active, "Agreement not active");
        require(_milestoneId < agreement.milestoneCount, "Invalid milestone");
        require(agreement.milestones[_milestoneId].status == MilestoneStatus.Verified, "Milestone not verified");
        require(!agreement.milestonePaid[_milestoneId], "Already paid");

        uint256 paymentAmount = (agreement.escrowAmount * agreement.milestones[_milestoneId].paymentPercentage) / 100;
        require(paymentAmount <= (agreement.escrowAmount - agreement.releasedAmount), "Insufficient escrow balance");

        agreement.milestones[_milestoneId].status = MilestoneStatus.Paid;
        agreement.milestones[_milestoneId].paymentReleasedAt = block.timestamp;
        agreement.milestonePaid[_milestoneId] = true;
        agreement.releasedAmount += paymentAmount;

        (bool success, ) = payable(agreement.carrier).call{value: paymentAmount}("");
        require(success, "Payment transfer failed");

        // Award reputation to Carrier
        reputation[agreement.carrier] += 1;

        emit PaymentReleased(_agreementId, _milestoneId, agreement.carrier, paymentAmount);
        emit ReputationRewarded(_agreementId, agreement.carrier, 1);

        // Check if all milestones are paid
        bool allComplete = true;
        for (uint256 i = 0; i < agreement.milestoneCount; i++) {
            if (!agreement.milestonePaid[i]) {
                allComplete = false;
                break;
            }
        }
        if (allComplete) {
            agreement.status = AgreementStatus.Completed;
        }
    }

    // =====================================================
    // MODULE 6 — REFUND
    // =====================================================

    function refund(uint256 _agreementId) external agreementExists(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(msg.sender == agreement.shipper, "Only shipper can refund");
        require(block.timestamp > agreement.deadline, "Deadline not passed yet");
        require(!agreement.refundExecuted, "Refund already executed");

        uint256 remainingBalance = agreement.escrowAmount - agreement.releasedAmount;
        require(remainingBalance > 0, "No balance to refund");

        agreement.refundExecuted = true;
        agreement.status = AgreementStatus.Refunded;

        (bool success, ) = payable(agreement.shipper).call{value: remainingBalance}("");
        require(success, "Refund transfer failed");

        emit RefundExecuted(_agreementId, agreement.shipper, remainingBalance);
    }


    // =====================================================
    // MODULE 7 — VIEW FUNCTIONS (GETTERS)
    // =====================================================

    function getAgreement(uint256 _agreementId) external view agreementExists(_agreementId) returns (
        uint256 agreementId,
        address shipper,
        address carrier,
        uint256 escrowAmount,
        uint256 releasedAmount,
        uint256 deadline,
        AgreementStatus status,
        uint256 createdAt,
        bool carrierAccepted,
        bool refundExecuted,
        uint256 milestoneCount
    ) {
        Agreement storage agreement = agreements[_agreementId];
        return (
            agreement.agreementId,
            agreement.shipper,
            agreement.carrier,
            agreement.escrowAmount,
            agreement.releasedAmount,
            agreement.deadline,
            agreement.status,
            agreement.createdAt,
            agreement.carrierAccepted,
            agreement.refundExecuted,
            agreement.milestoneCount
        );
    }

    // NEW FUNCTION: Enforce Expired Status
    function markExpired(uint256 _agreementId) external agreementExists(_agreementId) {
        Agreement storage agreement = agreements[_agreementId];
        require(block.timestamp > agreement.deadline, "Deadline not passed");
        require(agreement.status == AgreementStatus.Active, "Agreement not active");
        
        agreement.status = AgreementStatus.Expired;
    }

    function getMilestone(uint256 _agreementId, uint256 _milestoneId) external view agreementExists(_agreementId) returns (
        uint256 milestoneId,
        uint256 paymentPercentage,
        MilestoneStatus status,
        uint256 submittedAt,
        uint256 verifiedAt,
        uint256 paymentReleasedAt,
        string memory description
    ) {
        require(_milestoneId < agreements[_agreementId].milestoneCount, "Milestone does not exist");
        Milestone storage milestone = agreements[_agreementId].milestones[_milestoneId];
        return (
            milestone.milestoneId,
            milestone.paymentPercentage,
            milestone.status,
            milestone.submittedAt,
            milestone.verifiedAt,
            milestone.paymentReleasedAt,
            milestone.description
        );
    }

    function getAgreementCount() external view returns (uint256) {
        return agreementCounter;
    }

    function getShipperAgreements(address _shipper) external view returns (uint256[] memory) {
        return shipperAgreements[_shipper];
    }

    function getCarrierAgreements(address _carrier) external view returns (uint256[] memory) {
        return carrierAgreements[_carrier];
    }

    function getEscrowBalance(uint256 _agreementId) external view agreementExists(_agreementId) returns (uint256) {
        return agreements[_agreementId].escrowAmount - agreements[_agreementId].releasedAmount;
    }

    function getMilestoneCount(uint256 _agreementId) external view agreementExists(_agreementId) returns (uint256) {
        return agreements[_agreementId].milestoneCount;
    }

    function getReleasedAmount(uint256 _agreementId) external view agreementExists(_agreementId) returns (uint256) {
        return agreements[_agreementId].releasedAmount;
    }

    function isDeadlinePassed(uint256 _agreementId) external view agreementExists(_agreementId) returns (bool) {
        return block.timestamp > agreements[_agreementId].deadline;
    }

    function getReputation(address _wallet) external view returns (uint256) {
        return reputation[_wallet];
    }

    // =====================================================
    // RECEIVE ETH
    // =====================================================

    receive() external payable {
        revert("Use escrow deposit function");
    }

    fallback() external payable {
        revert("Invalid function");
    }
}