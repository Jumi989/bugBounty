"use client";

import { useState } from "react";
import { ethers } from "ethers";

export default function BugHunterRegisterPage() {

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [success, setSuccess] = useState(false);


  async function registerBugHunter() {

    try {

      setLoading(true);
      setMessage("");


      if (!window.ethereum) {
        throw new Error(
          "MetaMask is required."
        );
      }


      const provider =
        new ethers.BrowserProvider(
          window.ethereum
        );


      const signer =
        await provider.getSigner();


      const walletAddress =
        await signer.getAddress();



      // STEP 1:
      // Request registration challenge

      const challengeResponse =
        await fetch(
          "/api/tester/register/challenge",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({

              walletAddress,

              username,

              email,

            }),

          }
        );


      const challenge =
        await challengeResponse.json();



      if (!challenge.success) {

        throw new Error(
          challenge.message
        );

      }




      // STEP 2:
      // Sign wallet challenge

      const signature =
        await signer.signMessage(
          challenge.challengeMessage
        );





      // STEP 3:
      // Verify registration

      const verifyResponse =
        await fetch(
          "/api/tester/register/verify",
          {

            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },


            body: JSON.stringify({

              challengeId:
                challenge.challengeId,

              walletAddress,

              username,

              email,

              signature,

            }),

          }
        );



      const result =
        await verifyResponse.json();




      if (!result.success) {

        throw new Error(
          result.message
        );

      }



      setSuccess(true);


    }

    catch(error) {


      setMessage(

        error instanceof Error
          ?
          error.message
          :
          "Registration failed."

      );


    }

    finally {

      setLoading(false);

    }

  }





  return (

    <main className="registration-page">


      <header className="registration-header">


        <div className="registration-wordmark">


          <span>
            BB
          </span>


          <div>

            <strong>
              BUGBOUNTY
            </strong>


            <small>
              SECURITY NETWORK
            </small>


          </div>


        </div>



        <a
          href="/"
          className="back-link"
        >
          BACK TO HOME
        </a>


      </header>





      <section className="registration-layout">



        <div className="registration-intro">


          <p className="registration-number">
            02 / BUG HUNTER
          </p>



          <p className="registration-eyebrow">
            BUG HUNTER REGISTRATION
          </p>




          <h1>

            Become a

            <br />

            <em>
              Bug Hunter
            </em>

          </h1>





          <p className="registration-copy">

            Join the BugBounty community.
            Discover vulnerabilities, submit security
            reports, and earn rewards through a
            transparent blockchain-powered bounty system.

          </p>





          <div className="registration-process">



            <div>

              <span>
                01
              </span>


              <p>
                Create your Bug Hunter identity
              </p>


            </div>





            <div>

              <span>
                02
              </span>


              <p>
                Verify your wallet ownership
              </p>


            </div>





            <div>

              <span>
                03
              </span>


              <p>
                Hunt bugs and earn rewards
              </p>


            </div>



          </div>



        </div>








        <div className="registration-card">



          <div className="registration-card-title">


            <div>

              <p>
                CREATE HUNTER PROFILE
              </p>


              <h2>
                Bug Hunter
              </h2>


            </div>



            <span>
              STEP 01
            </span>


          </div>






          {
            success ?


            (

              <div className="registration-complete">


                <div className="complete-check">
                  ✓
                </div>



                <h2>
                  Welcome Bug Hunter
                </h2>




                <p>

                  Your Bug Hunter identity has been
                  created successfully. You can now
                  discover vulnerabilities and participate
                  in active bounty programs.

                </p>



              </div>


            )



            :



            (



              <div className="registration-form">



                <div className="registration-field">


                  <label>
                    Username
                  </label>



                  <input

                    placeholder="Enter hunter name"

                    value={username}

                    onChange={
                      (e)=>
                        setUsername(
                          e.target.value
                        )
                    }

                  />


                </div>







                <div className="registration-field">


                  <label>
                    Email Address
                  </label>



                  <input

                    placeholder="Enter email"

                    type="email"

                    value={email}

                    onChange={
                      (e)=>
                        setEmail(
                          e.target.value
                        )
                    }

                  />


                </div>







                <button

                  className="registration-submit"

                  disabled={loading}

                  onClick={
                    registerBugHunter
                  }

                >


                  {

                    loading

                    ?

                    "VERIFYING WALLET..."

                    :

                    "CONNECT WALLET & JOIN"

                  }



                </button>







                <p className="registration-signature-note">

                  A wallet signature is required
                  to prove ownership.

                </p>







                {

                  message &&


                  <div className="registration-error">


                    <strong>
                      ERROR
                    </strong>


                    <p>
                      {message}
                    </p>



                  </div>


                }




              </div>



            )


          }




        </div>





      </section>



    </main>

  );


}