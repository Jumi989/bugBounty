
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const roles = ["Company", "Tester", "Validator", "Explorer"];

const initialBounties = [
  {
    id: 1,
    title: "SQL Injection in Login API",
    company: "SecureBank Ltd.",
    reward: 1.2,
    severity: "Critical",
    scope: "Authentication APIs",
    deadline: "2026-06-30",
    status: "Open",
    reportHash: "",
    evidenceCID: "",
    decision: "Pending",
    disputeReason: "",
    votes: { approve: 0, reject: 0 },
  },
  {
    id: 2,
    title: "Stored XSS in User Profile",
    company: "MedSoft Cloud",
    reward: 0.7,
    severity: "High",
    scope: "Web dashboard",
    deadline: "2026-07-15",
    status: "Open",
    reportHash: "",
    evidenceCID: "",
    decision: "Pending",
    disputeReason: "",
    votes: { approve: 0, reject: 0 },
  },
  {
    id: 3,
    title: "Broken Access Control in Admin Panel",
    company: "EduCore Systems",
    reward: 0.9,
    severity: "High",
    scope: "Admin routes",
    deadline: "2026-07-20",
    status: "Open",
    reportHash: "",
    evidenceCID: "",
    decision: "Pending",
    disputeReason: "",
    votes: { approve: 0, reject: 0 },
  },
];

const initialValidators = [
  { id: "V-01", uptime: 0.97, success: 0.93, failure: 0.04, region: "Asia", consecutive: 1, selected: false },
  { id: "V-02", uptime: 0.91, success: 0.90, failure: 0.07, region: "Europe", consecutive: 0, selected: false },
  { id: "V-03", uptime: 0.86, success: 0.81, failure: 0.13, region: "Asia", consecutive: 3, selected: false },
  { id: "V-04", uptime: 0.95, success: 0.92, failure: 0.05, region: "North America", consecutive: 2, selected: false },
  { id: "V-05", uptime: 0.82, success: 0.76, failure: 0.16, region: "Africa", consecutive: 0, selected: false },
  { id: "V-06", uptime: 0.89, success: 0.87, failure: 0.09, region: "South America", consecutive: 1, selected: false },
  { id: "V-07", uptime: 0.94, success: 0.88, failure: 0.08, region: "Europe", consecutive: 4, selected: false },
  { id: "V-08", uptime: 0.88, success: 0.84, failure: 0.10, region: "Oceania", consecutive: 0, selected: false },
];

const clusterNodes = [
  { id: "N1", x: 12, y: 22, cluster: 1, eligible: true },
  { id: "N2", x: 20, y: 36, cluster: 1, eligible: true },
  { id: "N3", x: 28, y: 18, cluster: 1, eligible: true },
  { id: "N4", x: 38, y: 42, cluster: 1, eligible: false },
  { id: "N5", x: 52, y: 28, cluster: 2, eligible: true },
  { id: "N6", x: 61, y: 44, cluster: 2, eligible: true },
  { id: "N7", x: 69, y: 24, cluster: 2, eligible: true },
  { id: "N8", x: 80, y: 48, cluster: 3, eligible: true },
  { id: "N9", x: 88, y: 30, cluster: 3, eligible: true },
  { id: "N10", x: 78, y: 16, cluster: 3, eligible: false },
];

function pseudoHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "0x" + (hash >>> 0).toString(16).padStart(8, "0") + "f1c9a2d7";
}

function makeCID(text) {
  return "ipfs://bafy" + pseudoHash(text).replace("0x", "").slice(0, 20);
}

function scoreValidator(v) {
  const alpha = 0.4;
  const beta = 0.4;
  const gamma = 0.2;
  const raw = alpha * v.uptime + beta * v.success + gamma * (1 - v.failure);
  const timeDecay = 0.96;
  const participationBalance = Math.pow(0.88, v.consecutive);
  return Math.max(0, Math.min(1, raw * timeDecay * participationBalance));
}

function makeTx(label, details) {
  return {
    id: "0x" + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10),
    block: Math.floor(1000 + Math.random() * 400),
    label,
    details,
    time: new Date().toLocaleTimeString(),
  };
}

function Stat({ label, value, note }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}

