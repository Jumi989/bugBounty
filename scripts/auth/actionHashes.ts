import { ethers } from "ethers";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

export function hashCreateBountyAction(params: {
  metadataHash: string;
  metadataCID: string;
  startTime: bigint;
  endTime: bigint;
  escrowAmount: bigint;
}): string {
  return ethers.keccak256(
    abiCoder.encode(
      [
        "bytes32",
        "bytes32",
        "uint64",
        "uint64",
        "uint256",
      ],
      [
        params.metadataHash,
        ethers.keccak256(
          ethers.toUtf8Bytes(params.metadataCID)
        ),
        params.startTime,
        params.endTime,
        params.escrowAmount,
      ]
    )
  );
}

export function hashSubmitBugAction(params: {
  bountyId: bigint;
  reportHash: string;
  encryptedEvidenceCID: string;
  requestedReward: bigint;
}): string {
  return ethers.keccak256(
    abiCoder.encode(
      ["uint256", "bytes32", "bytes32", "uint256"],
      [
        params.bountyId,
        params.reportHash,
        ethers.keccak256(
          ethers.toUtf8Bytes(
            params.encryptedEvidenceCID
          )
        ),
        params.requestedReward,
      ]
    )
  );
}

export function hashAcceptSubmissionAction(
  submissionId: bigint,
  approvedReward: bigint
): string {
  return ethers.keccak256(
    abiCoder.encode(
      ["uint256", "uint256"],
      [submissionId, approvedReward]
    )
  );
}

export function hashRejectSubmissionAction(
  submissionId: bigint,
  rejectionReasonHash: string
): string {
  return ethers.keccak256(
    abiCoder.encode(
      ["uint256", "bytes32"],
      [submissionId, rejectionReasonHash]
    )
  );
}

export function hashBountyIdAction(
  bountyId: bigint
): string {
  return ethers.keccak256(
    abiCoder.encode(["uint256"], [bountyId])
  );
}
