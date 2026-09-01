"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";


type Participant = {
  id: string;
  walletAddress: string;
  role: string;
  display_name: string;
  email: string | null;
  active: boolean;
  verified: boolean;
};


type SessionResponse = {
  success: boolean;
  authenticated: boolean;
  participant?: Participant;
};

type Bounty = {
  id: string;
  bounty_id: string;
  title: string;
  description: string;
  severity: string;
  scope: string;
  total_escrow_wei: string;
  available_escrow_wei: string;
  end_time: string;
};



export default function TesterDashboard() {


  const router = useRouter();


  const [participant, setParticipant] =
    useState<Participant | null>(null);


  const [loading, setLoading] =
    useState(true);


  const [sidebarOpen, setSidebarOpen] =
    useState(false);


  const [showWelcome, setShowWelcome] =
    useState(false);

  const [bounties, setBounties] =
    useState<Bounty[]>([]);

  async function connectWallet() {


    if (!window.ethereum) {

      alert(
        "MetaMask is not installed"
      );

      return;

    }


    await window.ethereum.request({

      method:
        "eth_requestAccounts",

    });


  }

function formatEth(wei: string | number): string {
  return (Number(wei) / 1e18).toFixed(2);
}


  useEffect(() => {


    async function loadSession() {


      try {


        const response =
          await fetch(
            "/api/tester/auth/me",
            {
              credentials:
                "include",

              cache:
                "no-store",
            }
          );



        const data =
          (await response.json()) as SessionResponse;




        if (

          !response.ok ||

          !data.success ||

          !data.authenticated ||

          !data.participant

        ) {


          router.replace(
            "/tester/sign-in"
          );


          return;

        }




        setParticipant(
          data.participant
        );





        const welcomeShown =
          sessionStorage.getItem(
            "hunterWelcome"
          );




        if (!welcomeShown) {


          setShowWelcome(true);


          sessionStorage.setItem(
            "hunterWelcome",
            "true"
          );


        }





      }

      catch {


        router.replace(
          "/tester/sign-in"
        );


      }


      finally {


        setLoading(false);


      }


    }

    async function loadBounties(){

 const response =
 await fetch(
 "/api/tester/bounties",
 {
  credentials:"include",
  cache:"no-store"
 }
 );

 const data =
 await response.json();

 if(data.success){
   setBounties(data.bounties);
 }

}

loadBounties();




    loadSession();



  }, [router]);






  if (loading) {


    return (

      <div className="hunter-dashboard">

        Loading...

      </div>

    );


  }




  if (!participant) {


    return null;


  }





  return (



    <div className="hunter-dashboard">





      {/* TOP BAR */}


      <header className="dashboard-header">



        <div className="header-left">
                <button

            className="menu-button"

            onClick={() =>
              setSidebarOpen(true)
            }

          >

            ☰

          </button>
          <div className="hunter-brand">

            
            <h2 className="brand-title">

              BUG BOUNTY

            </h2>



            <p className="brand-subtitle">

              JOURNAL

            </p>


          </div>



        </div>







        <div className="user-profile">


          <strong>

            {participant.display_name}

          </strong>


          <span>

            ● Active

          </span>
        </div>



      </header>









      {/* SIDEBAR */}



      {sidebarOpen && (


        <>


          <div

            className="sidebar-overlay"

            onClick={() =>
              setSidebarOpen(false)
            }

          />





          <aside className="sidebar-drawer">


            <div className="drawer-header">


              <h2>

                BUG BOUNTY

              </h2>


              <p>

                JOURNAL

              </p>


            </div>





            <nav>


              <a>

                Dashboard

              </a>


              <a>

                Bounties

              </a>


              <a>

                My Reports

              </a>





              <button

                onClick={connectWallet}

              >

                Wallet

              </button>


            </nav>







            <div className="drawer-divider" />






            <small>

              ACCOUNT

            </small>





            <nav>



              <a>

                Profile Settings

              </a>




              <a>

                Account Settings

              </a>





              <button

                onClick={() =>

                  router.push(
                    "/api/auth/logout"
                  )

                }

              >

                Logout

              </button>



            </nav>



          </aside>


        </>


      )}












      {/* MAIN DASHBOARD */}



      <main className="hunter-main">





        <section className="hunter-hero">



          <div>


            <span className="portal-label">

              BUG HUNTER PORTAL

            </span>




            <h1>

              Dashboard

            </h1>




            <p>

              Discover security programs,
              submit vulnerability reports,
              and earn rewards through
              responsible disclosure.

            </p>



          </div>



        </section>









        <section className="dashboard-grid">






          {/* BOUNTIES */}



          <div className="content-card">



            <div className="content-card-header">


              <h2>

                Available Bounties

              </h2>



            </div>





<div className="bounty-list">

{
bounties.length === 0 ? (

<div className="empty-state">

<div className="empty-state-icon">
+
</div>

<h3>
No active programs yet
</h3>

<p>
Active security programs will appear here.
</p>

</div>

)

:

bounties.map((bounty)=> (

<article
key={bounty.id}
className="bounty-card"

onClick={() =>
router.push(
`/tester/bounties/${bounty.id}`
)
}

>


<div className="bounty-header">

<span className="bounty-tag">
ACTIVE PROGRAM
</span>


<span className="severity">
{bounty.severity}
</span>

</div>



<h3>
{bounty.title}
</h3>


<p className="bounty-description">

{bounty.description}

</p>



<div className="bounty-details">


<div>

<span>
SCOPE
</span>

<p>
{bounty.scope}
</p>

</div>



<div>

<span>
REWARD
</span>

<p>
{formatEth(bounty.total_escrow_wei)}
ETH
</p>

</div>


</div>



<button
className="view-program"
>

View Program →

</button>


</article>

))

}

</div>




          </div>












          {/* PROGRESS */}



          <div className="content-card">



            <div className="content-card-header">


              <h2>

                Research Progress

              </h2>



            </div>






            <div className="progress-area">



              <div className="progress-item">


                <span>

                  Reports Submitted

                </span>


                <strong>

                  0

                </strong>


              </div>






              <div className="progress-item">


                <span>

                  Accepted Reports

                </span>


                <strong>

                  0

                </strong>


              </div>







              <div className="progress-item">


                <span>

                  Reputation

                </span>


                <strong>

                  0

                </strong>


              </div>




            </div>




          </div>






        </section>






      </main>









      {/* WELCOME POPUP */}



      {showWelcome && (



        <div className="welcome-overlay">



          <div className="welcome-modal">



            <span>

              BUG HUNTER ACCESS

            </span>




            <h1>

              Welcome back,

              <br />

              {participant.display_name}

            </h1>




            <p className="active-status">

              ● Active Account

            </p>





            <button

              onClick={() =>
                setShowWelcome(false)
              }

            >

              Continue

            </button>



          </div>



        </div>



      )}





    </div>


  );

}