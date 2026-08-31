"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Participant = {
  id: string;
  walletAddress: string;
  role: string;
  username: string | null;
  email: string | null;
  active: boolean;
  verified: boolean;
};

type SessionResponse = {
  success: boolean;
  authenticated: boolean;
  participant?: Participant;
  message?: string;
};

export default function TesterDashboard() {
  const router = useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    participant,
    setParticipant,
  ] = useState<Participant | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
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
          router.replace(
            "/tester/sign-in"
          );
          return;
        }

        setParticipant(
          data.participant
        );
      } catch {
        if (!cancelled) {
          router.replace(
            "/tester/sign-in"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <main>
        <p>Loading your dashboard...</p>
      </main>
    );
  }

  if (!participant) {
    return null;
  }

  return (
  <div className="hunter-dashboard">

    <main className="hunter-main">

      <section className="welcome-section">

        <div className="welcome-copy">

          <span className="dashboard-eyebrow">
            BUG HUNTER PORTAL
          </span>

          <h1 className="dashboard-title">
            Welcome back,
            <br />
            {participant.username ?? "Bug Hunter"}.
          </h1>

          <p className="dashboard-description">
            Your wallet has been verified and your
            Bug Hunter session is active.
          </p>

        </div>


        <div className="dashboard-status-grid">

          <div className="status-card">

            <span className="card-label">
              ACCOUNT
            </span>

            <strong>
              {participant.username ?? "Bug Hunter"}
            </strong>

          </div>


          <div className="status-card">

            <span className="card-label">
              WALLET
            </span>

            <strong>
              {participant.walletAddress}
            </strong>

          </div>


          <div className="status-card">

            <span className="card-label">
              STATUS
            </span>

            <strong className="status-active">
              Active · Verified
            </strong>

          </div>

        </div>

      </section>



      <section className="content-grid">


        <div className="content-card">

          <div className="content-card-header">

            <h2>
              Available Bounties
            </h2>

          </div>


          <div className="empty-state">

            <div className="empty-state-icon">
              +
            </div>

            <h3>
              No active programs yet
            </h3>

            <p>
              Active security programs will appear here.
            </p>

          </div>

        </div>



        <div className="content-card">

          <div className="content-card-header">

            <h2>
              My Reports
            </h2>

          </div>


          <div className="empty-state">

            <div className="empty-state-icon">
              ✓
            </div>

            <h3>
              No reports submitted
            </h3>

            <p>
              Your vulnerability reports will appear here.
            </p>

          </div>

        </div>


      </section>


    </main>

  </div>
);
}