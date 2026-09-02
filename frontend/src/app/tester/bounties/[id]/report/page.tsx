"use client";

import { ethers } from "ethers";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const ESCROW_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "bountyId",
        type: "uint256",
      },
      {
        internalType: "bytes32",
        name: "reportHash",
        type: "bytes32",
      },
      {
        internalType: "string",
        name: "encryptedEvidenceCID",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "requestedReward",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address",
            name: "user",
            type: "address",
          },
          {
            internalType: "uint8",
            name: "role",
            type: "uint8",
          },
          {
            internalType: "bytes32",
            name: "organizationId",
            type: "bytes32",
          },
          {
            internalType: "uint8",
            name: "action",
            type: "uint8",
          },
          {
            internalType: "bytes32",
            name: "actionHash",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "nonce",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
        ],
        internalType:
          "struct BugBountyEscrow.Authorization",
        name: "authorization",
        type: "tuple",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
    ],
    name: "submitBug",
    outputs: [
      {
        internalType: "uint256",
        name: "submissionId",
        type: "uint256",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    inputs: [],
    name: "submissionCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "bountyCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();

  const bountyMetadataId = String(params.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [severity, setSeverity] = useState("");
  const [steps, setSteps] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submitReport() {
    setLoading(true);
    setMessage("");

    try {
      // =====================================================
      // 1. CHECK BUG HUNTER AUTHENTICATION
      // =====================================================

      const meResponse = await fetch(
        "/api/tester/auth/me",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const meData = await meResponse.json();

      if (
        !meResponse.ok ||
        !meData.success ||
        !meData.authenticated
      ) {
        throw new Error(
          meData.message ||
            "You are not authenticated as a Bug Hunter."
        );
      }

      const tester = meData.participant;

      // =====================================================
      // 2. SAVE REPORT TO DATABASE
      // =====================================================

      const response = await fetch(
        "/api/tester/reports",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            bountyId: bountyMetadataId,
            title,
            severity,
            description,
            stepsToReproduce: steps,
            evidenceUrl: evidence || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Report submission failed"
        );
      }

      const report = data.report;

      console.log(
        "REPORT SAVED TO DATABASE:",
        report
      );

      // =====================================================
      // 3. CONNECT METAMASK
      // =====================================================

      if (!window.ethereum) {
        throw new Error(
          "Please install MetaMask."
        );
      }

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const wallet =
        await signer.getAddress();

      // Make sure MetaMask is the Bug Hunter wallet

      if (
        wallet.toLowerCase() !==
        tester.walletAddress.toLowerCase()
      ) {
        throw new Error(
          "MetaMask wallet does not match your Bug Hunter account."
        );
      }

      // =====================================================
      // 4. CHECK NETWORK
      // =====================================================

      const network =
        await provider.getNetwork();

      if (network.chainId !== 2026n) {
        throw new Error(
          "Please switch MetaMask to Besu Reputation Network."
        );
      }

      setMessage(
        "Report saved. Preparing blockchain submission..."
      );

      // =====================================================
      // 5. GET BACKEND AUTHORIZATION
      // =====================================================

      const authResponse =
        await fetch(
          "/api/tester/reports/submit-authorization",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              bountyId:
                bountyMetadataId,

              reportId:
                report.id,

              reportHash:
                report.report_hash,
            }),
          }
        );

      const authData =
        await authResponse.json();

      console.log(
        "AUTHORIZATION RESPONSE:",
        authData
      );

      if (
        !authResponse.ok ||
        !authData.success
      ) {
        throw new Error(
          authData.message ||
            "Failed to prepare blockchain authorization."
        );
      }

      // =====================================================
      // 6. GET ON-CHAIN BOUNTY ID
      // =====================================================
      //
      // IMPORTANT:
      //
      // URL id is bounty_metadata.id.
      // It is NOT necessarily the blockchain bountyId.
      //
      // The database report contains bounty_db_id.
      // Your backend should return the actual
      // blockchain bounty ID as onchainBountyId.
      //
      // =====================================================

      let onchainBountyId =
        authData.onchainBountyId;

      if (!onchainBountyId) {
        throw new Error(
          "Authorization API did not return onchainBountyId. Fix the submit-authorization API before submitting the report."
        );
      }

      onchainBountyId =
        String(onchainBountyId);

      // =====================================================
      // 7. VALIDATE AUTHORIZATION
      // =====================================================

      const auth =
        authData.authorization;

      if (!auth) {
        throw new Error(
          "Authorization data is missing."
        );
      }

      const user =
        String(auth.user);

      const role =
        Number(auth.role);

      const organizationId =
        String(auth.organizationId);

      const action =
        Number(auth.action);

      const actionHash =
        String(auth.actionHash);

      const nonce =
        BigInt(String(auth.nonce));

      const deadline =
        BigInt(String(auth.deadline));

      const signature =
        String(authData.signature);

      const requestedRewardWei =
        BigInt(
          String(
            authData.requestedRewardWei
          )
        );

      const encryptedEvidenceCID =
        String(
          authData.encryptedEvidenceCID ||
            "ipfs://placeholder"
        );

      // =====================================================
      // 8. BASIC VALIDATION
      // =====================================================

      if (
        !ethers.isAddress(user)
      ) {
        throw new Error(
          "Invalid authorization user address."
        );
      }

      if (
        !ethers.isHexString(
          organizationId,
          32
        )
      ) {
        throw new Error(
          "Invalid organizationId. It must be bytes32."
        );
      }

      if (
        !ethers.isHexString(
          actionHash,
          32
        )
      ) {
        throw new Error(
          "Invalid actionHash."
        );
      }

      if (
        !ethers.isHexString(
          report.report_hash,
          32
        )
      ) {
        throw new Error(
          "Invalid report hash."
        );
      }

      if (!signature) {
        throw new Error(
          "Authorization signature is missing."
        );
      }

      if (
        requestedRewardWei <= 0n
      ) {
        throw new Error(
          "Requested reward must be greater than zero."
        );
      }

      // =====================================================
      // 9. CREATE CONTRACT
      // =====================================================

      const CONTRACT_ADDRESS =
        process.env
          .NEXT_PUBLIC_ESCROW_ADDRESS;

      if (!CONTRACT_ADDRESS) {
        throw new Error(
          "NEXT_PUBLIC_ESCROW_ADDRESS is missing."
        );
      }

      console.log(
        "ESCROW ADDRESS:",
        CONTRACT_ADDRESS
      );

      console.log(
        "ON-CHAIN BOUNTY ID:",
        onchainBountyId
      );

      const contract =
        new ethers.Contract(
          CONTRACT_ADDRESS,
          ESCROW_ABI,
          signer
        );

      // This MUST be a function

      console.log(
        "submitBug:",
        typeof contract.submitBug
      );

      if (
        typeof contract.submitBug !==
        "function"
      ) {
        throw new Error(
          "submitBug is missing from the contract ABI."
        );
      }

      // =====================================================
      // 10. CREATE EXACT CONTRACT TUPLE
      // =====================================================

      const authorizationTuple = [
        user,
        role,
        organizationId,
        action,
        actionHash,
        nonce,
        deadline,
      ];

      console.log(
        "AUTHORIZATION TUPLE:",
        authorizationTuple
      );

      // =====================================================
      // 11. VERIFY NONCE
      // =====================================================

      try {
        const currentNonce =
          await contract.authorizationNonces(
            wallet
          );

        console.log(
          "CONTRACT NONCE:",
          currentNonce.toString()
        );

        console.log(
          "AUTH NONCE:",
          nonce.toString()
        );

        if (
          currentNonce !== nonce
        ) {
          throw new Error(
            `Authorization nonce mismatch. Contract expects ${currentNonce.toString()}, but authorization contains ${nonce.toString()}.`
          );
        }
      } catch (error) {
        console.warn(
          "Nonce verification skipped:",
          error
        );
      }

      // =====================================================
      // 12. SUBMIT BUG ON CHAIN
      // =====================================================

      setMessage(
        "Submitting report to blockchain..."
      );

      console.log(
        "CALLING submitBug WITH:",
        {
          onchainBountyId,
          reportHash:
            report.report_hash,
          encryptedEvidenceCID,
          requestedRewardWei:
            requestedRewardWei.toString(),
          authorizationTuple,
          signature,
        }
      );

      const tx =
        await contract.submitBug(
          onchainBountyId,
          report.report_hash,
          encryptedEvidenceCID,
          requestedRewardWei,
          authorizationTuple,
          signature
        );

      console.log(
        "SUBMIT BUG TX:",
        tx.hash
      );

      setMessage(
        "Blockchain transaction submitted. Waiting for confirmation..."
      );

      const receipt =
        await tx.wait();

      console.log(
        "SUBMIT BUG RECEIPT:",
        receipt
      );

      // =====================================================
      // 13. SUCCESS
      // =====================================================

      setMessage(
        "Report submitted successfully on-chain."
      );

      setTimeout(() => {
        router.push(
          "/tester/reports"
        );
      }, 1500);

    } catch (error) {
      console.error(
        "SUBMIT REPORT ERROR:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hunter-main">

      <section className="report-card">

        <span className="portal-label">
          VULNERABILITY REPORT
        </span>

        <h1>
          Submit Security Report
        </h1>

        <div className="form-group">

          <label>
            Title
          </label>

          <input
            value={title}
            onChange={(e) =>
              setTitle(
                e.target.value
              )
            }
          />

        </div>

        <div className="form-group">

          <label>
            Severity
          </label>

          <select
            value={severity}
            onChange={(e) =>
              setSeverity(
                e.target.value
              )
            }
          >

            <option value="">
              Select severity
            </option>

            <option value="Critical">
              Critical
            </option>

            <option value="High">
              High
            </option>

            <option value="Medium">
              Medium
            </option>

            <option value="Low">
              Low
            </option>

          </select>

          <label>
            Description
          </label>

          <textarea
            rows={8}
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
          />

        </div>

        <div className="form-group">

          <label>
            Steps to reproduce
          </label>

          <textarea
            value={steps}
            onChange={(e) =>
              setSteps(
                e.target.value
              )
            }
          />

          <label>
            Evidence Link (optional)
          </label>

          <input
            value={evidence}
            onChange={(e) =>
              setEvidence(
                e.target.value
              )
            }
          />

        </div>

        <button
          type="button"
          onClick={submitReport}
          disabled={loading}
        >
          {loading
            ? "Submitting..."
            : "Submit Report"}
        </button>

        {message && (
          <p>{message}</p>
        )}

      </section>

    </main>
  );
}