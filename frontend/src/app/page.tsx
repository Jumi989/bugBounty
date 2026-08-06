"use client";

import { useState } from "react";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected";

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkName(chainId: string): string {
  const networks: Record<string, string> = {
    "0x7a69": "Hardhat Local Network",
    "0x1": "Ethereum Mainnet",
    "0xaa36a7": "Sepolia Testnet",
  };

  return networks[chainId] ?? `Chain ${chainId}`;
}

export default function Home() {
  const [walletAddress, setWalletAddress] =
    useState<string>("");

  const [networkName, setNetworkName] =
    useState<string>("");

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");

  const [errorMessage, setErrorMessage] =
    useState<string>("");

  const walletConnected =
    connectionStatus === "connected";

  async function connectWallet(): Promise<void> {
    setErrorMessage("");

    if (!window.ethereum) {
      setErrorMessage(
        "MetaMask was not detected. Install MetaMask and refresh the page."
      );

      return;
    }

    try {
      setConnectionStatus("connecting");

      const accounts =
        (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error(
          "MetaMask did not return a wallet account."
        );
      }

      const chainId =
        (await window.ethereum.request({
          method: "eth_chainId",
        })) as string;

      setWalletAddress(accounts[0]);
      setNetworkName(getNetworkName(chainId));
      setConnectionStatus("connected");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "The wallet connection failed.";

      setErrorMessage(message);
      setConnectionStatus("idle");
    }
  }

  function scrollToPortal(): void {
    document
      .getElementById("company-access")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  return (
    <main className="website">
      <header className="site-header">
        <a href="#" className="wordmark">
          <span className="wordmark-mark">BB</span>

          <span>
            BUG BOUNTY
            <small>SECURITY JOURNAL</small>
          </span>
        </a>

        <nav className="desktop-navigation">
          <a href="#company-access">Company access</a>
          <a href="#process">How it works</a>
          <a href="#technology">Technology</a>
        </nav>

        <button
          type="button"
          className="header-button"
          onClick={scrollToPortal}
        >
          Enter portal
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-grid" />

        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />

        <div className="hero-content">
          <p className="hero-kicker">
            A PRIVATE SECURITY MARKETPLACE
          </p>

          <h1>
            Trusted reports.
            <span>Transparent rewards.</span>
          </h1>

          <p className="hero-description">
            A secure meeting place for verified
            companies and professional security
            researchers.
          </p>

          <button
            type="button"
            className="hero-link"
            onClick={scrollToPortal}
          >
            <span>Company sign in</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="hero-caption">
          <span>POSTGRESQL VERIFICATION</span>
          <span>EIP-712 AUTHORIZATION</span>
          <span>BLOCKCHAIN ESCROW</span>
        </div>
      </section>

      <section
        className="company-section"
        id="company-access"
      >
        <div className="editorial-introduction">
          <p className="section-number">01</p>

          <p className="small-heading">
            WELCOME TO THE COMPANY PORTAL
          </p>

          <h2>
            Create trustworthy
            <br />
            security programs.
          </h2>

          <p className="intro-description">
            Connect the wallet associated with your
            verified company account. Your participant
            profile remains in PostgreSQL, while
            critical bounty and payment actions are
            protected through the blockchain escrow
            contract.
          </p>

          <div className="editorial-note">
            <span className="note-line" />

            <p>
              Connecting a wallet does not create a
              blockchain transaction and does not cost
              gas.
            </p>
          </div>
        </div>

        <article className="wallet-card">
          <div className="wallet-card-header">
            <div>
              <p className="small-heading">
                COMPANY ACCESS
              </p>

              <h3>Verify your wallet</h3>
            </div>

            <span className="card-number">01 / 03</span>
          </div>

          <div className="wallet-status">
            <div className="wallet-emblem">
              <span>W</span>
            </div>

            <div className="wallet-information">
              <span className="wallet-label">
                CONNECTED WALLET
              </span>

              <strong>
                {walletConnected
                  ? shortenAddress(walletAddress)
                  : "No wallet connected"}
              </strong>

              <p>
                {walletConnected
                  ? networkName
                  : "MetaMask connection required"}
              </p>
            </div>

            <span
              className={
                walletConnected
                  ? "connection-light active"
                  : "connection-light"
              }
              aria-label={
                walletConnected
                  ? "Wallet connected"
                  : "Wallet disconnected"
              }
            />
          </div>

          <button
            type="button"
            className="connect-button"
            onClick={connectWallet}
            disabled={
              connectionStatus === "connecting" ||
              walletConnected
            }
          >
            {connectionStatus === "connecting"
              ? "Connecting wallet..."
              : walletConnected
                ? "Wallet connected"
                : "Connect MetaMask"}
          </button>

          <div
            className="message-area"
            aria-live="polite"
          >
            {errorMessage && (
              <div className="error-message">
                <strong>Connection failed</strong>
                <p>{errorMessage}</p>
              </div>
            )}

            {walletConnected && (
              <div className="success-message">
                <span className="success-symbol">
                  ✓
                </span>

                <div>
                  <strong>
                    Wallet connection successful
                  </strong>

                  <p>
                    Next, you will sign a login
                    challenge to prove ownership of
                    this wallet.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="card-footer">
            <span>SECURE WALLET AUTHENTICATION</span>
            <span>NO GAS REQUIRED</span>
          </div>
        </article>
      </section>

      <section
        className="technology-strip"
        id="technology"
      >
        <p>BUILT WITH</p>

        <div className="technology-list">
          <span>POSTGRESQL</span>
          <span>REACT</span>
          <span>NEXT.JS</span>
          <span>ETHERS.JS</span>
          <span>HARDHAT</span>
          <span>EIP-712</span>
        </div>
      </section>

      <section
        className="process-section"
        id="process"
      >
        <div className="process-heading">
          <p className="section-number">02</p>

          <p className="small-heading">
            THE COMPANY WORKFLOW
          </p>

          <h2>
            From verification
            <br />
            to secured reward.
          </h2>
        </div>

        <div className="process-grid">
          <article className="process-card">
            <span className="process-number">01</span>
            <h3>Connect and verify</h3>

            <p>
              Prove ownership of the wallet connected
              to your verified PostgreSQL company
              profile.
            </p>
          </article>

          <article className="process-card">
            <span className="process-number">02</span>
            <h3>Create a bounty</h3>

            <p>
              Define the security scope, reward,
              reporting period and program
              requirements.
            </p>
          </article>

          <article className="process-card">
            <span className="process-number">03</span>
            <h3>Secure the reward</h3>

            <p>
              Deposit the bounty reward into the
              blockchain escrow contract for
              transparent settlement.
            </p>
          </article>
        </div>
      </section>

      <section className="closing-section">
        <p className="small-heading">
          RESPONSIBLE DISCLOSURE
        </p>

        <h2>
          Better security begins
          <br />
          with trusted collaboration.
        </h2>

        <button
          type="button"
          onClick={scrollToPortal}
        >
          Access the company portal
        </button>
      </section>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="wordmark-mark">BB</span>

          <div>
            <strong>BUG BOUNTY</strong>
            <p>SECURITY JOURNAL</p>
          </div>
        </div>

        <p>
          PostgreSQL participant verification.
          Blockchain-secured bounty operations.
        </p>

        <span>LOCAL DEVELOPMENT BUILD</span>
      </footer>
    </main>
  );
}