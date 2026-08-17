import { PinataSDK } from "pinata";

export function getPinata(): PinataSDK {
  const jwt =
    process.env.PINATA_JWT;

  const gateway =
    process.env.PINATA_GATEWAY;

  if (!jwt) {
    throw new Error(
      "PINATA_JWT is missing from environment."
    );
  }

  if (!gateway) {
    throw new Error(
      "PINATA_GATEWAY is missing from environment."
    );
  }

  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  });
}