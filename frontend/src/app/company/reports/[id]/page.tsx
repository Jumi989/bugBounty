"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";


type Report = {
  id:number;
  title:string;
  severity:string;
  bounty_title:string;
  researcher_name:string;
  description:string;
  steps_to_reproduce:string;
  evidence_url:string | null;
  status:string;
  created_at:string;
};


export default function ReportReviewPage(){

const params = useParams();

const router = useRouter();

const id = params.id;


const [report,setReport] =
useState<Report | null>(null);


const [loading,setLoading] =
useState(true);


const [message,setMessage] =
useState("");



useEffect(()=>{


async function loadReport(){


const response =
await fetch(
`/api/company/reports/${id}`,
{
credentials:"include",
cache:"no-store"
}
);


const data =
await response.json();


if(data.success){

setReport(data.report);

}


setLoading(false);

}


loadReport();


},[id]);




async function updateStatus(
status:string
){


const response =
await fetch(
`/api/company/reports/${id}`,
{
method:"PATCH",
headers:{
"Content-Type":"application/json"
},
credentials:"include",

body:JSON.stringify({
status
})

}
);


const data =
await response.json();


if(data.success){

setMessage(
`Report ${status}`
);

setReport({
...report!,
status
});

}

}




if(loading){

return <p>Loading report...</p>;

}



if(!report){

return <p>
Report not found.
</p>;

}



return (

<section className="report-review-page">


<div className="report-header">

<p className="dashboard-eyebrow">
REPORT REVIEW
</p>

<h1>
{report.title}
</h1>

</div>



<div className="report-summary-card">


<div className="report-meta">

<div>
<span>SEVERITY</span>
<h3 className="severity-text">
{report.severity}
</h3>
</div>


<div>
<span>PROGRAM</span>
<h3>
{report.bounty_title}
</h3>
</div>


<div>
<span>RESEARCHER</span>
<h3>
{report.researcher_name}
</h3>
</div>


<div>
<span>STATUS</span>
<h3>
{report.status}
</h3>
</div>


</div>


</div>





<div className="report-body-card">


<h2>
Vulnerability Description
</h2>

<p>
{report.description}
</p>



<h2>
Steps To Reproduce
</h2>


<p>
{report.steps_to_reproduce}
</p>



{
report.evidence_url &&

<div className="evidence-box">

<h2>
Evidence
</h2>


<a
href={report.evidence_url}
target="_blank"
>
View Evidence →
</a>

</div>

}



</div>




<div className="review-actions">


<button
className="accept-btn"
onClick={()=>
updateStatus("accepted")
}
>
Accept Report
</button>



<button
className="reject-btn"
onClick={()=>
updateStatus("rejected")
}
>
Reject Report
</button>


</div>


<p className="action-message">
{message}
</p>



</section>

);

}