"use client";

import { useEffect, useState } from "react";

type Report = {
  id: number;
  title: string;
  severity: string;
  status: string;
  approved_reward_wei: string | null;
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
        process.env
          .NEXT_PUBLIC_ESCROW_ADDRESS!;

      /*
       * withdraw() has no parameters
       * in the current contract.
       */
      const withdrawData =
        "0x3cc50b45";

      const txHash =
        (await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: accounts[0],
              to: CONTRACT_ADDRESS,
              data: withdrawData,
            },
          ],
        })) as string;

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