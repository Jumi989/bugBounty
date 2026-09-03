"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type RegistrationStatus =
  | "idle"
  | "connecting"
  | "preparing"
  | "signing"
  | "submitting"
  | "completed";

type RegistrationChallengeResponse = {
  success: boolean;
  code?: string;
  message?: string;

  challenge?: {
    id: string;
    message: string;
    expiresAt: string;
  };

  registrationPayloadHash?: string;
};

type RegistrationVerifyResponse = {
  success: boolean;
  code?: string;
  message: string;

  verificationStatus?: string;

  participant?: {
    id: string;
    walletAddress: string;
    role: string;
    organizationId: string;
    active: boolean;
    verified: boolean;
    contactPersonName: string;
    email: string;
    companyName: string;
  };
};

function shortenAddress(
  address: string
): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function CompanyRegisterPage() {
  const router = useRouter();

  const [walletAddress, setWalletAddress] =
    useState("");

  const [companyName, setCompanyName] =
    useState("");

  const [
    contactPersonName,
    setContactPersonName,
  ] = useState("");

  const [email, setEmail] =
    useState("");

  const [website, setWebsite] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [status, setStatus] =
    useState<RegistrationStatus>("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /*
   * When the page opens, check whether MetaMask
   * already has an account connected to this site.
   */
  useEffect(() => {
    async function loadConnectedWallet():
    Promise<void> {
      if (!window.ethereum) {
        return;
      }

      try {
        const accounts =
          (await window.ethereum.request({
            method: "eth_accounts",
          })) as string[];

        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
        }
      } catch {
        // User can still connect manually.
      }
    }

    void loadConnectedWallet();
  }, []);

  async function connectWallet():
  Promise<void> {
    setErrorMessage("");

    if (!window.ethereum) {
      setErrorMessage(
        "MetaMask was not detected. Install MetaMask and refresh this page."
      );

      return;
    }

    try {
      setStatus("connecting");

      const accounts =
        (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

      if (accounts.length === 0) {
        throw new Error(
          "No MetaMask account was selected."
        );
      }

      setWalletAddress(accounts[0]);
      setStatus("idle");
    } catch (error: unknown) {
      const metamaskError =
        error as {
          code?: number;
          message?: string;
        };

      if (metamaskError.code === 4001) {
        setErrorMessage(
          "Wallet connection was cancelled."
        );
      } else {
        setErrorMessage(
          metamaskError.message ??
            "Could not connect MetaMask."
        );
      }

      setStatus("idle");
    }
  }

  async function switchWallet():
  Promise<void> {
    setErrorMessage("");

    if (!window.ethereum) {
      setErrorMessage(
        "MetaMask was not detected."
      );

      return;
    }

    try {
      setStatus("connecting");

      await window.ethereum.request({
        method: "wallet_requestPermissions",

        params: [
          {
            eth_accounts: {},
          },
        ],
      });

      const accounts =
        (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

      if (accounts.length === 0) {
        throw new Error(
          "No MetaMask account was selected."
        );
      }

      setWalletAddress(accounts[0]);
      setStatus("idle");
    } catch (error: unknown) {
      const metamaskError =
        error as {
          code?: number;
          message?: string;
        };

      if (metamaskError.code === 4001) {
        setErrorMessage(
          "Account selection was cancelled."
        );
      } else {
        setErrorMessage(
          metamaskError.message ??
            "Could not switch account."
        );
      }

      setStatus("idle");
    }
  }

  async function submitRegistration(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!walletAddress) {
      setErrorMessage(
        "Connect the company wallet before registering."
      );

      return;
    }

    try {
      /*
       * STEP 1:
       * Backend validates the form and creates
       * a one-time registration challenge.
       */
      setStatus("preparing");

      const challengeResponse =
        await fetch(
          "/api/company/register/challenge",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              walletAddress,
              companyName,
              contactPersonName,
              email,
              website,
              description,
            }),
          }
        );

      const challengeData =
        (await challengeResponse.json()) as
          RegistrationChallengeResponse;

      if (
        !challengeResponse.ok ||
        !challengeData.success ||
        !challengeData.challenge
      ) {
        throw new Error(
          challengeData.message ??
            "Could not prepare company registration."
        );
      }

      /*
       * STEP 2:
       * MetaMask signs the exact challenge.
       *
       * This is NOT a blockchain transaction.
       */
      setStatus("signing");

      if (!window.ethereum) {
        throw new Error(
          "MetaMask is no longer available."
        );
      }

      const signature =
        (await window.ethereum.request({
          method: "personal_sign",

          params: [
            challengeData.challenge.message,
            walletAddress,
          ],
        })) as string;

      if (!signature) {
        throw new Error(
          "MetaMask did not return a signature."
        );
      }

      /*
       * STEP 3:
       * Send the same registration form +
       * signature to the verification endpoint.
       */
      setStatus("submitting");

      const verifyResponse =
        await fetch(
          "/api/company/register/verify",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              challengeId:
                challengeData.challenge.id,

              walletAddress,
              companyName,
              contactPersonName,
              email,
              website,
              description,
              signature,
            }),
          }
        );

      const verifyData =
        (await verifyResponse.json()) as
          RegistrationVerifyResponse;

      if (
        !verifyResponse.ok ||
        !verifyData.success
      ) {
        throw new Error(
          verifyData.message ??
            "Company registration failed."
        );
      }

/*
 * Registration verification succeeded.
 *
 * Send the company directly to the dashboard.
 */
setSuccessMessage(
  verifyData.message
);

setStatus("completed");

