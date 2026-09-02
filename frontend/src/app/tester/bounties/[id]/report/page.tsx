"use client";
import { ethers } from "ethers";
import {
  useState
} from "react";

import {
  useParams,
  useRouter
} from "next/navigation";


export default function ReportPage(){

const router = useRouter();

const params = useParams();
const bountyId =
  params.id as string;


const [title,setTitle] =
useState("");

const [description,setDescription] =
useState("");

const [evidence,setEvidence] =
useState("");

const [loading,setLoading] =
useState(false);


const [message,setMessage] =
useState("");

const [severity,setSeverity] =
useState("");

const [steps,setSteps] =
useState("");



async function submitReport() {
  setLoading(true);
  setMessage("");

  try {
    // 1. Check Bug Hunter authentication
    const meResponse = await fetch("/api/tester/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const meData = await meResponse.json();

    if (
      !meResponse.ok ||
      !meData.success ||
      !meData.authenticated
    ) {
      throw new Error(
        meData.message ||
          "You are not authenticated as a Bug Hunter."
      );
    }

    const tester = meData.participant;

    // 2. Create the database report
    const response = await fetch("/api/tester/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bountyId,
        title,
        severity,
        description,
        stepsToReproduce: steps,
        evidenceUrl: evidence || null,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Report submission failed"
      );
    }

    const report = data.report;

    // 3. Connect Bug Hunter's MetaMask
    if (!window.ethereum) {
      throw new Error("Please install MetaMask.");
    }

    const provider = new ethers.BrowserProvider(
      window.ethereum
    );

    const signer = await provider.getSigner();

    const wallet = await signer.getAddress();

    if (wallet.toLowerCase() !== tester.walletAddress.toLowerCase()) {
      throw new Error(
        "MetaMask wallet does not match your Bug Hunter account."
      );
    }

    // 4. Get blockchain network
    const network = await provider.getNetwork();

    if (network.chainId !== 2026n) {
      throw new Error(
        "Please switch MetaMask to Besu Reputation Network."
      );
    }

    setMessage("Report saved. Preparing blockchain submission...");

    // 5. Get authorization from backend
    const authResponse = await fetch(
      "/api/tester/reports/submit-authorization",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          bountyId,
          reportId: report.id,
          reportHash: report.report_hash,
        }),
      }
    );

    const authData = await authResponse.json();

    if (!authResponse.ok || !authData.success) {
      throw new Error(
        authData.message ||
          "Failed to prepare blockchain authorization."
      );
    }

    // 6. Contract
    const CONTRACT_ADDRESS =
      process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

    if (!CONTRACT_ADDRESS) {
      throw new Error(
        "NEXT_PUBLIC_ESCROW_ADDRESS is missing."
      );
    }

    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      [
        "function submitBug(uint256,bytes32,string,uint256,(address,uint8,bytes32,uint8,bytes32,uint256,uint256),bytes) returns (uint256)"
      ],
      signer
    );

    // 7. Submit bug on-chain
    const tx = await contract.submitBug(
      bountyId,
      report.report_hash,
      authData.encryptedEvidenceCID,
      authData.requestedRewardWei,
      authData.authorization,
      authData.signature
    );

    setMessage("Blockchain transaction submitted. Waiting...");

    const receipt = await tx.wait();

    console.log("SUBMIT BUG TX:", receipt.hash);

    setMessage(
      "Report submitted successfully on-chain."
    );

    setTimeout(() => {
      router.push("/tester/reports");
    }, 1500);

  } catch (error) {
    console.error("SUBMIT REPORT ERROR:", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "Something went wrong."
    );
  } finally {
    setLoading(false);
  }
}




return (

<main className="hunter-main">


<section className="report-card">


<span className="portal-label">
VULNERABILITY REPORT
</span>


<h1>
Submit Security Report
</h1>



<div className="form-group">

<label>
Title
</label>


<input

value={title}

onChange={
(e)=>setTitle(e.target.value)
}

/>

</div>




<div className="form-group">
<label>
Severity
</label>

<select
value={severity}
onChange={
(e)=>setSeverity(e.target.value)
}
>

<option value="">
Select severity
</option>

<option>
Critical
</option>

<option>
High
</option>

<option>
Medium
</option>

<option>
Low
</option>

</select>

<label>
Description
</label>


<textarea

rows={8}

value={description}

onChange={
(e)=>setDescription(e.target.value)
}

/>

</div>

<div className="form-group">
<label>
Steps to reproduce
</label>

<textarea

value={steps}

onChange={
(e)=>setSteps(e.target.value)
}

/>


<label>
Evidence Link (optional)
</label>


<input

value={evidence}

onChange={
(e)=>setEvidence(e.target.value)
}

/>

</div>



<button

onClick={submitReport}

disabled={loading}

>

{
loading
?
"Submitting..."
:
"Submit Report"
}


</button>


{
message &&

<p>

{message}

</p>

}



</section>


</main>


);


}