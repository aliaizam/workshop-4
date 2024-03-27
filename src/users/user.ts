import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT, REGISTRY_PORT  } from "../config";
import axios from "axios";
import * as crypto from "../crypto";
import {Node} from ".././registry/registry"
/*import {
  generateRsaKeyPair,
  exportPubKey,
  symEncrypt,
  rsaEncrypt,
} from "../crypto";*/

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

type MessageBody = {
  message: string;
};

let lastReceivedMessage: string | null = null;
let lastSentMessage: string | null = null;

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  _user.get("/status", (req, res) => {
    res.send("live");
  });

  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  _user.get("/getLastSentMessage", (req, res) => {
    // Renvoyer le dernier message envoyé
    res.json({ result: lastSentMessage });
  });

  _user.post("/message", express.json(), async (req, res) => {
    const { message } = req.body as MessageBody;
    lastReceivedMessage = message;
    res.sendStatus(200);
  });

  _user.post("/sendMessage", express.json(), async (req, res) => {
    try {
      const { message, destinationUserId } = req.body as SendMessageBody;

      // Generate RSA key pair for each node
      const { publicKey: userPublicKey, privateKey: userPrivateKey } = await crypto.generateRsaKeyPair();
      const { publicKey: registryPublicKey } = await crypto.generateRsaKeyPair();
      const { publicKey: node1PublicKey } = await crypto.generateRsaKeyPair();
      const { publicKey: node2PublicKey } = await crypto.generateRsaKeyPair();
      const { publicKey: node3PublicKey } = await crypto.generateRsaKeyPair();

      // Export public keys
      const userPubKey = await crypto.exportPubKey(userPublicKey);
      const registryPubKey = await crypto.exportPubKey(registryPublicKey);
      const node1PubKey = await crypto.exportPubKey(node1PublicKey);
      const node2PubKey = await crypto.exportPubKey(node2PublicKey);
      const node3PubKey = await crypto.exportPubKey(node3PublicKey);

      // Register user's public key with the registry
      await axios.post(`http://localhost:${REGISTRY_PORT}/registerNode`, {
        nodeId: userId,
        pubKey: userPubKey,
        privateKey: await crypto.exportPrvKey(userPrivateKey),
      });

      // Retrieve the node registry
      const nodeRegistry = await axios.get(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`);

      // Select 3 distinct nodes randomly from the registry
      const nodes = nodeRegistry.data.nodes;
      const selectedNodes: Node[] = [];
      while (selectedNodes.length < 3) {
        const randomIndex = Math.floor(Math.random() * nodes.length);
        const selectedNode = nodes[randomIndex];
        if (selectedNode.nodeId !== userId && !selectedNodes.includes(selectedNode)) {
          selectedNodes.push(selectedNode);
        }
      }

      // Create unique symmetric keys for each node
      const symKeys = await Promise.all(selectedNodes.map(() => crypto.createRandomSymmetricKey()));

      // Create layers of encryption
      let encryptedMessage = message;
      for (let i = 0; i < selectedNodes.length; i++) {
        const destination = selectedNodes[i].nodeId.toString().padStart(10, "0");
        
        // Encrypt message with symmetric key
        const encryptedData = await crypto.symEncrypt(symKeys[i], encryptedMessage);

        // Encrypt symmetric key with node's public key
        const encryptedSymKey = await crypto.rsaEncrypt(await crypto.exportPubKey(selectedNodes[i].pubKey), await crypto.exportSymKey(symKeys[i]));

        // Concatenate encrypted symmetric key with encrypted message
        encryptedMessage = encryptedSymKey + encryptedData;
      }

      // Forward the encrypted message to the entry node
      await axios.post(`http://localhost:${BASE_USER_PORT + selectedNodes[0].nodeId}/message`, {
        message: encryptedMessage,
      });

      res.sendStatus(200);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}

