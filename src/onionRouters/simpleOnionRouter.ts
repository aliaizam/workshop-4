import bodyParser from "body-parser";
import express from "express";
import axios, { AxiosResponse } from "axios";
import { BASE_ONION_ROUTER_PORT, REGISTRY_PORT } from "../config";

export async function simpleOnionRouter(nodeId: number) {
  const onionRouter = express();
  onionRouter.use(express.json());
  onionRouter.use(bodyParser.json());

  let lastReceivedEncryptedMessage: string | null = null;
  let lastReceivedDecryptedMessage: string | null = null;
  let lastMessageDestination: number | null = null;

  onionRouter.get("/status", (req, res) => {
    res.json({ status: "live" });
  });

  onionRouter.get("/getLastReceivedEncryptedMessage", (req, res) => {
    res.json({ result: lastReceivedEncryptedMessage });
  });

  onionRouter.get("/getLastReceivedDecryptedMessage", (req, res) => {
    res.json({ result: lastReceivedDecryptedMessage });
  });

  onionRouter.get("/getLastMessageDestination", (req, res) => {
    res.json({ result: lastMessageDestination });
  });

  axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, {
    nodeId: nodeId,
    pubKey: "public_key_here", // You may need to replace this with the actual public key
    privateKey: "private_key_here" // You may need to replace this with the actual private key
  })
  .then((res: AxiosResponse) => {
    console.log(res.data);
  })
  .catch(error => {
    console.error("Error registering node:", error);
  });
  const server = onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
    console.log(
      `Onion router ${nodeId} is listening on port ${
        BASE_ONION_ROUTER_PORT + nodeId
      }`
    );
  });

  return server;
}
