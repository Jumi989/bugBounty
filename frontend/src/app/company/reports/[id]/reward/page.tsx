"use client";
import { ethers } from "ethers";
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

    if (!window.ethereum) {
      throw new Error("MetaMask is required.");
    }

    /*
     * 1. Ask backend to prepare
     *    the exact reward authorization.
     */
    const prepareResponse = await fetch(
      `/api/company/reports/${id}/prepare-reward`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          rewardAmountEth: amount,
        }),
      }
    );

    const prepareData =
      await prepareResponse.json();

    if (
      !prepareResponse.ok ||
      !prepareData.success
    ) {
      throw new Error(
        prepareData.message ||
          "Could not prepare reward."
      );
    }

    /*
     * 2. Connect MetaMask.
     */
    const provider =
      new ethers.BrowserProvider(
        window.ethereum
      );

    const signer =
      await provider.getSigner();

    const companyWallet =
      await signer.getAddress();

    /*
     * 3. Make sure the company wallet
     *    is the authenticated wallet.
     */
    if (
      companyWallet.toLowerCase() !==
      prepareData.company.walletAddress.toLowerCase()
    ) {
      throw new Error(
        "Please connect the verified company wallet."
      );
    }

    /*
     * 4. Make sure MetaMask is on Besu.
     */
    const network =
      await provider.getNetwork();

    if (
      network.chainId !== 2026n
    ) {
      throw new Error(
        "Please switch MetaMask to Besu Reputation Network."
      );
    }

    /*
     * 5. EIP-712 signature.
     *
     * THIS DOES NOT SEND ETH.
     * THIS DOES NOT CREATE A TRANSACTION.
     */
    const signature =
      await signer.signTypedData(
        prepareData.domain,
        prepareData.types,
        prepareData.value
      );

    console.log(
      "REWARD SIGNATURE:",
      signature
    );

    /*
     * 6. Send signature to backend.
     */
    const acceptResponse =
      await fetch(
        `/api/company/reports/${id}/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            rewardAmountWei:
              prepareData.value.rewardAmount,
            nonce:
              prepareData.value.nonce,
            deadline:
              prepareData.value.deadline,
            signature,
          }),
        }
      );

    const acceptData =
      await acceptResponse.json();

    if (
      !acceptResponse.ok ||
      !acceptData.success
    ) {
      throw new Error(
        acceptData.message ||
          "Reward approval failed."
      );
    }

    alert(
      "Reward approved. The Bug Hunter can now claim it."
    );

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
        : "Failed to approve reward."
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