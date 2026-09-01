"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


type VulnerabilityReport = {
  id:number;
  title:string;
  severity:string;
  bounty_title:string;
  researcher_name:string | null;
  status:string;
  created_at:string;
};


export default function SubmissionsPage() {

  const router = useRouter();

  const [reports, setReports] =
    useState<VulnerabilityReport[]>([]);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {

    async function loadReports() {

      try {

        const response =
          await fetch(
            "/api/company/reports",
            {
              credentials: "include",
              cache: "no-store"
            }
          );


        const data =
          await response.json();


        if(data.success){

          setReports(data.reports);

        }

      } catch(error){

        console.error(
          "Failed loading reports:",
          error
        );

      } finally {

        setLoading(false);

      }

    }


    loadReports();


  }, []);



  if(loading){

    return (
      <section className="submissions-page">
        <p>
          Loading submissions...
        </p>
      </section>
    );

  }



  return (

    <section className="submissions-page">


      <div className="submissions-header">

        <p className="dashboard-eyebrow">
          INCOMING REPORTS
        </p>


        <h1>
          SECURITY
          <br/>
          RESEARCHER
          <br/>
          SUBMISSIONS
        </h1>


        <p>
          Review vulnerability reports submitted by Bug Hunters.
        </p>

      </div>



<div className="reports-list">

{
reports.length === 0 ? (

<div className="empty-state">

<h3>
No reports submitted yet.
</h3>

</div>

)

:

reports.map((report)=>(

<article
key={report.id}
className="report-row"
>


<div className="severity-column">

<span
className={
report.severity.toLowerCase()
}
>
● {report.severity}
</span>

</div>



<div className="report-information">


<h2>
{report.title}
</h2>


<p>
Program:
<strong>
{" "}
{report.bounty_title}
</strong>
</p>



<p>
Researcher:
{" "}
<strong>
{
report.researcher_name ??
"Anonymous Hunter"
}
</strong>
</p>



<p>
Status:
<strong>
{" "}
{report.status}
</strong>
</p>



<p>
Submitted:
{" "}
{
new Date(
report.created_at
).toLocaleDateString()
}
</p>


</div>




<div className="report-action">


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


</div>


</article>

))

}

</div>



    </section>

  );

}