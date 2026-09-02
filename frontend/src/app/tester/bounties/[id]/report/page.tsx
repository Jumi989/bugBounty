"use client";

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
    // Get the currently authenticated Bug Hunter
    const meResponse = await fetch("/api/tester/auth/me", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const meData = await meResponse.json();

    console.log("TESTER AUTH RESPONSE:", meData);

    if (!meResponse.ok || !meData.success || !meData.authenticated) {
  console.error("TESTER AUTH FAILED:", {
    status: meResponse.status,
    response: meData,
  });

  throw new Error(
    meData.message ||
    `Tester authentication failed (HTTP ${meResponse.status})`
  );
}

    const tester = meData.participant;

    if (!tester?.id || !tester?.walletAddress) {
      throw new Error(
        "Authenticated Bug Hunter information is incomplete."
      );
    }

    console.log("TESTER ID:", tester.id);
    console.log("TESTER WALLET:", tester.walletAddress);
    console.log("BOUNTY ID:", bountyId);

    // Submit the vulnerability report
    const response = await fetch("/api/tester/reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bountyId,
        title: title.trim(),
        severity,
        description: description.trim(),
        stepsToReproduce: steps.trim(),

        // IMPORTANT:
        // API expects evidenceUrl, not evidence
        evidenceUrl: evidence.trim() || null,

        // Required by /api/tester/reports
        testerId: tester.id,
        testerWallet: tester.walletAddress,
      }),
    });

    const data = await response.json();

    console.log("REPORT API RESPONSE:", data);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Report submission failed."
      );
    }

    setMessage("Report submitted successfully.");

    setTimeout(() => {
      router.push("/tester/dashboard");
    }, 1500);
  } catch (error) {
    console.error("REPORT SUBMISSION ERROR:", error);

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