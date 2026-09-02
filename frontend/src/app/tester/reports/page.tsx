"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";

type Report = {
  id: number;
  title: string;
  severity: string;
  status: string;
  bounty_id: string;
  tester_wallet: string;
  report_hash: string;
  approved_reward_wei: string | null;
  payout_nonce: string | null;
  payout_deadline: string | null;
  company_signature: string | null;
};

function formatEth(wei: string | null) {
  if (!wei) return "0.00";

  return (
    Number(wei) / 1e18
  ).toFixed(2);
}

export default function TesterReportsPage() {
  const [reports, setReports] =
    useState<Report[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [claiming, setClaiming] =
    useState<number | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch(
          "/api/tester/reports",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (data.success) {
          setReports(data.reports);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  async function claimReward(
    report: Report
  ) {
    if (!window.ethereum) {
      alert(
        "Please install MetaMask"
      );
      return;
    }

    try {
      setClaiming(report.id);

      const accounts =
        (await window.ethereum.request({
          method:
            "eth_requestAccounts",
        })) as string[];

      if (!accounts.length) {
        throw new Error(
          "No wallet connected"
        );
      }

      /*
       * IMPORTANT:
       *
       * Replace CONTRACT_ADDRESS with
       * your deployed BugBountyEscrow address.
       */
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS!;

if (!CONTRACT_ADDRESS) {
  throw new Error(
    "NEXT_PUBLIC_ESCROW_ADDRESS is missing"
  );
}

const provider =
  new ethers.BrowserProvider(
    window.ethereum
  );

const signer =
  await provider.getSigner();

const connectedWallet =
  await signer.getAddress();

if (
  connectedWallet.toLowerCase() !==
  report.tester_wallet.toLowerCase()
) {
  throw new Error(
    "Connect the same tester wallet that submitted this report."
  );
}

const network =
  await provider.getNetwork();

if (network.chainId !== BigInt("2026")) {
  throw new Error(
    "Please switch MetaMask to Besu Reputation Network."
  );
}

const contract =
  new ethers.Contract(
    CONTRACT_ADDRESS,
    [
      "function claimReward(uint256 bountyId,bytes32 reportHash,uint256 rewardAmount,uint256 nonce,uint256 deadline,bytes companySignature)"
    ],
    signer
  );

if (!report.bounty_id) {
  throw new Error(
    "Bounty ID is missing from report."
  );
}

if (!report.report_hash) {
  throw new Error(
    "Report hash is missing."
  );
}

if (!report.approved_reward_wei) {
  throw new Error(
    "Approved reward is missing."
  );
}

if (!report.payout_nonce) {
  throw new Error(
    "Reward nonce is missing."
  );
}

if (!report.payout_deadline) {
  throw new Error(
    "Reward deadline is missing."
  );
}

if (!report.company_signature) {
  throw new Error(
    "Company reward approval signature is missing."
  );
}

const tx =
  await contract.claimReward(
    BigInt(report.bounty_id),
    report.report_hash,
    BigInt(
      report.approved_reward_wei
    ),
    BigInt(
      report.payout_nonce
    ),
BigInt(
  report.payout_deadline
),
    report.company_signature
  );

console.log(
  "TX2 CLAIM:",
  tx.hash
);

await tx.wait();

const txHash = tx.hash;

      const response =
        await fetch(
          `/api/tester/reports/${report.id}/claim`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              claim_transaction_hash:
                txHash,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to update claim"
        );
      }

      alert(
        "Reward claimed successfully"
      );

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                status: "claimed",
              }
            : item
        )
      );
    } catch (error) {
      console.error(
        "CLAIM ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Reward claim failed"
      );
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return <p>Loading reports...</p>;
  }

  return (
    <section className="dashboard-action-section">

      <p className="dashboard-eyebrow">
        MY REPORTS
      </p>

      <h1>
        REPORT
        <br />
        PROGRESS
      </h1>

      <div className="report-list">

        {reports.length === 0 ? (
          <p>
            No reports submitted yet.
          </p>
        ) : (
          reports.map((report) => (

            <article
              key={report.id}
              className="report-card"
            >

              <span>
                {report.severity}
              </span>

              <h2>
                {report.title}
              </h2>

              <p>
                Status: {report.status}
              </p>

              {report.status ===
                "accepted" && (
                <>
                  <p>
                    Reward:{" "}
                    {formatEth(
                      report.approved_reward_wei
                    )}{" "}
                    ETH
                  </p>

                  <button
                    type="button"
                    disabled={
                      claiming === report.id
                    }
                    onClick={() =>
                      claimReward(report)
                    }
                  >
                    {claiming === report.id
                      ? "Claiming..."
                      : "Claim Reward →"}
                  </button>
                </>
              )}

              {report.status ===
                "claimed" && (
                <p>
                  ✓ Reward claimed
                </p>
              )}

            </article>

          ))
        )}

      </div>

    </section>
  );
}