"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";


type LoginStatus =
  | "idle"
  | "connecting"
  | "requesting"
  | "signing"
  | "verifying"
  | "authenticated";

type ChallengeResponse = {
  success: boolean;
  message?: string;
  challenge?: {
    id: string;
    message: string;
    walletAddress: string;
  };
};

type VerifyResponse = {
  success: boolean;
  message?: string;
  participant?: {
    username?: string | null;
  };
};

export default function TesterSignInPage() {
  const router = useRouter();

  const [
    walletAddress,
    setWalletAddress,
  ] = useState("");

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState<LoginStatus>("idle");

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    async function restoreSession() {
      try {
        const response =
          await fetch(
            "/api/tester/auth/me",
            {
              credentials: "include",
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          response.ok &&
          data.success &&
          data.authenticated
        ) {
          router.replace(
            "/tester/dashboard"
          );
        }
      } catch {
        // Not authenticated. Stay on sign-in page.
      }
    }

    void restoreSession();
  }, [router]);

  async function login(): Promise<void> {
    setError("");

    if (!window.ethereum) {
      setError(
        "MetaMask was not detected. Please install MetaMask first."
      );
      return;
    }

    try {
      setStatus("connecting");

      const accounts =
        (await window.ethereum.request({
          method:
            "eth_requestAccounts",
        })) as string[];

      if (
        !accounts ||
        accounts.length === 0
      ) {
        throw new Error(
          "No MetaMask wallet was selected."
        );
      }

      const wallet =
        accounts[0];

      setWalletAddress(wallet);

      setStatus("requesting");

      const challengeResponse =
        await fetch(
          "/api/tester/auth/challenge",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              walletAddress: wallet,
            }),
          }
        );

      const challengeData =
        (await challengeResponse.json()) as
          ChallengeResponse;

      if (
        !challengeResponse.ok ||
        !challengeData.success ||
        !challengeData.challenge
      ) {
        throw new Error(
          challengeData.message ??
            "Could not create the login challenge."
        );
      }

      setStatus("signing");

      const signature =
        (await window.ethereum.request({
          method: "personal_sign",
          params: [
            challengeData.challenge
              .message,
            wallet,
          ],
        })) as string;

      if (!signature) {
        throw new Error(
          "MetaMask did not return a signature."
        );
      }

      setStatus("verifying");

      const verifyResponse =
        await fetch(
          "/api/tester/auth/verify",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              challengeId:
                challengeData.challenge.id,
              walletAddress: wallet,
              signature,
            }),
          }
        );

      const verifyData =
        (await verifyResponse.json()) as
          VerifyResponse;

      if (
        !verifyResponse.ok ||
        !verifyData.success
      ) {
        throw new Error(
          verifyData.message ??
            "Bug Hunter login failed."
        );
      }

      setUsername(
        verifyData.participant
          ?.username ?? ""
      );

      setStatus("authenticated");

      router.replace(
        "/tester/dashboard"
      );
    } catch (error: unknown) {
      const metamaskError =
        error as {
          code?: number;
          message?: string;
        };

      if (
        metamaskError.code === 4001
      ) {
        setError(
          "The signature request was cancelled."
        );
      } else {
        setError(
          metamaskError.message ??
            "Bug Hunter login failed."
        );
      }

      setStatus("idle");
    }
  }

  const buttonText =
    status === "connecting"
      ? "Connecting wallet..."
      : status === "requesting"
      ? "Preparing secure login..."
      : status === "signing"
      ? "Waiting for signature..."
      : status === "verifying"
      ? "Verifying wallet..."
      : "Sign in with MetaMask";

  return (
    <main className="tester-auth-page">
      <section className="tester-auth-card">
        <p className="small-heading">
          BUG HUNTER ACCESS
        </p>

        <h1>
          Sign in to
          <br />
          your account.
        </h1>

        <p className="tester-auth-description">
          Connect the wallet associated with
          your Bug Hunter account and sign a
          secure message to verify ownership.
        </p>

        <button
          type="button"
          onClick={() => void login()}
          disabled={
            status !== "idle"
          }
        >
          {buttonText}
        </button>

        {walletAddress && (
          <p className="tester-wallet">
            {walletAddress}
          </p>
        )}

        {error && (
          <div className="tester-auth-error">
            <strong>
              Sign-in could not continue
            </strong>

            <p>{error}</p>
          </div>
        )}

        {status ===
          "authenticated" && (
          <p>
            Welcome back{" "}
            {username || "Bug Hunter"}.
          </p>
        )}

        <div className="tester-auth-links">
          <p>
            New to BugBounty?
            <a href="/tester/register">
              Become a Bug Hunter →
            </a>
          </p>

          <p>
            Looking to run a security
            program?
            <a href="/company/register">
              Company access →
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}