router.push("/company/dashboard");
    } catch (error: unknown) {
      const metamaskError =
        error as {
          code?: number;
          message?: string;
        };

      if (metamaskError.code === 4001) {
        setErrorMessage(
          "The MetaMask signature request was cancelled."
        );
      } else {
        setErrorMessage(
          metamaskError.message ??
            "Company registration failed."
        );
      }

      setStatus("idle");
    }
  }

  const busy =
    status === "connecting" ||
    status === "preparing" ||
    status === "signing" ||
    status === "submitting";

  function getSubmitButtonText():
  string {
    switch (status) {
      case "preparing":
        return "Preparing registration...";

      case "signing":
        return "Waiting for signature...";

      case "submitting":
        return "Submitting registration...";

      case "completed":
        return "Registration submitted";

      default:
        return "Sign & submit registration";
    }
  }

  return (
    <main className="registration-page">
      <header className="registration-header">
        <Link
          href="/"
          className="registration-wordmark"
        >
          <span>BB</span>

          <div>
            <strong>BUG BOUNTY</strong>
            <small>SECURITY JOURNAL</small>
          </div>
        </Link>

        <Link
          href="/"
          className="back-link"
        >
          Existing company? Sign in
        </Link>
      </header>

      <section className="registration-layout">
        <div className="registration-intro">
          <p className="registration-number">
            01
          </p>

          <p className="registration-eyebrow">
            COMPANY ONBOARDING
          </p>

          <h1>
            JOIN THE
            <br />
            SECURITY
            <br />
            NETWORK.
          </h1>

          <p className="registration-copy">
            Register your organization and
            prove ownership of the company
            wallet through a secure MetaMask
            signature.
          </p>

          <div className="registration-process">
            <div>
              <span>01</span>
              <p>
                Complete company information
              </p>
            </div>

            <div>
              <span>02</span>
              <p>
                Sign the registration challenge
              </p>
            </div>

            <div>
              <span>03</span>
              <p>
                Await platform verification
              </p>
            </div>
          </div>
        </div>

        <div className="registration-card">
          {status !== "completed" ? (
            <>
              <div className="registration-card-title">
                <div>
                  <p>
                    NEW COMPANY
                  </p>

                  <h2>
                    Register company
                  </h2>
                </div>

                <span>
                  01 / 03
                </span>
              </div>

              <div className="registration-wallet">
                <div className="wallet-square">
                  W
                </div>

                <div>
                  <span>
                    COMPANY WALLET
                  </span>

                  <strong>
                    {walletAddress
                      ? shortenAddress(
                          walletAddress
                        )
                      : "Not connected"}
                  </strong>

                  <p>
                    This wallet will identify
                    the company account.
                  </p>
                </div>
              </div>

              {!walletAddress ? (
                <button
                  type="button"
                  className="registration-wallet-button"
                  onClick={connectWallet}
                  disabled={busy}
                >
                  Connect MetaMask
                </button>
              ) : (
                <button
                  type="button"
                  className="registration-wallet-button secondary"
                  onClick={switchWallet}
                  disabled={busy}
                >
                  Switch MetaMask account
                </button>
              )}

              <form
                className="registration-form"
                onSubmit={submitRegistration}
              >
                <div className="registration-field">
                  <label htmlFor="companyName">
                    Company name *
                  </label>

                  <input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(event) =>
                      setCompanyName(
                        event.target.value
                      )
                    }
                    maxLength={200}
                    required
                    disabled={busy}
                    placeholder="SecureSoft Ltd"
                  />
                </div>

                <div className="registration-field">
                  <label htmlFor="contactPerson">
                    Contact person *
                  </label>

                  <input
                    id="contactPerson"
                    type="text"
                    value={
                      contactPersonName
                    }
                    onChange={(event) =>
                      setContactPersonName(
                        event.target.value
                      )
                    }
                    maxLength={150}
                    required
                    disabled={busy}
                    placeholder="Jane Smith"
                  />
                </div>

                <div className="registration-field">
                  <label htmlFor="email">
                    Business email *
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    maxLength={320}
                    required
                    disabled={busy}
                    placeholder="security@company.com"
                  />
                </div>

                <div className="registration-field">
                  <label htmlFor="website">
                    Website
                  </label>

                  <input
                    id="website"
                    type="url"
                    value={website}
                    onChange={(event) =>
                      setWebsite(
                        event.target.value
                      )
                    }
                    maxLength={500}
                    disabled={busy}
                    placeholder="https://company.com"
                  />
                </div>

                <div className="registration-field">
                  <label htmlFor="description">
                    Company description
                  </label>

                  <textarea
                    id="description"
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value
                      )
                    }
                    maxLength={2000}
                    disabled={busy}
                    placeholder="Tell us briefly about your organization..."
                  />
                </div>

                {errorMessage && (
                  <div
                    className="registration-error"
                    role="alert"
                  >
                    <strong>
                      Registration could not continue
                    </strong>

                    <p>
                      {errorMessage}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  className="registration-submit"
                  disabled={
                    busy ||
                    !walletAddress
                  }
                >
                  {getSubmitButtonText()}
                </button>

                <p className="registration-signature-note">
                  MetaMask will ask you to sign
                  a message. No blockchain
                  transaction or gas fee is
                  required.
                </p>
              </form>
            </>
          ) : (
            <div className="registration-complete">
              <span className="complete-check">
                ✓
              </span>

              <p className="registration-eyebrow">
                REGISTRATION RECEIVED
              </p>

              <h2>
                Awaiting
                <br />
                verification.
              </h2>

              <p>
                {successMessage}
              </p>

              <div className="pending-box">
                <span>
                  STATUS
                </span>

                <strong>
                  Pending verification
                </strong>

                <p>
                  Your wallet has been verified,
                  but the company profile must
                  be approved before bounties
                  can be created.
                </p>
              </div>

              <Link
                href="/"
                className="registration-return"
              >
                Return to company portal
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}