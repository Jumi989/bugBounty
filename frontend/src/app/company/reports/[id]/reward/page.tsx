"use client";

import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Report = {
  id: string | number;
  title: string;
  status: string;
  researcher_name?: string;
  bounty_id?: string | number;
  bounty_db_id?: string | number;
  approved_reward_wei?: string | null;
};

type PrepareResponse = {
  success: boolean;
  message?: string;

  company?: {
    walletAddress: string;
  };

  domain?: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };

  types?: {
    RewardApproval: Array<{
      name: string;
      type: string;
    }>;
  };

  value?: {
    bountyId: string;
    reportHash: string;
    tester: string;
    rewardAmount: string;
    nonce: string;
    deadline: string;
  };
};

type AcceptResponse = {
  success: boolean;
  message?: string;
};

export default function RewardPage() {
  const params = useParams();
  const router = useRouter();

  const id = String(params.id);

  const [amount, setAmount] = useState("0.25");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // =========================================================
  // LOAD REPORT
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const response = await fetch(
          `/api/company/reports/${id}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const text = await response.text();

        if (!text) {
          throw new Error(
            `Report API returned an empty response (${response.status}).`
          );
        }

        let data: {
          success?: boolean;
          message?: string;
          report?: Report;
        };

        try {
          data = JSON.parse(text) as {
            success?: boolean;
            message?: string;
            report?: Report;
          };
        } catch {
          console.error("REPORT API NON-JSON RESPONSE:", text);

          throw new Error(
            `Report API returned invalid JSON (${response.status}).`
          );
        }

        if (!response.ok || !data.success || !data.report) {
          throw new Error(
            data.message || "Failed to load report."
          );
        }

        if (!cancelled) {
          setReport(data.report);
        }
      } catch (error) {
        console.error("LOAD REPORT ERROR:", error);

        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Failed to load report."
          );
        }
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // =========================================================
  // APPROVE REWARD
  // =========================================================

  async function approveReward() {
    if (loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // -----------------------------------------------------
      // 1. Validate reward amount
      // -----------------------------------------------------

      if (!amount || Number(amount) <= 0) {
        throw new Error(
          "Enter a valid reward amount."
        );
      }

      let rewardAmountWei: string;

      try {
        rewardAmountWei =
          ethers.parseEther(amount).toString();
      } catch {
        throw new Error(
          "Invalid ETH reward amount."
        );
      }

      // -----------------------------------------------------
      // 2. MetaMask
      // -----------------------------------------------------

      if (!window.ethereum) {
        throw new Error(
          "MetaMask is required."
        );
      }

      // -----------------------------------------------------
      // 3. Connect company wallet
      // -----------------------------------------------------

      setMessage(
        "Connecting company wallet..."
      );

      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const companyWallet =
        await signer.getAddress();

      console.log(
        "COMPANY WALLET:",
        companyWallet
      );

      // -----------------------------------------------------
      // 4. Check Besu network
      // -----------------------------------------------------

      const network =
        await provider.getNetwork();

      console.log(
        "CONNECTED CHAIN ID:",
        network.chainId.toString()
      );

      if (
        network.chainId !== BigInt(2026)
      ) {
        throw new Error(
          "Please switch MetaMask to Besu Reputation Network (Chain ID 2026)."
        );
      }

      // -----------------------------------------------------
      // 5. Prepare reward
      //
      // IMPORTANT:
      //
      // We DO NOT call payoutNonces() here.
      //
      // The backend prepare-reward route must:
      //
      // report
      //   ↓
      // bounty_db_id
      //   ↓
      // bounties.id
      //   ↓
      // bounties.bounty_id
      //   ↓
      // payoutNonces(on-chain bounty ID)
      //
      // This avoids the browser RPC timeout problem.
      // -----------------------------------------------------

      setMessage(
        "Preparing reward authorization..."
      );

      const prepareResponse =
        await fetch(
          `/api/company/reports/${id}/prepare-reward`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({
              rewardAmountEth: amount,
              rewardAmountWei,
            }),
          }
        );

      const prepareText =
        await prepareResponse.text();

      if (!prepareText) {
        throw new Error(
          `Prepare-reward API returned an empty response (${prepareResponse.status}).`
        );
      }

      let prepareData: PrepareResponse;

      try {
        prepareData =
          JSON.parse(
            prepareText
          ) as PrepareResponse;
      } catch {
        console.error(
          "PREPARE-REWARD NON-JSON RESPONSE:",
          prepareText
        );

        throw new Error(
          `Prepare-reward API returned invalid JSON (${prepareResponse.status}).`
        );
      }

      console.log(
        "PREPARE REWARD RESPONSE:",
        prepareData
      );

      if (
        !prepareResponse.ok ||
        !prepareData.success
      ) {
        throw new Error(
          prepareData.message ||
            "Could not prepare reward."
        );
      }

      // -----------------------------------------------------
      // 6. Validate prepare response
      // -----------------------------------------------------

      if (
        !prepareData.company ||
        !prepareData.company.walletAddress
      ) {
        throw new Error(
          "Prepare-reward response is missing the company wallet."
        );
      }

      if (
        !prepareData.domain ||
        !prepareData.types ||
        !prepareData.value
      ) {
        throw new Error(
          "Prepare-reward response is missing EIP-712 authorization data."
        );
      }

      console.log(
        "PREPARED REWARD VALUE:",
        prepareData.value
      );

      // -----------------------------------------------------
      // 7. Verify company wallet
      // -----------------------------------------------------

      if (
        companyWallet.toLowerCase() !==
        prepareData.company.walletAddress.toLowerCase()
      ) {
        throw new Error(
          "Please connect the verified company wallet."
        );
      }

      // -----------------------------------------------------
      // 8. Verify reward amount
      // -----------------------------------------------------

      if (
        prepareData.value.rewardAmount !==
        rewardAmountWei
      ) {
        console.error(
          "REWARD AMOUNT MISMATCH:",
          {
            frontend: rewardAmountWei,
            backend:
              prepareData.value.rewardAmount,
          }
        );

        throw new Error(
          "Reward amount changed during authorization preparation. Please try again."
        );
      }

      // -----------------------------------------------------
      // 9. Sign EIP-712 authorization
      //
      // NO blockchain transaction happens here.
      // MetaMask only signs the authorization.
      // -----------------------------------------------------

      setMessage(
        "Waiting for MetaMask signature..."
      );

      const signature =
        await signer.signTypedData(
          prepareData.domain,
          prepareData.types,
          prepareData.value
        );

      console.log(
        "REWARD SIGNATURE:",
        signature
      );

      // -----------------------------------------------------
      // 10. Send signed authorization to backend
      // -----------------------------------------------------

      setMessage(
        "Submitting reward approval..."
      );

      const acceptResponse =
        await fetch(
          `/api/company/reports/${id}/accept`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({
              rewardAmountWei:
                prepareData.value.rewardAmount,

              nonce:
                prepareData.value.nonce,

              deadline:
                prepareData.value.deadline,

              signature,
            }),
          }
        );

      const acceptText =
        await acceptResponse.text();

      if (!acceptText) {
        throw new Error(
          `Accept API returned an empty response (${acceptResponse.status}).`
        );
      }

      let acceptData: AcceptResponse;

      try {
        acceptData =
          JSON.parse(
            acceptText
          ) as AcceptResponse;
      } catch {
        console.error(
          "ACCEPT API NON-JSON RESPONSE:",
          acceptText
        );

        throw new Error(
          `Accept API returned invalid JSON (${acceptResponse.status}).`
        );
      }

      console.log(
        "ACCEPT RESPONSE:",
        acceptData
      );

      if (
        !acceptResponse.ok ||
        !acceptData.success
      ) {
        throw new Error(
          acceptData.message ||
            "Reward approval failed."
        );
      }

      // -----------------------------------------------------
      // 11. Success
      // -----------------------------------------------------

      setMessage(
        "Reward approved successfully."
      );

      alert(
        "Reward approved. The Bug Hunter can now claim it."
      );

      router.push(
        `/company/reports/${id}`
      );
    } catch (error) {
      console.error(
        "APPROVE REWARD ERROR:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to approve reward."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (!report) {
    return (
      <section className="reward-page">
        <p className="dashboard-eyebrow">
          REWARD APPROVAL
        </p>

        <p>
          {message || "Loading..."}
        </p>
      </section>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <section className="reward-page">

      <p className="dashboard-eyebrow">
        REWARD APPROVAL
      </p>

      <h1>
        Approve Researcher Reward
      </h1>

      <div className="reward-card">

        <h2>
          {report.title}
        </h2>

        <p>
          Researcher:{" "}
          <strong>
            {report.researcher_name ||
              "Unknown"}
          </strong>
        </p>

        <p>
          Current Status:{" "}
          <strong>
            {report.status}
          </strong>
        </p>

        {report.bounty_id !==
          undefined && (
          <p>
            On-chain Bounty ID:{" "}
            <strong>
              {String(
                report.bounty_id
              )}
            </strong>
          </p>
        )}

        <label htmlFor="rewardAmount">
          Reward Amount (ETH)
        </label>

        <input
          id="rewardAmount"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) =>
            setAmount(
              event.target.value
            )
          }
          disabled={loading}
        />

        <br />

        <button
          type="button"
          onClick={approveReward}
          disabled={loading}
        >
          {loading
            ? "Approving..."
            : "Approve Reward →"}
        </button>

        {message && (
          <p>
            {message}
          </p>
        )}

      </div>

    </section>
  );
}