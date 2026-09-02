"use client";

import {useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";


export default function RewardPage(){

const params = useParams();
const router = useRouter();

const id = params.id as string;


const [amount,setAmount] = useState("0.25");

const [report,setReport] = useState<any>(null);



useEffect(()=>{

async function load(){

const res = await fetch(
`/api/company/reports/${id}`
);


const data = await res.json();


if(data.success){

setReport(data.report);

}

}


load();


},[id]);





async function approveReward() {
  try {
    if (!amount || Number(amount) <= 0) {
      alert("Enter a valid reward amount");
      return;
    }

    const rewardWei = BigInt(
      Math.floor(Number(amount) * 1e18)
    ).toString();

    console.log("APPROVING REWARD");
    console.log("Report:", id);
    console.log("Reward:", rewardWei);

    const response = await fetch(
      `/api/company/reports/${id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "accepted",
          approved_reward_wei: rewardWei,
        }),
      }
    );

    const data = await response.json();

    console.log("APPROVAL RESPONSE:", data);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Reward approval failed"
      );
    }

    alert("Reward approved successfully");

    router.push(
      `/company/reports/${id}`
    );
  } catch (error) {
    console.error(
      "APPROVE REWARD ERROR:",
      error
    );

    alert(
      error instanceof Error
        ? error.message
        : "Failed to approve reward"
    );
  }
}





if(!report){

return (

<p>

Loading...

</p>

);

}





return(

<section className="reward-page">


<p className="dashboard-eyebrow">

REWARD APPROVAL

</p>



<h1>

Approve Researcher Reward

</h1>




<div className="reward-card">



<h2>

{report.title}

</h2>



<p>

Researcher:

<strong>

{" "}

{report.researcher_name}

</strong>

</p>





<p>

Current Status:

<strong>

{" "}

{report.status}

</strong>

</p>




<label>

Reward Amount (ETH)

</label>



<input

type="number"

step="0.01"

value={amount}

onChange={(e)=>

setAmount(e.target.value)

}

/>





<br/>





<button
  type="button"
  onClick={approveReward}
>
  Approve Reward →
</button>




</div>


</section>


);


}