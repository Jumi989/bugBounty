"use client";

import { useEffect, useState } from "react";

type Bounty = {
  id: number;
  bounty_id?: number;
  title: string;
  program?: string;
  description?: string;
  reward?: string | number;
  reward_wei?: string | null;
  status?: string | number;
  created_at?: string;
  deadline?: string;
  company_address?: string;
};

function formatReward(bounty: Bounty): string {
  if (bounty.reward_wei) {
    const wei = Number(bounty.reward_wei);

    if (!Number.isNaN(wei)) {
      return `${(wei / 1e18).toFixed(2)} ETH`;
    }
  }

  if (
    bounty.reward !== undefined &&
    bounty.reward !== null
  ) {
    const value = Number(bounty.reward);

    if (!Number.isNaN(value)) {
      return `${value} ETH`;
    }

    return String(bounty.reward);
  }

  return "Not specified";
}

function formatDate(date?: string): string {
  if (!date) {
    return "Not provided";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString();
}

/*
 * API may return status as:
 *
 * 1
 * 0
 * "1"
 * "0"
 * "Open"
 * "Closed"
 *
 * Convert everything safely to a string first.
 */
function formatStatus(
  status?: string | number
): string {
  if (
    status === undefined ||
    status === null
  ) {
    return "Open";
  }

  const normalized = String(status).toLowerCase();

  switch (normalized) {
    case "1":
      return "Open";

    case "0":
      return "Draft";

    case "2":
      return "Closed";

    case "3":
      return "Expired";

    case "open":
      return "Open";

    case "draft":
      return "Draft";

    case "closed":
      return "Closed";

    case "expired":
      return "Expired";

    default:
      return String(status);
  }
}

export default function CompanyBountiesPage() {
  const [bounties, setBounties] =
    useState<Bounty[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadBounties() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/company/bounties",
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const text =
          await response.text();

        if (!text) {
          throw new Error(
            `Empty response from bounty API. HTTP ${response.status}`
          );
        }

        let data: {
          success?: boolean;
          message?: string;
          bounties?: Bounty[];
        };

        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `Invalid response from bounty API. HTTP ${response.status}`
          );
        }

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Failed to load bounties."
          );
        }

        setBounties(
          Array.isArray(data.bounties)
            ? data.bounties
            : []
        );
      } catch (err) {
        console.error(
          "LOAD COMPANY BOUNTIES ERROR:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load bounties."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadBounties();
  }, []);

  /*
   * LOADING
   */
  if (loading) {
    return (
      <section className="dashboard-action-section">
        <p className="dashboard-eyebrow">
          COMPANY BOUNTIES
        </p>

        <h1>
          MY
          <br />
          BOUNTIES
        </h1>

        <p className="dashboard-description">
          Loading your bounty programs...
        </p>
      </section>
    );
  }

  /*
   * ERROR
   */
  if (error) {
    return (
      <section className="dashboard-action-section">
        <p className="dashboard-eyebrow">
          COMPANY BOUNTIES
        </p>

        <h1>
          MY
          <br />
          BOUNTIES
        </h1>

        <article className="report-card">
          <span>ERROR</span>

          <h2>
            Could not load bounties
          </h2>

          <p>{error}</p>
        </article>
      </section>
    );
  }

  /*
   * MAIN PAGE
   */
  return (
    <section className="dashboard-action-section">
      <p className="dashboard-eyebrow">
        COMPANY BOUNTIES
      </p>

      <h1>
        MY
        <br />
        BOUNTIES
      </h1>

      <p className="dashboard-description">
        View the vulnerability reward programs
        created by your company.
      </p>

      <div className="report-list">
        {bounties.length === 0 ? (
          <article className="report-card">
            <span>
              NO BOUNTIES
            </span>

            <h2>
              No bounty programs yet.
            </h2>

            <p>
              Your created bounty programs
              will appear here.
            </p>
          </article>
        ) : (
          bounties.map((bounty) => {
            const status =
              formatStatus(
                bounty.status
              );

            return (
              <article
                key={bounty.id}
                className="report-card"
              >
                {/* STATUS */}
                <span>
                  {status}
                </span>

                {/* TITLE */}
                <h2>
                  {bounty.title}
                </h2>

                {/* PROGRAM */}
                {bounty.program && (
                  <p>
                    Program:{" "}
                    <strong>
                      {bounty.program}
                    </strong>
                  </p>
                )}

                {/* DESCRIPTION */}
                {bounty.description && (
                  <p className="report-description">
                    {bounty.description}
                  </p>
                )}

                {/* REWARD */}
                <p>
                  Reward:{" "}
                  <strong>
                    {formatReward(
                      bounty
                    )}
                  </strong>
                </p>

                {/* STATUS */}
                <p>
                  Status:{" "}
                  <strong>
                    {status}
                  </strong>
                </p>

                {/* CREATED */}
                <p>
                  Created:{" "}
                  {formatDate(
                    bounty.created_at
                  )}
                </p>

                {/* DEADLINE */}
                {bounty.deadline && (
                  <p>
                    Deadline:{" "}
                    {formatDate(
                      bounty.deadline
                    )}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}