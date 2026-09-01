"use client";
import SubmissionsPage from "@/components/company/SubmissionsPage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CompanySession = {
  success: boolean;
  authenticated: boolean;
  message?: string;

  participant?: {
    id: string;
    walletAddress: string;
    role: string;
    organizationId: string;
    companyName: string | null;
    displayName: string | null;
    email: string | null;
    active: boolean;
    verified: boolean;
  };
};

type VulnerabilityReport = {
  id: number;
  title: string;
  severity: string;
  description: string;
  steps_to_reproduce: string;
  evidence_url: string | null;
  status: string;
  created_at: string;
  tester_wallet: string;
  bounty_id: number;
  bounty_title: string;
};

function shortenAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export default function CompanyDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [company, setCompany] =
    useState<
      CompanySession["participant"] | null
    >(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);

  const [reports,setReports] =
    useState<VulnerabilityReport[]>([]);

    const [activePage,setActivePage] =
useState<
"dashboard" | "submissions"
>("dashboard");

  /*
   * Protect the dashboard.
   *
   * When the page opens, verify the HTTP-only
   * session with the backend.
   */
useEffect(()=>{

async function loadReports(){

try{

const response =
await fetch(
"/api/company/reports",
{
credentials:"include",
cache:"no-store"
}
);


const data =
await response.json();


if(data.success){

setReports(data.reports);

}

}
catch(error){

console.error(
"Failed loading reports:",
error
);

}

}


loadReports();


},[]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompany():
    Promise<void> {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as
            CompanySession;

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

        setCompany(data.participant);
      } catch {
        if (!cancelled) {
          router.replace("/");
        }
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

  async function logout():
  Promise<void> {
    setErrorMessage("");
    setLoggingOut(true);

    try {
      const response =
        await fetch(
          "/api/auth/logout",
          {
            method: "POST",
            credentials: "include",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Could not log out."
        );
      }

      router.replace("/");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Logout failed.";

      setErrorMessage(message);
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <div>
          <span>BB</span>

          <p>
            Verifying company session...
          </p>
        </div>
      </main>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <main className="company-dashboard">
      <aside className="dashboard-sidebar">
        <div>
          <Link
            href="/company/dashboard"
            className="dashboard-brand"
          >
            <span>BB</span>

            <div>
              <strong>
                BUG BOUNTY
              </strong>

              <small>
                COMPANY PORTAL
              </small>
            </div>
          </Link>

          <div className="dashboard-company-mini">
            <span>
              VERIFIED COMPANY
            </span>

            <strong>
              {company.companyName ??
                "Company"}
            </strong>

            <p>
              {shortenAddress(
                company.walletAddress
              )}
            </p>
          </div>

          <nav className="dashboard-navigation">
            <Link
 href="/company/dashboard"
 className={
   activePage === "dashboard"
   ? "active"
   : ""
 }
>
              <span>01</span>
              Overview
            </Link>

            <button
              type="button"
              disabled
            >
              <span>02</span>
              My Bounties
              <small>Next</small>
            </button>

           <Link href="/company/bounties/create">
  <span>03</span>
  Create Bounty
  <small>New</small>
</Link>

            <button
type="button"
className={
activePage === "submissions"
?
"active"
:
""
}
onClick={() =>
setActivePage("submissions")
}
>
<span>04</span>
Submissions
</button>

            <button
              type="button"
              disabled
            >
              <span>05</span>
              Company Profile
            </button>
          </nav>
        </div>

        <div className="dashboard-sidebar-footer">
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut
              ? "Logging out..."
              : "Log out"}
          </button>

          <span>
            LOCAL DEVELOPMENT BUILD
          </span>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p>
              COMPANY OPERATIONS
            </p>

            <span>
              Overview / Dashboard
            </span>
          </div>

          <div className="dashboard-verification">
            <span />

            <div>
              <small>
                ACCOUNT STATUS
              </small>

              <strong>
                Verified & Active
              </strong>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {
activePage === "dashboard" && (
<>
          <section className="dashboard-welcome">
            <div>
              <p className="dashboard-section-number">
                01
              </p>

              <p className="dashboard-eyebrow">
                COMPANY OVERVIEW
              </p>

              <h1>
                Welcome,
                <br />

                <em>
                  {company.companyName ??
                    "Company"}
                </em>
              </h1>

              <p className="dashboard-description">
                Manage vulnerability reward
                programs, review security
                submissions and control
                blockchain-secured bounty
                escrow from one workspace.
              </p>
            </div>

            <div className="dashboard-identity-card">
              <span>
                COMPANY IDENTITY
              </span>

              <div>
                <small>
                  WALLET
                </small>

                <strong>
                  {shortenAddress(
                    company.walletAddress
                  )}
                </strong>
              </div>

              <div>
                <small>
                  CONTACT
                </small>

                <strong>
                  {company.displayName ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <small>
                  EMAIL
                </small>

                <strong>
                  {company.email ??
                    "Not provided"}
                </strong>
              </div>

              <div>
                <small>
                  ORGANIZATION ID
                </small>

                <strong className="organization-id">
                  {shortenAddress(
                    company.organizationId
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="dashboard-stats">
            <article>
              <div>
                <span>
                  ACTIVE BOUNTIES
                </span>

                <small>
                  PROGRAMS
                </small>
              </div>

              <strong>0</strong>

              <p>
                No active programs yet.
              </p>
            </article>

            <article>
              <div>
                <span>
                  SUBMISSIONS
                </span>

                <small>
                  REPORTS
                </small>
              </div>

              <strong>
 {reports.length}
</strong>

<p>
 {reports.length === 0
 ?
 "No vulnerability reports yet."
 :
 "Reports waiting for review."
 }
</p>
            </article>

            <article>
              <div>
                <span>
                  ESCROW LOCKED
                </span>

                <small>
                  ON-CHAIN
                </small>
              </div>

              <strong>
                0
                <small> ETH</small>
              </strong>

              <p>
                No reward currently locked.
              </p>
            </article>
          </section>

          <section className="dashboard-action-section">

<div>

<p className="dashboard-eyebrow">
INCOMING REPORTS
</p>


<h2>
Security researcher submissions
</h2>


<p>
Review vulnerability reports submitted
by Bug Hunters.
</p>


</div>



<div className="dashboard-next-card">


{
reports.length === 0 ?

(
<p>
No reports submitted yet.
</p>
)

:

reports.map(
(report)=>(
<article
key={report.id}
className="report-card"
>


<span>
{report.severity}
</span>


<h3>
{report.title}
</h3>


<p>
Program:
{report.bounty_title}
</p>


<p>
Researcher:

{report.tester_wallet.slice(0,10)}
...
</p>


<p>
Status:
{report.status}
</p>


<button
type="button"
onClick={()=>
router.push(
`/company/reports/${report.id}`
)
}
>
Review Report →
</button>


</article>
)

)


}


</div>


</section>

          <section className="dashboard-action-section">
            <div>
              <p className="dashboard-section-number">
                02
              </p>

              <p className="dashboard-eyebrow">
                SECURITY PROGRAMS
              </p>

              <h2>
                Launch your first
                <br />
                bounty program.
              </h2>

              <p>
                Define the security scope,
                reward amount, reporting
                period and program metadata.
                The reward will later be
                secured through the
                BugBountyEscrow smart
                contract.
              </p>
            </div>

            <div className="dashboard-next-card">
              <span>
                NEXT DEVELOPMENT STEP
              </span>

              <h3>
                Create Bounty
              </h3>

              <p>
                We will connect this action
                to PostgreSQL authorization,
                EIP-712 backend signatures
                and MetaMask.
              </p>

              <button
                type="button"
                disabled
              >
                Create bounty — coming next
              </button>
            </div>
          </section>

          {errorMessage && (
            <div
              className="dashboard-error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

        </>
      )}

      {activePage === "submissions" && (
        <SubmissionsPage />
      )}

        </div>
      </section>
    </main>
  );
}