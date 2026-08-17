"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

type SessionResponse = {
  success: boolean;
  authenticated: boolean;

  participant?: {
    id: string;
    walletAddress: string;
    companyName: string | null;
    organizationId: string;
    active: boolean;
    verified: boolean;
  };
};

type AuthorizationResponse = {
  success: boolean;
  code?: string;
  message?: string;

  contract?: {
    address: string;
    chainId: string;
  };

  bounty?: {
    title: string;
    metadataHash: string;
    metadataCID: string;
    startTime: string;
    endTime: string;
    escrowAmountWei: string;
    escrowAmountEth: string;
  };

  authorization?: {
    user: string;
    role: number;
    organizationId: string;
    action: number;
    actionHash: string;
    nonce: string;
    deadline: string;
  };

  signature?: string;
};

export default function CreateBountyPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [walletAddress, setWalletAddress] =
    useState("");

  const [companyName, setCompanyName] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [scope, setScope] =
    useState("");

  const [escrowAmountEth, setEscrowAmountEth] =
    useState("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [authorization, setAuthorization] =
    useState<AuthorizationResponse | null>(
      null
    );

  /*
   * Protect the page with the existing
   * authenticated company session.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCompany():
    Promise<void> {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              credentials: "include",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as
            SessionResponse;

        if (cancelled) {
          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.authenticated ||
          !data.participant
        ) {
          router.replace("/");
          return;
        }

        setWalletAddress(
          data.participant.walletAddress
        );

        setCompanyName(
          data.participant.companyName ??
            "Verified Company"
        );
      } catch {
        router.replace("/");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCompany();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submitBounty(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrorMessage("");
    setAuthorization(null);

    if (!window.ethereum) {
      setErrorMessage(
        "MetaMask was not detected."
      );

      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage(
        "Choose a start date and end date."
      );

      return;
    }

    try {
      setSubmitting(true);

      /*
       * Check the currently selected MetaMask
       * account before asking the backend for
       * blockchain authorization.
       */
      const accounts =
        (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];

      if (
        !accounts ||
        accounts.length === 0
      ) {
        throw new Error(
          "Connect MetaMask before creating a bounty."
        );
      }

      if (
        accounts[0].toLowerCase() !==
        walletAddress.toLowerCase()
      ) {
        throw new Error(
          "The selected MetaMask wallet does not match the authenticated company wallet."
        );
      }

      /*
       * HTML datetime-local gives milliseconds.
       * Solidity expects Unix time in seconds.
       */
      const startTime =
        Math.floor(
          new Date(
            startDate
          ).getTime() / 1000
        );

      const endTime =
        Math.floor(
          new Date(
            endDate
          ).getTime() / 1000
        );

      if (
        Number.isNaN(startTime) ||
        Number.isNaN(endTime)
      ) {
        throw new Error(
          "Invalid bounty dates."
        );
      }

      if (endTime <= startTime) {
        throw new Error(
          "The end date must be after the start date."
        );
      }

      /*
       * Ask the backend for permission to create
       * THIS exact bounty.
       */
      const response =
        await fetch(
          "/api/company/bounties/create-authorization",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

body: JSON.stringify({
  walletAddress,
  title,
  description,
  scope,
  escrowAmountEth,
  startTime,
  endTime,
}),
          }
        );

      const data =
        (await response.json()) as
          AuthorizationResponse;

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ??
            "Could not authorize bounty creation."
        );
      }

      setAuthorization(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not prepare bounty.";

      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <p>
          Loading create bounty...
        </p>
      </main>
    );
  }

  return (
    <main className="bounty-create-page">
      <header className="bounty-create-header">
        <div>
          <Link
            href="/company/dashboard"
          >
            ← Dashboard
          </Link>

          <p>
            VERIFIED COMPANY
          </p>
        </div>

        <div>
          <strong>
            {companyName}
          </strong>

          <small>
            {walletAddress.slice(0, 8)}
            ...
            {walletAddress.slice(-6)}
          </small>
        </div>
      </header>

      <section className="bounty-create-layout">
        <div className="bounty-create-intro">
          <p>03</p>

          <span>
            NEW SECURITY PROGRAM
          </span>

          <h1>
            CREATE
            <br />
            A BOUNTY.
          </h1>

          <p>
            Define exactly what security
            researchers may test, how much
            reward is secured, and when the
            program is active.
          </p>
        </div>

        <form
          className="bounty-create-form"
          onSubmit={submitBounty}
        >
          <div className="bounty-form-heading">
            <div>
              <span>
                PROGRAM DETAILS
              </span>

              <h2>
                Bounty configuration
              </h2>
            </div>

            <span>
              01 / 02
            </span>
          </div>

          <label>
            Bounty title *

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
              required
              maxLength={200}
              disabled={submitting}
              placeholder="Web Application Security Program"
            />
          </label>

          <label>
            Description *

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              required
              minLength={10}
              maxLength={5000}
              disabled={submitting}
              placeholder="Describe the security program..."
            />
          </label>

          <label>
            Testing scope *

            <textarea
              value={scope}
              onChange={(event) =>
                setScope(
                  event.target.value
                )
              }
              required
              maxLength={5000}
              disabled={submitting}
              placeholder="Example: https://app.example.com and API endpoints..."
            />
          </label>


          <div className="bounty-form-grid">
            <label>
              Reward / Escrow (ETH) *

              <input
                type="number"
                min="0"
                step="0.0001"
                value={escrowAmountEth}
                onChange={(event) =>
                  setEscrowAmountEth(
                    event.target.value
                  )
                }
                required
                disabled={submitting}
                placeholder="0.5"
              />
            </label>

            <label>
              Start *

              <input
                type="datetime-local"
                value={startDate}
                onChange={(event) =>
                  setStartDate(
                    event.target.value
                  )
                }
                required
                disabled={submitting}
              />
            </label>

            <label>
              End *

              <input
                type="datetime-local"
                value={endDate}
                onChange={(event) =>
                  setEndDate(
                    event.target.value
                  )
                }
                required
                disabled={submitting}
              />
            </label>
          </div>

          {errorMessage && (
            <div className="registration-error">
              <strong>
                Bounty could not continue
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            className="bounty-authorize-button"
            disabled={submitting}
          >
            {submitting
              ? "Requesting secure authorization..."
              : "Prepare bounty authorization"}
          </button>

          <p className="bounty-form-note">
            This step does not send ETH yet.
            The backend only authorizes this
            exact bounty configuration.
          </p>

          {authorization?.success &&
            authorization.authorization && (
              <div className="bounty-authorization-success">
                <span>
                  AUTHORIZATION READY
                </span>

                <h3>
                  Backend permission
                  issued.
                </h3>

                <p>
                  The trusted verifier has
                  authorized your wallet to
                  create this exact bounty.
                </p>

                <dl>
                  <div>
                    <dt>
                      Action nonce
                    </dt>

                    <dd>
                      {
                        authorization
                          .authorization
                          .nonce
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Reward
                    </dt>

                    <dd>
                      {
                        authorization
                          .bounty
                          ?.escrowAmountEth
                      }{" "}
                      ETH
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Action hash
                    </dt>

                    <dd>
                      {authorization.authorization.actionHash.slice(
                        0,
                        16
                      )}
                      ...
                    </dd>
                  </div>
                </dl>

                <strong>
                  Next: send the authorized
                  MetaMask transaction.
                </strong>
              </div>
            )}
        </form>
      </section>
    </main>
  );
}