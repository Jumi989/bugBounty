import "dotenv/config";
import fs from "fs";

async function main() {
  const report = {
    title: "SQL Injection in Login Page",
    bugType: "SQL Injection",
    description: "The login form is vulnerable to SQL injection.",
    steps: [
      "Open login page",
      "Enter payload in username field",
      "Observe database error",
    ],
    severity: "High",
  };

  fs.writeFileSync("bug-report.json", JSON.stringify(report, null, 2));

  const formData = new FormData();
  const file = new Blob([fs.readFileSync("bug-report.json")], {
    type: "application/json",
  });

  formData.append("file", file, "bug-report.json");

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${await response.text()}`);
  }

  const result: any = await response.json();

  console.log("IPFS CID:", result.IpfsHash);
  console.log("Evidence CID:", `ipfs://${result.IpfsHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});