"use client";
import { ethers } from "ethers";
import {
  useEffect,
  useState
} from "react";

import {
  useParams,
  useRouter
} from "next/navigation";


type Bounty = {

  id:string;

  title:string;

  description:string;

  severity:string;

  scope:string;

  total_escrow_wei:string;

  start_time:string;

  end_time:string;

};



function formatEth(wei:string){

return ethers.formatEther(wei);

}



export default function BountyDetails(){


const params = useParams();

const router = useRouter();


const [bounty,setBounty] =
useState<Bounty|null>(null);


const [loading,setLoading] =
useState(true);



useEffect(()=>{


async function loadBounty(){


try{


const response =
await fetch(
`/api/tester/bounties/${params.id}`,
{
credentials:"include",
cache:"no-store"
}
);


const data =
await response.json();



if (data.success && data.bounty) {

  setBounty(data.bounty);

} else {

  console.error(
    "Bounty loading failed:",
    data
  );

}



}
catch(error){

console.error(
error
);

}

finally{

setLoading(false);

}


}


loadBounty();


},[params.id]);




if(loading){

return (

<div className="hunter-dashboard">

Loading bounty...

</div>

);

}



if(!bounty){

return (

<div className="hunter-dashboard">

Bounty not found.

</div>

);

}



return (

<main className="hunter-main">


<button
className="back-button"
onClick={()=>router.back()}
>
← Back
</button>



<section className="bounty-detail-card">


<span className="portal-label">

ACTIVE SECURITY PROGRAM

</span>



<h1>

{bounty.title}

</h1>



<p className="detail-description">

{bounty.description}

</p>




<div className="detail-grid">


<div>

<span>
SEVERITY
</span>

<h3>
{bounty.severity}
</h3>

</div>



<div>

<span>
REWARD
</span>

<h3>
{formatEth(
bounty.total_escrow_wei
)}
ETH
</h3>

</div>



</div>





<section className="scope-section">


<h2>

Program Scope

</h2>


<p>

{bounty.scope}

</p>


</section>





<div className="rules-section">


<h2>

Research Guidelines

</h2>


<ul>

<li>
No social engineering
</li>

<li>
No denial of service attacks
</li>

<li>
Follow responsible disclosure
</li>

<li>
Provide reproducible evidence
</li>

</ul>


</div>




<button

className="submit-report-button"

onClick={()=>


router.push(
`/tester/bounties/${bounty.id}/report`
)

}

>

Submit Vulnerability Report

</button>



</section>


</main>

);


}