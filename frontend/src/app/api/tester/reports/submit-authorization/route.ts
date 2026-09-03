import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ethers } from "ethers";
import { database } from "@/lib/database";

export const runtime = "nodejs";

type SessionPayload = {
  participantId?: string;
  walletAddress?: string;
  role?: string;
};

const ESCROW_ABI = [
  "function authorizationNonces(address) view returns (uint256)",

  "function trustedVerifier() view returns (address)",

  "function hashSubmitBugAction(uint256 bountyId,bytes32 reportHash,string encryptedEvidenceCID,uint256 requestedReward) view returns (bytes32)",

  "function getBounty(uint256 bountyId) view returns (tuple(address company,bytes32 companyOrganizationId,bytes32 metadataHash,string metadataCID,uint256 totalEscrow,uint256 availableEscrow,uint64 startTime,uint64 endTime,uint64 refundAvailableAt,uint8 status))",
];

const TESTER_ROLE = 2;
const SUBMIT_BUG_ACTION = 2;

export async function POST(request: Request) {
  try {
    // =====================================================
    // 1. ENVIRONMENT
    // =====================================================

    const sessionSecret =
      process.env.AUTH_SESSION_SECRET;

    const rpcUrl =
      process.env.RPC_URL;

    const contractAddress =
      process.env.BUG_BOUNTY_ESCROW_ADDRESS;

    const verifierPrivateKey =
      process.env.TRUSTED_VERIFIER_PRIVATE_KEY;

    if (!sessionSecret) {
      throw new Error(
        "AUTH_SESSION_SECRET is missing"
      );
    }

    if (!rpcUrl) {
      throw new Error(
        "RPC_URL is missing"
      );
    }

    if (!contractAddress) {
      throw new Error(
        "BUG_BOUNTY_ESCROW_ADDRESS is missing"
      );
    }

    if (!verifierPrivateKey) {
      throw new Error(
        "TRUSTED_VERIFIER_PRIVATE_KEY is missing"
      );
    }

    // =====================================================
    // 2. AUTHENTICATE BUG HUNTER
    // =====================================================

    const cookieStore = await cookies();

    const token =
      cookieStore.get(
        "bugbounty_session"
      )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Not authenticated.",
        },
        { status: 401 }
      );
    }

    const verified =
      await jwtVerify(
        token,
        new TextEncoder().encode(
          sessionSecret
        ),
        {
          algorithms: ["HS256"],
        }
      );

    const session =
      verified.payload as SessionPayload;

    if (
      session.role !== "tester" ||
      !session.participantId ||
      !session.walletAddress
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Not authenticated as Bug Hunter.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 3. LOAD TESTER FROM DATABASE
    // =====================================================

    const testerResult =
      await database.query(
        `
        SELECT
          id,
          wallet_address,
          organization_id,
          participant_type,
          active,
          verified
        FROM participants
        WHERE id = $1
        LIMIT 1
        `,
        [session.participantId]
      );

    if (
      testerResult.rowCount !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tester account not found.",
        },
        { status: 404 }
      );
    }

    const tester =
      testerResult.rows[0];

    if (
      Number(
        tester.participant_type
      ) !== 2
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Account is not a Bug Hunter.",
        },
        { status: 403 }
      );
    }

    if (
      !tester.active ||
      !tester.verified
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Bug Hunter account is inactive or unverified.",
        },
        { status: 403 }
      );
    }

    if (
      tester.wallet_address.toLowerCase() !==
      session.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Session wallet does not match tester wallet.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 4. READ REQUEST
    // =====================================================

    const body =
      await request.json();

    const {
      bountyId: metadataId,
      reportId,
      reportHash: browserReportHash,
    } = body;

    if (
      !metadataId ||
      !reportId ||
      !browserReportHash
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing authorization information.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 5. LOAD THE REPORT FROM DATABASE
    //
    // DO NOT TRUST bountyId/reportHash FROM BROWSER.
    // =====================================================

    const reportResult =
      await database.query(
        `
        SELECT
          vr.id,
          vr.bounty_db_id,
          vr.tester_id,
          vr.tester_wallet,
          vr.report_hash,

          b.id AS bounty_database_id,
          b.bounty_id AS onchain_bounty_id,
          b.chain_id,
          b.escrow_address,
          b.company_address

        FROM vulnerability_reports vr

        JOIN bounties b
          ON b.id = vr.bounty_db_id

        JOIN bounty_metadata m
          ON m.bounty_id = b.id

        WHERE
          vr.id = $1
          AND vr.tester_id = $2
          AND m.id = $3

        LIMIT 1
        `,
        [
          reportId,
          tester.id,
          metadataId,
        ]
      );

    if (
      reportResult.rowCount !== 1
    ) {
      console.error(
        "REPORT/BOUNTY LOOKUP FAILED:",
        {
          reportId,
          testerId: tester.id,
          metadataId,
        }
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Report and bounty relationship could not be verified.",
        },
        { status: 404 }
      );
    }

    const report =
      reportResult.rows[0];

    // =====================================================
    // 6. VERIFY REPORT HASH
    // =====================================================

    if (
      String(
        browserReportHash
      ).toLowerCase() !==
      String(
        report.report_hash
      ).toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Report hash does not match the database.",
        },
        { status: 400 }
      );
    }

    const reportHash =
      String(
        report.report_hash
      );

    if (
      !ethers.isHexString(
        reportHash,
        32
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Stored report hash is invalid.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 7. GET ACTUAL ON-CHAIN BOUNTY ID
    // =====================================================

    const onchainBountyId =
      String(
        report.onchain_bounty_id
      );

    if (
      !onchainBountyId ||
      onchainBountyId === "0"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This report is not linked to a valid on-chain bounty.",
        },
        { status: 400 }
      );
    }

    console.log(
      "BOUNTY ID MAPPING:",
      {
        metadataId: String(
          metadataId
        ),

        reportId: String(
          reportId
        ),

        databaseBountyId:
          String(
            report.bounty_database_id
          ),

        onchainBountyId,
      }
    );

    // =====================================================
    // 8. CONNECT TO BESU CONTRACT
    // =====================================================

    const provider =
      new ethers.JsonRpcProvider(
        rpcUrl
      );

    const escrow =
      new ethers.Contract(
        contractAddress,
        ESCROW_ABI,
        provider
      );

    // =====================================================
    // 9. READ LIVE ON-CHAIN BOUNTY
    // =====================================================

    const bounty =
      await escrow.getBounty(
        onchainBountyId
      );

    console.log(
      "LIVE ON-CHAIN BOUNTY:",
      {
        company:
          bounty.company,

        companyOrganizationId:
          bounty.companyOrganizationId,

        totalEscrow:
          bounty.totalEscrow.toString(),

        availableEscrow:
          bounty.availableEscrow.toString(),

        startTime:
          bounty.startTime.toString(),

        endTime:
          bounty.endTime.toString(),

        status:
          bounty.status,
      }
    );

    // Contract enum:
    //
    // None = 0
    // Open = 1
    // Closed = 2
    // Cancelled = 3

    if (
      Number(bounty.status) !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This bounty is not open.",
        },
        { status: 400 }
      );
    }

    const now =
      Math.floor(
        Date.now() / 1000
      );

    if (
      BigInt(now) <
      BigInt(bounty.startTime)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This bounty has not started yet.",
        },
        { status: 400 }
      );
    }

    if (
      BigInt(now) >
      BigInt(bounty.endTime)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "This bounty has expired.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 10. MAKE SURE TESTER IS NOT THE COMPANY
    // =====================================================

    if (
      tester.wallet_address.toLowerCase() ===
      bounty.company.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The bounty owner cannot submit a report to their own bounty.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 11. ORGANIZATION ID
    // =====================================================

    const organizationId =
  tester.organization_id &&
  ethers.isHexString(
    String(tester.organization_id),
    32
  )
    ? String(tester.organization_id)
    : ethers.keccak256(
        ethers.toUtf8Bytes(
          "tester:" +
            tester.wallet_address.toLowerCase()
        )
      );

    // =====================================================
    // 12. REQUESTED REWARD
    // =====================================================

    const requestedRewardWei =
      ethers.parseEther(
        "0.25"
      );

    if (
      requestedRewardWei === 0n
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Requested reward must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (
      requestedRewardWei >
      BigInt(
        bounty.availableEscrow
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Requested reward exceeds available bounty escrow.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 13. EVIDENCE CID
    //
    // The contract only requires a non-empty string.
    // =====================================================

    const encryptedEvidenceCID =
      "ipfs://";

    // =====================================================
    // 14. CALCULATE THE ACTION HASH
    //
    // IMPORTANT:
    //
    // We ask the DEPLOYED CONTRACT itself to calculate
    // the hash.
    //
    // This completely removes any frontend/backend
    // encoding mismatch.
    // =====================================================

    const actionHash =
      await escrow.hashSubmitBugAction(
        onchainBountyId,
        reportHash,
        encryptedEvidenceCID,
        requestedRewardWei
      );

    console.log(
      "CONTRACT ACTION HASH:",
      actionHash
    );

    // =====================================================
    // 15. GET CURRENT AUTHORIZATION NONCE
    // =====================================================

    const nonce =
      await escrow.authorizationNonces(
        tester.wallet_address
      );

    console.log(
      "AUTHORIZATION NONCE:",
      nonce.toString()
    );

    // =====================================================
    // 16. DEADLINE
    // =====================================================

    const deadline =
      BigInt(
        Math.floor(
          Date.now() / 1000
        ) + 15 * 60
      );

    // =====================================================
    // 17. BUILD EXACT AUTHORIZATION
    // =====================================================

    const authorization = {
      user:
        tester.wallet_address,

      role:
        TESTER_ROLE,

      organizationId,

      action:
        SUBMIT_BUG_ACTION,

      actionHash,

      nonce,

      deadline,
    };

    console.log(
      "AUTHORIZATION TO SIGN:",
      {
        user:
          authorization.user,

        role:
          authorization.role,

        organizationId:
          authorization.organizationId,

        action:
          authorization.action,

        actionHash:
          authorization.actionHash,

        nonce:
          authorization.nonce.toString(),

        deadline:
          authorization.deadline.toString(),
      }
    );

    // =====================================================
    // 18. EIP-712 DOMAIN
    // =====================================================

    const domain = {
      name:
        "BugBountyEscrow",

      version:
        "1",

      chainId:
        2026,

      verifyingContract:
        contractAddress,
    };

    // =====================================================
    // 19. EIP-712 TYPES
    // =====================================================

    const types = {
      Authorization: [
        {
          name:
            "user",

          type:
            "address",
        },

        {
          name:
            "role",

          type:
            "uint8",
        },

        {
          name:
            "organizationId",

          type:
            "bytes32",
        },

        {
          name:
            "action",

          type:
            "uint8",
        },

        {
          name:
            "actionHash",

          type:
            "bytes32",
        },

        {
          name:
            "nonce",

          type:
            "uint256",
        },

        {
          name:
            "deadline",

          type:
            "uint256",
        },
      ],
    };

    // =====================================================
    // 20. CREATE TRUSTED VERIFIER
    // =====================================================

    const verifier =
      new ethers.Wallet(
        verifierPrivateKey,
        provider
      );

    // =====================================================
    // 21. VERIFY VERIFIER ADDRESS
    // =====================================================

    const trustedVerifier =
      await escrow.trustedVerifier();

    console.log(
      "CONTRACT TRUSTED VERIFIER:",
      trustedVerifier
    );

    console.log(
      "BACKEND VERIFIER:",
      verifier.address
    );

    if (
      trustedVerifier.toLowerCase() !==
      verifier.address.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Backend verifier does not match the trusted verifier configured in the deployed escrow contract.",

          debug: {
            contractTrustedVerifier:
              trustedVerifier,

            backendVerifier:
              verifier.address,
          },
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 22. SIGN EIP-712 AUTHORIZATION
    // =====================================================

    const signature =
      await verifier.signTypedData(
        domain,
        types,
        authorization
      );

    // =====================================================
    // 23. VERIFY SIGNATURE LOCALLY
    // =====================================================

    const recovered =
      ethers.verifyTypedData(
        domain,
        types,
        authorization,
        signature
      );

    console.log(
      "RECOVERED SIGNER:",
      recovered
    );

    if (
      recovered.toLowerCase() !==
      verifier.address.toLowerCase()
    ) {
      throw new Error(
        "EIP-712 signature verification failed on backend."
      );
    }

    // =====================================================
    // 24. RETURN EVERYTHING REQUIRED BY FRONTEND
    // =====================================================

    return NextResponse.json({
      success: true,

      onchainBountyId,

      requestedRewardWei:
        requestedRewardWei.toString(),

      encryptedEvidenceCID,

      authorization: {
        user:
          authorization.user,

        role:
          authorization.role,

        organizationId:
          authorization.organizationId,

        action:
          authorization.action,

        actionHash:
          authorization.actionHash,

        nonce:
          authorization.nonce.toString(),

        deadline:
          authorization.deadline.toString(),
      },

      signature,

      contract: {
        address:
          contractAddress,

        chainId:
          "2026",
      },
    });

  } catch (error) {
    console.error(
      "SUBMIT AUTHORIZATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          error instanceof Error
            ? error.message
            : "Failed to create authorization.",
      },
      {
        status: 500,
      }
    );
  }
}