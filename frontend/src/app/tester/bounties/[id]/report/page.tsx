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



async function submitReport(){


setLoading(true);

setMessage("");

try{


const response =
await fetch(
"/api/tester/reports",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

credentials:"include",

body:JSON.stringify({

bountyId,

title,

severity,

description,

stepsToReproduce:steps,

evidence

})

}
);



const data =
await response.json();



if(!response.ok){

throw new Error(
data.message ??
"Report submission failed"
);

}



setMessage(
"Report submitted successfully"
);



setTimeout(()=>{

router.push(
"/tester/dashboard"
);

},1500);



}
catch(error){

setMessage(
error instanceof Error
?
error.message
:
"Something went wrong"
);

}

finally{

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