function App() {
  const [role, setRole] = useState("Company");
  const [wallet, setWallet] = useState("");
  const [bounties, setBounties] = useState(initialBounties);
  const [validators, setValidators] = useState(initialValidators);
  const [activeId, setActiveId] = useState(1);
  const [report, setReport] = useState("Vulnerability: login API accepts a crafted payload that bypasses validation.");
  const [newBounty, setNewBounty] = useState({
    title: "",
    reward: "",
    severity: "High",
    scope: "",
    deadline: "",
  });
  const [transactions, setTransactions] = useState([
    makeTx("NetworkStarted", "Permissioned chain initialized"),
    makeTx("ContractDeployed", "BugBountyEscrow.sol ready"),
  ]);
  const [clustered, setClustered] = useState(false);

  const activeBounty = bounties.find((b) => b.id === Number(activeId)) || bounties[0];
  const selectedValidators = validators.filter((v) => v.selected);
  const computedValidators = validators
    .map((v) => ({ ...v, score: scoreValidator(v) }))
    .sort((a, b) => b.score - a.score);

  function addTx(label, details) {
    setTransactions((prev) => [makeTx(label, details), ...prev].slice(0, 10));
  }

  function connectWallet() {
    const addr = "0x" + Math.random().toString(16).slice(2, 8).padEnd(6, "a") + "..." + Math.random().toString(16).slice(2, 6).padEnd(4, "f");
    setWallet(addr);
    addTx("WalletConnected", addr);
  }

  function createBounty() {
    if (!newBounty.title || !newBounty.reward || !newBounty.scope) return;
    const bounty = {
      id: bounties.length + 1,
      title: newBounty.title,
      company: "Demo Company",
      reward: Number(newBounty.reward),
      severity: newBounty.severity,
      scope: newBounty.scope,
      deadline: newBounty.deadline || "Not fixed",
      status: "Open",
      reportHash: "",
      evidenceCID: "",
      decision: "Pending",
      disputeReason: "",
      votes: { approve: 0, reject: 0 },
    };
    setBounties([bounty, ...bounties]);
    setActiveId(bounty.id);
    setNewBounty({ title: "", reward: "", severity: "High", scope: "", deadline: "" });
    addTx("BountyCreated", `Bounty #${bounty.id}, reward ${bounty.reward} ETH locked`);
  }

  function submitReport() {
    if (!report.trim()) return;
    const hash = pseudoHash(report);
    const cid = makeCID(report);
    setBounties((prev) =>
      prev.map((b) =>
        b.id === activeBounty.id
          ? { ...b, status: "Submitted", reportHash: hash, evidenceCID: cid }
          : b
      )
    );
    addTx("BugSubmitted", `Bounty #${activeBounty.id}, hash ${hash}, CID generated`);
  }

  function companyDecision(accepted) {
    setBounties((prev) =>
      prev.map((b) =>
        b.id === activeBounty.id
          ? { ...b, status: accepted ? "Accepted" : "Rejected", decision: accepted ? "Accepted by company" : "Rejected by company" }
          : b
      )
    );
    addTx(accepted ? "ReportAccepted" : "ReportRejected", `Company decision for bounty #${activeBounty.id}`);
  }

  function openDispute() {
    setBounties((prev) =>
      prev.map((b) =>
        b.id === activeBounty.id
          ? { ...b, status: "Dispute Open", disputeReason: "Tester disagrees with rejection / reward decision" }
          : b
      )
    );
    addTx("DisputeOpened", `Bounty #${activeBounty.id}, representatives required`);
  }

  function runValidatorSelection() {
    const picked = computedValidators.slice(0, 3).map((v) => v.id);
    setValidators((prev) =>
      prev.map((v) => ({
        ...v,
        selected: picked.includes(v.id),
        consecutive: picked.includes(v.id) ? v.consecutive + 1 : 0,
      }))
    );
    addTx("ValidatorsSelected", `Selected ${picked.join(", ")} using weighted reputation`);
  }

  function vote(kind) {
    const key = kind === "approve" ? "approve" : "reject";
    setBounties((prev) =>
      prev.map((b) =>
        b.id === activeBounty.id
          ? { ...b, votes: { ...b.votes, [key]: b.votes[key] + 1 } }
          : b
      )
    );
    addTx("ValidatorVote", `${kind.toUpperCase()} vote submitted for bounty #${activeBounty.id}`);
  }

  function finalizeDispute() {
    const approved = activeBounty.votes.approve >= activeBounty.votes.reject;
    setBounties((prev) =>
      prev.map((b) =>
        b.id === activeBounty.id
          ? { ...b, status: approved ? "Reward Released" : "Closed", decision: approved ? "Tester won" : "Company won" }
          : b
      )
    );
    addTx("FinalResult", approved ? "Tester won, reward released" : "Company won, dispute closed");
  }

  function runClustering() {
    setClustered(true);
    addTx("NHopClustering", "Nodes grouped by hop distance, uptime, bandwidth, and latency");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span>⬢</span>
          <div>
            <b>BugBountyChain</b>
            <small>Functional demo</small>
          </div>
        </div>

        {roles.map((r) => (
          <button key={r} className={role === r ? "active" : ""} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}

        <div className="wallet">
          <small>Wallet</small>
          <b>{wallet || "Not connected"}</b>
          <button onClick={connectWallet}>{wallet ? "Reconnect" : "Connect wallet"}</button>
        </div>
      </aside>

      <main className="main">
        <section className="topbar">
          <div>
            <p className="eyebrow">Capstone demo prototype</p>
            <h1>Blockchain-based bug bounty workflow</h1>
          </div>
          <div className="top-actions">
            <select value={activeId} onChange={(e) => setActiveId(Number(e.target.value))}>
              {bounties.map((b) => (
                <option key={b.id} value={b.id}>#{b.id} {b.title}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="stats-grid">
          <Stat label="Open bounties" value={bounties.filter((b) => b.status === "Open").length} note="Available programs" />
          <Stat label="Selected validators" value={selectedValidators.length} note="Current committee" />
          <Stat label="On-chain actions" value={transactions.length} note="Mock event log" />
          <Stat label="Safety target" value="< 1/3" note="Malicious validator limit" />
        </section>

        {role === "Company" && (
          <section className="grid two">
            <article className="card">
              <p className="eyebrow">Company dashboard</p>
              <h2>Create bounty and lock reward</h2>
              <div className="form">
                <input placeholder="Bounty title" value={newBounty.title} onChange={(e) => setNewBounty({ ...newBounty, title: e.target.value })} />
                <input placeholder="Reward amount in ETH" type="number" value={newBounty.reward} onChange={(e) => setNewBounty({ ...newBounty, reward: e.target.value })} />
                <select value={newBounty.severity} onChange={(e) => setNewBounty({ ...newBounty, severity: e.target.value })}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <input placeholder="Allowed scope" value={newBounty.scope} onChange={(e) => setNewBounty({ ...newBounty, scope: e.target.value })} />
                <input type="date" value={newBounty.deadline} onChange={(e) => setNewBounty({ ...newBounty, deadline: e.target.value })} />
                <button onClick={createBounty}>Create bounty + lock reward</button>
              </div>
              <small>Later: connect this button to createBounty() in the smart contract.</small>
            </article>

            <article className="card">
              <p className="eyebrow">Company action</p>
              <h2>Review submitted report</h2>
              <BountySnapshot bounty={activeBounty} />
              <div className="row-actions">
                <button onClick={() => companyDecision(true)}>Accept report</button>
                <button className="danger" onClick={() => companyDecision(false)}>Reject report</button>
              </div>
            </article>
          </section>
        )}

        {role === "Tester" && (
          <section className="grid two">
            <article className="card">
              <p className="eyebrow">Tester dashboard</p>
              <h2>Browse bounty marketplace</h2>
              <div className="market">
                {bounties.map((b) => (
                  <button key={b.id} className={b.id === activeBounty.id ? "market-card selected" : "market-card"} onClick={() => setActiveId(b.id)}>
                    <b>#{b.id} {b.title}</b>
                    <span>{b.company} • {b.reward} ETH • {b.severity}</span>
                    <small>{b.status}</small>
                  </button>
                ))}
              </div>
            </article>

            <article className="card">
              <p className="eyebrow">Report submission</p>
              <h2>Submit vulnerability evidence</h2>
              <textarea value={report} onChange={(e) => setReport(e.target.value)} />
              <button onClick={submitReport}>Upload off-chain + submit hash</button>
              <button className="soft" onClick={openDispute}>Open dispute</button>
              <small>Later: upload to IPFS/Pinata, then submit reportHash and evidenceCID on-chain.</small>
            </article>
          </section>
        )}

        {role === "Validator" && (
          <>
            <section className="card">
              <p className="eyebrow">Validator selection</p>
              <h2>Weighted reputation-based representative selection</h2>
              <p className="muted">
                Score uses uptime, success rate, failure rate, time decay, and participation balance.
                Higher reputation gives better chance, but repeated participation is reduced.
              </p>
              <button onClick={runValidatorSelection}>Run validator selection</button>
            </section>

            <section className="validator-grid">
              {computedValidators.map((v) => (
                <article key={v.id} className={v.selected ? "validator selected" : "validator"}>
                  <div className="validator-head">
                    <b>{v.id}</b>
                    <span>{v.selected ? "Selected" : "Candidate"}</span>
                  </div>
                  <div className="scorebar"><i style={{ width: `${v.score * 100}%` }} /></div>
                  <div className="metrics">
                    <p>Score <b>{Math.round(v.score * 100)}%</b></p>
                    <p>Uptime <b>{Math.round(v.uptime * 100)}%</b></p>
                    <p>Success <b>{Math.round(v.success * 100)}%</b></p>
                    <p>Failure <b>{Math.round(v.failure * 100)}%</b></p>
                    <p>Consecutive <b>{v.consecutive}</b></p>
                    <p>Region <b>{v.region}</b></p>
                  </div>
                </article>
              ))}
            </section>

            <section className="grid two">
              <article className="card">
                <p className="eyebrow">Voting panel</p>
                <h2>Validator dispute vote</h2>
                <BountySnapshot bounty={activeBounty} />
                <div className="row-actions">
                  <button onClick={() => vote("approve")}>Vote approve</button>
                  <button className="danger" onClick={() => vote("reject")}>Vote reject</button>
                </div>
                <button className="soft" onClick={finalizeDispute}>Finalize dispute</button>
              </article>

              <article className="card">
                <p className="eyebrow">Future clustering</p>
                <h2>N-hop clustering visualizer</h2>
                <NetworkGraph clustered={clustered} />
                <button onClick={runClustering}>Run n-hop clustering</button>
                <small>Groups nodes by hop distance, verified uptime, measured bandwidth, and latency.</small>
              </article>
            </section>
          </>
        )}

        {role === "Explorer" && (
          <section className="grid two">
            <article className="card">
              <p className="eyebrow">Current bounty state</p>
              <h2>On-chain/off-chain record</h2>
              <BountySnapshot bounty={activeBounty} />
              <div className="storage-grid">
                <div>
                  <b>On-chain</b>
                  <span>Bounty ID, reward, report hash, CID, votes, final decision</span>
                </div>
                <div>
                  <b>Off-chain</b>
                  <span>Full report, exploit steps, screenshots, evidence files</span>
                </div>
              </div>
            </article>

            <article className="card">
              <p className="eyebrow">Blockchain explorer</p>
              <h2>Mock transaction/event log</h2>
              <div className="tx-list">
                {transactions.map((tx) => (
                  <div className="tx" key={tx.id}>
                    <b>{tx.label}</b>
                    <span>Block #{tx.block} • {tx.time}</span>
                    <small>{tx.details}</small>
                    <code>{tx.id}</code>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

function BountySnapshot({ bounty }) {
  return (
    <div className="snapshot">
      <h3>#{bounty.id} {bounty.title}</h3>
      <div className="snapshot-grid">
        <p>Company <b>{bounty.company}</b></p>
        <p>Reward <b>{bounty.reward} ETH</b></p>
        <p>Severity <b>{bounty.severity}</b></p>
        <p>Status <b>{bounty.status}</b></p>
        <p>Approve votes <b>{bounty.votes.approve}</b></p>
        <p>Reject votes <b>{bounty.votes.reject}</b></p>
      </div>
      <div className="hash">
        <span>Report hash</span>
        <code>{bounty.reportHash || "Not submitted yet"}</code>
      </div>
      <div className="hash">
        <span>Evidence CID</span>
        <code>{bounty.evidenceCID || "Not uploaded yet"}</code>
      </div>
    </div>
  );
}

function NetworkGraph({ clustered }) {
  return (
    <div className="network-graph">
      <svg viewBox="0 0 100 60" role="img">
        <line x1="12" y1="22" x2="20" y2="36" />
        <line x1="20" y1="36" x2="28" y2="18" />
        <line x1="28" y1="18" x2="38" y2="42" />
        <line x1="52" y1="28" x2="61" y2="44" />
        <line x1="61" y1="44" x2="69" y2="24" />
        <line x1="80" y1="48" x2="88" y2="30" />
        <line x1="88" y1="30" x2="78" y2="16" />
        {clustered && (
          <>
            <ellipse cx="24" cy="30" rx="22" ry="21" className="c1" />
            <ellipse cx="61" cy="32" rx="19" ry="20" className="c2" />
            <ellipse cx="82" cy="31" rx="17" ry="22" className="c3" />
          </>
        )}
        {clusterNodes.map((n) => (
          <g key={n.id}>
            <circle className={`node node-${n.cluster} ${n.eligible ? "" : "bad"}`} cx={n.x} cy={n.y} r="3.4" />
            <text x={n.x + 3} y={n.y - 3}>{n.id}</text>
          </g>
        ))}
      </svg>
      <div className="cluster-note">
        {clustered ? "Clusters formed: C1, C2, C3" : "Click run to form n-hop clusters"}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
